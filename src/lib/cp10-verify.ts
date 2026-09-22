import { createServerFn } from "@tanstack/react-start";
import { getGraphAccessToken } from "./graph-auth";
import { classifyApprovalLanguage } from "./approval-classifier";
import { cp10Configs, resolveCp10Project, type Cp10ProjectConfig } from "./cp10-config";
import { connectRovoMcp } from "../mcp/rovo-mcp-client";
// Dynamically imported at each call site below, never at module top level —
// evidence-screenshot.ts pulls in playwright, which must never be eagerly
// evaluated by the browser (this module has no server-only build boundary,
// so Vite serves it to the client unbundled in dev).

export type Cp10PendingReason = "not_ready" | "wrong_sender" | "ambiguous";

export type Cp10Result = {
  project_id: string;
  jira_ticket: string;
  outcome_id: "CP10-C" | "CP10-Pending";
  pending_reason: Cp10PendingReason | null;
  approver_actor: string | null;
  confidence: number | null; // meaningful only for the Compliant case
  evidence_ref: string | null;
  evidence_screenshot: string | null; // approval-email screenshot filename — null only when no email was found
  timestamp: string;
};

export type GateState = "pending" | "passed" | "failed";
export type Cp10GateStatus = { jira: GateState; mail: GateState; llm: GateState };

export type Cp10VerifyResponse = {
  config: Cp10ProjectConfig | null;
  result: Cp10Result | null;
  reply: string;
  gates: Cp10GateStatus;
};

// In-memory "backend" for this POC, same pattern as CP38.
const resultStore = new Map<string, Cp10Result>();

function initialGates(): Cp10GateStatus {
  return { jira: "pending", mail: "pending", llm: "pending" };
}

function cp10ReplyText(
  cfg: Cp10ProjectConfig,
  result: Cp10Result,
  approverName: string | null,
  actualStatus?: string,
  wrongSenderEmail?: string | null,
): string {
  if (result.outcome_id === "CP10-C") {
    return `CP10 — CAB Approval: Compliant\n${cfg.jiraTicket} was approved by ${approverName ?? result.approver_actor}, the authorized CAB approver for ${cfg.projectLabel}. Confidence: ${result.confidence}%.`;
  }
  if (result.pending_reason === "not_ready") {
    return `CP10 — CAB Approval: Pending\n${cfg.jiraTicket} has not yet reached CAB approval stage${actualStatus ? ` (current status: ${actualStatus})` : ""}.`;
  }
  if (result.pending_reason === "wrong_sender") {
    if (wrongSenderEmail) {
      return `CP10 — CAB Approval: Pending\nAn email was received, but from ${wrongSenderEmail} — this is not the authorized CAB approver for ${cfg.projectLabel}.`;
    }
    return `CP10 — CAB Approval: Pending\nNo CAB approval email has been received yet for ${cfg.jiraTicket}.`;
  }
  // ambiguous
  return `CP10 — CAB Approval: Pending\nAn email was received from the authorized CAB approver, but the approval language was not explicit enough to confirm.`;
}

