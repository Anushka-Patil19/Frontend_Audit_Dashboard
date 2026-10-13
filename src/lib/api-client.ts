// Thin client for the standalone FastAPI backend (../../backend). Every
// function here has the same name and `{ data: {...} }` call shape the old
// TanStack Start server functions had, so call sites didn't need to change
// beyond dropping `useServerFn(...)` and importing from here instead.
import type { ProjectId } from "@/lib/audit-data";
import type {
  Level,
  Notification,
  OpenItem,
  Policy,
  ProjectConfig,
  RunSummary,
} from "@/lib/escalation-data";

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

export async function runCp38Verification({
  data,
}: {
  data: { question: string };
}): Promise<Cp38VerifyResponse> {
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

export async function runCp10Verification({
  data,
}: {
  data: { question: string };
}): Promise<Cp10VerifyResponse> {
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
  /** Screenshot of the PR's GitHub page, when it could be captured (public repos). */
  evidence_screenshot: string | null;
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

export async function getCrEvidenceScreenshot({
  data,
}: {
  data: { fileName: string };
}): Promise<{ dataUrl: string } | null> {
  return apiFetchOrNull(
    `/api/cr-compliance/evidence?file_name=${encodeURIComponent(data.fileName)}`,
  );
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

export type DependencyMonitorResult =
  | {
      ok: true;
      results: DependencyResult[];
      checkedAt: string | null;
      evidenceScreenshot: string | null;
    }
  | { ok: false; error: string };

// captureEvidence asks the backend to also screenshot this run's results
// (used by the CP16 evidence panel) — skipped by default since it spins up
// a headless browser.
export async function checkRepoDependencies({
  captureEvidence = false,
}: { captureEvidence?: boolean } = {}): Promise<DependencyMonitorResult> {
  return apiFetch(`/api/dependencies/check${captureEvidence ? "?capture_evidence=true" : ""}`, {
    method: "GET",
  });
}

export async function getDependencyEvidenceScreenshot({
  data,
}: {
  data: { fileName: string };
}): Promise<{ dataUrl: string } | null> {
  return apiFetchOrNull(
    `/api/dependencies/evidence?file_name=${encodeURIComponent(data.fileName)}`,
  );
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
    for (const r of updates)
      lines.push(`  • ${r.package}: ${r.currentVersion} → ${r.latestVersion}`);
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

// --- Developer invites --------------------------------------------------

export type Invite = {
  token: string;
  email: string;
  projectId: string;
  projectName: string;
  role: "developer";
  invitedBy: string | null;
  createdAt: string;
};

export type CreateInviteResponse = {
  invite: Invite;
  link: string;
  emailSent: boolean;
  emailError: string | null;
};

export async function createInvite({
  data,
}: {
  data: { email: string; projectId: string; projectName: string; invitedBy?: string };
}): Promise<CreateInviteResponse> {
  return apiFetch("/api/invites", { method: "POST", body: JSON.stringify(data) });
}

export async function getInvite({ data }: { data: { token: string } }): Promise<Invite | null> {
  return apiFetchOrNull(`/api/invites/${encodeURIComponent(data.token)}`);
}

// --- Escalations ---------------------------------------------------------

const ESCALATIONS_API = "/api/escalations";

export type EscalationLimitsPatch = {
  defaultLimitDays?: number | null;
  categoryLimits?: Record<string, number | null>;
  checkpointLimits?: Record<string, number | null>;
};

export const getEscalationConfig = (projectId: ProjectId) =>
  apiFetch<ProjectConfig>(`${ESCALATIONS_API}/config/${projectId}`);

export const saveEscalationPolicy = (projectId: ProjectId, policy: Policy) =>
  apiFetch<ProjectConfig>(`${ESCALATIONS_API}/policy/${projectId}`, {
    method: "PUT",
    body: JSON.stringify(policy),
  });

export const saveEscalationLimits = (projectId: ProjectId, patch: EscalationLimitsPatch) =>
  apiFetch<ProjectConfig>(`${ESCALATIONS_API}/limits/${projectId}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });

export const resetEscalationConfig = (projectId: ProjectId) =>
  apiFetch<ProjectConfig>(`${ESCALATIONS_API}/config/${projectId}`, { method: "DELETE" });

export type EscalationItemAction = {
  item: OpenItem;
  notifications: Notification[];
  emailNote?: string;
};

export const listEscalationItems = (projectId?: ProjectId) => {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return apiFetch<OpenItem[]>(`${ESCALATIONS_API}/items${query}`);
};

export const runEscalationApi = (projectId: ProjectId) =>
  apiFetch<RunSummary>(`${ESCALATIONS_API}/run/${projectId}`, { method: "POST" });

export const getLatestEscalationRuns = () =>
  apiFetch<Partial<Record<ProjectId, RunSummary>>>(`${ESCALATIONS_API}/runs/latest`);

export const listEscalationNotifications = (
  filters: { role?: Level; projectId?: ProjectId; since?: string } = {},
) => {
  const query = new URLSearchParams();
  if (filters.role) query.set("role", filters.role);
  if (filters.projectId) query.set("projectId", filters.projectId);
  if (filters.since) query.set("since", filters.since);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return apiFetch<Notification[]>(`${ESCALATIONS_API}/notifications${suffix}`);
};

export const escalationItemAction = (itemId: string, action: "fixed" | "undo" | "nudge") =>
  apiFetch<EscalationItemAction>(
    `${ESCALATIONS_API}/items/${encodeURIComponent(itemId)}/${action}`,
    { method: "POST" },
  );

export const approveEscalationItem = (itemId: string, by: string) =>
  apiFetch<EscalationItemAction>(`${ESCALATIONS_API}/items/${encodeURIComponent(itemId)}/approve`, {
    method: "POST",
    body: JSON.stringify({ by }),
  });

export async function getEscalationEvidenceScreenshot({
  data,
}: {
  data: { fileName: string };
}): Promise<{ dataUrl: string } | null> {
  return apiFetchOrNull(
    `${ESCALATIONS_API}/evidence?file_name=${encodeURIComponent(data.fileName)}`,
  );
}

export const rejectEscalationItem = (itemId: string, by: string, reason: string) =>
  apiFetch<EscalationItemAction>(`${ESCALATIONS_API}/items/${encodeURIComponent(itemId)}/reject`, {
    method: "POST",
    body: JSON.stringify({ by, reason }),
  });

export const resetEscalationDemo = () =>
  apiFetch<{ ok: boolean }>(`${ESCALATIONS_API}/demo/reset`, { method: "POST" });
