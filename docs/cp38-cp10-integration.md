# CP38 & CP10 — Email and Jira Integration (Technical Reference)

This document covers how the CP38 (UAT sign-off) and CP10 (CAB approval) checkpoints
technically integrate with Microsoft Graph (email) and Atlassian Rovo MCP (Jira),
including credentials, subject-line conventions, edge cases, and where each piece
of logic lives in the codebase.

Both checkpoints share one architectural rule, enforced in code, not just by
convention: **identity/eligibility checks are always deterministic string
comparisons. The LLM is only ever asked to classify language, and only after
every check ahead of it has already passed.** This document calls out exactly
where that boundary sits for each integration.

---

## 1. Email integration (Microsoft Graph)

### 1.1 Authentication — app-only `client_credentials`

No user interaction required; this is a service-to-service credential.

- **File:** [`src/lib/graph-auth.ts`](../src/lib/graph-auth.ts) — `getGraphAccessToken()`
- **Flow:** OAuth2 `client_credentials` grant against
  `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`
- **Scope requested:** `https://graph.microsoft.com/.default` (uses whatever
  Application permissions are admin-consented on the Azure AD app registration)
- **Credentials (`.env`, git-ignored):**

  | Variable | Purpose |
  |---|---|
  | `MS_TENANT_ID` | Azure AD tenant ID |
  | `MS_CLIENT_ID` | App registration client ID |
  | `MS_CLIENT_SECRET` | App registration client secret (rotate if ever exposed) |
  | `MS_SHARED_MAILBOX` | Mailbox both CP38 and CP10 search. Falls back to `MS_TEST_MAILBOX` if unset |

- **Required Azure AD Application permissions (admin-consented):** `User.Read.All`
  or `Directory.Read.All` (directory access, used by the connector health-check),
  `Mail.Read` (Application) for actually reading messages. No delegated/user
  consent is involved — the app can read **any mailbox in the tenant**, not
  just the one it's pointed at; this is worth knowing before widening scope.

### 1.2 Mailbox search mechanics

Both checkpoints use the same search shape against
`GET /v1.0/users/{mailbox}/messages`:

```
$search="subject:X"
$top=10
$select=id,from,body,subject,receivedDateTime
```
Headers: `Authorization: Bearer <token>`, `Prefer: outlook.body-content-type="text"`,
`ConsistencyLevel: eventual`.

**Important, hard-won detail:** Graph's `$search` is **fuzzy/relevance-ranked,
not exact-phrase matching**. It can return a message that only loosely shares
keywords with the query — this caused a real false-positive during testing
(an unrelated email surfaced ahead of the real one). The fix, present in both
`cp38-verify.ts` and `cp10-verify.ts`:

1. Pull up to 10 raw candidates from `$search`
2. **Client-side post-filter**: keep only messages whose `subject` field
   actually contains the configured phrase (case-insensitive substring)
3. Sort survivors by `receivedDateTime` descending, take the most recent

Graph also **disallows combining `$orderby` with `$search`** on this endpoint,
which is why sorting happens client-side instead of via the query.

### 1.3 Subject-line conventions

| Checkpoint | Subject must contain | Config location |
|---|---|---|
| CP38 | `"PIT Armour UAT Sign-off"` (one fixed phrase) | `subjectMatch` in [`cp38-config.ts`](../src/lib/cp38-config.ts) |
| CP10 | `"POC-3"` **or** `"PIT-Arnour CAB Approval"` (either matches) | `subjectMatches: string[]` in [`cp10-config.ts`](../src/lib/cp10-config.ts) |

CP10's multi-pattern case is built as an OR inside the KQL search string
(`subject:A OR subject:B`), then the same post-filter checks the subject
contains *any* of the configured phrases.

### 1.4 Deterministic sender check

This is the core guarantee — identity is never inferred by AI:

- **CP38:** `sender.toLowerCase() === cfg.authorizedEmail.toLowerCase()`, where
  `authorizedEmail` is static config (`cp38-config.ts`).