// Core flow, framework-agnostic. Mirrors CP38's structure deliberately: a
// cheap deterministic gate (Jira status) runs before an expensive one (mail
// search), sender identity is a deterministic string match, and the LLM
// only ever classifies language — never identity or eligibility — and only
// once both gates ahead of it have already passed.
export async function verifyCp10(cfg: Cp10ProjectConfig): Promise<Cp10VerifyResponse> {
  const timestamp = new Date().toISOString();
  const gates = initialGates();

  const client = await connectRovoMcp();
  try {
    // Step 3 — fetch the Jira ticket via Rovo MCP.
    const resourcesRes = await client.callTool({ name: "getAccessibleAtlassianResources", arguments: {} });
    const resourcesText = (resourcesRes.content as { text: string }[])[0]?.text ?? "{}";
    const cloudId = JSON.parse(resourcesText).data?.resources?.[0]?.cloudId as string | undefined;
    if (!cloudId) {
      return {
        config: cfg,
        result: null,
        gates,
        reply: "Copilot couldn't resolve an Atlassian site (no accessible resources returned).",
      };
    }

    const issueRes = await client.callTool({
      name: "getJiraIssue",
      arguments: { cloudId, issueIdOrKey: cfg.jiraTicket, view: "full" },
    });
    const issueText = (issueRes.content as { text: string }[])[0]?.text ?? "{}";
    if (issueRes.isError) {
      return { config: cfg, result: null, gates, reply: `Copilot couldn't fetch ${cfg.jiraTicket}: ${issueText}` };
    }
    const issue = JSON.parse(issueText).data;
    const statusName: string = issue?.fields?.status?.name ?? "Unknown";
    const reporterEmail: string | null = issue?.fields?.reporter?.emailAddress ?? null;
    const reporterName: string | null = issue?.fields?.reporter?.displayName ?? null;

    // Step 4 — Jira gate. Fails → stop here, mail is never even searched.
    if (statusName !== "Pending CAB Approval") {
      gates.jira = "failed";
      const result: Cp10Result = {
        project_id: cfg.projectId,
        jira_ticket: cfg.jiraTicket,
        outcome_id: "CP10-Pending",
        pending_reason: "not_ready",
        approver_actor: null,
        confidence: null,
        evidence_ref: null,
        evidence_screenshot: null,
        timestamp,
      };
      resultStore.set(cfg.projectId, result);
      return { config: cfg, result, gates, reply: cp10ReplyText(cfg, result, reporterName, statusName) };
    }
    gates.jira = "passed";

    if (!reporterEmail) {
      return {
        config: cfg,
        result: null,
        gates,
        reply: `Jira gate passed, but ${cfg.jiraTicket} has no reporter email to authorize against.`,
      };
    }

    // Step 5 — mail gate: search only runs because the Jira gate passed.
    const tokenResult = await getGraphAccessToken();
    if (!tokenResult.ok) {
      return {
        config: cfg,
        result: null,
        gates,
        reply: `Jira gate passed, but the mailbox couldn't be reached: ${tokenResult.error}`,
      };
    }
    const sharedMailbox = process.env.MS_SHARED_MAILBOX ?? process.env.MS_TEST_MAILBOX;
    if (!sharedMailbox) {
      return {
        config: cfg,
        result: null,
        gates,
        reply: "No shared mailbox configured (set MS_SHARED_MAILBOX or MS_TEST_MAILBOX in .env).",
      };
    }

    type GraphMessage = {
      id?: string;
      from?: { emailAddress?: { address?: string } };
      body?: { content?: string };
      subject?: string;
      receivedDateTime?: string;
    };
    let message: GraphMessage | undefined;
    try {
      const searchParams = new URLSearchParams();
      const orQuery = cfg.subjectMatches.map((s) => `subject:${s}`).join(" OR ");
      searchParams.set("$search", `"${orQuery}"`);
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
          gates,
          reply: `Copilot couldn't search the mailbox: ${searchData.error?.message ?? `HTTP ${searchRes.status}`}`,
        };
      }
      const needles = cfg.subjectMatches.map((s) => s.toLowerCase());
      const candidates = (searchData.value ?? []).filter((m) => {
        const subj = (m.subject ?? "").toLowerCase();
        return needles.some((n) => subj.includes(n));
      });
      candidates.sort((a, b) => (b.receivedDateTime ?? "").localeCompare(a.receivedDateTime ?? ""));
      message = candidates[0];
    } catch (error) {
      return {
        config: cfg,
        result: null,
        gates,
        reply: `Mailbox search failed: ${error instanceof Error ? error.message : "unknown error"}`,
      };
    }

    // Step 6 — deterministic sender check. The PRD's pending_reason enum
    // (not_ready | wrong_sender | ambiguous) has no separate "no email"
    // value, so both "nothing found" and "found but wrong sender" map to
    // wrong_sender — the reply text below still distinguishes them for the
    // human reading it.
    if (!message) {
      gates.mail = "failed";
      const result: Cp10Result = {
        project_id: cfg.projectId,
        jira_ticket: cfg.jiraTicket,
        outcome_id: "CP10-Pending",
        pending_reason: "wrong_sender",
        approver_actor: null,
        confidence: null,
        evidence_ref: null,
        evidence_screenshot: null,
        timestamp,
      };
      resultStore.set(cfg.projectId, result);
      return { config: cfg, result, gates, reply: cp10ReplyText(cfg, result, reporterName, statusName, null) };
    }

    const sender = message.from?.emailAddress?.address ?? "";

    // Evidence of the email that was actually found — captured as soon as
    // any message exists, regardless of sender/language outcome, so a
    // wrong-sender or ambiguous Pending result still shows the auditor what
    // was received. Never used to establish eligibility or identity itself,
    // and a capture failure never affects the outcome — it just leaves
    // evidence_screenshot null.
    const screenshotFileName = message.id
      ? await (await import("./evidence-screenshot")).captureApprovalEmailScreenshot({
          checkpoint: "cp10",
          projectId: cfg.projectId,
          messageId: message.id,
          mailbox: sharedMailbox,
          accessToken: tokenResult.accessToken,
          subject: message.subject ?? "",
          from: sender,
          receivedDateTime: message.receivedDateTime ?? "",
        })
      : null;

    if (sender.toLowerCase() !== reporterEmail.toLowerCase()) {
      gates.mail = "failed";
      const result: Cp10Result = {
        project_id: cfg.projectId,
        jira_ticket: cfg.jiraTicket,
        outcome_id: "CP10-Pending",
        pending_reason: "wrong_sender",
        approver_actor: null,
        confidence: null,
        evidence_ref: message.id ?? null,
        evidence_screenshot: screenshotFileName,
        timestamp,
      };
      resultStore.set(cfg.projectId, result);
      return { config: cfg, result, gates, reply: cp10ReplyText(cfg, result, reporterName, statusName, sender) };
    }
    gates.mail = "passed";

    // Step 7 — LLM checks approval language, only now that sender matched.
    const classification = await classifyApprovalLanguage(message.body?.content ?? "", message.subject ?? "");
    if (!classification.ok) {
      return {
        config: cfg,
        result: null,
        gates,
        reply: `Sender verified, but the approval-language check failed: ${classification.error}`,
      };
    }
    gates.llm = classification.value.explicit ? "passed" : "failed";

    const result: Cp10Result = classification.value.explicit
      ? {
          project_id: cfg.projectId,
          jira_ticket: cfg.jiraTicket,
          outcome_id: "CP10-C",
          pending_reason: null,
          approver_actor: reporterEmail,
          confidence: classification.value.confidence,
          evidence_ref: message.id ?? null,
          evidence_screenshot: screenshotFileName,
          timestamp,
        }
      : {
          project_id: cfg.projectId,
          jira_ticket: cfg.jiraTicket,
          outcome_id: "CP10-Pending",
          pending_reason: "ambiguous",
          approver_actor: reporterEmail,
          confidence: classification.value.confidence,
          evidence_ref: message.id ?? null,
          evidence_screenshot: screenshotFileName,
          timestamp,
        };

    resultStore.set(cfg.projectId, result);
    return { config: cfg, result, gates, reply: cp10ReplyText(cfg, result, reporterName, statusName) };
  } finally {
    await client.close();
  }
}

export const runCp10Verification = createServerFn({ method: "POST" })
  .validator((data: { question: string }) => data)
  .handler(async ({ data }): Promise<Cp10VerifyResponse> => {
    const cfg = resolveCp10Project(data.question);
    if (!cfg) {
      return {
        config: null,
        result: null,
        gates: initialGates(),
        reply: `I couldn't tell which project you mean. Known projects: ${cp10Configs
          .map((c) => c.projectLabel)
          .join(", ")}.`,
      };
    }
    return verifyCp10(cfg);
  });

export const getCp10LatestResult = createServerFn({ method: "GET" })
  .validator((data: { projectId: string }) => data)
  .handler(async ({ data }): Promise<Cp10Result | null> => resultStore.get(data.projectId) ?? null);

export const getCp10EvidenceScreenshot = createServerFn({ method: "GET" })
  .validator((data: { fileName: string }) => data)
  .handler(async ({ data }): Promise<{ dataUrl: string } | null> => {
    const { readEvidenceScreenshot } = await import("./evidence-screenshot");
    const buffer = await readEvidenceScreenshot(data.fileName);
    if (!buffer) return null;
    return { dataUrl: `data:image/png;base64,${buffer.toString("base64")}` };
  });
