import type { Checkpoint } from "@/lib/audit-data";

// Manager-view data for the POC, scoped to PIT Armour. Live parts are computed from the
// real checkpoint state (project-a): compliance score, the heatmap's live column,
// audit readiness, the #18 developer issue, and the CAB (#10) / UAT (#38) release gates.
// Everything else is mock, like audit-data.ts.

export const MANAGER_PERSONA = {
  name: "Neha Gupta",
  role: "Engineering Manager",
  bu: "Enterprise",
  project: "PIT Armour",
};

export const COMPLIANCE_TARGET = 90;
export const MTTR_SLA_DAYS = 3;
export const MTTR_DAYS = 2.3;
export const MTTR_TREND = [3.6, 3.1, 2.9, 2.7, 2.5, 2.3];
export const SCORE_TREND_HISTORY = [61, 64, 66, 69, 70]; // + live value appended

export type ComponentId = "api" | "web" | "batch" | "int";

export type Component = {
  id: ComponentId;
  name: string;
  repo: string;
  score: number;
  trend: number[];
  nc: number;
  overdue: number;
  nextRelease: string;
  topIssue: string;
};

export const COMPONENTS: Component[] = [
  {
    id: "api", name: "PIT Armour API", repo: "pit-armour-api", score: 72, trend: [64, 66, 70, 74, 70, 72],
    nc: 2, overdue: 1, nextRelease: "v2.5.0 · Thu 2 Oct", topIssue: "Self-approved PR #13 (#21)",
  },
  {
    id: "web", name: "PIT Armour Web", repo: "pit-armour-web", score: 84, trend: [78, 80, 79, 82, 83, 84],
    nc: 0, overdue: 1, nextRelease: "v2.5.0 · Thu 2 Oct", topIssue: "Rollback plan missing on CR-POC-5 (#15)",
  },
  {
    id: "batch", name: "Batch & Reports", repo: "pit-armour-batch", score: 91, trend: [85, 86, 88, 90, 90, 91],
    nc: 0, overdue: 0, nextRelease: "v1.8.2 · Mon 6 Oct", topIssue: "Outdated dependency in requirements.txt (#16)",
  },
  {
    id: "int", name: "Integrations (Mail / Jira)", repo: "pit-armour-integrations", score: 78, trend: [70, 72, 75, 77, 76, 78],
    nc: 1, overdue: 1, nextRelease: "v2.4.3 · Tue 30 Sep", topIssue: "UAT sign-off pending (#38)",
  },
];

export type TeamMember = {
  name: string;
  role: string;
  open: number;
  overdue: number;
  access: string[];
  status?: "active" | "invited";
};

export const TEAM: TeamMember[] = [
  { name: "Rahul Verma", role: "Developer", open: 4, overdue: 1, access: ["PIT Armour"] },
  { name: "Aditya Sharma", role: "Developer", open: 2, overdue: 1, access: ["PIT Armour", "SAATHI"] },
  { name: "Farhan Ali", role: "DevOps", open: 3, overdue: 1, access: ["PIT Armour", "MPS"] },
  { name: "Kunal Shah", role: "Release Manager", open: 2, overdue: 1, access: ["PIT Armour"] },
  { name: "Tanvi Kulkarni", role: "Reviewer", open: 1, overdue: 0, access: ["PIT Armour"] },
  { name: "Arjun Singh", role: "CAB", open: 1, overdue: 0, access: ["PIT Armour", "SAATHI", "MPS"] },
  { name: "Anushka Patil", role: "Business / UAT", open: 1, overdue: 0, access: ["PIT Armour"] },
];

export type DevIssue = {
  id: string;
  who: string;
  what: string;
  process: string;
  change: string;
  component: ComponentId;
  when: string;
  severity: "nc" | "obs";
  status: "open" | "fixed" | "verifying";
  live?: boolean;
};

export type Escalation = {
  id: string;
  title: string;
  process: string;
  owner: string;
  overdueBy: string;
  blocks: string;
  component: ComponentId;
  severity: "high" | "medium";
  live?: boolean;
};

export type DecisionType = "exception" | "access" | "review" | "escalation";
export type Decision = {
  id: string;
  type: DecisionType;
  title: string;
  requester: string;
  why: string;
  risk: "High" | "Medium" | "Low";
  evidence: string;
  process: string;
};