- **CP10:** `sender.toLowerCase() === reporterEmail.toLowerCase()`, where
  `reporterEmail` is read **dynamically from the Jira ticket** at check time
  (the ticket's Reporter field — see §2.5 for why this replaced the PRD's
  literal "CAB Approver custom field").

If this check fails, **the LLM step never runs** in either checkpoint — the
function returns immediately with a Pending result.

### 1.5 LLM approval-language classification

- **File:** [`src/lib/approval-classifier.ts`](../src/lib/approval-classifier.ts)
  — `classifyApprovalLanguage(body, subjectForContext)` — shared by both
  checkpoints, one implementation, not duplicated.
- **Model:** Groq's free-tier hosting of OpenAI's open-weight `gpt-oss-20b`,
  via an OpenAI-compatible chat completions API (`https://api.groq.com/openai/v1/chat/completions`).
- **Credential:** `GROQ_API_KEY` in `.env` (free tier key from console.groq.com).
- **Prompt contract:** strict one-line JSON output, `{"explicit": boolean, "confidence": number}`.
- **Failure handling:** if the model's response can't be parsed as that JSON
  shape, the function returns `{explicit: false, confidence: 0}` — a parse
  failure is treated as "couldn't confirm," **never silently promoted to
  Compliant**.

### 1.6 Email-side edge cases and how they're handled

| Edge case | Handling |
|---|---|
| No matching email at all | CP38: `pending_reason: "no_email"`. CP10: folded into `"wrong_sender"` (PRD's given enum for CP10 has no separate "no email" value — see §3.4) |
| `$search` fuzzy false positive | Client-side subject-contains post-filter (§1.2) |
| Multiple matching emails | Sorted by `receivedDateTime` desc, most recent wins |
| Freshly-sent email not found yet | Exchange/Graph search-index indexing lag (a few minutes) — a real external-system limitation, not a code bug; mitigated by "wait and re-ask," not engineerable around |
| Wrong sender | Deterministic mismatch → Pending, **LLM never invoked** (zero cost, zero risk of the model rationalizing an unauthorized approval) |
| LLM API key missing | Returns a clear error reply (`"Missing GROQ_API_KEY..."`), not a crash |
| LLM response unparsable | Defaults to non-explicit/0 confidence, never compliant |
| Stale dev server not picking up new `.env` values | Real bug hit during build: `process.loadEnvFile()` only runs once per OS process; Vite's "soft restart" on `.env` change doesn't always re-run it for every module. Fix: a full process kill + fresh `npm run dev`, not just a Vite-internal restart |
| Missing Graph credentials | `getGraphAccessToken()` returns `{ok: false, error}` before any network call, surfaced verbatim in the copilot reply |

---

## 2. Jira integration (Atlassian Rovo MCP)

### 2.1 Why MCP instead of a direct REST call

The PRD explicitly specifies Jira access "via Rovo MCP
(`https://mcp.atlassian.com/v2/mcp`), OAuth 2.1." Our code is therefore an
**MCP client** connecting to Atlassian's own remote MCP server — not a
hand-rolled call to the Jira Cloud REST API. This matters for the auth model:
it's user-delegated OAuth 2.1, not an app-only credential like Graph's.

### 2.2 Authentication — OAuth 2.1 + PKCE + Dynamic Client Registration

No manually-created Atlassian developer-console app was needed — verified live
against Atlassian's real authorization server metadata
(`https://mcp.atlassian.com/.well-known/oauth-authorization-server`), which
advertises a `registration_endpoint` and supports `token_endpoint_auth_method: "none"`
(public client, PKCE-only, no client secret at all).

- **File:** [`src/lib/atlassian-auth.ts`](../src/lib/atlassian-auth.ts) —
  implements the SDK's `OAuthClientProvider` interface:
  - `clientInformation()` / `saveClientInformation()` — dynamic registration
    result, persisted locally
  - `tokens()` / `saveTokens()` — access + refresh tokens, persisted locally
  - `redirectToAuthorization()` — prints the auth URL and attempts to
    auto-open the system browser
  - `saveCodeVerifier()` / `codeVerifier()` — PKCE state across the redirect
  - **Token storage:** `.atlassian-auth.json` at the project root (git-ignored)
- **One-time interactive login:** [`src/mcp/atlassian-login.ts`](../src/mcp/atlassian-login.ts),
  run via `npm run atlassian:login`:
  1. Calls the SDK's `auth()` orchestrator, which registers a client (first
     run only) and returns `'REDIRECT'`
  2. Starts a temporary local HTTP server on `http://localhost:8934/callback`
  3. Opens the browser to Atlassian's consent screen
  4. On callback, exchanges the authorization code for tokens, saves them
