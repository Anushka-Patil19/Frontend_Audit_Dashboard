// Thin client for the standalone FastAPI backend (../../backend). Every
// function here has the same name and `{ data: {...} }` call shape the old
// TanStack Start server functions had, so call sites didn't need to change
// beyond dropping `useServerFn(...)` and importing from here instead.
const API_BASE_URL = import.meta.env["VITE_API_BASE_URL"] ?? "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function apiFetchOrNull<T>(path: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// --- CP38 ------------------------------------------------------------

export type Cp38PendingReason = "no_email" | "wrong_sender" | "ambiguous_language";

export type Cp38Result = {
  project_id: string;
  outcome_id: "CP38-C" | "CP38-Pending";
  pending_reason: Cp38PendingReason | null;
  wrong_sender_email: string | null;
  confidence: number | null;
  evidence_ref: string | null;
  evidence_screenshot: string | null;
  approver_actor: string | null;
  timestamp: string;
};

export type Cp38ProjectConfig = {
  projectId: string;
  projectLabel: string;
  checkpointId: "CP38";
  requiredRole: string;
  authorizedName: string;
  authorizedEmail: string;
  subjectMatch: string;
  ledgerId: string;
};

export type Cp38VerifyResponse = {
  config: Cp38ProjectConfig | null;
  result: Cp38Result | null;
  reply: string;
};

export async function runCp38Verification({ data }: { data: { question: string } }): Promise<Cp38VerifyResponse> {
  return apiFetch("/api/cp38/verify", { method: "POST", body: JSON.stringify(data) });
}

export async function getCp38EvidenceScreenshot({
  data,
}: {
  data: { fileName: string };
}): Promise<{ dataUrl: string } | null> {
  return apiFetchOrNull(`/api/cp38/evidence?file_name=${encodeURIComponent(data.fileName)}`);
}

// --- CP10 --------------------------------------------------------------

export type GateState = "pending" | "passed" | "failed";
export type Cp10PendingReason = "not_ready" | "wrong_sender" | "ambiguous";

export type Cp10Result = {
  project_id: string;
  jira_ticket: string;
  outcome_id: "CP10-C" | "CP10-Pending";
  pending_reason: Cp10PendingReason | null;
  approver_actor: string | null;
  confidence: number | null;
  evidence_ref: string | null;
  evidence_screenshot: string | null;
  timestamp: string;
};

export type Cp10GateStatus = { jira: GateState; mail: GateState; llm: GateState };

export type Cp10ProjectConfig = {
  projectId: string;
  projectLabel: string;
  checkpointId: "CP10";
  jiraTicket: string;
  subjectMatches: string[];
  ledgerId: string;
};

export type Cp10VerifyResponse = {
  config: Cp10ProjectConfig | null;
  result: Cp10Result | null;
  reply: string;
  gates: Cp10GateStatus;
};

export async function runCp10Verification({ data }: { data: { question: string } }): Promise<Cp10VerifyResponse> {
  return apiFetch("/api/cp10/verify", { method: "POST", body: JSON.stringify(data) });
}

export async function getCp10EvidenceScreenshot({
  data,
}: {
  data: { fileName: string };
}): Promise<{ dataUrl: string } | null> {
  return apiFetchOrNull(`/api/cp10/evidence?file_name=${encodeURIComponent(data.fileName)}`);
}

// --- CR compliance -------------------------------------------------------

export type CrOutcomeId = "CR-C" | "CR-NC" | "CR-IP" | "CR-Pending";

export type CrComplianceResult = {
  project_id: string;
  jira_ticket: string;
  outcome_id: CrOutcomeId;
  jira_status: string | null;
  jira_approved: boolean;
  required_merger: string | null;
  branch_found: boolean;
  pr_number: number | null;
  pr_state: string | null;
  pr_merged: boolean;
  pr_merged_by: string | null;
  merger_matches: boolean;
  pr_url: string | null;
  timestamp: string;
};

export type CrGateStatus = { jira: GateState; branch: GateState; pr: GateState };

export type CrComplianceProjectConfig = {
  projectId: string;
  projectLabel: string;
  checkpointId: "CR";
  jiraProjectKey: string;
  githubOwner: string;
  githubRepo: string;
  ledgerId: string;
};

export type CrVerifyResponse = {
  config: CrComplianceProjectConfig | null;
  ticketKey: string | null;
  result: CrComplianceResult | null;
  reply: string;
  gates: CrGateStatus;
};

export async function runCrComplianceVerification({
  data,
}: {
  data: { question: string };
}): Promise<CrVerifyResponse> {
  return apiFetch("/api/cr-compliance/verify", { method: "POST", body: JSON.stringify(data) });
}

// --- Mail connector ----------------------------------------------------

export type MailSyncResult = { connected: boolean; message: string };

export async function syncMailConnector(): Promise<MailSyncResult> {
  return apiFetch("/api/mail-connector/sync", { method: "POST" });
}

// --- Dependency monitor -----------------------------------------------

export type DependencyStatus = "UP_TO_DATE" | "UPDATE_AVAILABLE" | "CHECK_FAILED";

export type DependencyResult = {
  package: string;
  currentVersion: string;
  latestVersion: string | null;
  status: DependencyStatus;
  message?: string;
  deprecated: boolean;
  deprecationNote: string | null;
  deprecationSource: "official-classifier" | "maintainer-text" | null;
  replacementPackage: string | null;
};

export type DependencyMonitorResult = { ok: true; results: DependencyResult[] } | { ok: false; error: string };

export async function checkRepoDependencies(): Promise<DependencyMonitorResult> {
  return apiFetch("/api/dependencies/check", { method: "GET" });
}

// Reports packages needing action — either a version update, or a switch
// away from a deprecated package. Packages that are both up to date and not
// deprecated are left out entirely. Pure formatting, no network — kept on
// the frontend since it only shapes text for the copilot chat reply.
export function formatDependencyReply(res: DependencyMonitorResult): string {
  if (!res.ok) return `Couldn't check dependencies: ${res.error}`;

  const { results } = res;
  const updates = results.filter((r) => r.status === "UPDATE_AVAILABLE" && !r.deprecated);
  const deprecated = results.filter((r) => r.deprecated);

  if (updates.length === 0 && deprecated.length === 0) {
    return `All ${results.length} tracked dependencies are up to date and none are deprecated.`;
  }

  const lines: string[] = [
    `${updates.length + deprecated.length} of ${results.length} dependencies need action — ${updates.length} need an update, ${deprecated.length} deprecated.`,
    "",
  ];

  if (updates.length > 0) {
    lines.push("Need an update:");
    for (const r of updates) lines.push(`  • ${r.package}: ${r.currentVersion} → ${r.latestVersion}`);
    lines.push("");
  }

  if (deprecated.length > 0) {
    lines.push("Deprecated (currently in use):");
    for (const r of deprecated) {
      const sourceLabel =
        r.deprecationSource === "official-classifier"
          ? "PyPI official classifier"
          : "maintainer's own package description";
      lines.push(
        `  • You're using ${r.package} (${r.currentVersion}), but it's deprecated${r.replacementPackage ? ` — use ${r.replacementPackage} instead` : ""}. [source: ${sourceLabel}]`,
      );
    }
  }

  return lines.join("\n").trimEnd();
}
