import type { Checkpoint } from "@/lib/audit-data";

// Developer-view data for the POC. The four implemented checkpoints (#10 CAB, #16
// dependencies, #18 CR traceability, #38 UAT) are read from live app state, so running
// them from the copilot updates this view. Everything else is mock, like audit-data.ts.

export const DEV_PERSONA = { name: "Rahul Verma", role: "Developer", project: "PIT Armour" };

export type Severity = "blocking" | "due" | "waiting";

export type DevAction = {
  id: string;
  severity: Severity;
  title: string;
  process: string; // e.g. "#18 CR traceability"
  change: string; // CR key
  hint: string;
  live?: boolean; // driven by a real verification workflow
  steps?: string[]; // how to fix (blocking / due)
  who?: string; // person it is waiting on (waiting)
  since?: string; // how long it has been waiting (waiting)
};

export type Rule = { id: string; group: "Code" | "Approvals" | "Release"; rule: string; detail: string; process: string };

// PIT Armour's rules as a developer sees them. In a real build these come from the
// Add Project wizard (branch regex, CAB approver, UAT signer, PR merge owner).
export const PROJECT_RULES: Rule[] = [
  { id: "r1", group: "Code", rule: "Branch name: feature/CR-123-short-name", process: "#19 Branching",
    detail: "Allowed prefixes: feature/, bugfix/, hotfix/, release/ followed by the CR key. Feature branches merge into develop; release and hotfix into main." },
  { id: "r2", group: "Code", rule: "Every PR title carries its CR key", process: "#6 / #18 CR traceability",
    detail: "e.g. \"CR-POC-4: Payment retry logic\". The check looks in the title, then the branch name, then the PR body." },
  { id: "r3", group: "Code", rule: "No secrets in code: push protection is on", process: "#27 Secrets",
    detail: "Use GitHub Secrets or the vault. If a secret is detected, revoke it first, then remove it from history." },
  { id: "r10", group: "Code", rule: "SAST, SCA and secret scan must pass on every PR", process: "#22 / #24 / #27",
    detail: "These are required status checks on main; a failing check blocks the merge." },
  { id: "r4", group: "Approvals", rule: "1+ approval from someone other than you, on the latest commit", process: "#21 PR review",
    detail: "Pushing new commits after approval makes the approval stale, so ask for a fresh review." },
  { id: "r5", group: "Approvals", rule: "Only the named merger may merge", process: "#18 CR traceability",
    detail: "The required merger is the person @mentioned in the Jira comment \"merged by ...\" on the CR. Merging it yourself is non-compliant." },
  { id: "r6", group: "Approvals", rule: "CR must be Approved in Jira before merge", process: "#18 CR traceability",
    detail: "The Jira status must be Approved/Done at the time of merge, not afterwards." },
  { id: "r7", group: "Release", rule: "Impact analysis and rollback plan on the CR before deployment", process: "#8 / #15",
    detail: "Both fields must be filled before the CR moves to implementation or deploys to production." },
  { id: "r8", group: "Release", rule: "CAB approval by Arjun Singh, by email, before production", process: "#10 CAB approval",
    detail: "The Jira ticket must be in Pending CAB Approval, and the approval email must come from the authorised approver with explicit approval wording." },
  { id: "r9", group: "Release", rule: "UAT sign-off by Anushka Patil after deployment", process: "#38 UAT sign-off",
    detail: "A sign-off email from the authorised business signer with the subject \"PIT Armour UAT Sign-off\"." },
];

export type DevActivity = { id: string; at: string; kind: "verification" | "you" | "review"; text: string };