export const DECISIONS: Decision[] = [
  {
    id: "dec-1", type: "exception", process: "#62 Security exceptions",
    title: "Ship v2.5.0 with 1 High vulnerability (lodash), fix within 14 days",
    requester: "Rahul Verma · Developer", why: "Fix needs a major upgrade; release carries a regulatory deadline.",
    risk: "High", evidence: "Dependabot alert #231 · compensating control: WAF rule",
  },
  {
    id: "dec-2", type: "access", process: "#49 Access provisioning",
    title: "Grant Aditya Sharma read-only access to PIT Armour prod logs for 7 days",
    requester: "Aditya Sharma · Developer", why: "Investigating incident INC-88 (payment retries).",
    risk: "Medium", evidence: "Service desk ticket SD-4411",
  },
  {
    id: "dec-3", type: "review", process: "#50 Periodic access review",
    title: "Sign the Q3 access review for PIT Armour: 42 users, 3 flagged for removal",
    requester: "Priya Nair · Security", why: "Quarterly review due by 5 Oct.",
    risk: "Medium", evidence: "Access review sheet (Q3) · 3 leavers still active",
  },
  {
    id: "dec-4", type: "escalation", process: "#18 CR traceability",
    title: "Accept escalation: PR #14 merged by someone other than the named merger",
    requester: "Rahul Verma · Developer", why: "Named merger was on leave; asks for a one-off exception.",
    risk: "High", evidence: "PR #14 merge record · Jira CR-POC-4 comment \"merged by @Kunal\"",
  },
];

export type GateState = "done" | "pending" | "fail" | "na";
export const GATES = ["CR", "Review", "Scans", "CAB", "Window", "UAT"] as const;
export type Release = {
  id: string;
  version: string;
  date: string;
  daysAway: number; // negative = already deployed
  component: ComponentId;
  changes: string;
  gates: GateState[]; // aligned with GATES
  liveNote?: string;
  blocker?: string; // plain-language reason when a gate fails
};

export type LeadActivity = {
  id: string;
  at: string;
  actor: string;
  text: string;
  source: "jira" | "github" | "mail" | "bitbucket" | "system" | "you";
};

export const LEAD_ACTIVITY: LeadActivity[] = [
  { id: "l1", at: "Today 09:40", actor: "Kunal Shah", source: "jira", text: "moved CR-POC-4 to Pending CAB Approval" },
  { id: "l2", at: "Today 09:12", actor: "Tanvi Kulkarni", source: "github", text: "approved PR #17 (CR-POC-6)" },
  { id: "l3", at: "Today 08:55", actor: "Audit bot", source: "system", text: "#21 flagged new commits on PR #17 after approval" },
  { id: "l4", at: "Today 08:30", actor: "Anushka Patil", source: "mail", text: "was sent the UAT sign-off request for CR-POC-1" },
  { id: "l5", at: "Yesterday 19:05", actor: "Farhan Ali", source: "bitbucket", text: "pushed deploy scripts for v2.5.0 to the infra repo" },
  { id: "l6", at: "Yesterday 17:48", actor: "Arjun Singh", source: "mail", text: "asked for the rollback plan before approving CR-POC-3" },
  { id: "l7", at: "Yesterday 15:20", actor: "Aditya Sharma", source: "github", text: "self-approved PR #13, flagged by #21" },
];

const byId = (list: Checkpoint[], id: string) => list.find((c) => c.id === id);
const isPit = (c: Checkpoint) => (c.projectId ?? "project-a") === "project-a";

const passed = (c: Checkpoint) =>
  c.kind === "automated" ? c.status === "compliant" : c.steps.every((s) => s.state === "done");

