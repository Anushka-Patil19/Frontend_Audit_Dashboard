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
  /** Today's Jira status. */
  jira_status: string | null;
  jira_approved: boolean;
  /** Jira's state when the PR was merged — what a merged PR is judged on. */
  jira_status_at_merge: string | null;
  jira_approved_at_merge: boolean | null;
  jira_approved_by: string | null;
  jira_approved_at: string | null;
  approval_withdrawn_after_merge: boolean;
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

// --- CP6 (change linked to an approved CR/Jira) ------------------------------

export type Cp6Result = {
  project_id: string;
  jira_ticket: string;
  outcome_id: "CP6-C" | "CP6-NC";
  jira_status: string;
  jira_summary: string | null;
  jira_reporter: string | null;
  jira_url: string;
  /** Jira status screenshot — captured only when the ticket is approved. */
  evidence_screenshot: string | null;
  timestamp: string;
};

export type Cp6ProjectConfig = {
  projectId: string;
  projectLabel: string;
  checkpointId: "CP6";
  jiraTicket: string;
  approvedStatus: string;
  ledgerId: string;
};

export type Cp6VerifyResponse = {
  config: Cp6ProjectConfig | null;
  result: Cp6Result | null;
  reply: string;
};

export async function runCp6Verification({
  data,
}: {
  data: { question: string };
}): Promise<Cp6VerifyResponse> {
  return apiFetch("/api/cp6/verify", { method: "POST", body: JSON.stringify(data) });
}

export async function getCp6EvidenceScreenshot({
  data,
}: {
  data: { fileName: string };
}): Promise<{ dataUrl: string } | null> {
  return apiFetchOrNull(`/api/cp6/evidence?file_name=${encodeURIComponent(data.fileName)}`);
}

// --- CP20 (pull request mandatory for changes) ---------------------------------

/** C compliant · CE compliant with exception · OBS observation · NC non-compliant · NE not evidenced */
export type Cp20OutcomeId = "CP20-C" | "CP20-CE" | "CP20-OBS" | "CP20-NC" | "CP20-NE";
export type Cp20FindingLevel = "nc" | "not_evidenced" | "observation" | "exception" | "info";

export type Cp20Result = {
  project_id: string;
  repo: string;
  repo_url: string;
  outcome_id: Cp20OutcomeId;
  findings: { level: Cp20FindingLevel; text: string }[];
  counts: Record<"nc" | "not_evidenced" | "observation" | "exception", number>;
  branches: {
    branch: string;
    readable: boolean;
    protected: boolean;
    pr_required: boolean;
    admins_enforced: boolean;
    force_push_blocked: boolean;
    deletion_blocked: boolean;
    source: string;
  }[];
  rule_start_date: string | null;
  rule_start_source: string;
  period_start: string;
  commits: {
    branch: string;
    sha: string;
    author: string | null;
    date: string;
    message: string;
    pr_number: number | null;
    pr_url: string | null;
    pr_author: string | null;
    merged_by: string | null;
    merged_at: string | null;
    reviewers: string[];
    self_merged: boolean;
    direct_push: boolean;
    exception_id: string | null;
  }[];
  commits_before_rule_start: number;
  history_events: {
    branch: string;
    type: string;
    actor: string | null;
    time: string;
    sha: string | null;
    exception_id: string | null;
  }[];
  exceptions_used: { id: string; reason: string; approver: string; expires: string }[];
  evidence_file: string | null;
  evidence_hash: string | null;
  evidence_screenshot: string | null;
  /** Append-only, hash-chained run log in backend/evidence. */
  hash_log_file: string | null;
  hash_log_entry: number | null;
  hash_log_entry_hash: string | null;
  timestamp: string;
};

export type Cp20Gates = {
  protection: GateState;
  commits: GateState;
  history: GateState;
  review: GateState;
};

export type Cp20VerifyResponse = {
  config: { ledgerId: string; githubOwner: string; githubRepo: string } | null;
  result: Cp20Result | null;
  reply: string;
  gates: Cp20Gates;
};

export async function runCp20Verification({
  data,
}: {
  data: { question: string };
}): Promise<Cp20VerifyResponse> {
  return apiFetch("/api/cp20/verify", { method: "POST", body: JSON.stringify(data) });
}

export async function getCp20EvidenceScreenshot({
  data,
}: {
  data: { fileName: string };
}): Promise<{ dataUrl: string } | null> {
  return apiFetchOrNull(`/api/cp20/evidence?file_name=${encodeURIComponent(data.fileName)}`);
}

// --- GitHub tracking (live PRs, pushes, rules, deployments per project) --------

export type TraceState = "passed" | "failed" | "warn" | "pending";
export type TraceStep = {
  key: "cr" | "jira" | "review" | "merge" | "deploy";
  label: string;
  state: TraceState;
  title: string;
  detail: string | null;
  url: string | null;
};
export type PrFlag = { code: string; label: string; level: "fail" | "warn"; why: string };