// Mock history of events on this developer's changes (newest first).
export const DEV_ACTIVITY: DevActivity[] = [
  { id: "d1", at: "Today 09:12", kind: "review", text: "Tanvi Kulkarni approved PR #17 (CR-POC-6)" },
  { id: "d2", at: "Today 08:55", kind: "verification", text: "#21 flagged: new commits on PR #17 after approval" },
  { id: "d3", at: "Yesterday 18:20", kind: "verification", text: "#16 dependency check found 1 deprecated package" },
  { id: "d4", at: "Yesterday 16:04", kind: "you", text: "You opened PR #16 for CR-POC-5" },
  { id: "d5", at: "Yesterday 11:30", kind: "verification", text: "#10 CR-POC-3 moved to Pending CAB Approval" },
  { id: "d6", at: "2 days ago", kind: "verification", text: "#6 PR #11 CR key missing, fixed and verified compliant" },
];

export type Stage = "cr" | "docs" | "branch" | "pr" | "scans" | "merge" | "cab" | "deploy" | "uat";
export type StageState = "done" | "current" | "blocked" | "waiting" | "todo";

export const STAGES: { key: Stage; label: string }[] = [
  { key: "cr", label: "CR approved" },
  { key: "docs", label: "Impact + rollback" },
  { key: "branch", label: "Branch" },
  { key: "pr", label: "PR + review" },
  { key: "scans", label: "Scans" },
  { key: "merge", label: "Merged by" },
  { key: "cab", label: "CAB" },
  { key: "deploy", label: "Deploy" },
  { key: "uat", label: "UAT sign-off" },
];

export type DevChange = {
  key: string;
  title: string;
  pr?: string | undefined;
  stages: Record<Stage, StageState>;
  bucket: "In review" | "Waiting on CAB" | "Waiting on UAT" | "Blocked" | "In development";
  waitingOn?: string | undefined;
  since: string;
};

export type MergedPr = { pr: string; change: string; mergedAgo: string; clean: boolean; reason?: string | undefined; live?: boolean };
export type FixRecord = { finding: string; process: string; days: number; closed: string };

export const FIX_SLA_DAYS = 3;
// Weekly clean-merge % for the sparkline (last 6 weeks, mock history).
export const CLEAN_TREND = [67, 75, 80, 75, 88, 86];
// Monthly average days-to-fix (last 6 months, mock history).
export const FIX_TREND = [3.4, 2.9, 2.6, 2.2, 2.0, 1.4];

const stages = (s: Partial<Record<Stage, StageState>>): Record<Stage, StageState> => ({
  cr: "todo", docs: "todo", branch: "todo", pr: "todo", scans: "todo",
  merge: "todo", cab: "todo", deploy: "todo", uat: "todo", ...s,
});

const byId = (list: Checkpoint[], id: string) => list.find((c) => c.id === id);