export function buildManagerView(checkpoints: Checkpoint[]) {
  const pit = checkpoints.filter(isPit);
  const cp18 = byId(checkpoints, "cp-18");
  const cp10 = byId(checkpoints, "cp-10");
  const cp38 = byId(checkpoints, "cp-38");
  const crStatus = cp18?.status ?? "needs-review";
  const cabDone = cp10?.status === "compliant";
  const uatDone = cp38 ? passed(cp38) : false;

  // ── Compliance score (same formula as the CTO Home) ──
  const score = Math.round(
    (pit.reduce((sum, c) => {
      if (c.kind === "automated") return sum + (c.status === "compliant" ? 1 : 0);
      return sum + c.steps.filter((s) => s.state === "done").length / (c.steps.length || 1);
    }, 0) /
      (pit.length || 1)) *
      100,
  );
  const scoreTrend = [...SCORE_TREND_HISTORY, score];

  // ── Audit readiness (evidence captured = check passed with its evidence) ──
  const byCategory = new Map<string, { total: number; captured: number }>();
  pit.forEach((c) => {
    const e = byCategory.get(c.category) ?? { total: 0, captured: 0 };
    e.total += 1;
    if (passed(c)) e.captured += 1;
    byCategory.set(c.category, e);
  });
  const readiness = [...byCategory.entries()]
    .map(([category, v]) => ({ category, ...v, pct: Math.round((v.captured / v.total) * 100) }))
    .sort((a, b) => a.pct - b.pct);
  const readinessPct = Math.round(
    (readiness.reduce((s, r) => s + r.captured, 0) / (readiness.reduce((s, r) => s + r.total, 0) || 1)) * 100,
  );

  // ── Issues by developers ──
  const issues: DevIssue[] = [
    {
      id: "i-cr", who: "Rahul Verma", live: true, component: "api", change: "CR-POC-4", when: "3 d ago",
      what: "PR #14 merged by someone other than the named merger", process: "#18 CR traceability",
      severity: "nc", status: crStatus === "non-compliant" ? "open" : crStatus === "compliant" ? "fixed" : "verifying",
    },
    { id: "i-2", who: "Aditya Sharma", component: "api", change: "CR-POC-5", when: "Yesterday",
      what: "Self-approved PR #13", process: "#21 PR review", severity: "nc", status: "open" },
    { id: "i-3", who: "Farhan Ali", component: "api", change: "v2.4.2", when: "4 d ago",
      what: "Deployed v2.4.2 two hours outside the approved window", process: "#42 Deployment window", severity: "nc", status: "open" },
    { id: "i-4", who: "Rahul Verma", component: "web", change: "CR-POC-6", when: "Today",
      what: "New commits on PR #17 after approval (stale review)", process: "#21 PR review", severity: "obs", status: "open" },
    { id: "i-5", who: "Aditya Sharma", component: "int", change: "CR-POC-2", when: "6 d ago",
      what: "Secret committed in config.py, revoked within 2 h", process: "#27 Secrets", severity: "nc", status: "fixed" },
    { id: "i-6", who: "Rahul Verma", component: "web", change: "CR-POC-2", when: "9 d ago",
      what: "No CR key in PR #11 title", process: "#6 CR linkage", severity: "obs", status: "fixed" },
    { id: "i-7", who: "Aditya Sharma", component: "batch", change: "CR-POC-7", when: "12 d ago",
      what: "Branch name off-pattern (fix/login)", process: "#19 Branching", severity: "obs", status: "fixed" },
  ];

  // ── Escalations (developer blockers past SLA) ──
  const escalations: Escalation[] = [
    { id: "e-1", title: "Deployment outside the approved window (v2.4.2)", process: "#42 Deployment window",
      owner: "Farhan Ali", overdueBy: "2 d", blocks: "v2.5.0", component: "api", severity: "high" },
    { id: "e-2", title: "Self-approved PR #13 still unresolved", process: "#21 PR review",
      owner: "Aditya Sharma", overdueBy: "1 d", blocks: "v2.5.0", component: "api", severity: "high" },
    { id: "e-3", title: "Release notes for v2.4.3 miss CR-POC-3", process: "#33 Release notes",
      owner: "Kunal Shah", overdueBy: "3 d", blocks: "v2.4.3", component: "int", severity: "medium" },
  ];
  if (crStatus === "non-compliant") {
    escalations.unshift({ id: "e-cr", title: "PR #14 merged by the wrong person", process: "#18 CR traceability",
      owner: "Rahul Verma", overdueBy: "past SLA", blocks: "v2.5.0", component: "api", severity: "high", live: true });
  }

  // ── Release calendar ──
  const releases: Release[] = [
    { id: "r-243", version: "v2.4.3 (hotfix)", date: "Tue 30 Sep", daysAway: 0, component: "int", changes: "CR-POC-3",
      gates: ["done", "done", "done", cabDone ? "done" : "pending", "pending", "na"],
      liveNote: cabDone ? "CAB approved (#10 live)" : "Waiting on CAB, Arjun Singh (#10 live)" },
    { id: "r-250", version: "v2.5.0", date: "Thu 2 Oct", daysAway: 2, component: "api", changes: "CR-POC-4, CR-POC-5",
      gates: ["done", "fail", "done", "pending", "pending", "na"], blocker: "self-approved PR #13" },
    { id: "r-182", version: "v1.8.2 (batch)", date: "Mon 6 Oct", daysAway: 6, component: "batch", changes: "CR-POC-7",
      gates: ["done", "pending", "pending", "pending", "pending", "na"] },
    { id: "r-242", version: "v2.4.2", date: "Fri 26 Sep", daysAway: -4, component: "web", changes: "CR-POC-1",
      gates: ["done", "done", "done", "done", "fail", uatDone ? "done" : "pending"], blocker: "deployed outside the approved window",
      liveNote: uatDone ? "UAT signed off (#38 live)" : "Deployed; UAT sign-off pending, Anushka Patil (#38 live)" },
  ];
  const releaseStatus = (r: Release): "Blocked" | "At risk" | "On track" | "Done" =>
    r.gates.includes("fail") && r.daysAway >= 0 ? "Blocked"
      : r.gates.every((g) => g === "done" || g === "na") ? "Done"
      : r.daysAway >= 0 && r.daysAway <= 2 ? "At risk"
      : r.daysAway < 0 ? (r.gates.includes("fail") ? "Blocked" : "At risk")
      : "On track";

  return {
    score, scoreTrend, readiness, readinessPct,
    issues, escalations, releases, releaseStatus,
    pitCheckpoints: pit,
  };
}

