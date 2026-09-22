# CAB Approval & UAT Sign-off — Verification Workflow (Overview)

A plain-language walkthrough of how CP10 (CAB Approval) and CP38 (UAT
Sign-off) actually verify a compliance checkpoint — Jira via Rovo MCP,
email via Microsoft Graph, language via an LLM, and evidence screenshots.
For the deep technical reference (exact API calls, auth internals, edge
cases), see [`cp38-cp10-integration.md`](cp38-cp10-integration.md). This
document is the "how it works, in order" version.

---

## 1. The one rule both checkpoints follow

**Identity and eligibility are always decided by a deterministic check —
never by the LLM.** The LLM is only ever asked one narrow question: *does
this email's wording explicitly say "approved" / "signed off"?* It never
decides who someone is, or whether they're allowed to approve. That
question is answered by simple string comparison, before the LLM is ever
called.

This means every check runs as a **chain of gates**, cheapest/safest first,
each one only running because the one before it passed:

```
CP10 (CAB Approval):   Jira gate  →  Mail gate  →  LLM gate  →  Evidence capture
CP38 (UAT Sign-off):    (no Jira gate)  Mail gate  →  LLM gate  →  Evidence capture
```

If any gate fails, everything after it is skipped — CP10 never even
searches the mailbox if the Jira ticket isn't in the right state yet.

---

## 2. CP10 — CAB Approval, step by step

1. **Ask the copilot.** A question like *"Check CP10 for PIT Armour"*
   resolves deterministically (keyword + project-name matching, never
   LLM-guessed) to a specific Jira ticket (e.g. `POC-3`).

2. **Jira gate — via Rovo MCP.** The app connects to Atlassian's *Rovo MCP*
   server (`https://mcp.atlassian.com/v2/mcp`) as an MCP client and calls
   two of its tools:
   - `getAccessibleAtlassianResources` → finds the Atlassian site
   - `getJiraIssue({ issueIdOrKey: "POC-3", view: "full" })` → fetches the
     ticket

   The ticket's **status** must read exactly `"Pending CAB Approval"`. If
   it doesn't, the check stops right here — outcome `not_ready`, and the
   mailbox is never even searched.

   The ticket's **Reporter** field is read as the *authorized approver's
   identity* (the PRD's imagined "CAB Approver custom field" doesn't exist
   on the real ticket, so Reporter — a field that already exists — stands
   in for it).

3. **Mail gate — via Microsoft Graph.** Now, and only now, the shared
   mailbox is searched for an email whose subject matches the ticket
   (`POC-3` or `PIT-Arnour CAB Approval`). If no matching email exists, or
   it exists but its sender doesn't match the Jira ticket's Reporter email
   *exactly*, the check stops — outcome `wrong_sender`. The LLM is never
   called for this decision.

4. **LLM gate — language only.** Only once the sender is confirmed correct
   does the LLM read the email body and answer one question: is this
   *explicit* approval language ("approved for implementation", "sign off
   on this release"), or is it vague/conditional? A parse failure or
   anything unclear defaults to **not approved** — it's never silently
   promoted to compliant.

5. **Evidence capture.** As soon as a matching email exists (regardless of
   which gate it ultimately fails or passes), a screenshot of that email is
   captured and saved — see §4. This means even a `wrong_sender` or
   `ambiguous` Pending result still shows the auditor exactly what was
   received.

6. **Result.** `CP10-C` (Compliant) only if all three gates passed. The
   dashboard's CP10 gate stepper (Jira → Mail → LLM) reflects exactly which
   gate the check is at, with an Undo control per gate.

## 3. CP38 — UAT Sign-off, step by step

Same shape, minus the Jira gate (CP38 has no ticket-state precondition):

1. **Ask the copilot.** *"What's the status of PIT Armour's UAT sign-off?"*
   resolves to the CP38 project config (fixed authorized signer name/email,
   fixed subject-line convention).

2. **Mail gate.** Search the shared mailbox for a subject match (`"PIT
   Armour UAT Sign-off"`). No match → `no_email`. A match from anyone other
   than the configured authorized signer → `wrong_sender` (deterministic
   string comparison, LLM never consulted).

3. **LLM gate.** Same shared classifier as CP10 (`approval-classifier.ts`
   — one implementation, reused, not duplicated) checks the body for
   explicit sign-off language.

4. **Evidence capture.** Same as CP10: as soon as any matching email is
   found, it's screenshotted — `wrong_sender` and `ambiguous_language`
   results get a screenshot too, not just the compliant one.

5. **Result.** `CP38-C` only if sender and language both check out.

---

## 4. Evidence capture — what it actually does

Once a relevant email is found, [`evidence-screenshot.ts`](../src/lib/evidence-screenshot.ts):

1. Re-fetches that email's **HTML** body from Graph (the earlier search
   fetched plain text, which is what the LLM reads — HTML is fetched
   separately, only for the screenshot).
