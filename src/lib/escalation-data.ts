import type { ProjectId } from "@/lib/audit-data";

// Checkpoint deadlines, escalation matrix and open items (PRD: Checkpoint Deadlines,
// Escalation & Approval). Frontend-only for now: escalation-store.tsx keeps this state in
// localStorage. When the backend lands, the store's actions become API calls; these types
// mirror the planned records (EscalationPolicy, CheckpointLimit, OpenItem, Notification).

export const DAY_MS = 864e5;

export type Level = "developer" | "manager" | "cto";

export type Person = { name: string; email: string };

export type Policy = {
  /** Developer gets a reminder this many days before the limit. */
  reminderBeforeDays: number;
  /** Manager is notified this many days after the limit (0 = at the limit). */
  managerAfterDays: number;
  /** CTO is notified this many days after the limit. */
  ctoAfterDays: number;
  /** Manager has this many days to approve a fix before the CTO is notified. */
  approvalLimitDays: number;
  people: Record<Level, Person>;
};

export type ProjectConfig = {
  /** Project-wide default limit; undefined = org template default. */
  defaultLimitDays?: number | undefined;
  categoryLimits: Record<string, number>;
  checkpointLimits: Record<string, number>;
  policy: Policy;
};

export const ORG_DEFAULT_LIMIT_DAYS = 2;

export const DEFAULT_POLICY: Policy = {
  reminderBeforeDays: 1,
  managerAfterDays: 0,
  ctoAfterDays: 2,
  approvalLimitDays: 2,
  people: {
    developer: { name: "Rahul Verma", email: "" },
    manager: { name: "Neha Gupta", email: "" },
    cto: { name: "CTO", email: "" },
  },
};

const DEFAULT_DEVELOPER: Record<ProjectId, string> = {
  "project-a": "Rahul Verma",
  "project-b": "Vivek Pillai",
  "project-c": "Karan Mehta",
};

export const emptyConfig = (pid: ProjectId = "project-a"): ProjectConfig => ({
  categoryLimits: {},
  checkpointLimits: {},
  policy: {
    ...DEFAULT_POLICY,
    people: { ...DEFAULT_POLICY.people, developer: { name: DEFAULT_DEVELOPER[pid], email: "" } },
  },
});

export type ItemStatus = "open" | "pending-approval" | "compliant";

export type HistoryEvent = { at: string; text: string };

export type ApprovalRecord = {
  checkpointRef: string;
  checkpointName: string;
  checkpointCategory: string;
  projectName: string;
  fixedBy: string;
  fixedAt: string;
  overdueDaysAtFix: number;
  nudges: number;
  approvedBy: string;
  approvedAt: string;
  evidenceFile?: string | undefined;
};

export type OpenItem = {
  id: string;
  projectId: ProjectId;
  checkpointId: string;
  owner: string;
  openedAt: string; // ISO
  status: ItemStatus;
  fixedAt?: string | undefined;
  fixedBy?: string | undefined;
  overdueDaysAtFix?: number | undefined;
  approvedAt?: string | undefined;
  approvedBy?: string | undefined;
  rejectReason?: string | undefined;
  nudges: string[]; // ISO times
  approval?: ApprovalRecord | undefined;
  history: HistoryEvent[];
};

export type NotificationKind = "escalation" | "approval-stalled" | "nudge" | "fixed";

export type Notification = {
  id: string;
  runAt: string; // ISO; groups notifications from one Simulate run
  projectId: ProjectId;
  itemId: string;
  recipient: Level;
  kind: NotificationKind;
  title: string;
  detail: string;
};

export type RunSummary = {
  runAt: string;
  projectId: ProjectId;
  counts: Record<Level, number>;
  notifications: Notification[];
  emailNote: string;
};