export type ManagerView = ReturnType<typeof buildManagerView>;

/* ───────── Risk heatmap v2: 17 modules × (Overall + components) or × weeks ───────── */

export const HEATMAP_DOMAINS: { name: string; modules: string[] }[] = [
  { name: "SDLC & Engineering", modules: ["Change Management", "Source Code", "Secure SDLC", "Build & Release", "Testing", "Deployment"] },
  { name: "Security & Access", modules: ["Access Control", "Data Security", "Patch Management"] },
  { name: "Operations & Reliability", modules: ["Backup", "Disaster Recovery", "Logging", "Incident Management"] },
  { name: "Governance & Risk", modules: ["Application Governance", "Vendor Management", "Business Continuity", "Compliance"] },
];

/** bad = checks not passing, nc = of which non-compliant, total = checks in scope. */
export type HeatCell = { bad: number; nc: number; total: number; mock?: boolean };
export type HeatColumn = { key: string; label: string; live?: boolean };

export const COMPONENT_COLUMNS: HeatColumn[] = [
  { key: "overall", label: "Overall", live: true },
  ...COMPONENTS.map((c) => ({ key: c.id, label: c.name.replace("PIT Armour ", "").replace(" (Mail / Jira)", "") })),
];
export const WEEK_COLUMNS: HeatColumn[] = [
  { key: "w-5", label: "5 wk ago" },
  { key: "w-4", label: "4 wk" },
  { key: "w-3", label: "3 wk" },
  { key: "w-2", label: "2 wk" },
  { key: "w-1", label: "Last wk" },
  { key: "w0", label: "This wk", live: true },
];

// Deterministic pseudo-random 0..1 from a string, so mock cells are stable across renders.
const noise = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
};
// How much worse (+) or better (−) each component is than the project overall (mock).
const COMPONENT_BIAS: Record<string, number> = { api: 0.35, web: 0, batch: -0.4, int: 0.15 };