- **Ongoing use:** no repeated login needed. `StreamableHTTPClientTransport`'s
  `authProvider` option automatically refreshes the access token via the
  stored `refresh_token` when expired (access tokens last 8 hours per the
  live response observed).

**Critical implementation detail — why the Node imports are lazy:**
`atlassian-auth.ts` is reachable from client-bundled code (imported
transitively by the copilot widget, via `cp10-verify.ts`'s `createServerFn`).
Vite throws immediately when a top-level `node:child_process` (or `node:fs`)
import is merely *evaluated* in a browser bundle, even if never called. Fix:
all Node built-ins (`node:fs`, `node:path`, `node:url`, `node:child_process`)
are imported via **dynamic `await import(...)` inside functions**, never at
module top-level — safe to load in a browser context since the functions
that touch them are never actually invoked there.

### 2.3 Scope granted

**Read-only, by explicit choice** — the consent screen's "Write" toggle was
deliberately unchecked. Verified after login by decoding the actual granted
scope list: `read:jira:agent-interface`, `read:confluence:agent-interface`,
`read:account`, `offline_access`, etc. — no `write:*`, `search:*`, or
`delete:*` scopes present. CP10 only ever reads one ticket, so this is
already minimal for what the feature needs.

One caveat: Rovo MCP bundles scopes across Jira, Confluence, Bitbucket, Loom,
Teams, Goals, and more as a single fixed grant — there's no way to request
"just `read:jira`" alone. That's a platform limitation, not something this
integration chose.

### 2.4 MCP client connection

- **File:** [`src/mcp/rovo-mcp-client.ts`](../src/mcp/rovo-mcp-client.ts) —
  `connectRovoMcp()`: builds a `StreamableHTTPClientTransport` pointed at
  `https://mcp.atlassian.com/v2/mcp` with the auth provider from §2.2, wraps
  it in an MCP SDK `Client`, connects, returns it.
- A **new connection is made per verification call** (acceptable for this
  POC's call volume; not pooled/reused). `cp10-verify.ts` always calls
  `client.close()` in a `finally` block.
- **Diagnostic scripts** used during development (kept for future debugging):
  [`src/mcp/list-rovo-tools.ts`](../src/mcp/list-rovo-tools.ts) — lists real
  tool names/schemas and fetches a live ticket. Useful if Rovo MCP's tool
  surface changes.

### 2.5 The actual Jira read flow

Real tools discovered live via `client.listTools()` (not assumed from the
PRD's illustrative pseudocode):

1. `getAccessibleAtlassianResources` (no args) → returns the site's `cloudId`
   (a UUID identifying the Atlassian Cloud instance)
2. `getJiraIssue({ cloudId, issueIdOrKey: "POC-3", view: "full" })` → full
   ticket payload

Fields actually read from the response:
- `fields.status.name` — must equal `"Pending CAB Approval"` exactly
- `fields.reporter.emailAddress` / `fields.reporter.displayName` — used as
  the authorized-approver identity

**Fields deliberately *not* read:** `fields.summary` (cosmetic only — the
PRD's `[CR]` prefix has no effect on system logic), and no custom field is
read at all.

**Why Reporter instead of the PRD's "CAB Approver custom field":** the real
Jira ticket (`POC-3` in project `POC-PIT-ARMOUR`) does not have that custom
field — confirmed by fetching with `view: "full"` (every field) and finding
only `Development` and `Rank` under `customFields`. Rather than requiring a
Jira schema change (new custom field, added to the issue type's screen), the
existing Reporter field is used as the authorized-approver identity instead —
same principle (read identity from the system of record, never guess it),
applied to a field that already exists. This is documented as a deliberate
simplification in [`cp10-config.ts`](../src/lib/cp10-config.ts)'s header
comment, not a silent deviation.

### 2.6 Jira-side edge cases and how they're handled

| Edge case | Handling |
|---|---|
| Ticket status ≠ "Pending CAB Approval" | `pending_reason: "not_ready"`, actual current status is surfaced in the reply text. **Mail is never searched** — this is the cheap gate that must pass before the expensive one runs |
| `getAccessibleAtlassianResources` returns no resources | Explicit error reply ("couldn't resolve an Atlassian site"), not a crash |
| `getJiraIssue` returns `isError: true` | The tool's raw error text is surfaced in the copilot reply verbatim |
| Ticket has no reporter email | Explicit error reply ("no reporter email to authorize against") — the flow stops rather than silently treating `undefined === undefined` as a match |
| Someone manually flips the Jira status to "Approved" | This **breaks** the flow by design — the Jira status field represents "awaiting CAB review," not the approval itself. Setting it to "Approved" makes the Jira gate fail (`not_ready`, current status "Approved"), since approval evidence must come from the email, never from a Jira field edit |
| Token expired mid-session | Handled transparently by the MCP SDK's `authProvider` — refreshes via the stored `refresh_token` before the call, no user-visible error |
| Refresh token itself revoked/expired | `npm run atlassian:login` must be re-run manually — no code path auto-recovers from this, since it requires a real browser consent |

---

## 3. How the two checks are unified in the frontend

- **Shared logic**, not duplicated per checkpoint:
  - [`approval-classifier.ts`](../src/lib/approval-classifier.ts) — the LLM step
  - [`graph-auth.ts`](../src/lib/graph-auth.ts) — Microsoft token acquisition
- **Copilot widget:** [`Cp38Copilot.tsx`](../src/components/audit/Cp38Copilot.tsx)
  routes a free-text question to CP38 or CP10 based on **deterministic
  keyword matching** (`looksLikeCp10Question()` in `cp10-config.ts` — checks
  for "cp10", "cab approval", "poc-3", etc.), never an LLM-based intent guess.
- **Shared live state:** [`audit-store.tsx`](../src/lib/audit-store.tsx) holds
  `cp10Gates` / `cp10Result` centrally (`setCp10Verification`, `undoCp10Gate`).
  Both the copilot and the ledger card read/write the *same* state — a check
  run from either place is reflected in both.
- **Ledger integration:**
  - CP38 → auto-completes the remaining step on checkpoint `cp-38` (a
    `ManualCheckpoint`), attributed to `"CP38 Copilot (AI-verified)"`
  - CP10 → flips checkpoint `cp-10`'s status to `"compliant"` (an
    `AutomatedCheckpoint`, Change Management category), attributed to
    `"CP10 Copilot (AI-verified)"`. `AutomatedCard.tsx` renders the vertical
    gate progress specifically when `cp.id === "cp-10"`.
- **Vertical progress UI:** [`Cp10VerticalProgress.tsx`](../src/components/audit/Cp10VerticalProgress.tsx)
  — Jira Gate → Mail Gate → LLM Decision, each `pending | passed | failed`,
  with an Undo control that reverts the most-recently-resolved gate and
  cascades to reverting the ledger's Compliant status if that gate was the
  LLM decision.

---

## 4. File map

| File | Purpose |
|---|---|
| `src/lib/graph-auth.ts` | Microsoft Graph `client_credentials` token acquisition (shared) |
| `src/lib/mail-connector.ts` | Mail connector health-check (Connectors page) — unrelated to CP38/CP10 logic but shares `graph-auth.ts` |
| `src/lib/approval-classifier.ts` | Shared LLM approval-language classifier (Groq / gpt-oss-20b) |
| `src/lib/cp38-config.ts` | CP38 project config + deterministic question resolution |
| `src/lib/cp38-verify.ts` | CP38's full verification flow + `createServerFn` wrapper |
| `src/lib/cp10-config.ts` | CP10 project config (Reporter-as-approver) + resolution + CP10-vs-CP38 routing keyword check |
| `src/lib/cp10-verify.ts` | CP10's full verification flow (Jira gate → mail gate → LLM) + `createServerFn` wrapper |
| `src/lib/atlassian-auth.ts` | Atlassian OAuth 2.1 provider (dynamic registration, PKCE, token storage) |
| `src/mcp/rovo-mcp-client.ts` | Authenticated MCP client connection to Rovo MCP |
| `src/mcp/atlassian-login.ts` | One-time interactive OAuth login script (`npm run atlassian:login`) |
| `src/mcp/list-rovo-tools.ts` | Diagnostic script — lists real Rovo MCP tools/schemas, fetches a live ticket |
| `src/mcp/cp38-server.ts` | Standalone MCP *server* exposing CP38 as a tool for external MCP hosts (Claude Code/Desktop) |
| `src/components/audit/Cp38Copilot.tsx` | Floating chat widget — routes questions to CP38 or CP10 |
| `src/components/audit/Cp10VerticalProgress.tsx` | Vertical gate-progress UI + Undo |
| `src/components/audit/AutomatedCard.tsx` | Ledger card for automated checkpoints; renders CP10's progress for `cp-10` |
| `src/lib/audit-store.tsx` | Central app state, incl. shared `cp10Gates`/`cp10Result` |
| `.atlassian-auth.json` | Persisted Atlassian OAuth client info + tokens (git-ignored) |
| `.env` | All credentials (git-ignored) |

---

## 5. Environment variables reference

| Variable | Used by | Required for |
|---|---|---|
| `MS_TENANT_ID` | `graph-auth.ts` | Any email check (CP38, CP10) |
| `MS_CLIENT_ID` | `graph-auth.ts` | Any email check |
| `MS_CLIENT_SECRET` | `graph-auth.ts` | Any email check |
| `MS_TEST_MAILBOX` | `mail-connector.ts`, fallback for `MS_SHARED_MAILBOX` | Connector health-check; CP38/CP10 mail search if `MS_SHARED_MAILBOX` unset |
| `MS_SHARED_MAILBOX` | `cp38-verify.ts`, `cp10-verify.ts` | The actual mailbox CP38/CP10 search |
| `GROQ_API_KEY` | `approval-classifier.ts` | The LLM step in both checkpoints |

No Atlassian credentials live in `.env` — that auth is entirely handled via
`.atlassian-auth.json` (dynamic registration + OAuth tokens), not a static
secret.

---

## 6. Known limitations (deliberate scope, not oversights)

- **In-memory result stores** (`resultStore` Maps in `cp38-verify.ts` /
  `cp10-verify.ts`) — reset on every server restart. Explicitly called out in
  code comments as "swap for a real DB in production."
- **The web app and the standalone MCP server (`cp38-server.ts`) don't share
  state** — they're separate OS processes, each with their own in-memory
  store. A check run through one isn't visible to the other.
- **No Jira write-back.** CP10 never updates the Jira ticket's status — by
  PRD design (the dashboard is the system of record for compliance, not
  Jira) and by granted OAuth scope (Read-only). Adding write-back would
  require re-running `atlassian:login` with Write granted plus new code
  calling a Jira transition operation.
- **Search-index lag on freshly-sent mail** is an external Exchange/Graph
  behavior, not something this code can fix — the guidance is "wait a minute
  and re-ask," not a retry loop, since the actual delay is unpredictable.