export function buildDeveloperView(checkpoints: Checkpoint[], resolved: ReadonlySet<string> = new Set()) {
  const cp18 = byId(checkpoints, "cp-18");
  const cp10 = byId(checkpoints, "cp-10");
  const cp38 = byId(checkpoints, "cp-38");

  const crStatus = cp18?.status ?? "needs-review";
  const cabDone = cp10?.status === "compliant";
  const uatDone = cp38?.kind === "manual" ? cp38.steps.every((s) => s.state === "done") : cp38?.status === "compliant";

  // ── Actions ──
  const actions: DevAction[] = [];
  if (crStatus === "non-compliant") {
    actions.push({
      id: "a-cr", severity: "blocking", live: true, change: "CR-POC-4",
      title: "PR #14 was merged by someone other than the required merger",
      process: "#18 CR traceability",
      hint: "The required merger is named in the Jira comment. Ask them to re-approve, or raise an exception.",
      steps: [
        "Open CR-POC-4 in Jira and find the comment \"merged by @...\". That person is the required merger.",
        "If the wrong person merged, raise an exception with your lead, or revert and let the named merger merge.",
        "Re-run the check in the copilot: \"Is ticket CR-POC-4 compliant?\"",
      ],
    });
  } else if (crStatus === "needs-review") {
    actions.push({
      id: "a-cr", severity: "due", live: true, change: "CR-POC-4",
      title: "Verify CR-POC-4 before it goes to CAB",
      process: "#18 CR traceability",
      hint: "Ask the copilot \"Is ticket CR-POC-4 compliant?\" to check Jira approval, branch and merger.",
      steps: [
        "Make sure CR-POC-4 is Approved in Jira.",
        "Check the PR was merged by the person named in the Jira \"merged by\" comment.",
        "Open the copilot and ask: \"Is ticket CR-POC-4 compliant?\"",
      ],
    });
  }
  actions.push({
    id: "a-dep", severity: "blocking", change: "Repo",
    title: "A package in requirements.txt is deprecated or outdated",
    process: "#16 Dependency check",
    hint: "Open the dependency bell on the project page, upgrade the package and re-check.",
    steps: [
      "Open the project page and click the dependency bell to see which package is flagged.",
      "Upgrade it in requirements.txt (or replace it if deprecated) and open a PR with the CR key.",
      "Re-check once the PR is merged.",
    ],
  });
  actions.push({
    id: "a-rb", severity: "due", change: "CR-POC-5",
    title: "Add a rollback plan to CR-POC-5 before its deploy window",
    process: "#15 Rollback plan",
    hint: "Deploy window opens in 2 days. Fill the Rollback Plan field in Jira.",
    steps: [
      "Open CR-POC-5 in Jira.",
      "Fill Rollback Plan: how to revert (e.g. redeploy tag v2.4.2), who does it, and how long it takes.",
      "Re-check. It must be filled before the deployment starts.",
    ],
  });
  actions.push({
    id: "a-rev", severity: "due", change: "CR-POC-6",
    title: "New commits on PR #17 after approval — request a fresh review",
    process: "#21 PR review",
    hint: "The approval was on an older commit, so it no longer counts.",
    steps: [
      "Open PR #17 and click \"Re-request review\" for Tanvi Kulkarni.",
      "Avoid pushing further commits until the new approval lands.",
    ],
  });
  actions.push({
    id: "w-rev", severity: "waiting", change: "CR-POC-5", who: "Tanvi Kulkarni · Reviewer", since: "1 day",
    title: "PR #16 is waiting for review",
    process: "#21 PR review",
    hint: "Review requested yesterday.",
  });
  if (!cabDone) {
    actions.push({
      id: "w-cab", severity: "waiting", live: true, change: "CR-POC-3", who: "Arjun Singh · CAB", since: "1 day",
      title: "CR-POC-3 is waiting for CAB approval",
      process: "#10 CAB approval",
      hint: "With CAB (Arjun Singh). Nothing for you to do — it turns green when the approval email arrives.",
    });
  }
  if (!uatDone) {
    actions.push({
      id: "w-uat", severity: "waiting", live: true, change: "CR-POC-1", who: "Anushka Patil · Business", since: "2 days",
      title: "CR-POC-1 is waiting for UAT sign-off",
      process: "#38 UAT sign-off",
      hint: "With the business signer (Anushka Patil).",
    });
  }

  const order: Record<Severity, number> = { blocking: 0, due: 1, waiting: 2 };
  const openActions = actions.filter((a) => !resolved.has(a.id));
  openActions.sort((a, b) => order[a.severity] - order[b.severity]);
  const resolvedActions = actions.filter((a) => resolved.has(a.id));

  // ── Changes in flight ──
  const cr4Merge: StageState = crStatus === "non-compliant" ? "blocked" : crStatus === "compliant" ? "done" : "current";
  const changes: DevChange[] = [
    {
      key: "CR-POC-4", title: "Payment retry logic", pr: "PR #14", since: "3 days",
      bucket: crStatus === "non-compliant" ? "Blocked" : crStatus === "compliant" ? "Waiting on CAB" : "In review",
      waitingOn: crStatus === "compliant" ? "CAB · Arjun Singh" : undefined,
      stages: stages({ cr: "done", docs: "done", branch: "done", pr: "done", scans: "done", merge: cr4Merge,
        cab: crStatus === "compliant" ? "waiting" : "todo" }),
    },
    {
      key: "CR-POC-3", title: "CAB workflow for PIT Armour release", pr: "PR #12", since: cabDone ? "—" : "1 day",
      bucket: cabDone ? "In review" : "Waiting on CAB", waitingOn: cabDone ? undefined : "CAB · Arjun Singh",
      stages: stages({ cr: "done", docs: "done", branch: "done", pr: "done", scans: "done", merge: "done",
        cab: cabDone ? "done" : "waiting", deploy: cabDone ? "current" : "todo" }),
    },
    {
      key: "CR-POC-1", title: "UAT release — dashboard v1", pr: "PR #9", since: uatDone ? "—" : "2 days",
      bucket: uatDone ? "In review" : "Waiting on UAT", waitingOn: uatDone ? undefined : "UAT · Anushka Patil",
      stages: stages({ cr: "done", docs: "done", branch: "done", pr: "done", scans: "done", merge: "done",
        cab: "done", deploy: "done", uat: uatDone ? "done" : "waiting" }),
    },
    {
      key: "CR-POC-5", title: "Session timeout configuration", pr: "PR #16", since: "1 day",
      bucket: "In review",
      stages: stages({ cr: "done", docs: "blocked", branch: "done", pr: "current" }),
    },
    {
      key: "CR-POC-6", title: "Audit log export", pr: "PR #17", since: "today",
      bucket: "In development",
      stages: stages({ cr: "done", docs: "done", branch: "done", pr: "current" }),
    },
  ];

  // ── Merged PRs (last 30 days) ──
  const merged: MergedPr[] = [
    { pr: "PR #14", change: "CR-POC-4", mergedAgo: "3 d ago", live: true,
      clean: crStatus !== "non-compliant",
      reason: crStatus === "non-compliant" ? "Merged by the wrong person (#18)" : undefined },
    { pr: "PR #12", change: "CR-POC-3", mergedAgo: "5 d ago", clean: true },
    { pr: "PR #11", change: "CR-POC-2", mergedAgo: "9 d ago", clean: false, reason: "No CR key in PR title (#6) — fixed" },
    { pr: "PR #9", change: "CR-POC-1", mergedAgo: "12 d ago", clean: true },
    { pr: "PR #8", change: "CR-POC-1", mergedAgo: "14 d ago", clean: true },
    { pr: "PR #6", change: "CR-POC-0", mergedAgo: "21 d ago", clean: true },
    { pr: "PR #5", change: "CR-POC-0", mergedAgo: "26 d ago", clean: true },
  ];

  // ── Resolved findings (last 30 days) ──
  const fixes: FixRecord[] = [
    { finding: "No CR key in PR #11 title", process: "#6 CR linkage", days: 0.5, closed: "9 d ago" },
    { finding: "Branch name off-pattern (fix/login)", process: "#19 Branching", days: 1.0, closed: "15 d ago" },
    { finding: "High vulnerability in lodash", process: "#24 SCA", days: 2.5, closed: "18 d ago" },
    { finding: "Impact analysis added late on CR-POC-2", process: "#8 Impact analysis", days: 1.6, closed: "24 d ago" },
  ];

  const blocking = openActions.filter((a) => a.severity === "blocking");
  const due = openActions.filter((a) => a.severity === "due");
  const waiting = openActions.filter((a) => a.severity === "waiting");
  const inFlight = changes.filter((c) => !(c.stages.uat === "done"));
  const cleanCount = merged.filter((m) => m.clean).length;
  const cleanPct = Math.round((cleanCount / merged.length) * 100);
  const avgFix = Math.round((fixes.reduce((s, f) => s + f.days, 0) / fixes.length) * 10) / 10;

  return { actions: openActions, resolvedActions, blocking, due, waiting, changes, inFlight, merged, cleanCount, cleanPct, fixes, avgFix };
}

export type DeveloperView = ReturnType<typeof buildDeveloperView>;