export function buildHeatmap(pit: Checkpoint[]) {
  const live = new Map<string, HeatCell & { failing: Checkpoint[] }>();
  for (const d of HEATMAP_DOMAINS) for (const m of d.modules) {
    const inModule = pit.filter((c) => c.category === m);
    const failing = inModule.filter((c) => !passed(c));
    live.set(m, { bad: failing.length, nc: failing.filter((c) => c.status === "non-compliant").length, total: inModule.length, failing });
  }

  const mockFrom = (base: HeatCell, key: string, shift: number): HeatCell => {
    if (!base.total) return { bad: 0, nc: 0, total: 0, mock: true };
    const r = noise(key);
    const bad = Math.max(0, Math.min(base.total, Math.round(base.bad + shift + (r - 0.5) * 1.4)));
    const nc = Math.min(bad, Math.max(0, Math.round(base.nc + (shift > 0.3 && r > 0.6 ? 1 : 0) - (shift < -0.2 ? 1 : 0))));
    return { bad, nc, total: base.total, mock: true };
  };

  const cell = (module: string, col: string): HeatCell => {
    const base = live.get(module) ?? { bad: 0, nc: 0, total: 0 };
    if (col === "overall" || col === "w0") return base;
    if (col.startsWith("w-")) {
      const weeksAgo = Number(col.slice(2));
      return mockFrom(base, `${module}|${col}`, weeksAgo * 0.35); // older weeks were a bit worse
    }
    return mockFrom(base, `${module}|${col}`, COMPONENT_BIAS[col] ?? 0);
  };

  return { live, cell };
}

/* ───────── Repeat offences (recurring breaches, mock for the POC) ───────── */

export type Offence = {
  id: string;
  process: string;
  rule: string;
  times: number; // this month
  people: { name: string; times: number }[];
  weekly: number[]; // last 6 weeks, oldest first
  last: string;
  fix: string; // suggested process fix or coaching note
};

export const REPEAT_OFFENCES: Offence[] = [
  {
    id: "o-21", process: "#21 PR review", rule: "PR merged with a stale or self approval",
    times: 4, people: [{ name: "Aditya Sharma", times: 2 }, { name: "Rahul Verma", times: 1 }, { name: "Farhan Ali", times: 1 }],
    weekly: [0, 1, 0, 1, 1, 2], last: "Today",
    fix: "Turn on \"Dismiss stale approvals\" and block self-approval in branch protection for main.",
  },
  {
    id: "o-15", process: "#15 Rollback plan", rule: "Rollback plan missing before deployment",
    times: 3, people: [{ name: "Rahul Verma", times: 2 }, { name: "Kunal Shah", times: 1 }],
    weekly: [1, 0, 1, 0, 1, 1], last: "Yesterday",
    fix: "Make Rollback Plan a required Jira field before a CR can move to Ready for deploy.",
  },
  {
    id: "o-06", process: "#6 / #18 CR traceability", rule: "PR without a CR key, or merged by the wrong person",
    times: 3, people: [{ name: "Rahul Verma", times: 2 }, { name: "Aditya Sharma", times: 1 }],
    weekly: [1, 1, 0, 0, 1, 1], last: "3 d ago",
    fix: "Add a CI check that fails the PR when its title has no approved CR key.",
  },
  {
    id: "o-42", process: "#42 Deployment window", rule: "Deployment outside the approved window",
    times: 2, people: [{ name: "Farhan Ali", times: 2 }],
    weekly: [0, 0, 1, 0, 1, 0], last: "4 d ago",
    fix: "One person, twice: talk to Farhan, and add a window check to the deploy pipeline.",
  },
  {
    id: "o-27", process: "#27 Secrets", rule: "Secret committed to the repo",
    times: 1, people: [{ name: "Aditya Sharma", times: 1 }],
    weekly: [0, 0, 0, 1, 0, 0], last: "6 d ago",
    fix: "One-off, revoked within 2 h. Keep watching; push protection is already on.",
  },
];

export type OffenceKind = "process" | "coaching" | "watch";
export const offenceKind = (o: Offence): OffenceKind =>
  o.people.length >= 2 ? "process" : o.times >= 2 ? "coaching" : "watch";

/* ───────── Findings flow (opened vs closed per week) and aging, mock ───────── */

export const FLOW_WEEKS = [
  { week: "1 Sep", opened: 9, closed: 5 },
  { week: "8 Sep", opened: 7, closed: 6 },
  { week: "15 Sep", opened: 8, closed: 9 },
  { week: "22 Sep", opened: 6, closed: 8 },
  { week: "29 Sep", opened: 5, closed: 8 },
];
export const BACKLOG_START = 14;

export const AGING = [
  { bucket: "0–3 d", count: 6, color: "var(--ok)" },
  { bucket: "4–7 d", count: 4, color: "var(--warn)" },
  { bucket: "8–14 d", count: 2, color: "var(--fail)" },
  { bucket: "> 14 d", count: 1, color: "var(--fail)" },
];
