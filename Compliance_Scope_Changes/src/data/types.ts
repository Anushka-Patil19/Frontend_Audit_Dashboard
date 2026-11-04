// Shapes used across the Compliance Review Dashboard. The demo data (seed.ts) and,
// later, the backend both return these, so screens never depend on where data comes from.

export type ProjectId = "project-a" | "project-b" | "project-c";
/** A quarter, or a custom period written as custom:<from>:<to> (YYYY-MM-DD, inclusive). */
export type QuarterKey = "FY27-Q1" | "FY27-Q2" | "FY27-Q3" | `custom:${string}:${string}`;
export type QuarterState = "open" | "ready" | "signed-off";

export type Severity = "Critical" | "High" | "Medium" | "Low";
export type Frequency = "per-change" | "periodic" | "continuous" | "document";
export type Period = "quarterly" | "half-yearly" | "yearly";

export interface Project {
  id: ProjectId;
  name: string;
  client: string;
  businessUnit: string;
  description: string;
  onboardedOn: string; // ISO date
}

export interface Checkpoint {
  id: string; // cp-10
  ref: string; // #10
  name: string;
  category: string; // module
  ownerRole: string;
  kind: "automated" | "manual";
  auditEvidence: string;
}

export interface ControlRule {
  frequency: Frequency;
  period?: Period;
  severity: Severity;
  rule: string; // plain-language rule the agent checks
}

export interface Person {
  id: string;
  name: string;
  role: string;
  email: string;
}

export interface ChangeRequest {
  id: string; // CR-PIT-2041
  projectId: ProjectId;
  title: string;
  jira: string;
  release: string;
  component: string;
  raisedAt: string;
  approvedAt: string;
  mergedAt: string; // when the PR merged (between approval and deployment)
  deployedAt: string;
  requester: string; // person id
  approver: string;
  deployer: string;
  pr: string;
}

/** A commit that reached a protected branch without a PR (a direct push, or an admin merge). */
export interface DirectCommit {
  sha: string; // full SHA; the screens show the first 7
  projectId: ProjectId;
  repo: string;
  branch: string;
  author: string; // person id
  pushedAt: string;
  crKey?: string; // CR named in the commit message, if any
  message: string;
}

/** The five NC kinds the reviewer filters by. */
export type NcKind = "failed-check" | "missing-evidence" | "missed-periodic" | "sla-breach" | "reopened";

export type NcEventType =
  | "raised"
  | "notified"
  | "reminder"
  | "escalated-owner"
  | "escalated-cto"
  | "fixed"
  | "approved"
  | "rejected"
  | "evidence-added"
  | "comment";

export interface NcEvent {
  at: string; // ISO with +05:30
  type: NcEventType;
  actor: string; // person id or "agent"
  text: string;
}

export type EvidenceKind = "jira" | "pr" | "email" | "log" | "document";

export interface Evidence {
  id: string;
  kind: EvidenceKind;
  title: string;
  source: string; // Jira, GitHub, Mail, CI/CD, SharePoint
  capturedAt: string;
  missing?: boolean; // the evidence the rule needs was not found
  fields: [string, string][]; // label/value pairs shown in the snapshot
  body?: string[]; // email body or log lines
  highlight?: string; // the line or value that broke the rule
}

export interface AiReading {
  verdict: string;
  confidence: number;
  reasoning: string;
}

export type StatusAtEnd = "closed" | "open" | "pending-approval";

export interface NcCase {
  id: string; // NC-PIT-Q2-007
  projectId: ProjectId;
  quarter: QuarterKey;
  checkpointId: string;
  crId?: string;
  title: string;
  finding: string;
  severity: Severity;
  kinds: NcKind[];
  owner: string; // person id
  raisedAt: string;
  tatDays: number;
  dueAt: string;
  events: NcEvent[];
  evidence: Evidence[];
  ai?: AiReading;
  statusAtEnd: StatusAtEnd;
  closedAt?: string; // when it was closed (may be after the quarter end)
  carriedFrom?: QuarterKey;
  /** Planted for the walkthrough: the agent got it wrong. */
  likelyFalsePositive?: boolean;
}

export interface PeriodicResult {
  projectId: ProjectId;
  quarter: QuarterKey;
  checkpointId: string;
  dueBy: string;
  doneOn?: string;
  status: "on-time" | "late" | "missed" | "not-due";
  evidenceTitle?: string;
}

export type Decision = "confirm" | "observation" | "exception" | "dismiss" | "info";

export interface NcDecision {
  ncId: string;
  decision: Decision;
  note: string;
  at: string;
  by: string;
  severity?: Severity; // reviewer override
  severityReason?: string;
  observationId?: string;
  exceptionExpiry?: string;
  /** Critical exceptions also need the CTO. */
  ctoApprovedAt?: string;
}

export interface SignOff {
  quarter: QuarterKey;
  by: string;
  at: string;
  score: number;
  ncCount: number;
  documentId: string;
}

/* ───────── reviewer workflow records ───────── */

export type ObservationStatus = "queued" | "sent" | "responded" | "fixed" | "verified";

export interface ManagementResponse {
  agree: boolean;
  plan: string;
  targetDate: string;
  by: string;
  at: string;
}

export interface Observation {
  id: string; // OBS-Q2-03
  quarter: QuarterKey;
  projectId: ProjectId;
  ncIds: string[];
  title: string;
  severity: Severity;
  whatsWrong: string;
  expected: string;
  owner: string;
  cc: string[];
  dueAt: string;
  status: ObservationStatus;
  createdAt: string;
  by: string;
  sentAt?: string;
  response?: ManagementResponse;
  fixedAt?: string;
  fixNote?: string;
  verifiedAt?: string;
  verifyNote?: string;
}

export interface InfoRequest {
  ncId: string;
  question: string;
  owner: string;
  askedAt: string;
  dueAt: string;
  reply?: { text: string; at: string; by: string };
}

export interface Comment {
  id: string;
  targetId: string; // NC or observation id
  author: string;
  text: string;
  at: string;
}

export type NotificationKind = "observation-digest" | "info-request" | "report" | "verification" | "exception-approval";
export type EmailStatus = "demo" | "queued" | "sent" | "failed";

export interface Notification {
  id: string;
  at: string;
  kind: NotificationKind;
  to: string[]; // person ids
  cc: string[];
  subject: string;
  body: string[];
  related: string[]; // observation / NC / report ids
  emailStatus: EmailStatus;
  emailNote?: string;
}

export type ReportSection =
  | "summary"
  | "projects"
  | "register"
  | "observations"
  | "exceptions"
  | "carried"
  | "after-period"
  | "periodic"
  | "evidence"
  | "signoff";

export interface ReportRecord {
  id: string;
  quarter: QuarterKey;
  documentId: string;
  final: boolean;
  sections: ReportSection[];
  coverNote: string;
  includeEvidence: boolean;
  generatedAt: string;
  by: string;
  sentTo: { personId: string; at: string }[];
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  quarter?: QuarterKey;
  action: string;
  target: string;
  detail: string;
}
