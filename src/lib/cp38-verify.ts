import { createServerFn } from "@tanstack/react-start";
import { getGraphAccessToken } from "./graph-auth";
import { classifyApprovalLanguage } from "./approval-classifier";
import { cp38Configs, resolveCp38Project, type Cp38ProjectConfig } from "./cp38-config";

export type PendingReason = "no_email" | "wrong_sender" | "ambiguous_language";

export type Cp38Result = {
  project_id: string;
  outcome_id: "CP38-C" | "CP38-Pending";
  pending_reason: PendingReason | null;
  wrong_sender_email: string | null;
  confidence: number | null; // meaningful only for the Compliant case
  evidence_ref: string | null; // null when no email was found at all
  evidence_screenshot: string | null; // sign-off email screenshot filename — null only when no email was found
  approver_actor: string | null;
  timestamp: string;
};

export type Cp38VerifyResponse = {
  config: Cp38ProjectConfig | null;
  result: Cp38Result | null;
  reply: string;
};

// In-memory "backend" for this POC — swap for a real DB write in production.
// Keyed by project_id, holds the latest known result so the dashboard can
// read it without re-running the flow.
const resultStore = new Map<string, Cp38Result>();

export function copilotReplyText(cfg: Cp38ProjectConfig, result: Cp38Result): string {
  if (result.outcome_id === "CP38-C") {
    return `CP38 - Business UAT Sign-off: Compliant\nSigned off by ${cfg.authorizedName} (${cfg.authorizedEmail}), confidence ${result.confidence}%.`;
  }
  if (result.pending_reason === "no_email") {
    return `CP38 - Business UAT Sign-off: Pending\nNo sign-off email has been received yet for ${cfg.projectLabel}.`;
  }
  if (result.pending_reason === "wrong_sender") {
    return (
      `CP38 - Business UAT Sign-off: Pending\n` +
      `An email was received, but from ${result.wrong_sender_email} - this is not\n` +
      `the authorized signer for ${cfg.projectLabel} (expected ${cfg.authorizedEmail}).\n` +
      `Still awaiting sign-off from the correct owner.`
    );
  }
  // ambiguous_language
  return (
    `CP38 - Business UAT Sign-off: Pending\n` +
    `An email was received from the authorized signer (${cfg.authorizedEmail}), but the ` +
    `sign-off language was not explicit enough to confirm. Awaiting clearer confirmation.`
  );
}