// Demo seed, relative to "now" so the demo looks the same on any day.
// PIT Armour has five items; SAATHI and MPS have two each for the Manager's All projects view.
type SeedRow = {
  projectId: ProjectId;
  checkpointId: string;
  owner: string;
  openedDaysAgo: number;
  fixedDaysAgo?: number;
};
export const DEMO_SEED: SeedRow[] = [
  { projectId: "project-a", checkpointId: "cp-15", owner: "Rahul Verma", openedDaysAgo: 4 },
  { projectId: "project-a", checkpointId: "cp-21", owner: "Rahul Verma", openedDaysAgo: 4 },
  { projectId: "project-a", checkpointId: "cp-8", owner: "Rahul Verma", openedDaysAgo: 2 },
  { projectId: "project-a", checkpointId: "cp-19", owner: "Rahul Verma", openedDaysAgo: 1 },
  {
    projectId: "project-a",
    checkpointId: "cp-6",
    owner: "Rahul Verma",
    openedDaysAgo: 6,
    fixedDaysAgo: 3,
  },
  { projectId: "project-b", checkpointId: "cp-25", owner: "Vivek Pillai", openedDaysAgo: 5 },
  { projectId: "project-b", checkpointId: "cp-60", owner: "Sneha Kapoor", openedDaysAgo: 2 },
  { projectId: "project-c", checkpointId: "cp-28", owner: "Karan Mehta", openedDaysAgo: 3 },
  {
    projectId: "project-c",
    checkpointId: "cp-71",
    owner: "Manoj Kumar",
    openedDaysAgo: 5,
    fixedDaysAgo: 2,
  },
];

export function seedItems(now: number): OpenItem[] {
  const iso = (daysAgo: number) => new Date(now - daysAgo * DAY_MS).toISOString();
  return DEMO_SEED.map((s) => {
    const fixed = s.fixedDaysAgo !== undefined;
    const history: HistoryEvent[] = [{ at: iso(s.openedDaysAgo), text: "Opened (demo seed)" }];
    if (fixed) history.push({ at: iso(s.fixedDaysAgo!), text: `Marked fixed by ${s.owner}` });
    return {
      id: `esc-${s.checkpointId}`,
      projectId: s.projectId,
      checkpointId: s.checkpointId,
      owner: s.owner,
      openedAt: iso(s.openedDaysAgo),
      status: fixed ? "pending-approval" : "open",
      fixedAt: fixed ? iso(s.fixedDaysAgo!) : undefined,
      fixedBy: fixed ? s.owner : undefined,
      overdueDaysAtFix: fixed
        ? Math.max(0, s.openedDaysAgo - s.fixedDaysAgo! - ORG_DEFAULT_LIMIT_DAYS)
        : undefined,
      nudges: [],
      history,
    };
  });
}

/** Whole days between an ISO time and now. */
export const daysSince = (iso: string, now: number) =>
  Math.max(0, Math.floor((now - Date.parse(iso)) / DAY_MS));

/** Effective limit: checkpoint override → category → project default → org default. */
export function resolveLimit(
  cfg: ProjectConfig,
  checkpointId: string,
  category: string,
): { days: number; source: "checkpoint" | "category" | "project" | "default" } {
  if (cfg.checkpointLimits[checkpointId] !== undefined)
    return { days: cfg.checkpointLimits[checkpointId]!, source: "checkpoint" };
  if (cfg.categoryLimits[category] !== undefined)
    return { days: cfg.categoryLimits[category]!, source: "category" };
  if (cfg.defaultLimitDays !== undefined) return { days: cfg.defaultLimitDays, source: "project" };
  return { days: ORG_DEFAULT_LIMIT_DAYS, source: "default" };
}

export type ItemAge = {
  openDays: number;
  limitDays: number;
  overdueDays: number; // negative = days left
  level: Level | null; // highest level due for an open item
};

export function ageItem(
  item: OpenItem,
  cfg: ProjectConfig,
  category: string,
  now: number,
): ItemAge {
  const openDays = daysSince(item.openedAt, now);
  const limitDays = resolveLimit(cfg, item.checkpointId, category).days;
  const overdueDays = openDays - limitDays;
  const p = cfg.policy;
  let level: Level | null = null;
  if (overdueDays >= p.ctoAfterDays) level = "cto";
  else if (overdueDays >= p.managerAfterDays) level = "manager";
  else if (-overdueDays <= p.reminderBeforeDays) level = "developer";
  return { openDays, limitDays, overdueDays, level };
}

export const ageLabel = (a: ItemAge) =>
  `Open ${a.openDays} ${a.openDays === 1 ? "day" : "days"} · limit ${a.limitDays} ${a.limitDays === 1 ? "day" : "days"} · ${
    a.overdueDays > 0
      ? `${a.overdueDays} ${a.overdueDays === 1 ? "day" : "days"} overdue`
      : a.overdueDays === 0
        ? "due today"
        : `${-a.overdueDays} ${-a.overdueDays === 1 ? "day" : "days"} left`
  }`;

export const LEVEL_LABEL: Record<Level, string> = {
  developer: "Developer",
  manager: "Manager",
  cto: "CTO",
};