2. Wraps it in a small styled page (subject / sender / received time,
   received time converted to **IST**, then the email body).
3. Renders that page in a **headless Chromium** browser (Playwright) and
   takes a full-page screenshot.
4. Saves the PNG under `evidence/` at the project root, named
   `<checkpoint>-<project>-<message-id>.png` (e.g. `cp10-project-a-AAMk...png`).

The dashboard (both the CP10 gate panel and the copilot chat reply) shows a
"View screenshot" link that lazily fetches and displays that image.

**Important scope note:** this only works in local/Node development. The
project's actual deployment target is Cloudflare, whose Workers runtime
can't spawn a real browser process or write to a persistent filesystem —
so this is explicitly a local-dev-only feature for now (see the comments at
the top of `evidence-screenshot.ts`).

A capture failure (Graph error, Playwright crash, etc.) is logged and
swallowed — it never changes the compliance outcome. The screenshot is
supporting evidence, never part of the decision itself.

---

## 5. Why Rovo MCP instead of calling the Jira API directly

The PRD specifies Jira access "via Rovo MCP, OAuth 2.1" rather than a
hand-rolled REST call — so the code is a genuine **MCP client**
(`@modelcontextprotocol/sdk`) connecting to Atlassian's own remote MCP
server, not a direct `api.atlassian.com` integration. Practically, that
means:

- **Auth is user-delegated OAuth 2.1** (PKCE, dynamic client registration —
  no manually-created Atlassian dev-console app, no client secret at all),
  not an app-only credential the way Graph's email access is.
- A **one-time interactive login** (`npm run atlassian:login`) opens a
  browser for consent once; after that, tokens refresh automatically.
- The set of things the app *can* call is whatever tools Rovo MCP exposes
  (`getAccessibleAtlassianResources`, `getJiraIssue`, etc.) — discovered
  live via `client.listTools()`, not assumed from documentation.
- The granted scope is **read-only** by deliberate choice (the consent
  screen's Write toggle was left off) — CP10 only ever reads one ticket, it
  never updates Jira's status.

---

## 6. Where each piece lives

| Piece | File |
|---|---|
| CP10's full gate chain | [`src/lib/cp10-verify.ts`](../src/lib/cp10-verify.ts) |
| CP38's full gate chain | [`src/lib/cp38-verify.ts`](../src/lib/cp38-verify.ts) |
| Shared LLM language classifier | [`src/lib/approval-classifier.ts`](../src/lib/approval-classifier.ts) |
| Microsoft Graph auth | [`src/lib/graph-auth.ts`](../src/lib/graph-auth.ts) |
| Atlassian OAuth 2.1 provider | [`src/lib/atlassian-auth.ts`](../src/lib/atlassian-auth.ts) |
| Rovo MCP client connection | [`src/mcp/rovo-mcp-client.ts`](../src/mcp/rovo-mcp-client.ts) |
| Evidence screenshot capture | [`src/lib/evidence-screenshot.ts`](../src/lib/evidence-screenshot.ts) |
| Copilot chat UI (routes CP10 vs CP38) | [`src/components/audit/Cp38Copilot.tsx`](../src/components/audit/Cp38Copilot.tsx) |
| CP10 gate-progress UI | [`src/components/audit/Cp10VerticalProgress.tsx`](../src/components/audit/Cp10VerticalProgress.tsx) |

For full API-call-level detail (exact Graph query params, MCP tool
payloads, every edge case handled, environment variables) see
[`cp38-cp10-integration.md`](cp38-cp10-integration.md).
