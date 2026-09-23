export type AutoStatus = "compliant" | "non-compliant" | "needs-review";
export type ManualStatus = "manual-in-progress" | "manual-waiting";
export type Status = AutoStatus | ManualStatus;

export type SourceKey = "github" | "jira" | "mail" | "manual";

export type ProjectId = "project-a" | "project-b" | "project-c";
export type ProjectName = "PIT Armour" | "SAATHI" | "MPS";

export interface ProjectInfo {
  id: ProjectId;
  name: ProjectName;
  client: string;
  description?: string;
  badgeTone: string;
}

export const projectsData: Record<ProjectId, ProjectInfo> = {
  "project-a": {
    id: "project-a",
    name: "PIT Armour",
    client: "ACME-CLT-01 — Acme Capital",
    description: "Production IT Armour Platform — Core Banking & Financial Systems Governance",
    badgeTone: "bg-primary/10 text-primary border-primary/20",
  },
  "project-b": {
    id: "project-b",
    name: "SAATHI",
    client: "ACME-CLT-02 — Acme Capital",
    description: "SAATHI — Merchant Payment Gateway & Digital Financial Services",
    badgeTone: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  },
  "project-c": {
    id: "project-c",
    name: "MPS",
    client: "ACME-CLT-03 — Acme Capital",
    description: "MPS — Risk Analytics & BI Cloud Data Platform",
    badgeTone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
};

export function getCheckpointProjectId(cpId: string): ProjectId {
  const num = parseInt(cpId.replace("cp-", ""), 10) || 1;
  // Specific findings assignment:
  // PIT Armour (3 findings, 1 high):
  if (num === 5 || num === 13 || num === 21) return "project-a";
  // SAATHI (2 findings):
  if (num === 25 || num === 60) return "project-b";
  // MPS (2 findings):
  if (num === 28 || num === 71) return "project-c";

  // General distribution for remaining checks:
  if (num <= 24 || (num >= 30 && num <= 45)) return "project-a";
  if ((num >= 51 && num <= 65) || (num >= 76 && num <= 80)) return "project-b";
  return "project-c";
}

export function getCheckpointProjectName(cpId: string): ProjectName {
  const pId = getCheckpointProjectId(cpId);
  return projectsData[pId].name;
}

export type HistoryEntry = { at: string; text: string };

export type AutomatedCheckpoint = {
  kind: "automated";
  id: string;
  ref: string;
  name: string;
  category: string;
  ownerRole: string;
  auditEvidence: string;
  projectId?: ProjectId;
  projectName?: ProjectName;
  sources: SourceKey[];
  sourceLabel: string;
  status: AutoStatus;
  confidence: number;
  syncedMinutesAgo: number;
  stale: boolean;
  detail: string;
  entity: string;
  evidenceFile: string;
  evidence: string;
  // Screenshot evidence in place of the JSON blob — served from /public.
  evidenceImage?: string;
  approver?: { name: string; role: string; valid: boolean; note: string };
  history: HistoryEntry[];
};

export type ManualStep = {
  name: string;
  role: string;
  state: "done" | "pending" | "locked";
  completedBy?: string;
  completedAt?: string;
  ownerEmail?: string;
};

export type Comment = { author: string; at: string; text: string };

export type ManualCheckpoint = {
  kind: "manual";
  id: string;
  ref: string;
  name: string;
  category: string;
  ownerRole: string;
  ownerEmail?: string;
  auditEvidence: string;
  projectId?: ProjectId;
  projectName?: ProjectName;
  sources: SourceKey[];
  sourceLabel: string;
  status: ManualStatus;
  waitingOn: string;
  steps: ManualStep[];
  comments: Comment[];
  history: HistoryEntry[];
};

export type Checkpoint = AutomatedCheckpoint | ManualCheckpoint;

export const statusLabel: Record<Status, string> = {
  compliant: "Compliant",
  "non-compliant": "Non-compliant",
  "needs-review": "Needs review",
  "manual-in-progress": "Manual — in progress",
  "manual-waiting": "Manual — waiting",
};

export const statusTone: Record<Status, "ok" | "fail" | "warn" | "manual"> = {
  compliant: "ok",
  "non-compliant": "fail",
  "needs-review": "warn",
  "manual-in-progress": "manual",
  "manual-waiting": "warn",
};

export const sourceLabels: Record<SourceKey, string> = {
  github: "GitHub",
  jira: "Jira",
  mail: "Mail",
  manual: "Manual",
};

export const categories = [
  "Application Governance",
  "Change Management",
  "Source Code",
  "Secure SDLC",
  "Build & Release",
  "Testing",
  "Deployment",
  "Access Control",
  "Data Security",
  "Patch Management",
  "Backup",
  "Disaster Recovery",
  "Logging",
  "Incident Management",
  "Vendor Management",
  "Business Continuity",
  "Compliance"
];

const rawInitialCheckpoints: Checkpoint[] = [
  {
    kind: "automated",
    id: "cp-1",
    ref: "#1",
    name: "Application owner and technical owner are formally assigned",
    category: "Application Governance",
    ownerRole: "Application Owner",
    auditEvidence: "Ownership Matrix",
    sources: ["jira"],
    sourceLabel: "Jira",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 10,
    stale: false,
    detail: "Verified against " + "Ownership Matrix" + " owned by " + "Application Owner" + ".",
    entity: "REF-1 · " + "Ownership Matrix",
    evidenceFile: "evidence_1_" + "ownership-matrix" + ".json",
    evidence: JSON.stringify({
      itemNumber: 1,
      category: "Application Governance",
      requirement: "Application owner and technical owner are formally assigned",
      ownerRole: "Application Owner",
      auditEvidence: "Ownership Matrix",
      source: "JIRA",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Application Owner", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Ownership Matrix" }
    ]
  },
  {
    kind: "automated",
    id: "cp-2",
    ref: "#2",
    name: "Updated Application Architecture document is available",
    category: "Application Governance",
    ownerRole: "Architect",
    auditEvidence: "Architecture Diagram",
    sources: ["jira"],
    sourceLabel: "Jira",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 17,
    stale: false,
    detail: "Verified against " + "Architecture Diagram" + " owned by " + "Architect" + ".",
    entity: "REF-2 · " + "Architecture Diagram",
    evidenceFile: "evidence_2_" + "architecture-diagram" + ".json",
    evidence: JSON.stringify({
      itemNumber: 2,
      category: "Application Governance",
      requirement: "Updated Application Architecture document is available",
      ownerRole: "Architect",
      auditEvidence: "Architecture Diagram",
      source: "JIRA",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Architect", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Architecture Diagram" }
    ]
  },
  {
    kind: "manual",
    id: "cp-3",
    ref: "#3",
    name: "Approved Application/Process SOP is available",
    category: "Application Governance",
    ownerRole: "Application Owner",
    auditEvidence: "Approved SOP",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "manual-in-progress",
    waitingOn: "Application Owner",
    steps: [
      { name: "Verify " + "Approved SOP", role: "Application Owner", state: "done", completedBy: "Auditor", completedAt: "Today 07:00" },
      { name: "Sign-off and attach documentation", role: "Application Owner", state: "pending" }
    ],
    comments: [
      { author: "Application Owner", at: "Today 07:45", text: "Working on validating " + "Approved SOP" + "." }
    ],
    history: [
      { at: "Today 07:00", text: "Step 1 completed. Awaiting sign-off." }
    ]
  },
  {
    kind: "automated",
    id: "cp-4",
    ref: "#4",
    name: "Application inventory/CMDB is maintained",
    category: "Application Governance",
    ownerRole: "IT",
    auditEvidence: "Application Register",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 31,
    stale: false,
    detail: "Verified against " + "Application Register" + " owned by " + "IT" + ".",
    entity: "REF-4 · " + "Application Register",
    evidenceFile: "evidence_4_" + "application-register" + ".json",
    evidence: JSON.stringify({
      itemNumber: 4,
      category: "Application Governance",
      requirement: "Application inventory/CMDB is maintained",
      ownerRole: "IT",
      auditEvidence: "Application Register",
      source: "MAIL",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "IT", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Application Register" }
    ]
  },
  {
    kind: "automated",
    id: "cp-5",
    ref: "#5",
    name: "SBOM is available for critical applications or approved exception exists",
    category: "Application Governance",
    ownerRole: "Security",
    auditEvidence: "SBOM / Exception Approval",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "needs-review",
    confidence: 78,
    syncedMinutesAgo: 38,
    stale: false,
    detail: "Verified against " + "SBOM / Exception Approval" + " owned by " + "Security" + ".",
    entity: "REF-5 · " + "SBOM / Exception Approval",
    evidenceFile: "evidence_5_" + "sbom-exception-approval" + ".json",
    evidence: JSON.stringify({
      itemNumber: 5,
      category: "Application Governance",
      requirement: "SBOM is available for critical applications or approved exception exists",
      ownerRole: "Security",
      auditEvidence: "SBOM / Exception Approval",
      source: "MAIL",
      verificationState: "needs-review",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Security", valid: false, note: "Review required" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "SBOM / Exception Approval" }
    ]
  },
  {
    kind: "automated",
    id: "cp-6",
    ref: "#6",
    name: "Every change is linked to an approved CR/JIRA",
    category: "Change Management",
    ownerRole: "Developer",
    auditEvidence: "JIRA Ticket",
    sources: ["jira"],
    sourceLabel: "Jira",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 45,
    stale: false,
    detail: "Verified against " + "JIRA Ticket" + " owned by " + "Developer" + ".",
    entity: "REF-6 · " + "JIRA Ticket",
    evidenceFile: "evidence_6_" + "jira-ticket" + ".json",
    evidence: JSON.stringify({
      itemNumber: 6,
      category: "Change Management",
      requirement: "Every change is linked to an approved CR/JIRA",
      ownerRole: "Developer",
      auditEvidence: "JIRA Ticket",
      source: "JIRA",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Developer", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "JIRA Ticket" }
    ]
  },
  {
    kind: "manual",
    id: "cp-7",
    ref: "#7",
    name: "Business justification is documented",
    category: "Change Management",
    ownerRole: "Requestor",
    auditEvidence: "CR Document",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "manual-in-progress",
    waitingOn: "Requestor",
    steps: [
      { name: "Verify " + "CR Document", role: "Requestor", state: "done", completedBy: "Auditor", completedAt: "Today 07:00" },
      { name: "Sign-off and attach documentation", role: "Requestor", state: "pending" }
    ],
    comments: [
      { author: "Requestor", at: "Today 07:45", text: "Working on validating " + "CR Document" + "." }
    ],
    history: [
      { at: "Today 07:00", text: "Step 1 completed. Awaiting sign-off." }
    ]
  },
  {
    kind: "automated",
    id: "cp-8",
    ref: "#8",
    name: "Impact analysis is completed before implementation",
    category: "Change Management",
    ownerRole: "Developer",
    auditEvidence: "Impact Assessment",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 4,
    stale: false,
    detail: "Verified against " + "Impact Assessment" + " owned by " + "Developer" + ".",
    entity: "REF-8 · " + "Impact Assessment",
    evidenceFile: "evidence_8_" + "impact-assessment" + ".json",
    evidence: JSON.stringify({
      itemNumber: 8,
      category: "Change Management",
      requirement: "Impact analysis is completed before implementation",
      ownerRole: "Developer",
      auditEvidence: "Impact Assessment",
      source: "MAIL",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Developer", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Impact Assessment" }
    ]
  },
  {
    kind: "automated",
    id: "cp-9",
    ref: "#9",
    name: "Risk classification is assigned",
    category: "Change Management",
    ownerRole: "CAB",
    auditEvidence: "Risk Assessment",
    sources: ["jira"],
    sourceLabel: "Jira",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 11,
    stale: false,
    detail: "Verified against " + "Risk Assessment" + " owned by " + "CAB" + ".",
    entity: "REF-9 · " + "Risk Assessment",
    evidenceFile: "evidence_9_" + "risk-assessment" + ".json",
    evidence: JSON.stringify({
      itemNumber: 9,
      category: "Change Management",
      requirement: "Risk classification is assigned",
      ownerRole: "CAB",
      auditEvidence: "Risk Assessment",
      source: "JIRA",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "CAB", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Risk Assessment" }
    ]
  },
  {
    kind: "automated",
    id: "cp-10",
    ref: "#10",
    name: "CAB approval is obtained before production deployment",
    category: "Change Management",
    ownerRole: "CAB",
    auditEvidence: "CAB MOM",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "needs-review",
    confidence: 0,
    syncedMinutesAgo: 18,
    stale: false,
    detail: "Verified against " + "CAB MOM" + " owned by " + "CAB" + ".",
    entity: "REF-10 · " + "CAB MOM",
    evidenceFile: "evidence_10_" + "cab-mom" + ".json",
    evidence: JSON.stringify({
      itemNumber: 10,
      category: "Change Management",
      requirement: "CAB approval is obtained before production deployment",
      ownerRole: "CAB",
      auditEvidence: "CAB MOM",
      source: "MAIL",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "CAB", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "CAB MOM" }
    ]
  },
  {
    kind: "manual",
    id: "cp-11",
    ref: "#11",
    name: "Emergency changes follow documented approval process",
    category: "Change Management",
    ownerRole: "CAB",
    auditEvidence: "Emergency Approval",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "manual-waiting",
    waitingOn: "CAB",
    steps: [
      { name: "Verify " + "Emergency Approval", role: "CAB", state: "done", completedBy: "Auditor", completedAt: "Today 07:00" },
      { name: "Sign-off and attach documentation", role: "CAB", state: "pending" }
    ],
    comments: [
      { author: "CAB", at: "Today 07:45", text: "Working on validating " + "Emergency Approval" + "." }
    ],
    history: [
      { at: "Today 07:00", text: "Step 1 completed. Awaiting sign-off." }
    ]
  },
  {
    kind: "automated",
    id: "cp-12",
    ref: "#12",
    name: "Release/version information is maintained",
    category: "Change Management",
    ownerRole: "Release Manager",
    auditEvidence: "Release Notes",
    sources: ["github"],
    sourceLabel: "GitHub",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 32,
    stale: false,
    detail: "Verified against " + "Release Notes" + " owned by " + "Release Manager" + ".",
    entity: "REF-12 · " + "Release Notes",
    evidenceFile: "evidence_12_" + "release-notes" + ".json",
    evidence: JSON.stringify({
      itemNumber: 12,
      category: "Change Management",
      requirement: "Release/version information is maintained",
      ownerRole: "Release Manager",
      auditEvidence: "Release Notes",
      source: "Github",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Release Manager", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Release Notes" }
    ]
  },
  {
    kind: "automated",
    id: "cp-13",
    ref: "#13",
    name: "Post Implementation Review (PIR) is completed",
    category: "Change Management",
    ownerRole: "CAB",
    auditEvidence: "PIR Report",
    sources: ["github"],
    sourceLabel: "GitHub",
    status: "needs-review",
    confidence: 78,
    syncedMinutesAgo: 39,
    stale: false,
    detail: "Verified against " + "PIR Report" + " owned by " + "CAB" + ".",
    entity: "REF-13 · " + "PIR Report",
    evidenceFile: "evidence_13_" + "pir-report" + ".json",
    evidence: JSON.stringify({
      itemNumber: 13,
      category: "Change Management",
      requirement: "Post Implementation Review (PIR) is completed",
      ownerRole: "CAB",
      auditEvidence: "PIR Report",
      source: "Github",
      verificationState: "needs-review",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "CAB", valid: false, note: "Review required" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "PIR Report" }
    ]
  },
  {
    kind: "manual",
    id: "cp-14",
    ref: "#14",
    name: "Change is closed only after successful validation",
    category: "Change Management",
    ownerRole: "CAB",
    auditEvidence: "Closed CR",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "manual-in-progress",
    waitingOn: "CAB",
    steps: [
      { name: "Verify " + "Closed CR", role: "CAB", state: "done", completedBy: "Auditor", completedAt: "Today 07:00" },
      { name: "Sign-off and attach documentation", role: "CAB", state: "pending" }
    ],
    comments: [
      { author: "CAB", at: "Today 07:45", text: "Working on validating " + "Closed CR" + "." }
    ],
    history: [
      { at: "Today 07:00", text: "Step 1 completed. Awaiting sign-off." }
    ]
  },
  {
    kind: "automated",
    id: "cp-15",
    ref: "#15",
    name: "Rollback plan is documented before deployment",
    category: "Change Management",
    ownerRole: "DevOps",
    auditEvidence: "Rollback Plan",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 53,
    stale: false,
    detail: "Verified against " + "Rollback Plan" + " owned by " + "DevOps" + ".",
    entity: "REF-15 · " + "Rollback Plan",
    evidenceFile: "evidence_15_" + "rollback-plan" + ".json",
    evidence: JSON.stringify({
      itemNumber: 15,
      category: "Change Management",
      requirement: "Rollback plan is documented before deployment",
      ownerRole: "DevOps",
      auditEvidence: "Rollback Plan",
      source: "MAIL",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "DevOps", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Rollback Plan" }
    ]
  },
  {
    kind: "automated",
    id: "cp-16",
    ref: "#16",
    name: "Version control system (Git/Azure DevOps) is used",
    category: "Source Code",
    ownerRole: "Developer",
    auditEvidence: "Repository",
    sources: ["github"],
    sourceLabel: "GitHub",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 5,
    stale: false,
    detail: "Verified against " + "Repository" + " owned by " + "Developer" + ".",
    entity: "REF-16 · " + "Repository",
    evidenceFile: "evidence_16_dependency-notification.png",
    evidence: "",
    evidenceImage: "/checkpoint-evidence/cp-16-dependency-notification.png",
    approver: { name: "Audit Bot", role: "Developer", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Repository" }
    ]
  },
  {
    kind: "automated",
    id: "cp-17",
    ref: "#17",
    name: "Source code ownership is defined",
    category: "Source Code",
    ownerRole: "Application Owner",
    auditEvidence: "Ownership Matrix",
    sources: ["jira"],
    sourceLabel: "Jira",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 12,
    stale: false,
    detail: "Verified against " + "Ownership Matrix" + " owned by " + "Application Owner" + ".",
    entity: "REF-17 · " + "Ownership Matrix",
    evidenceFile: "evidence_17_" + "ownership-matrix" + ".json",
    evidence: JSON.stringify({
      itemNumber: 17,
      category: "Source Code",
      requirement: "Source code ownership is defined",
      ownerRole: "Application Owner",
      auditEvidence: "Ownership Matrix",
      source: "JIRA",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Application Owner", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Ownership Matrix" }
    ]
  },
  {
    kind: "automated",
    id: "cp-18",
    ref: "#18",
    name: "Git commits are traceable to approved CRs",
    category: "Source Code",
    ownerRole: "Developer",
    auditEvidence: "Commit History",
    sources: ["github"],
    sourceLabel: "GitHub",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 19,
    stale: false,
    detail: "Verified against " + "Commit History" + " owned by " + "Developer" + ".",
    entity: "REF-18 · " + "Commit History",
    evidenceFile: "evidence_18_" + "commit-history" + ".json",
    evidence: JSON.stringify({
      itemNumber: 18,
      category: "Source Code",
      requirement: "Git commits are traceable to approved CRs",
      ownerRole: "Developer",
      auditEvidence: "Commit History",
      source: "Github",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Developer", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Commit History" }
    ]
  },
  {
    kind: "automated",
    id: "cp-19",
    ref: "#19",
    name: "Branching strategy is followed",
    category: "Source Code",
    ownerRole: "Developer",
    auditEvidence: "Repository",
    sources: ["github"],
    sourceLabel: "GitHub",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 26,
    stale: false,
    detail: "Verified against " + "Repository" + " owned by " + "Developer" + ".",
    entity: "REF-19 · " + "Repository",
    evidenceFile: "evidence_19_" + "repository" + ".json",
    evidence: JSON.stringify({
      itemNumber: 19,
      category: "Source Code",
      requirement: "Branching strategy is followed",
      ownerRole: "Developer",
      auditEvidence: "Repository",
      source: "Github",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Developer", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Repository" }
    ]
  },
  {
    kind: "automated",
    id: "cp-20",
    ref: "#20",
    name: "Pull Request is mandatory for changes",
    category: "Source Code",
    ownerRole: "Developer",
    auditEvidence: "PR History",
    sources: ["github"],
    sourceLabel: "GitHub",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 33,
    stale: false,
    detail: "Verified against " + "PR History" + " owned by " + "Developer" + ".",
    entity: "REF-20 · " + "PR History",
    evidenceFile: "evidence_20_" + "pr-history" + ".json",
    evidence: JSON.stringify({
      itemNumber: 20,
      category: "Source Code",
      requirement: "Pull Request is mandatory for changes",
      ownerRole: "Developer",
      auditEvidence: "PR History",
      source: "Github",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Developer", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "PR History" }
    ]
  },
  {
    kind: "automated",
    id: "cp-21",
    ref: "#21",
    name: "Peer review is completed before merge",
    category: "Source Code",
    ownerRole: "Reviewer",
    auditEvidence: "PR Approval",
    sources: ["github"],
    sourceLabel: "GitHub",
    status: "non-compliant",
    confidence: 60,
    syncedMinutesAgo: 40,
    stale: false,
    detail: "Verified against " + "PR Approval" + " owned by " + "Reviewer" + ".",
    entity: "REF-21 · " + "PR Approval",
    evidenceFile: "evidence_21_" + "pr-approval" + ".json",
    evidence: JSON.stringify({
      itemNumber: 21,
      category: "Source Code",
      requirement: "Peer review is completed before merge",
      ownerRole: "Reviewer",
      auditEvidence: "PR Approval",
      source: "Github",
      verificationState: "non-compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Reviewer", valid: false, note: "Review required" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "PR Approval" }
    ]
  },
  {
    kind: "automated",
    id: "cp-22",
    ref: "#22",
    name: "SAST is performed",
    category: "Secure SDLC",
    ownerRole: "Security",
    auditEvidence: "SAST Report",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 47,
    stale: false,
    detail: "Verified against " + "SAST Report" + " owned by " + "Security" + ".",
    entity: "REF-22 · " + "SAST Report",
    evidenceFile: "evidence_22_" + "sast-report" + ".json",
    evidence: JSON.stringify({
      itemNumber: 22,
      category: "Secure SDLC",
      requirement: "SAST is performed",
      ownerRole: "Security",
      auditEvidence: "SAST Report",
      source: "MAIL",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Security", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "SAST Report" }
    ]
  },
  {
    kind: "automated",
    id: "cp-23",
    ref: "#23",
    name: "DAST is performed before production deployment",
    category: "Secure SDLC",
    ownerRole: "Security",
    auditEvidence: "DAST Report",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 54,
    stale: false,
    detail: "Verified against " + "DAST Report" + " owned by " + "Security" + ".",
    entity: "REF-23 · " + "DAST Report",
    evidenceFile: "evidence_23_" + "dast-report" + ".json",
    evidence: JSON.stringify({
      itemNumber: 23,
      category: "Secure SDLC",
      requirement: "DAST is performed before production deployment",
      ownerRole: "Security",
      auditEvidence: "DAST Report",
      source: "MAIL",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Security", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "DAST Report" }
    ]
  },
  {
    kind: "automated",
    id: "cp-24",
    ref: "#24",
    name: "Open-source dependency scan (SCA) is performed",
    category: "Secure SDLC",
    ownerRole: "Security",
    auditEvidence: "SCA Report",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 6,
    stale: false,
    detail: "Verified against " + "SCA Report" + " owned by " + "Security" + ".",
    entity: "REF-24 · " + "SCA Report",
    evidenceFile: "evidence_24_" + "sca-report" + ".json",
    evidence: JSON.stringify({
      itemNumber: 24,
      category: "Secure SDLC",
      requirement: "Open-source dependency scan (SCA) is performed",
      ownerRole: "Security",
      auditEvidence: "SCA Report",
      source: "MAIL",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Security", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "SCA Report" }
    ]
  },
  {
    kind: "automated",
    id: "cp-25",
    ref: "#25",
    name: "Security vulnerabilities are tracked to closure",
    category: "Secure SDLC",
    ownerRole: "Security",
    auditEvidence: "Vulnerability Tracker",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "needs-review",
    confidence: 78,
    syncedMinutesAgo: 13,
    stale: false,
    detail: "Verified against " + "Vulnerability Tracker" + " owned by " + "Security" + ".",
    entity: "REF-25 · " + "Vulnerability Tracker",
    evidenceFile: "evidence_25_" + "vulnerability-tracker" + ".json",
    evidence: JSON.stringify({
      itemNumber: 25,
      category: "Secure SDLC",
      requirement: "Security vulnerabilities are tracked to closure",
      ownerRole: "Security",
      auditEvidence: "Vulnerability Tracker",
      source: "MAIL",
      verificationState: "needs-review",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Security", valid: false, note: "Review required" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Vulnerability Tracker" }
    ]
  },
  {
    kind: "automated",
    id: "cp-26",
    ref: "#26",
    name: "High/Critical vulnerabilities are resolved before release",
    category: "Secure SDLC",
    ownerRole: "Security",
    auditEvidence: "Closure Evidence",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 20,
    stale: false,
    detail: "Verified against " + "Closure Evidence" + " owned by " + "Security" + ".",
    entity: "REF-26 · " + "Closure Evidence",
    evidenceFile: "evidence_26_" + "closure-evidence" + ".json",
    evidence: JSON.stringify({
      itemNumber: 26,
      category: "Secure SDLC",
      requirement: "High/Critical vulnerabilities are resolved before release",
      ownerRole: "Security",
      auditEvidence: "Closure Evidence",
      source: "MAIL",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Security", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Closure Evidence" }
    ]
  },
  {
    kind: "automated",
    id: "cp-27",
    ref: "#27",
    name: "Secrets are not stored in source code",
    category: "Secure SDLC",
    ownerRole: "Developer",
    auditEvidence: "Secret Scan Report",
    sources: ["github"],
    sourceLabel: "GitHub",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 27,
    stale: false,
    detail: "Verified against " + "Secret Scan Report" + " owned by " + "Developer" + ".",
    entity: "REF-27 · " + "Secret Scan Report",
    evidenceFile: "evidence_27_" + "secret-scan-report" + ".json",
    evidence: JSON.stringify({
      itemNumber: 27,
      category: "Secure SDLC",
      requirement: "Secrets are not stored in source code",
      ownerRole: "Developer",
      auditEvidence: "Secret Scan Report",
      source: "Github",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Developer", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Secret Scan Report" }
    ]
  },
  {
    kind: "automated",
    id: "cp-28",
    ref: "#28",
    name: "Secure coding standards are followed",
    category: "Secure SDLC",
    ownerRole: "Development Lead",
    auditEvidence: "Coding Standard",
    sources: ["github"],
    sourceLabel: "GitHub",
    status: "needs-review",
    confidence: 78,
    syncedMinutesAgo: 34,
    stale: false,
    detail: "Verified against " + "Coding Standard" + " owned by " + "Development Lead" + ".",
    entity: "REF-28 · " + "Coding Standard",
    evidenceFile: "evidence_28_" + "coding-standard" + ".json",
    evidence: JSON.stringify({
      itemNumber: 28,
      category: "Secure SDLC",
      requirement: "Secure coding standards are followed",
      ownerRole: "Development Lead",
      auditEvidence: "Coding Standard",
      source: "Github",
      verificationState: "needs-review",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Development Lead", valid: false, note: "Review required" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Coding Standard" }
    ]
  },
  {
    kind: "automated",
    id: "cp-29",
    ref: "#29",
    name: "CI/CD quality gates enforce security validation",
    category: "Secure SDLC",
    ownerRole: "DevOps",
    auditEvidence: "Pipeline Configuration",
    sources: ["github"],
    sourceLabel: "GitHub",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 41,
    stale: false,
    detail: "Verified against " + "Pipeline Configuration" + " owned by " + "DevOps" + ".",
    entity: "REF-29 · " + "Pipeline Configuration",
    evidenceFile: "evidence_29_" + "pipeline-configuration" + ".json",
    evidence: JSON.stringify({
      itemNumber: 29,
      category: "Secure SDLC",
      requirement: "CI/CD quality gates enforce security validation",
      ownerRole: "DevOps",
      auditEvidence: "Pipeline Configuration",
      source: "Github",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "DevOps", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Pipeline Configuration" }
    ]
  },
  {
    kind: "automated",
    id: "cp-30",
    ref: "#30",
    name: "CI/CD pipeline is used for build and deployment",
    category: "Build & Release",
    ownerRole: "DevOps",
    auditEvidence: "Pipeline Logs",
    sources: ["github"],
    sourceLabel: "GitHub",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 48,
    stale: false,
    detail: "Verified against " + "Pipeline Logs" + " owned by " + "DevOps" + ".",
    entity: "REF-30 · " + "Pipeline Logs",
    evidenceFile: "evidence_30_" + "pipeline-logs" + ".json",
    evidence: JSON.stringify({
      itemNumber: 30,
      category: "Build & Release",
      requirement: "CI/CD pipeline is used for build and deployment",
      ownerRole: "DevOps",
      auditEvidence: "Pipeline Logs",
      source: "Github",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "DevOps", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Pipeline Logs" }
    ]
  },
  {
    kind: "automated",
    id: "cp-31",
    ref: "#31",
    name: "Build artifacts are version controlled",
    category: "Build & Release",
    ownerRole: "DevOps",
    auditEvidence: "Artifact Repository",
    sources: ["github"],
    sourceLabel: "GitHub",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 55,
    stale: false,
    detail: "Verified against " + "Artifact Repository" + " owned by " + "DevOps" + ".",
    entity: "REF-31 · " + "Artifact Repository",
    evidenceFile: "evidence_31_" + "artifact-repository" + ".json",
    evidence: JSON.stringify({
      itemNumber: 31,
      category: "Build & Release",
      requirement: "Build artifacts are version controlled",
      ownerRole: "DevOps",
      auditEvidence: "Artifact Repository",
      source: "Github",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "DevOps", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Artifact Repository" }
    ]
  },
  {
    kind: "automated",
    id: "cp-32",
    ref: "#32",
    name: "Deployment package is generated from tagged source",
    category: "Build & Release",
    ownerRole: "DevOps",
    auditEvidence: "Git Tag",
    sources: ["github"],
    sourceLabel: "GitHub",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 7,
    stale: false,
    detail: "Verified against " + "Git Tag" + " owned by " + "DevOps" + ".",
    entity: "REF-32 · " + "Git Tag",
    evidenceFile: "evidence_32_" + "git-tag" + ".json",
    evidence: JSON.stringify({
      itemNumber: 32,
      category: "Build & Release",
      requirement: "Deployment package is generated from tagged source",
      ownerRole: "DevOps",
      auditEvidence: "Git Tag",
      source: "Github",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "DevOps", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Git Tag" }
    ]
  },
  {
    kind: "automated",
    id: "cp-33",
    ref: "#33",
    name: "Release notes are maintained",
    category: "Build & Release",
    ownerRole: "Release Manager",
    auditEvidence: "Release Notes",
    sources: ["jira"],
    sourceLabel: "Jira",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 14,
    stale: false,
    detail: "Verified against " + "Release Notes" + " owned by " + "Release Manager" + ".",
    entity: "REF-33 · " + "Release Notes",
    evidenceFile: "evidence_33_" + "release-notes" + ".json",
    evidence: JSON.stringify({
      itemNumber: 33,
      category: "Build & Release",
      requirement: "Release notes are maintained",
      ownerRole: "Release Manager",
      auditEvidence: "Release Notes",
      source: "JIRA",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Release Manager", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Release Notes" }
    ]
  },
  {
    kind: "manual",
    id: "cp-34",
    ref: "#34",
    name: "Deployment communication is shared",
    category: "Build & Release",
    ownerRole: "Release Manager",
    auditEvidence: "Email",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "manual-in-progress",
    waitingOn: "Release Manager",
    steps: [
      { name: "Verify " + "Email", role: "Release Manager", state: "done", completedBy: "Auditor", completedAt: "Today 07:00" },
      { name: "Sign-off and attach documentation", role: "Release Manager", state: "pending" }
    ],
    comments: [
      { author: "Release Manager", at: "Today 07:45", text: "Working on validating " + "Email" + "." }
    ],
    history: [
      { at: "Today 07:00", text: "Step 1 completed. Awaiting sign-off." }
    ]
  },
  {
    kind: "automated",
    id: "cp-35",
    ref: "#35",
    name: "Functional testing completed",
    category: "Testing",
    ownerRole: "QA",
    auditEvidence: "Test Report",
    sources: ["jira"],
    sourceLabel: "Jira",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 28,
    stale: false,
    detail: "Verified against " + "Test Report" + " owned by " + "QA" + ".",
    entity: "REF-35 · " + "Test Report",
    evidenceFile: "evidence_35_" + "test-report" + ".json",
    evidence: JSON.stringify({
      itemNumber: 35,
      category: "Testing",
      requirement: "Functional testing completed",
      ownerRole: "QA",
      auditEvidence: "Test Report",
      source: "JIRA",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "QA", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Test Report" }
    ]
  },
  {
    kind: "automated",
    id: "cp-36",
    ref: "#36",
    name: "Regression testing completed",
    category: "Testing",
    ownerRole: "QA",
    auditEvidence: "Regression Report",
    sources: ["jira"],
    sourceLabel: "Jira",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 35,
    stale: false,
    detail: "Verified against " + "Regression Report" + " owned by " + "QA" + ".",
    entity: "REF-36 · " + "Regression Report",
    evidenceFile: "evidence_36_" + "regression-report" + ".json",
    evidence: JSON.stringify({
      itemNumber: 36,
      category: "Testing",
      requirement: "Regression testing completed",
      ownerRole: "QA",
      auditEvidence: "Regression Report",
      source: "JIRA",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "QA", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Regression Report" }
    ]
  },
  {
    kind: "manual",
    id: "cp-37",
    ref: "#37",
    name: "UAT completed successfully",
    category: "Testing",
    ownerRole: "Business/QA",
    auditEvidence: "UAT Report",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "manual-in-progress",
    waitingOn: "Business/QA",
    steps: [
      { name: "Verify " + "UAT Report", role: "Business/QA", state: "done", completedBy: "Auditor", completedAt: "Today 07:00" },
      { name: "Sign-off and attach documentation", role: "Business/QA", state: "pending" }
    ],
    comments: [
      { author: "Business/QA", at: "Today 07:45", text: "Working on validating " + "UAT Report" + "." }
    ],
    history: [
      { at: "Today 07:00", text: "Step 1 completed. Awaiting sign-off." }
    ]
  },
  {
    kind: "manual",
    id: "cp-38",
    ref: "#38",
    name: "UAT Sign-Off: [CR-POC-1] – [JIRA-POC-1][PIT-ARMOUR]",
    category: "Testing",
    ownerRole: "Business",
    ownerEmail: "Akhil@neweltechnologies.com",
    auditEvidence: "Sign-off Email",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "manual-in-progress",
    waitingOn: "Business",
    steps: [
      { name: "Verify " + "Sign-off Email", role: "Business", state: "done", completedBy: "Auditor", completedAt: "Today 07:00", ownerEmail: "Akhil@neweltechnologies.com" },
      { name: "Sign-off and attach documentation", role: "Business", state: "pending" }
    ],
    comments: [
      { author: "Business", at: "Today 07:45", text: "Working on validating " + "Sign-off Email" + "." }
    ],
    history: [
      { at: "Today 07:00", text: "Step 1 completed. Awaiting sign-off." }
    ]
  },
  {
    kind: "automated",
    id: "cp-39",
    ref: "#39",
    name: "Smoke testing completed after deployment",
    category: "Testing",
    ownerRole: "QA",
    auditEvidence: "Smoke Test Report",
    sources: ["jira"],
    sourceLabel: "Jira",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 56,
    stale: false,
    detail: "Verified against " + "Smoke Test Report" + " owned by " + "QA" + ".",
    entity: "REF-39 · " + "Smoke Test Report",
    evidenceFile: "evidence_39_" + "smoke-test-report" + ".json",
    evidence: JSON.stringify({
      itemNumber: 39,
      category: "Testing",
      requirement: "Smoke testing completed after deployment",
      ownerRole: "QA",
      auditEvidence: "Smoke Test Report",
      source: "JIRA",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "QA", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Smoke Test Report" }
    ]
  },
  {
    kind: "automated",
    id: "cp-40",
    ref: "#40",
    name: "Production deployment request is approved",
    category: "Deployment",
    ownerRole: "CAB",
    auditEvidence: "Deployment Ticket",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 8,
    stale: false,
    detail: "Verified against " + "Deployment Ticket" + " owned by " + "CAB" + ".",
    entity: "REF-40 · " + "Deployment Ticket",
    evidenceFile: "evidence_40_" + "deployment-ticket" + ".json",
    evidence: JSON.stringify({
      itemNumber: 40,
      category: "Deployment",
      requirement: "Production deployment request is approved",
      ownerRole: "CAB",
      auditEvidence: "Deployment Ticket",
      source: "MAIL",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "CAB", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Deployment Ticket" }
    ]
  },
  {
    kind: "automated",
    id: "cp-41",
    ref: "#41",
    name: "Deployment performed by authorized personnel",
    category: "Deployment",
    ownerRole: "DevOps",
    auditEvidence: "Deployment Log",
    sources: ["github"],
    sourceLabel: "GitHub",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 15,
    stale: false,
    detail: "Verified against " + "Deployment Log" + " owned by " + "DevOps" + ".",
    entity: "REF-41 · " + "Deployment Log",
    evidenceFile: "evidence_41_" + "deployment-log" + ".json",
    evidence: JSON.stringify({
      itemNumber: 41,
      category: "Deployment",
      requirement: "Deployment performed by authorized personnel",
      ownerRole: "DevOps",
      auditEvidence: "Deployment Log",
      source: "Github",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "DevOps", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Deployment Log" }
    ]
  },
  {
    kind: "automated",
    id: "cp-42",
    ref: "#42",
    name: "Deployment executed within approved window",
    category: "Deployment",
    ownerRole: "DevOps",
    auditEvidence: "Change Calendar",
    sources: ["github"],
    sourceLabel: "GitHub",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 22,
    stale: false,
    detail: "Verified against " + "Change Calendar" + " owned by " + "DevOps" + ".",
    entity: "REF-42 · " + "Change Calendar",
    evidenceFile: "evidence_42_" + "change-calendar" + ".json",
    evidence: JSON.stringify({
      itemNumber: 42,
      category: "Deployment",
      requirement: "Deployment executed within approved window",
      ownerRole: "DevOps",
      auditEvidence: "Change Calendar",
      source: "Github",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "DevOps", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Change Calendar" }
    ]
  },
  {
    kind: "automated",
    id: "cp-43",
    ref: "#43",
    name: "Backup taken before deployment",
    category: "Deployment",
    ownerRole: "DBA",
    auditEvidence: "Backup Log",
    sources: ["manual"],
    sourceLabel: "Manual",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 29,
    stale: false,
    detail: "Verified against " + "Backup Log" + " owned by " + "DBA" + ".",
    entity: "REF-43 · " + "Backup Log",
    evidenceFile: "evidence_43_" + "backup-log" + ".json",
    evidence: JSON.stringify({
      itemNumber: 43,
      category: "Deployment",
      requirement: "Backup taken before deployment",
      ownerRole: "DBA",
      auditEvidence: "Backup Log",
      source: "manual",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "DBA", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Backup Log" }
    ]
  },
  {
    kind: "manual",
    id: "cp-44",
    ref: "#44",
    name: "Rollback procedure validated",
    category: "Deployment",
    ownerRole: "DevOps",
    auditEvidence: "Rollback Evidence",
    sources: ["manual"],
    sourceLabel: "Manual",
    status: "manual-in-progress",
    waitingOn: "DevOps",
    steps: [
      { name: "Verify " + "Rollback Evidence", role: "DevOps", state: "done", completedBy: "Auditor", completedAt: "Today 07:00" },
      { name: "Sign-off and attach documentation", role: "DevOps", state: "pending" }
    ],
    comments: [
      { author: "DevOps", at: "Today 07:45", text: "Working on validating " + "Rollback Evidence" + "." }
    ],
    history: [
      { at: "Today 07:00", text: "Step 1 completed. Awaiting sign-off." }
    ]
  },
  {
    kind: "automated",
    id: "cp-45",
    ref: "#45",
    name: "Authentication integrated with AD/SSO where applicable",
    category: "Access Control",
    ownerRole: "Infra",
    auditEvidence: "Configuration",
    sources: ["jira"],
    sourceLabel: "Jira",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 43,
    stale: false,
    detail: "Verified against " + "Configuration" + " owned by " + "Infra" + ".",
    entity: "REF-45 · " + "Configuration",
    evidenceFile: "evidence_45_" + "configuration" + ".json",
    evidence: JSON.stringify({
      itemNumber: 45,
      category: "Access Control",
      requirement: "Authentication integrated with AD/SSO where applicable",
      ownerRole: "Infra",
      auditEvidence: "Configuration",
      source: "JIRA",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Infra", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Configuration" }
    ]
  },
  {
    kind: "automated",
    id: "cp-46",
    ref: "#46",
    name: "MFA is enabled",
    category: "Access Control",
    ownerRole: "Security",
    auditEvidence: "MFA Configuration",
    sources: ["jira"],
    sourceLabel: "Jira",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 50,
    stale: false,
    detail: "Verified against " + "MFA Configuration" + " owned by " + "Security" + ".",
    entity: "REF-46 · " + "MFA Configuration",
    evidenceFile: "evidence_46_" + "mfa-configuration" + ".json",
    evidence: JSON.stringify({
      itemNumber: 46,
      category: "Access Control",
      requirement: "MFA is enabled",
      ownerRole: "Security",
      auditEvidence: "MFA Configuration",
      source: "JIRA",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Security", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "MFA Configuration" }
    ]
  },
  {
    kind: "manual",
    id: "cp-47",
    ref: "#47",
    name: "Password policy complies with organizational standards",
    category: "Access Control",
    ownerRole: "Security",
    auditEvidence: "Password Policy",
    sources: ["manual"],
    sourceLabel: "Manual",
    status: "manual-in-progress",
    waitingOn: "Security",
    steps: [
      { name: "Verify " + "Password Policy", role: "Security", state: "done", completedBy: "Auditor", completedAt: "Today 07:00" },
      { name: "Sign-off and attach documentation", role: "Security", state: "pending" }
    ],
    comments: [
      { author: "Security", at: "Today 07:45", text: "Working on validating " + "Password Policy" + "." }
    ],
    history: [
      { at: "Today 07:00", text: "Step 1 completed. Awaiting sign-off." }
    ]
  },
  {
    kind: "automated",
    id: "cp-48",
    ref: "#48",
    name: "Access Control Matrix is maintained",
    category: "Access Control",
    ownerRole: "Security",
    auditEvidence: "ACM",
    sources: ["jira"],
    sourceLabel: "Jira",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 9,
    stale: false,
    detail: "Verified against " + "ACM" + " owned by " + "Security" + ".",
    entity: "REF-48 · " + "ACM",
    evidenceFile: "evidence_48_" + "acm" + ".json",
    evidence: JSON.stringify({
      itemNumber: 48,
      category: "Access Control",
      requirement: "Access Control Matrix is maintained",
      ownerRole: "Security",
      auditEvidence: "ACM",
      source: "JIRA",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Security", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "ACM" }
    ]
  },
  {
    kind: "automated",
    id: "cp-49",
    ref: "#49",
    name: "User access provisioning follows approval workflow",
    category: "Access Control",
    ownerRole: "Service Desk",
    auditEvidence: "Access Request",
    sources: ["jira"],
    sourceLabel: "Jira",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 16,
    stale: false,
    detail: "Verified against " + "Access Request" + " owned by " + "Service Desk" + ".",
    entity: "REF-49 · " + "Access Request",
    evidenceFile: "evidence_49_" + "access-request" + ".json",
    evidence: JSON.stringify({
      itemNumber: 49,
      category: "Access Control",
      requirement: "User access provisioning follows approval workflow",
      ownerRole: "Service Desk",
      auditEvidence: "Access Request",
      source: "JIRA",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Service Desk", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Access Request" }
    ]
  },
  {
    kind: "manual",
    id: "cp-50",
    ref: "#50",
    name: "Periodic user access reviews are performed",
    category: "Access Control",
    ownerRole: "Security",
    auditEvidence: "Access Review",
    sources: ["jira"],
    sourceLabel: "Jira",
    status: "manual-waiting",
    waitingOn: "Security",
    steps: [
      { name: "Verify " + "Access Review", role: "Security", state: "done", completedBy: "Auditor", completedAt: "Today 07:00" },
      { name: "Sign-off and attach documentation", role: "Security", state: "pending" }
    ],
    comments: [
      { author: "Security", at: "Today 07:45", text: "Working on validating " + "Access Review" + "." }
    ],
    history: [
      { at: "Today 07:00", text: "Step 1 completed. Awaiting sign-off." }
    ]
  },
  {
    kind: "automated",
    id: "cp-51",
    ref: "#51",
    name: "Privileged accounts are managed securely",
    category: "Access Control",
    ownerRole: "Security",
    auditEvidence: "PAM/Vault Report",
    sources: ["jira"],
    sourceLabel: "Jira",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 30,
    stale: false,
    detail: "Verified against " + "PAM/Vault Report" + " owned by " + "Security" + ".",
    entity: "REF-51 · " + "PAM/Vault Report",
    evidenceFile: "evidence_51_" + "pam-vault-report" + ".json",
    evidence: JSON.stringify({
      itemNumber: 51,
      category: "Access Control",
      requirement: "Privileged accounts are managed securely",
      ownerRole: "Security",
      auditEvidence: "PAM/Vault Report",
      source: "JIRA",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Security", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "PAM/Vault Report" }
    ]
  },
  {
    kind: "automated",
    id: "cp-52",
    ref: "#52",
    name: "Developers do not have unauthorized production write access",
    category: "Access Control",
    ownerRole: "Infra",
    auditEvidence: "Access Matrix",
    sources: ["jira"],
    sourceLabel: "Jira",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 37,
    stale: false,
    detail: "Verified against " + "Access Matrix" + " owned by " + "Infra" + ".",
    entity: "REF-52 · " + "Access Matrix",
    evidenceFile: "evidence_52_" + "access-matrix" + ".json",
    evidence: JSON.stringify({
      itemNumber: 52,
      category: "Access Control",
      requirement: "Developers do not have unauthorized production write access",
      ownerRole: "Infra",
      auditEvidence: "Access Matrix",
      source: "JIRA",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Infra", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Access Matrix" }
    ]
  },
  {
    kind: "manual",
    id: "cp-53",
    ref: "#53",
    name: "Sensitive data is masked in application screens",
    category: "Data Security",
    ownerRole: "Developer",
    auditEvidence: "Screenshot",
    sources: ["manual"],
    sourceLabel: "Manual",
    status: "manual-in-progress",
    waitingOn: "Developer",
    steps: [
      { name: "Verify " + "Screenshot", role: "Developer", state: "done", completedBy: "Auditor", completedAt: "Today 07:00" },
      { name: "Sign-off and attach documentation", role: "Developer", state: "pending" }
    ],
    comments: [
      { author: "Developer", at: "Today 07:45", text: "Working on validating " + "Screenshot" + "." }
    ],
    history: [
      { at: "Today 07:00", text: "Step 1 completed. Awaiting sign-off." }
    ]
  },
  {
    kind: "automated",
    id: "cp-54",
    ref: "#54",
    name: "Sensitive test data is masked in non-production",
    category: "Data Security",
    ownerRole: "QA",
    auditEvidence: "Masking Evidence",
    sources: ["manual"],
    sourceLabel: "Manual",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 51,
    stale: false,
    detail: "Verified against " + "Masking Evidence" + " owned by " + "QA" + ".",
    entity: "REF-54 · " + "Masking Evidence",
    evidenceFile: "evidence_54_" + "masking-evidence" + ".json",
    evidence: JSON.stringify({
      itemNumber: 54,
      category: "Data Security",
      requirement: "Sensitive test data is masked in non-production",
      ownerRole: "QA",
      auditEvidence: "Masking Evidence",
      source: "manual",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "QA", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Masking Evidence" }
    ]
  },
  {
    kind: "automated",
    id: "cp-55",
    ref: "#55",
    name: "Database RBAC is implemented",
    category: "Data Security",
    ownerRole: "DBA",
    auditEvidence: "Role Configuration",
    sources: ["manual"],
    sourceLabel: "Manual",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 3,
    stale: false,
    detail: "Verified against " + "Role Configuration" + " owned by " + "DBA" + ".",
    entity: "REF-55 · " + "Role Configuration",
    evidenceFile: "evidence_55_" + "role-configuration" + ".json",
    evidence: JSON.stringify({
      itemNumber: 55,
      category: "Data Security",
      requirement: "Database RBAC is implemented",
      ownerRole: "DBA",
      auditEvidence: "Role Configuration",
      source: "manual",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "DBA", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Role Configuration" }
    ]
  },
  {
    kind: "automated",
    id: "cp-56",
    ref: "#56",
    name: "Encryption is implemented for sensitive data",
    category: "Data Security",
    ownerRole: "Security",
    auditEvidence: "Encryption Configuration",
    sources: ["manual"],
    sourceLabel: "Manual",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 10,
    stale: false,
    detail: "Verified against " + "Encryption Configuration" + " owned by " + "Security" + ".",
    entity: "REF-56 · " + "Encryption Configuration",
    evidenceFile: "evidence_56_" + "encryption-configuration" + ".json",
    evidence: JSON.stringify({
      itemNumber: 56,
      category: "Data Security",
      requirement: "Encryption is implemented for sensitive data",
      ownerRole: "Security",
      auditEvidence: "Encryption Configuration",
      source: "manual",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Security", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Encryption Configuration" }
    ]
  },
  {
    kind: "automated",
    id: "cp-57",
    ref: "#57",
    name: "Secrets/configuration values are securely managed",
    category: "Data Security",
    ownerRole: "DevOps",
    auditEvidence: "Vault Configuration",
    sources: ["github"],
    sourceLabel: "GitHub",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 17,
    stale: false,
    detail: "Verified against " + "Vault Configuration" + " owned by " + "DevOps" + ".",
    entity: "REF-57 · " + "Vault Configuration",
    evidenceFile: "evidence_57_" + "vault-configuration" + ".json",
    evidence: JSON.stringify({
      itemNumber: 57,
      category: "Data Security",
      requirement: "Secrets/configuration values are securely managed",
      ownerRole: "DevOps",
      auditEvidence: "Vault Configuration",
      source: "Github",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "DevOps", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Vault Configuration" }
    ]
  },
  {
    kind: "manual",
    id: "cp-58",
    ref: "#58",
    name: "Patch inventory is maintained",
    category: "Patch Management",
    ownerRole: "Infra",
    auditEvidence: "Patch Register",
    sources: ["manual"],
    sourceLabel: "Manual",
    status: "manual-in-progress",
    waitingOn: "Infra",
    steps: [
      { name: "Verify " + "Patch Register", role: "Infra", state: "done", completedBy: "Auditor", completedAt: "Today 07:00" },
      { name: "Sign-off and attach documentation", role: "Infra", state: "pending" }
    ],
    comments: [
      { author: "Infra", at: "Today 07:45", text: "Working on validating " + "Patch Register" + "." }
    ],
    history: [
      { at: "Today 07:00", text: "Step 1 completed. Awaiting sign-off." }
    ]
  },
  {
    kind: "automated",
    id: "cp-59",
    ref: "#59",
    name: "Patches are tested before deployment",
    category: "Patch Management",
    ownerRole: "Infra",
    auditEvidence: "Test Report",
    sources: ["jira"],
    sourceLabel: "Jira",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 31,
    stale: false,
    detail: "Verified against " + "Test Report" + " owned by " + "Infra" + ".",
    entity: "REF-59 · " + "Test Report",
    evidenceFile: "evidence_59_" + "test-report" + ".json",
    evidence: JSON.stringify({
      itemNumber: 59,
      category: "Patch Management",
      requirement: "Patches are tested before deployment",
      ownerRole: "Infra",
      auditEvidence: "Test Report",
      source: "JIRA",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Infra", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Test Report" }
    ]
  },
  {
    kind: "automated",
    id: "cp-60",
    ref: "#60",
    name: "VA/PT is performed periodically",
    category: "Patch Management",
    ownerRole: "Security",
    auditEvidence: "VA/PT Report",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "needs-review",
    confidence: 78,
    syncedMinutesAgo: 38,
    stale: false,
    detail: "Verified against " + "VA/PT Report" + " owned by " + "Security" + ".",
    entity: "REF-60 · " + "VA/PT Report",
    evidenceFile: "evidence_60_" + "va-pt-report" + ".json",
    evidence: JSON.stringify({
      itemNumber: 60,
      category: "Patch Management",
      requirement: "VA/PT is performed periodically",
      ownerRole: "Security",
      auditEvidence: "VA/PT Report",
      source: "MAIL",
      verificationState: "needs-review",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Security", valid: false, note: "Review required" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "VA/PT Report" }
    ]
  },
  {
    kind: "automated",
    id: "cp-61",
    ref: "#61",
    name: "Security findings are remediated within SLA",
    category: "Patch Management",
    ownerRole: "Security",
    auditEvidence: "Closure Tracker",
    sources: ["jira"],
    sourceLabel: "Jira",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 45,
    stale: false,
    detail: "Verified against " + "Closure Tracker" + " owned by " + "Security" + ".",
    entity: "REF-61 · " + "Closure Tracker",
    evidenceFile: "evidence_61_" + "closure-tracker" + ".json",
    evidence: JSON.stringify({
      itemNumber: 61,
      category: "Patch Management",
      requirement: "Security findings are remediated within SLA",
      ownerRole: "Security",
      auditEvidence: "Closure Tracker",
      source: "JIRA",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Security", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Closure Tracker" }
    ]
  },
  {
    kind: "manual",
    id: "cp-62",
    ref: "#62",
    name: "Security exceptions are documented and approved",
    category: "Patch Management",
    ownerRole: "Security",
    auditEvidence: "Exception Register",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "manual-waiting",
    waitingOn: "Security",
    steps: [
      { name: "Verify " + "Exception Register", role: "Security", state: "done", completedBy: "Auditor", completedAt: "Today 07:00" },
      { name: "Sign-off and attach documentation", role: "Security", state: "pending" }
    ],
    comments: [
      { author: "Security", at: "Today 07:45", text: "Working on validating " + "Exception Register" + "." }
    ],
    history: [
      { at: "Today 07:00", text: "Step 1 completed. Awaiting sign-off." }
    ]
  },
  {
    kind: "manual",
    id: "cp-63",
    ref: "#63",
    name: "Backup schedule is defined",
    category: "Backup",
    ownerRole: "DBA",
    auditEvidence: "Backup Policy",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "manual-in-progress",
    waitingOn: "DBA",
    steps: [
      { name: "Verify " + "Backup Policy", role: "DBA", state: "done", completedBy: "Auditor", completedAt: "Today 07:00" },
      { name: "Sign-off and attach documentation", role: "DBA", state: "pending" }
    ],
    comments: [
      { author: "DBA", at: "Today 07:45", text: "Working on validating " + "Backup Policy" + "." }
    ],
    history: [
      { at: "Today 07:00", text: "Step 1 completed. Awaiting sign-off." }
    ]
  },
  {
    kind: "automated",
    id: "cp-64",
    ref: "#64",
    name: "Backup retention policy is implemented",
    category: "Backup",
    ownerRole: "DBA",
    auditEvidence: "Retention Policy",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 11,
    stale: false,
    detail: "Verified against " + "Retention Policy" + " owned by " + "DBA" + ".",
    entity: "REF-64 · " + "Retention Policy",
    evidenceFile: "evidence_64_" + "retention-policy" + ".json",
    evidence: JSON.stringify({
      itemNumber: 64,
      category: "Backup",
      requirement: "Backup retention policy is implemented",
      ownerRole: "DBA",
      auditEvidence: "Retention Policy",
      source: "MAIL",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "DBA", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Retention Policy" }
    ]
  },
  {
    kind: "automated",
    id: "cp-65",
    ref: "#65",
    name: "Offsite backup is maintained",
    category: "Backup",
    ownerRole: "Infra",
    auditEvidence: "Backup Configuration",
    sources: ["manual"],
    sourceLabel: "Manual",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 18,
    stale: false,
    detail: "Verified against " + "Backup Configuration" + " owned by " + "Infra" + ".",
    entity: "REF-65 · " + "Backup Configuration",
    evidenceFile: "evidence_65_" + "backup-configuration" + ".json",
    evidence: JSON.stringify({
      itemNumber: 65,
      category: "Backup",
      requirement: "Offsite backup is maintained",
      ownerRole: "Infra",
      auditEvidence: "Backup Configuration",
      source: "manual",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Infra", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Backup Configuration" }
    ]
  },
  {
    kind: "manual",
    id: "cp-66",
    ref: "#66",
    name: "Backup restoration is tested periodically",
    category: "Backup",
    ownerRole: "DBA",
    auditEvidence: "Restore Report",
    sources: ["jira"],
    sourceLabel: "Jira",
    status: "manual-in-progress",
    waitingOn: "DBA",
    steps: [
      { name: "Verify " + "Restore Report", role: "DBA", state: "done", completedBy: "Auditor", completedAt: "Today 07:00" },
      { name: "Sign-off and attach documentation", role: "DBA", state: "pending" }
    ],
    comments: [
      { author: "DBA", at: "Today 07:45", text: "Working on validating " + "Restore Report" + "." }
    ],
    history: [
      { at: "Today 07:00", text: "Step 1 completed. Awaiting sign-off." }
    ]
  },
  {
    kind: "manual",
    id: "cp-67",
    ref: "#67",
    name: "DR plan is documented and tested",
    category: "Disaster Recovery",
    ownerRole: "BCM",
    auditEvidence: "DR Test Report",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "manual-in-progress",
    waitingOn: "BCM",
    steps: [
      { name: "Verify " + "DR Test Report", role: "BCM", state: "done", completedBy: "Auditor", completedAt: "Today 07:00" },
      { name: "Sign-off and attach documentation", role: "BCM", state: "pending" }
    ],
    comments: [
      { author: "BCM", at: "Today 07:45", text: "Working on validating " + "DR Test Report" + "." }
    ],
    history: [
      { at: "Today 07:00", text: "Step 1 completed. Awaiting sign-off." }
    ]
  },
  {
    kind: "automated",
    id: "cp-68",
    ref: "#68",
    name: "Audit logging is enabled",
    category: "Logging",
    ownerRole: "DevOps",
    auditEvidence: "Log Configuration",
    sources: ["github"],
    sourceLabel: "GitHub",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 39,
    stale: false,
    detail: "Verified against " + "Log Configuration" + " owned by " + "DevOps" + ".",
    entity: "REF-68 · " + "Log Configuration",
    evidenceFile: "evidence_68_" + "log-configuration" + ".json",
    evidence: JSON.stringify({
      itemNumber: 68,
      category: "Logging",
      requirement: "Audit logging is enabled",
      ownerRole: "DevOps",
      auditEvidence: "Log Configuration",
      source: "Github",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "DevOps", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Log Configuration" }
    ]
  },
  {
    kind: "automated",
    id: "cp-69",
    ref: "#69",
    name: "Successful and failed login attempts are logged",
    category: "Logging",
    ownerRole: "Security",
    auditEvidence: "Log Sample",
    sources: ["manual"],
    sourceLabel: "Manual",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 46,
    stale: false,
    detail: "Verified against " + "Log Sample" + " owned by " + "Security" + ".",
    entity: "REF-69 · " + "Log Sample",
    evidenceFile: "evidence_69_" + "log-sample" + ".json",
    evidence: JSON.stringify({
      itemNumber: 69,
      category: "Logging",
      requirement: "Successful and failed login attempts are logged",
      ownerRole: "Security",
      auditEvidence: "Log Sample",
      source: "manual",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Security", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Log Sample" }
    ]
  },
  {
    kind: "automated",
    id: "cp-70",
    ref: "#70",
    name: "Database administrator/developer access is logged",
    category: "Logging",
    ownerRole: "DBA",
    auditEvidence: "DB Audit Log",
    sources: ["manual"],
    sourceLabel: "Manual",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 53,
    stale: false,
    detail: "Verified against " + "DB Audit Log" + " owned by " + "DBA" + ".",
    entity: "REF-70 · " + "DB Audit Log",
    evidenceFile: "evidence_70_" + "db-audit-log" + ".json",
    evidence: JSON.stringify({
      itemNumber: 70,
      category: "Logging",
      requirement: "Database administrator/developer access is logged",
      ownerRole: "DBA",
      auditEvidence: "DB Audit Log",
      source: "manual",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "DBA", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "DB Audit Log" }
    ]
  },
  {
    kind: "automated",
    id: "cp-71",
    ref: "#71",
    name: "Logs are reviewed periodically",
    category: "Logging",
    ownerRole: "SOC",
    auditEvidence: "Review Report",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "needs-review",
    confidence: 78,
    syncedMinutesAgo: 5,
    stale: false,
    detail: "Verified against " + "Review Report" + " owned by " + "SOC" + ".",
    entity: "REF-71 · " + "Review Report",
    evidenceFile: "evidence_71_" + "review-report" + ".json",
    evidence: JSON.stringify({
      itemNumber: 71,
      category: "Logging",
      requirement: "Logs are reviewed periodically",
      ownerRole: "SOC",
      auditEvidence: "Review Report",
      source: "MAIL",
      verificationState: "needs-review",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "SOC", valid: false, note: "Review required" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Review Report" }
    ]
  },
  {
    kind: "automated",
    id: "cp-72",
    ref: "#72",
    name: "Logs are retained as per policy",
    category: "Logging",
    ownerRole: "Security",
    auditEvidence: "Retention Policy",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 12,
    stale: false,
    detail: "Verified against " + "Retention Policy" + " owned by " + "Security" + ".",
    entity: "REF-72 · " + "Retention Policy",
    evidenceFile: "evidence_72_" + "retention-policy" + ".json",
    evidence: JSON.stringify({
      itemNumber: 72,
      category: "Logging",
      requirement: "Logs are retained as per policy",
      ownerRole: "Security",
      auditEvidence: "Retention Policy",
      source: "MAIL",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Security", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Retention Policy" }
    ]
  },
  {
    kind: "automated",
    id: "cp-73",
    ref: "#73",
    name: "Incident register is maintained",
    category: "Incident Management",
    ownerRole: "Support",
    auditEvidence: "Incident Register",
    sources: ["jira"],
    sourceLabel: "Jira",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 19,
    stale: false,
    detail: "Verified against " + "Incident Register" + " owned by " + "Support" + ".",
    entity: "REF-73 · " + "Incident Register",
    evidenceFile: "evidence_73_" + "incident-register" + ".json",
    evidence: JSON.stringify({
      itemNumber: 73,
      category: "Incident Management",
      requirement: "Incident register is maintained",
      ownerRole: "Support",
      auditEvidence: "Incident Register",
      source: "JIRA",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Support", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Incident Register" }
    ]
  },
  {
    kind: "manual",
    id: "cp-74",
    ref: "#74",
    name: "RCA is documented for major incidents",
    category: "Incident Management",
    ownerRole: "Support",
    auditEvidence: "RCA Report",
    sources: ["jira"],
    sourceLabel: "Jira",
    status: "manual-in-progress",
    waitingOn: "Support",
    steps: [
      { name: "Verify " + "RCA Report", role: "Support", state: "done", completedBy: "Auditor", completedAt: "Today 07:00" },
      { name: "Sign-off and attach documentation", role: "Support", state: "pending" }
    ],
    comments: [
      { author: "Support", at: "Today 07:45", text: "Working on validating " + "RCA Report" + "." }
    ],
    history: [
      { at: "Today 07:00", text: "Step 1 completed. Awaiting sign-off." }
    ]
  },
  {
    kind: "automated",
    id: "cp-75",
    ref: "#75",
    name: "Corrective and preventive actions are tracked",
    category: "Incident Management",
    ownerRole: "Support",
    auditEvidence: "CAPA Tracker",
    sources: ["jira"],
    sourceLabel: "Jira",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 33,
    stale: false,
    detail: "Verified against " + "CAPA Tracker" + " owned by " + "Support" + ".",
    entity: "REF-75 · " + "CAPA Tracker",
    evidenceFile: "evidence_75_" + "capa-tracker" + ".json",
    evidence: JSON.stringify({
      itemNumber: 75,
      category: "Incident Management",
      requirement: "Corrective and preventive actions are tracked",
      ownerRole: "Support",
      auditEvidence: "CAPA Tracker",
      source: "JIRA",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Support", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "CAPA Tracker" }
    ]
  },
  {
    kind: "automated",
    id: "cp-76",
    ref: "#76",
    name: "Failed deployments are linked to incidents where applicable",
    category: "Incident Management",
    ownerRole: "Support",
    auditEvidence: "Incident Ticket",
    sources: ["jira"],
    sourceLabel: "Jira",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 40,
    stale: false,
    detail: "Verified against " + "Incident Ticket" + " owned by " + "Support" + ".",
    entity: "REF-76 · " + "Incident Ticket",
    evidenceFile: "evidence_76_" + "incident-ticket" + ".json",
    evidence: JSON.stringify({
      itemNumber: 76,
      category: "Incident Management",
      requirement: "Failed deployments are linked to incidents where applicable",
      ownerRole: "Support",
      auditEvidence: "Incident Ticket",
      source: "JIRA",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Support", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Incident Ticket" }
    ]
  },
  {
    kind: "manual",
    id: "cp-77",
    ref: "#77",
    name: "Security clauses are included in vendor contracts",
    category: "Vendor Management",
    ownerRole: "Procurement",
    auditEvidence: "Contract",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "manual-in-progress",
    waitingOn: "Procurement",
    steps: [
      { name: "Verify " + "Contract", role: "Procurement", state: "done", completedBy: "Auditor", completedAt: "Today 07:00" },
      { name: "Sign-off and attach documentation", role: "Procurement", state: "pending" }
    ],
    comments: [
      { author: "Procurement", at: "Today 07:45", text: "Working on validating " + "Contract" + "." }
    ],
    history: [
      { at: "Today 07:00", text: "Step 1 completed. Awaiting sign-off." }
    ]
  },
  {
    kind: "automated",
    id: "cp-78",
    ref: "#78",
    name: "Vendor access is approved and periodically reviewed",
    category: "Vendor Management",
    ownerRole: "Security",
    auditEvidence: "Access Review",
    sources: ["jira"],
    sourceLabel: "Jira",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 54,
    stale: false,
    detail: "Verified against " + "Access Review" + " owned by " + "Security" + ".",
    entity: "REF-78 · " + "Access Review",
    evidenceFile: "evidence_78_" + "access-review" + ".json",
    evidence: JSON.stringify({
      itemNumber: 78,
      category: "Vendor Management",
      requirement: "Vendor access is approved and periodically reviewed",
      ownerRole: "Security",
      auditEvidence: "Access Review",
      source: "JIRA",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Security", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Access Review" }
    ]
  },
  {
    kind: "manual",
    id: "cp-79",
    ref: "#79",
    name: "Vendor performance/security reviews are conducted",
    category: "Vendor Management",
    ownerRole: "Vendor Manager",
    auditEvidence: "Review Report",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "manual-in-progress",
    waitingOn: "Vendor Manager",
    steps: [
      { name: "Verify " + "Review Report", role: "Vendor Manager", state: "done", completedBy: "Auditor", completedAt: "Today 07:00" },
      { name: "Sign-off and attach documentation", role: "Vendor Manager", state: "pending" }
    ],
    comments: [
      { author: "Vendor Manager", at: "Today 07:45", text: "Working on validating " + "Review Report" + "." }
    ],
    history: [
      { at: "Today 07:00", text: "Step 1 completed. Awaiting sign-off." }
    ]
  },
  {
    kind: "manual",
    id: "cp-80",
    ref: "#80",
    name: "Business Continuity Plan (BCP) is available",
    category: "Business Continuity",
    ownerRole: "BCM",
    auditEvidence: "BCP Document",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "manual-in-progress",
    waitingOn: "BCM",
    steps: [
      { name: "Verify " + "BCP Document", role: "BCM", state: "done", completedBy: "Auditor", completedAt: "Today 07:00" },
      { name: "Sign-off and attach documentation", role: "BCM", state: "pending" }
    ],
    comments: [
      { author: "BCM", at: "Today 07:45", text: "Working on validating " + "BCP Document" + "." }
    ],
    history: [
      { at: "Today 07:00", text: "Step 1 completed. Awaiting sign-off." }
    ]
  },
  {
    kind: "manual",
    id: "cp-81",
    ref: "#81",
    name: "Disaster Recovery Plan (DRP) is available",
    category: "Business Continuity",
    ownerRole: "BCM",
    auditEvidence: "DR Document",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "manual-in-progress",
    waitingOn: "BCM",
    steps: [
      { name: "Verify " + "DR Document", role: "BCM", state: "done", completedBy: "Auditor", completedAt: "Today 07:00" },
      { name: "Sign-off and attach documentation", role: "BCM", state: "pending" }
    ],
    comments: [
      { author: "BCM", at: "Today 07:45", text: "Working on validating " + "DR Document" + "." }
    ],
    history: [
      { at: "Today 07:00", text: "Step 1 completed. Awaiting sign-off." }
    ]
  },
  {
    kind: "manual",
    id: "cp-82",
    ref: "#82",
    name: "DR drills are conducted periodically",
    category: "Business Continuity",
    ownerRole: "BCM",
    auditEvidence: "DR Drill Report",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "manual-in-progress",
    waitingOn: "BCM",
    steps: [
      { name: "Verify " + "DR Drill Report", role: "BCM", state: "done", completedBy: "Auditor", completedAt: "Today 07:00" },
      { name: "Sign-off and attach documentation", role: "BCM", state: "pending" }
    ],
    comments: [
      { author: "BCM", at: "Today 07:45", text: "Working on validating " + "DR Drill Report" + "." }
    ],
    history: [
      { at: "Today 07:00", text: "Step 1 completed. Awaiting sign-off." }
    ]
  },
  {
    kind: "automated",
    id: "cp-83",
    ref: "#83",
    name: "Segregation of Duties (Developer != Approver != Deployer) is enforced",
    category: "Compliance",
    ownerRole: "PMO",
    auditEvidence: "Role Matrix",
    sources: ["jira"],
    sourceLabel: "Jira",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 34,
    stale: false,
    detail: "Verified against " + "Role Matrix" + " owned by " + "PMO" + ".",
    entity: "REF-83 · " + "Role Matrix",
    evidenceFile: "evidence_83_" + "role-matrix" + ".json",
    evidence: JSON.stringify({
      itemNumber: 83,
      category: "Compliance",
      requirement: "Segregation of Duties (Developer != Approver != Deployer) is enforced",
      ownerRole: "PMO",
      auditEvidence: "Role Matrix",
      source: "JIRA",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "PMO", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Role Matrix" }
    ]
  },
  {
    kind: "manual",
    id: "cp-84",
    ref: "#84",
    name: "Compliance with regulatory/security requirements is periodically reviewed",
    category: "Compliance",
    ownerRole: "Compliance",
    auditEvidence: "Compliance Assessment",
    sources: ["mail"],
    sourceLabel: "Mail",
    status: "manual-in-progress",
    waitingOn: "Compliance",
    steps: [
      { name: "Verify " + "Compliance Assessment", role: "Compliance", state: "done", completedBy: "Auditor", completedAt: "Today 07:00" },
      { name: "Sign-off and attach documentation", role: "Compliance", state: "pending" }
    ],
    comments: [
      { author: "Compliance", at: "Today 07:45", text: "Working on validating " + "Compliance Assessment" + "." }
    ],
    history: [
      { at: "Today 07:00", text: "Step 1 completed. Awaiting sign-off." }
    ]
  },
  {
    kind: "automated",
    id: "cp-85",
    ref: "#85",
    name: "Audit observations are tracked to closure",
    category: "Compliance",
    ownerRole: "Compliance",
    auditEvidence: "Audit Closure Tracker",
    sources: ["jira"],
    sourceLabel: "Jira",
    status: "compliant",
    confidence: 100,
    syncedMinutesAgo: 48,
    stale: false,
    detail: "Verified against " + "Audit Closure Tracker" + " owned by " + "Compliance" + ".",
    entity: "REF-85 · " + "Audit Closure Tracker",
    evidenceFile: "evidence_85_" + "audit-closure-tracker" + ".json",
    evidence: JSON.stringify({
      itemNumber: 85,
      category: "Compliance",
      requirement: "Audit observations are tracked to closure",
      ownerRole: "Compliance",
      auditEvidence: "Audit Closure Tracker",
      source: "JIRA",
      verificationState: "compliant",
      timestamp: "2026-09-09T08:00:00Z"
    }, null, 2),
    approver: { name: "Audit Bot", role: "Compliance", valid: true, note: "Verified against system logs" },
    history: [
      { at: "Today 08:30", text: "Automated check verified against " + "Audit Closure Tracker" }
    ]
  }
];

export const initialCheckpoints: Checkpoint[] = rawInitialCheckpoints.map((cp) => {
  const pId = getCheckpointProjectId(cp.id);
  return {
    ...cp,
    projectId: pId,
    projectName: projectsData[pId].name,
  };
});

export type ConnectorState = "healthy" | "stale" | "failed";

export type Connector = {
  key: SourceKey;
  name: string;
  state: ConnectorState;
  lastSyncedMinutes: number;
  intervalLabel: string;
  message: string;
  syncing?: boolean;
};

export const initialConnectors: Connector[] = [
  {
    key: "github",
    name: "GitHub",
    state: "healthy",
    lastSyncedMinutes: 6,
    intervalLabel: "every 2h",
    message: "Connected — 3 repositories in scope.",
  },
  {
    key: "jira",
    name: "Jira",
    state: "failed",
    lastSyncedMinutes: 254,
    intervalLabel: "every 4h",
    message: "API rate limit exceeded — retrying in 12m.",
  },
  {
    key: "mail",
    name: "Mail",
    state: "stale",
    lastSyncedMinutes: 118,
    intervalLabel: "every 6h",
    message: "Last synced 118m ago, expected every 6h — approaching stale threshold.",
  },
];

export type FeedEntry = { id: string; at: string; source: string; text: string; fresh?: boolean };

export const initialFeed: FeedEntry[] = [
  {
    id: "f1",
    at: "09:41:02",
    source: "secure-sdlc-worker",
    text: "#28 Secure coding standards adherence flagged Needs review (confidence 74%).",
  },
  {
    id: "f2",
    at: "09:12:48",
    source: "jira-connector",
    text: "Sync failed — API rate limit exceeded, retrying in 12m.",
  },
  {
    id: "f3",
    at: "08:55:19",
    source: "github-worker",
    text: "#21 Peer review check flagged Non-compliant on PR #491 (self-approval).",
  },
  {
    id: "f4",
    at: "08:30:07",
    source: "mail-connector",
    text: "1 message matched UAT-3391 — #38 verified Compliant.",
  },
  {
    id: "f5",
    at: "07:58:33",
    source: "github+jira-worker",
    text: "#6 CR / Jira linkage verified Compliant on PR #482.",
  },
];

export type Module = {
  key: string;
  name: string;
  kindTag: string;
  client: string;
  description: string;
  submodules: string[];
};

export const modules: Module[] = [
  {
    "key": "application-governance",
    "name": "Application Governance",
    "kindTag": "Application Governance",
    "client": "ACME-CLT-01 — Acme Capital",
    "description": "Application ownership, architecture documentation, SOP governance, CMDB register, and SBOM management.",
    "submodules": [
      "Ownership Matrix",
      "Architecture Diagram",
      "Approved SOP",
      "Application Register"
    ]
  },
  {
    "key": "change-management",
    "name": "Change Management",
    "kindTag": "Change Management",
    "client": "ACME-CLT-01 — Acme Capital",
    "description": "Change requests, CAB approvals, risk classifications, release versioning, PIRs, and rollback plans.",
    "submodules": [
      "JIRA Ticket",
      "CR Document",
      "Impact Assessment",
      "Risk Assessment"
    ]
  },
  {
    "key": "source-code",
    "name": "Source Code",
    "kindTag": "Source Code",
    "client": "ACME-CLT-01 — Acme Capital",
    "description": "VCS repositories, code ownership, commit traceability to CRs, branching strategy, and peer review approvals.",
    "submodules": [
      "Repository",
      "Ownership Matrix",
      "Commit History",
      "PR History"
    ]
  },
  {
    "key": "secure-sdlc",
    "name": "Secure SDLC",
    "kindTag": "Secure SDLC",
    "client": "ACME-CLT-01 — Acme Capital",
    "description": "SAST, DAST, SCA dependency scans, vulnerability tracking to closure, secrets scanning, and quality gates.",
    "submodules": [
      "SAST Report",
      "DAST Report",
      "SCA Report",
      "Vulnerability Tracker"
    ]
  },
  {
    "key": "build-and-release",
    "name": "Build & Release",
    "kindTag": "Build & Release",
    "client": "ACME-CLT-01 — Acme Capital",
    "description": "CI/CD automated pipelines, versioned artifact repositories, tagged source releases, and deployment logs.",
    "submodules": [
      "Pipeline Logs",
      "Artifact Repository",
      "Git Tag",
      "Release Notes"
    ]
  },
  {
    "key": "testing",
    "name": "Testing",
    "kindTag": "Testing",
    "client": "ACME-CLT-01 — Acme Capital",
    "description": "Functional test suites, regression test runs, UAT approvals, business sign-offs, and post-deploy smoke tests.",
    "submodules": [
      "Test Report",
      "Regression Report",
      "UAT Report",
      "Sign-off Email"
    ]
  },
  {
    "key": "deployment",
    "name": "Deployment",
    "kindTag": "Deployment",
    "client": "ACME-CLT-01 — Acme Capital",
    "description": "CAB deployment tickets, authorized DevOps personnel, approved maintenance windows, and pre-deploy backups.",
    "submodules": [
      "Deployment Ticket",
      "Deployment Log",
      "Change Calendar",
      "Backup Log"
    ]
  },
  {
    "key": "access-control",
    "name": "Access Control",
    "kindTag": "Access Control",
    "client": "ACME-CLT-01 — Acme Capital",
    "description": "AD/SSO integration, multi-factor authentication (MFA), password compliance, access matrices, and PAM vaults.",
    "submodules": [
      "Configuration",
      "MFA Configuration",
      "Password Policy",
      "ACM"
    ]
  },
  {
    "key": "data-security",
    "name": "Data Security",
    "kindTag": "Data Security",
    "client": "ACME-CLT-01 — Acme Capital",
    "description": "Production screen masking, test data sanitization, database RBAC enforcement, and encryption controls.",
    "submodules": [
      "Screenshot",
      "Masking Evidence",
      "Role Configuration",
      "Encryption Configuration"
    ]
  },
  {
    "key": "patch-management",
    "name": "Patch Management",
    "kindTag": "Patch Management",
    "client": "ACME-CLT-01 — Acme Capital",
    "description": "Operating system and package patch registers, patch testing, regular VA/PT assessments, and SLA tracking.",
    "submodules": [
      "Patch Register",
      "Test Report",
      "VA/PT Report",
      "Closure Tracker"
    ]
  },
  {
    "key": "backup",
    "name": "Backup",
    "kindTag": "Backup",
    "client": "ACME-CLT-01 — Acme Capital",
    "description": "Automated backup schedules, snapshot retention policies, offsite immutable backups, and periodic restore drills.",
    "submodules": [
      "Backup Policy",
      "Retention Policy",
      "Backup Configuration",
      "Restore Report"
    ]
  },
  {
    "key": "disaster-recovery",
    "name": "Disaster Recovery",
    "kindTag": "Disaster Recovery",
    "client": "ACME-CLT-01 — Acme Capital",
    "description": "Comprehensive DR plan, recovery time objectives (RTO/RPO), and verified recovery testing reports.",
    "submodules": [
      "DR Test Report"
    ]
  },
  {
    "key": "logging",
    "name": "Logging",
    "kindTag": "Logging",
    "client": "ACME-CLT-01 — Acme Capital",
    "description": "Centralized audit trails, authentication logs, administrator activity tracking, and SOC retention policy.",
    "submodules": [
      "Log Configuration",
      "Log Sample",
      "DB Audit Log",
      "Review Report"
    ]
  },
  {
    "key": "incident-management",
    "name": "Incident Management",
    "kindTag": "Incident Management",
    "client": "ACME-CLT-01 — Acme Capital",
    "description": "Incident ticketing register, root-cause analyses (RCA), CAPA tracking, and deployment linkage.",
    "submodules": [
      "Incident Register",
      "RCA Report",
      "CAPA Tracker",
      "Incident Ticket"
    ]
  },
  {
    "key": "vendor-management",
    "name": "Vendor Management",
    "kindTag": "Vendor Management",
    "client": "ACME-CLT-01 — Acme Capital",
    "description": "Third-party vendor security clauses, access authorization reviews, and periodic performance audits.",
    "submodules": [
      "Contract",
      "Access Review",
      "Review Report"
    ]
  },
  {
    "key": "business-continuity",
    "name": "Business Continuity",
    "kindTag": "Business Continuity",
    "client": "ACME-CLT-01 — Acme Capital",
    "description": "Business Continuity Plans (BCP), operational resilience documentation, and live crisis simulation drills.",
    "submodules": [
      "BCP Document",
      "DR Document",
      "DR Drill Report"
    ]
  },
  {
    "key": "compliance",
    "name": "Compliance",
    "kindTag": "Compliance",
    "client": "ACME-CLT-01 — Acme Capital",
    "description": "Enforced Segregation of Duties (SoD), periodic regulatory assessments, and continuous audit finding closure.",
    "submodules": [
      "Role Matrix",
      "Compliance Assessment",
      "Audit Closure Tracker"
    ]
  }
];

export const checkpointModule: Record<string, string> = {
  "cp-1": "application-governance",
  "cp-2": "application-governance",
  "cp-3": "application-governance",
  "cp-4": "application-governance",
  "cp-5": "application-governance",
  "cp-6": "change-management",
  "cp-7": "change-management",
  "cp-8": "change-management",
  "cp-9": "change-management",
  "cp-10": "change-management",
  "cp-11": "change-management",
  "cp-12": "change-management",
  "cp-13": "change-management",
  "cp-14": "change-management",
  "cp-15": "change-management",
  "cp-16": "source-code",
  "cp-17": "source-code",
  "cp-18": "source-code",
  "cp-19": "source-code",
  "cp-20": "source-code",
  "cp-21": "source-code",
  "cp-22": "secure-sdlc",
  "cp-23": "secure-sdlc",
  "cp-24": "secure-sdlc",
  "cp-25": "secure-sdlc",
  "cp-26": "secure-sdlc",
  "cp-27": "secure-sdlc",
  "cp-28": "secure-sdlc",
  "cp-29": "secure-sdlc",
  "cp-30": "build-and-release",
  "cp-31": "build-and-release",
  "cp-32": "build-and-release",
  "cp-33": "build-and-release",
  "cp-34": "build-and-release",
  "cp-35": "testing",
  "cp-36": "testing",
  "cp-37": "testing",
  "cp-38": "testing",
  "cp-39": "testing",
  "cp-40": "deployment",
  "cp-41": "deployment",
  "cp-42": "deployment",
  "cp-43": "deployment",
  "cp-44": "deployment",
  "cp-45": "access-control",
  "cp-46": "access-control",
  "cp-47": "access-control",
  "cp-48": "access-control",
  "cp-49": "access-control",
  "cp-50": "access-control",
  "cp-51": "access-control",
  "cp-52": "access-control",
  "cp-53": "data-security",
  "cp-54": "data-security",
  "cp-55": "data-security",
  "cp-56": "data-security",
  "cp-57": "data-security",
  "cp-58": "patch-management",
  "cp-59": "patch-management",
  "cp-60": "patch-management",
  "cp-61": "patch-management",
  "cp-62": "patch-management",
  "cp-63": "backup",
  "cp-64": "backup",
  "cp-65": "backup",
  "cp-66": "backup",
  "cp-67": "disaster-recovery",
  "cp-68": "logging",
  "cp-69": "logging",
  "cp-70": "logging",
  "cp-71": "logging",
  "cp-72": "logging",
  "cp-73": "incident-management",
  "cp-74": "incident-management",
  "cp-75": "incident-management",
  "cp-76": "incident-management",
  "cp-77": "vendor-management",
  "cp-78": "vendor-management",
  "cp-79": "vendor-management",
  "cp-80": "business-continuity",
  "cp-81": "business-continuity",
  "cp-82": "business-continuity",
  "cp-83": "compliance",
  "cp-84": "compliance",
  "cp-85": "compliance"
};

export const complianceTrend = [
  { month: "Apr", compliance: 61, findings: 7 },
  { month: "May", compliance: 64, findings: 6 },
  { month: "Jun", compliance: 68, findings: 6 },
  { month: "Jul", compliance: 71, findings: 4 },
  { month: "Aug", compliance: 74, findings: 3 },
  { month: "Sep", compliance: 78, findings: 2 },
];

export const projectComplianceTrends: Record<ProjectId, { month: string; compliance: number; findings: number }[]> = {
  "project-a": [
    { month: "Apr", compliance: 61, findings: 6 },
    { month: "May", compliance: 64, findings: 5 },
    { month: "Jun", compliance: 68, findings: 5 },
    { month: "Jul", compliance: 71, findings: 4 },
    { month: "Aug", compliance: 74, findings: 3 },
    { month: "Sep", compliance: 78, findings: 2 },
  ],
  "project-b": [
    { month: "Apr", compliance: 74, findings: 3 },
    { month: "May", compliance: 78, findings: 3 },
    { month: "Jun", compliance: 82, findings: 2 },
    { month: "Jul", compliance: 86, findings: 2 },
    { month: "Aug", compliance: 89, findings: 1 },
    { month: "Sep", compliance: 91, findings: 0 },
  ],
  "project-c": [
    { month: "Apr", compliance: 65, findings: 4 },
    { month: "May", compliance: 68, findings: 4 },
    { month: "Jun", compliance: 72, findings: 3 },
    { month: "Jul", compliance: 75, findings: 3 },
    { month: "Aug", compliance: 79, findings: 2 },
    { month: "Sep", compliance: 82, findings: 1 },
  ],
};

export const verificationVolume = [
  { month: "Apr", passed: 412, failed: 96 },
  { month: "May", passed: 468, failed: 84 },
  { month: "Jun", passed: 503, failed: 71 },
  { month: "Jul", passed: 544, failed: 62 },
  { month: "Aug", passed: 588, failed: 44 },
  { month: "Sep", passed: 641, failed: 31 },
];

export type SourceEvent = {
  id: string;
  ref: string;
  title: string;
  meta: string;
  at: string;
  outcome: "verified" | "flagged" | "review";
};

export const sourceEvents: Record<SourceKey, SourceEvent[]> = {
  github: [
    { id: "g1", ref: "PR #482", title: "Add retry to settlement poller", meta: "payments-service · merged by priya.rao", at: "Sep 1, 10:42", outcome: "verified" },
    { id: "g2", ref: "PR #488", title: "Refactor input sanitisation helper", meta: "payments-service · open · standards check 74%", at: "Sep 4, 08:12", outcome: "review" },
    { id: "g3", ref: "PR #491", title: "Hotfix settlement rounding", meta: "payments-service · self-approved by raj.mehta", at: "Sep 3, 13:55", outcome: "flagged" },
    { id: "g4", ref: "main", title: "Branch protection snapshot", meta: "2 reviews required · signed commits enforced", at: "Sep 1, 09:30", outcome: "verified" },
    { id: "g5", ref: "PR #479", title: "Upgrade settlement SDK", meta: "payments-service · merged by neha.patil", at: "Aug 29, 16:20", outcome: "verified" },
  ],
  jira: [
    { id: "j1", ref: "PROJ-482", title: "Settlement poller reliability", meta: "Approved · CAB session 2026-09-01", at: "Sep 1, 09:58", outcome: "verified" },
    { id: "j2", ref: "CR-1187", title: "Payment gateway config change", meta: "Approved · release window Wed", at: "Sep 1, 09:58", outcome: "verified" },
    { id: "j3", ref: "PROJ-491", title: "Rounding hotfix", meta: "No linked change request found", at: "Sep 3, 14:00", outcome: "flagged" },
    { id: "j4", ref: "SYNC", title: "Connector sync attempt", meta: "API rate limit exceeded — retrying in 12m", at: "Sep 4, 09:12", outcome: "flagged" },
  ],
  mail: [
    { id: "m1", ref: "UAT-3391", title: "UAT sign-off — Release R-2026.09", meta: "Anita Deshmukh · Business owner", at: "Sep 2, 18:22", outcome: "verified" },
    { id: "m2", ref: "CR-1187", title: "CAB approval thread", meta: "Priya Rao · Change Advisory Board", at: "Sep 1, 09:58", outcome: "verified" },
    { id: "m3", ref: "SYNC", title: "Mailbox poll", meta: "Last synced 118m ago, expected every 6h", at: "Sep 4, 07:30", outcome: "review" },
  ],
  manual: [
    { id: "w1", ref: "MW-01", title: "Bank reconciliation approval", meta: "Waiting on Finance Manager · 2 of 4 steps", at: "Sep 3, 09:05", outcome: "review" },
    { id: "w2", ref: "MW-02", title: "Backup restoration test", meta: "Waiting on DBA · 1 of 4 steps", at: "Sep 1, 16:00", outcome: "review" },
    { id: "w3", ref: "MW-03", title: "Vendor security review sign-off", meta: "Waiting on Security Team · 0 of 3 steps", at: "Sep 4, 09:00", outcome: "review" },
  ],
};
