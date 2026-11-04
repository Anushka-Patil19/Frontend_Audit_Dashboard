import { CHANGE_REQUESTS, NC_CASES, PERIODIC_RESULTS } from "./seed";
import { PROJECTS, applicableCheckpoints, checkpointById, controlRule } from "./catalog";
import { DEMO_TODAY, QUARTERS, daysBetween, inPeriod, isCustomKey, previousQuarter, quarterByKey } from "./quarters";
import type { NcCase, NcDecision, NcKind, ProjectId, QuarterKey, Severity } from "./types";

// The data layer. Screens only call these functions; today they read the dated demo data,
// later they call the backend (/api/compliance/...) with the same shapes.

// Severity changes the reviewer made without (or before) a decision; set by the review store.
let SEV_OV: Record<string, Severity> = {};
export const setSeverityOverrides = (m: Record<string, Severity>) => {
  SEV_OV = m;
};
export const sevOf = (n: NcCase, decisions: Record<string, NcDecision>): Severity => decisions[n.id]?.severity ?? SEV_OV[n.id] ?? n.severity;

// A quarter uses its own tags (an NC belongs to the quarter it was logged in). A custom period
// uses dates: an NC counts on the day it was raised, a change on its deployment day, a periodic
// check on its due date.
export const ncsIn = (q: QuarterKey, pid?: ProjectId) =>
  NC_CASES.filter((n) => (isCustomKey(q) ? inPeriod(n.raisedAt, q) : n.quarter === q) && (!pid || n.projectId === pid));
export const ncById = (id: string) => NC_CASES.find((n) => n.id === id);
export const crById = (id: string) => CHANGE_REQUESTS.find((c) => c.id === id);
export const crsIn = (q: QuarterKey, pid?: ProjectId) =>
  CHANGE_REQUESTS.filter((c) => inPeriod(c.deployedAt, q) && (!pid || c.projectId === pid));
export const periodicIn = (q: QuarterKey, pid?: ProjectId) =>
  PERIODIC_RESULTS.filter((r) => (isCustomKey(q) ? inPeriod(r.dueBy, q) : r.quarter === q) && (!pid || r.projectId === pid));

/** Dismissed false positives do not count as NCs. */
export const counted = (list: NcCase[], decisions: Record<string, NcDecision>) => list.filter((n) => decisions[n.id]?.decision !== "dismiss");

/** Same checkpoint failed in either of the previous 2 quarters (gap 24). */
export function isRepeat(nc: NcCase) {
  const p1 = previousQuarter(nc.quarter);
  const p2 = p1 ? previousQuarter(p1) : undefined;
  return NC_CASES.some((o) => o.projectId === nc.projectId && o.checkpointId === nc.checkpointId && (o.quarter === p1 || o.quarter === p2));
}

export interface ProjectQuarterStats {
  projectId: ProjectId;
  applicable: number;
  controlsWithNc: number;
  score: number; // % of applicable controls with no counted NC in the quarter
  ncs: number;
  bySeverity: Record<Severity, number>;
  openAtEnd: number;
  pastTat: number;
  repeat: number;
  crs: number;
  checksPerformed: number;
  partial: boolean;
}

export function projectStats(pid: ProjectId, q: QuarterKey, decisions: Record<string, NcDecision>): ProjectQuarterStats {
  const list = counted(ncsIn(q, pid), decisions);
  const applicable = applicableCheckpoints(pid).length;
  const controlsWithNc = new Set(list.map((n) => n.checkpointId)).size;
  const bySeverity: Record<Severity, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  list.forEach((n) => (bySeverity[sevOf(n, decisions)] += 1));
  const crs = crsIn(q, pid).length;
  const qq = quarterByKey(q);
  const project = PROJECTS.find((p) => p.id === pid)!;
  const start = project.onboardedOn > qq.start ? project.onboardedOn : qq.start;
  const end = qq.end > DEMO_TODAY ? DEMO_TODAY : qq.end;
  const days = Math.max(0, daysBetween(start, end) + 1);
  const cps = applicableCheckpoints(pid).map((c) => controlRule(c.id).frequency);
  const checksPerformed =
    cps.filter((f) => f === "per-change").length * crs +
    cps.filter((f) => f === "continuous").length * days +
    cps.filter((f) => f === "document").length +
    periodicIn(q, pid).filter((r) => r.status !== "not-due").length;
  return {
    projectId: pid,
    applicable,
    controlsWithNc,
    score: Math.round(((applicable - controlsWithNc) / applicable) * 100),
    ncs: list.length,
    bySeverity,
    openAtEnd: list.filter((n) => n.statusAtEnd !== "closed").length,
    pastTat: list.filter((n) => n.kinds.includes("sla-breach")).length,
    repeat: list.filter(isRepeat).length,
    crs,
    checksPerformed,
    partial: project.onboardedOn > qq.start,
  };
}

export function quarterStats(q: QuarterKey, decisions: Record<string, NcDecision>) {
  const per = PROJECTS.map((p) => projectStats(p.id, q, decisions));
  const sum = (f: (s: ProjectQuarterStats) => number) => per.reduce((a, s) => a + f(s), 0);
  const all = counted(ncsIn(q), decisions);
  const byKind: Record<NcKind, number> = { "failed-check": 0, "missing-evidence": 0, "missed-periodic": 0, "sla-breach": 0, reopened: 0 };
  all.forEach((n) => n.kinds.forEach((k) => (byKind[k] += 1)));
  const byControl = new Map<string, number>();
  all.forEach((n) => byControl.set(n.checkpointId, (byControl.get(n.checkpointId) ?? 0) + 1));
  const topControls = [...byControl.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ checkpoint: checkpointById(id), count, projects: new Set(all.filter((n) => n.checkpointId === id).map((n) => n.projectId)).size }));
  return {
    per,
    score: Math.round(per.reduce((a, s) => a + s.score, 0) / per.length),
    ncs: all.length,
    openAtEnd: sum((s) => s.openAtEnd),
    pastTat: sum((s) => s.pastTat),
    repeat: sum((s) => s.repeat),
    crs: sum((s) => s.crs),
    checksPerformed: sum((s) => s.checksPerformed),
    bySeverity: (["Critical", "High", "Medium", "Low"] as Severity[]).reduce(
      (acc, s) => ({ ...acc, [s]: sum((p) => p.bySeverity[s]) }),
      {} as Record<Severity, number>,
    ),
    byKind,
    topControls,
    periodic: periodicIn(q),
  };
}

export const ALL_QUARTERS = QUARTERS;
