import { CHANGE_REQUESTS, DIRECT_COMMITS, NC_CASES } from "./seed";
import { quarterByKey } from "./quarters";
import type { ChangeRequest, DirectCommit, ProjectId, QuarterKey } from "./types";

// What is in a period. The rule is the one the team agreed:
// - A CR counts in the period its deployment falls in (deployment closes it).
// - A PR counts in the period it merged in. Its CR's approval date is context only.
// - A direct commit counts in the period it was pushed (it is closed on arrival).
// - A PR still open at the period's end is not counted here. It rolls into the next period.
// Dates are IST calendar days, inclusive at both ends.

export interface ScopeRange {
  from: string; // YYYY-MM-DD
  to: string;
  quarter?: QuarterKey; // set when the range is a whole quarter
}

export const quarterScope = (q: QuarterKey): ScopeRange => {
  const qq = quarterByKey(q);
  return { from: qq.start, to: qq.end, quarter: q };
};

const day = (iso: string) => iso.slice(0, 10);
const within = (iso: string, r: ScopeRange) => day(iso) >= r.from && day(iso) <= r.to;

export interface ScopeCr {
  cr: ChangeRequest;
  /** Approved in an earlier period, deployed in this one. */
  carriedIn: boolean;
}

export interface ScopePr {
  cr: ChangeRequest;
  /** Merged in this period, deployed in a later one. */
  deploysLater: boolean;
  /** Approved in an earlier period, merged in this one. */
  carriedIn: boolean;
}

export interface ScopeOpenPr {
  cr: ChangeRequest;
}

export interface ScopeCommit {
  commit: DirectCommit;
  /** Names a CR. A commit with no CR is a gap in the trace. */
  linked: boolean;
}

export interface Scope {
  crs: ScopeCr[];
  prs: ScopePr[];
  commits: ScopeCommit[];
  openAtEnd: ScopeOpenPr[];
  approvedCount: number;
  gapCommits: number;
  carriedInCrs: number;
}

export function scopeFor(r: ScopeRange, pid?: ProjectId): Scope {
  const keep = (x: { projectId: ProjectId }) => !pid || x.projectId === pid;

  const crs: ScopeCr[] = CHANGE_REQUESTS.filter((c) => keep(c) && within(c.deployedAt, r))
    .map((cr) => ({ cr, carriedIn: day(cr.approvedAt) < r.from }))
    .sort((a, b) => b.cr.deployedAt.localeCompare(a.cr.deployedAt));

  const prs: ScopePr[] = CHANGE_REQUESTS.filter((c) => keep(c) && within(c.mergedAt, r))
    .map((cr) => ({ cr, deploysLater: day(cr.deployedAt) > r.to, carriedIn: day(cr.approvedAt) < r.from }))
    .sort((a, b) => b.cr.mergedAt.localeCompare(a.cr.mergedAt));

  // Approved by the period's end, merged after it: still open, so it counts in the next period.
  const openAtEnd: ScopeOpenPr[] = CHANGE_REQUESTS.filter((c) => keep(c) && day(c.approvedAt) <= r.to && day(c.mergedAt) > r.to)
    .map((cr) => ({ cr }))
    .sort((a, b) => a.cr.mergedAt.localeCompare(b.cr.mergedAt));

  const commits: ScopeCommit[] = DIRECT_COMMITS.filter((c) => keep(c) && within(c.pushedAt, r))
    .map((commit) => ({ commit, linked: Boolean(commit.crKey) }))
    .sort((a, b) => b.commit.pushedAt.localeCompare(a.commit.pushedAt));

  return {
    crs,
    prs,
    commits,
    openAtEnd,
    approvedCount: CHANGE_REQUESTS.filter((c) => keep(c) && within(c.approvedAt, r)).length,
    gapCommits: commits.filter((c) => !c.linked).length,
    carriedInCrs: crs.filter((c) => c.carriedIn).length,
  };
}

/** Totals for any date range, for the Overview's custom-period view. NCs count by the day they were raised. */
export function rangeStats(r: ScopeRange, pid?: ProjectId) {
  const s = scopeFor(r, pid);
  const ncs = NC_CASES.filter((n) => (!pid || n.projectId === pid) && within(n.raisedAt, r));
  return {
    ncs: ncs.length,
    criticalHigh: ncs.filter((n) => n.severity === "Critical" || n.severity === "High").length,
    approved: s.approvedCount,
    changes: s.crs.length,
    prs: s.prs.length,
    commits: s.commits.length,
    commitGaps: s.gapCommits,
    openAtEnd: s.openAtEnd.length,
  };
}