export type TrackedPr = {
  repo: string;
  number: number;
  title: string;
  url: string;
  state: "open" | "closed" | "merged";
  author: string | null;
  approvers: string[];
  merged_by: string | null;
  merged_at: string | null;
  created_at: string;
  base: string;
  head: string;
  cr_key: string | null;
  jira: { status_now: string | null; status_at_merge: string | null; approved: boolean | null };
  required_merger: string | null;
  release: string | null;
  flags: PrFlag[];
  result: "fail" | "warn" | "clean";
  trace: TraceStep[];
};

export type TrackedPush = {
  repo: string;
  branch: string;
  sha: string | null;
  url: string | null;
  author: string | null;
  date: string | null;
  message: string;
  kind: string;
};

export type TrackedRule = {
  repo: string;
  branch: string;
  readable: boolean;
  protected: boolean;
  pr_required: boolean;
  admins_enforced: boolean;
  force_push_blocked: boolean;
  deletion_blocked: boolean;
  source: string;
  gaps: string[];
};

export type TrackedDeployment = {
  id: number;
  repo: string;
  environment: string | null;
  sha: string | null;
  ref: string | null;
  creator: string | null;
  created_at: string | null;
  status: string | null;
  tag: string | null;
  in_window: boolean | null;
};

export type TrackingKpis = {
  open_prs: number;
  flagged_prs: number;
  bypassed_pushes: number;
  rule_gaps: number;
  deploys_to_check: number;
  deploys_outside_window: number;
  deploys_without_tag: number;
};

export type ProjectTracking = {
  project_id: string;
  name: string;
  connected: boolean;
  repos: { repo: string; url: string | null; error: string | null }[];
  kpis: TrackingKpis;
  prs: TrackedPr[];
  pushes: TrackedPush[];
  rules: TrackedRule[];
  deployments: TrackedDeployment[];
  fetched_at: string;
};

export type TrackingSummary = {
  project_id: string;
  name: string;
  connected: boolean;
  repos: string[];
  kpis: TrackingKpis;
  flagged: number;
  top: { kind: "pr" | "push"; text: string; label: string; level: "fail" | "warn" }[];
};

export async function getGithubTrackingSummary(refresh = false): Promise<TrackingSummary[]> {
  return apiFetch(`/api/github-tracking/summary${refresh ? "?refresh=true" : ""}`);
}

export async function getProjectTracking(projectId: string, refresh = false): Promise<ProjectTracking> {
  return apiFetch(`/api/github-tracking/${encodeURIComponent(projectId)}${refresh ? "?refresh=true" : ""}`);
}

// --- CP40 (production deployment approval: Jira ticket + attached email) ------

export type Cp40OutcomeId = "CP40-C" | "CP40-Pending" | "CP40-NC" | "CP40-Manual";

export type Cp40Result = {
  project_id: string;
  jira_ticket: string;
  jira_url: string;
  outcome_id: Cp40OutcomeId;
  /** Every rule that failed / what is missing, in plain words. */
  reasons: string[];
  jira_status: string;
  approver_name: string | null;
  approver_email: string | null;
  attachment_name: string | null;
  attachment_author: string | null;
  attachment_sha256: string | null;
  email_from: string | null;
  email_date: string | null;
  email_subject: string | null;
  email_excerpt: string | null;
  llm_approved: boolean | null;
  llm_confidence: number | null;
  llm_reason: string | null;
  /** Stored copy of the approval file (Compliant only). */
  evidence_file: string | null;
  /** Jira ticket screenshot (Compliant only). */
  evidence_screenshot: string | null;
  comment_posted: boolean;
  timestamp: string;
};

export type Cp40GateStatus = {
  ticket: GateState;
  approver: GateState;
  attachment: GateState;
  content: GateState;
};

export type Cp40ProjectConfig = {
  projectId: string;
  projectLabel: string;
  checkpointId: "CP40";
  jiraTicket: string;
  approvedStatus: string;
  stepName: string;
  authorizedApprovers: string[];
  deploymentAt: string | null;
  ledgerId: string;
};

export type Cp40VerifyResponse = {
  config: Cp40ProjectConfig | null;
  result: Cp40Result | null;
  reply: string;
  gates: Cp40GateStatus;
};

export async function runCp40Verification({
  data,
}: {
  data: { question: string };
}): Promise<Cp40VerifyResponse> {
  return apiFetch("/api/cp40/verify", { method: "POST", body: JSON.stringify(data) });
}

export async function getCp40EvidenceScreenshot({
  data,
}: {
  data: { fileName: string };
}): Promise<{ dataUrl: string } | null> {
  return apiFetchOrNull(`/api/cp40/evidence?file_name=${encodeURIComponent(data.fileName)}`);
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