// Core flow, framework-agnostic — used by both the web app's server function
// (below) and the standalone MCP server (src/mcp/cp38-server.ts), so there is
// exactly one implementation of the PRD's deterministic-then-LLM-gated flow.
export async function verifyCp38(cfg: Cp38ProjectConfig): Promise<Cp38VerifyResponse> {
    const timestamp = new Date().toISOString();

    const tokenResult = await getGraphAccessToken();
    if (!tokenResult.ok) {
      return { config: cfg, result: null, reply: `Copilot couldn't reach the mailbox: ${tokenResult.error}` };
    }

    const sharedMailbox = process.env.MS_SHARED_MAILBOX ?? process.env.MS_TEST_MAILBOX;
    if (!sharedMailbox) {
      return {
        config: cfg,
        result: null,
        reply: "No shared mailbox configured (set MS_SHARED_MAILBOX or MS_TEST_MAILBOX in .env).",
      };
    }

    // Step 3: targeted subject search — never a full inbox scan.
    type GraphMessage = {
      id?: string;
      from?: { emailAddress?: { address?: string } };
      body?: { content?: string };
      subject?: string;
      receivedDateTime?: string;
    };
    let message: GraphMessage | undefined;
    try {
      // $search is fuzzy/relevance-ranked, not exact-phrase — it can return
      // a message that only loosely shares keywords. Pull a small batch and
      // keep only ones whose subject genuinely contains the configured
      // phrase, then take the most recent of those (Graph disallows
      // combining $orderby with $search, so ordering happens here instead).
      const searchParams = new URLSearchParams();
      searchParams.set("$search", `"subject:${cfg.subjectMatch}"`);
      searchParams.set("$top", "10");
      searchParams.set("$select", "id,from,body,subject,receivedDateTime");
      const searchRes = await fetch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sharedMailbox)}/messages?${searchParams.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${tokenResult.accessToken}`,
            Prefer: 'outlook.body-content-type="text"',
            ConsistencyLevel: "eventual",
          },
        },
      );
      const searchData = (await searchRes.json()) as { value?: GraphMessage[]; error?: { message: string } };
      if (!searchRes.ok) {
        return {
          config: cfg,
          result: null,
          reply: `Copilot couldn't search the mailbox: ${searchData.error?.message ?? `HTTP ${searchRes.status}`}`,
        };
      }

      const needle = cfg.subjectMatch.toLowerCase();
      const raw = searchData.value ?? [];
      const candidates = raw.filter((m) => (m.subject ?? "").toLowerCase().includes(needle));
      candidates.sort((a, b) => (b.receivedDateTime ?? "").localeCompare(a.receivedDateTime ?? ""));
      message = candidates[0];
    } catch (error) {
      return {
        config: cfg,
        result: null,
        reply: `Mailbox search failed: ${error instanceof Error ? error.message : "unknown error"}`,
      };
    }

    // Step 4 / Case 2 — no matching email at all.
    if (!message) {
      const result: Cp38Result = {
        project_id: cfg.projectId,
        outcome_id: "CP38-Pending",
        pending_reason: "no_email",
        wrong_sender_email: null,
        confidence: null,
        evidence_ref: null,
        evidence_screenshot: null,
        approver_actor: null,
        timestamp,
      };
      resultStore.set(cfg.projectId, result);
      return { config: cfg, result, reply: copilotReplyText(cfg, result) };
    }

    const sender = message.from?.emailAddress?.address ?? "";

    // Evidence of the email that was actually found — captured as soon as
    // any message exists, regardless of sender/language outcome, so a
    // wrong-sender or ambiguous-language Pending result still shows the
    // auditor what was received. Never used to establish eligibility or
    // identity itself, and a capture failure never affects the outcome —
    // it just leaves evidence_screenshot null.
    const screenshotFileName = message.id
      ? await (await import("./evidence-screenshot")).captureApprovalEmailScreenshot({
          checkpoint: "cp38",
          projectId: cfg.projectId,
          messageId: message.id,
          mailbox: sharedMailbox,
          accessToken: tokenResult.accessToken,
          subject: message.subject ?? "",
          from: sender,
          receivedDateTime: message.receivedDateTime ?? "",
        })
      : null;

    // Step 5/6 / Case 3 — deterministic sender check runs BEFORE any LLM
    // call. If it fails, the LLM step is skipped entirely.
    if (sender.toLowerCase() !== cfg.authorizedEmail.toLowerCase()) {
      const result: Cp38Result = {
        project_id: cfg.projectId,
        outcome_id: "CP38-Pending",
        pending_reason: "wrong_sender",
        wrong_sender_email: sender,
        confidence: null,
        evidence_ref: message.id ?? null,
        evidence_screenshot: screenshotFileName,
        approver_actor: null,
        timestamp,
      };
      resultStore.set(cfg.projectId, result);
      return { config: cfg, result, reply: copilotReplyText(cfg, result) };
    }

    // Step 7/8 — sender matches, so now (and only now) the LLM classifies
    // the body's language.
    const classification = await classifyApprovalLanguage(message.body?.content ?? "", message.subject ?? "");
    if (!classification.ok) {
      return {
        config: cfg,
        result: null,
        reply: `Sender verified, but the sign-off language check failed: ${classification.error}`,
      };
    }

    const result: Cp38Result = classification.value.explicit
      ? {
          project_id: cfg.projectId,
          outcome_id: "CP38-C",
          pending_reason: null,
          wrong_sender_email: null,
          confidence: classification.value.confidence,
          evidence_ref: message.id ?? null,
          evidence_screenshot: screenshotFileName,
          approver_actor: cfg.authorizedEmail,
          timestamp,
        }
      : {
          project_id: cfg.projectId,
          outcome_id: "CP38-Pending",
          pending_reason: "ambiguous_language",
          wrong_sender_email: null,
          confidence: classification.value.confidence,
          evidence_ref: message.id ?? null,
          evidence_screenshot: screenshotFileName,
          approver_actor: cfg.authorizedEmail,
          timestamp,
        };

    // Step 9 — "write to backend."
    resultStore.set(cfg.projectId, result);

    // Step 10 — plain-language copilot reply.
    return { config: cfg, result, reply: copilotReplyText(cfg, result) };
}

export const runCp38Verification = createServerFn({ method: "POST" })
  .validator((data: { question: string }) => data)
  .handler(async ({ data }): Promise<Cp38VerifyResponse> => {
    // Step 2: resolve the request against stored project config — never
    // inferred by the LLM, just a plain substring match.
    const cfg = resolveCp38Project(data.question);
    if (!cfg) {
      return {
        config: null,
        result: null,
        reply: `I couldn't tell which project you mean. Known projects: ${cp38Configs
          .map((c) => c.projectLabel)
          .join(", ")}.`,
      };
    }
    return verifyCp38(cfg);
  });

export const getCp38LatestResult = createServerFn({ method: "GET" })
  .validator((data: { projectId: string }) => data)
  .handler(async ({ data }): Promise<Cp38Result | null> => resultStore.get(data.projectId) ?? null);

export const getCp38EvidenceScreenshot = createServerFn({ method: "GET" })
  .validator((data: { fileName: string }) => data)
  .handler(async ({ data }): Promise<{ dataUrl: string } | null> => {
    const { readEvidenceScreenshot } = await import("./evidence-screenshot");
    const buffer = await readEvidenceScreenshot(data.fileName);
    if (!buffer) return null;
    return { dataUrl: `data:image/png;base64,${buffer.toString("base64")}` };
  });
