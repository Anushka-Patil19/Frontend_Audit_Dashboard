import { projectsData, type ProjectId } from "@/lib/audit-data";

// Audit schedule for the POC, read-only. The compliance dashboard owns the schedule and writes
// completion dates. Until the shared backend exists, this uses seeded data with the same shape
// the API will return, so the screens do not change when the data source does.

export type Frequency = "monthly" | "quarterly" | "half-yearly" | "yearly";
export const FREQUENCY_LABEL: Record<Frequency, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  "half-yearly": "Half-yearly",
  yearly: "Yearly",
};
const STEP: Record<Frequency, number> = { monthly: 1, quarterly: 3, "half-yearly": 6, yearly: 12 };

export interface AuditPlan {
  id: string;
  projectId: ProjectId;
  site: string;
  frequency: Frequency;
  standard: string;
  auditor: string;
  startYear: number;
  endYear: number;
}

export interface Occurrence {
  id: string;
  planId: string;
  projectId: ProjectId;
  site: string;
  auditor: string;
  standard: string;
  frequency: Frequency;
  dueDate: string; // YYYY-MM-DD
  periodStart: string;
  periodEnd: string;
}

export type OccStatus = "completed" | "pending" | "overdue";

/** Demo "today" for the POC, matching the rest of the demo data. */
export const TODAY = "2026-10-09";

const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const hash = (s: string) => [...s].reduce((a, c) => (Math.imul(a ^ c.charCodeAt(0), 2654435761) >>> 0), 7);

export const PLANS: AuditPlan[] = (["project-a", "project-b", "project-c"] as ProjectId[]).map((pid, i) => ({
  id: `plan-${pid}`,
  projectId: pid,
  site: projectsData[pid].name,
  frequency: (["monthly", "quarterly", "half-yearly"] as Frequency[])[i]!,
  standard: "ISO 9001:2015",
  auditor: ["Junaid", "Ritesh", "Akhil"][i]!,
  startYear: 2025,
  endYear: 2027,
}));

export function occurrencesFor(year: number): Occurrence[] {
  const out: Occurrence[] = [];
  for (const p of PLANS) {
    if (year < p.startYear || year > p.endYear) continue;
    const step = STEP[p.frequency];
    for (let m = step; m <= 12; m += step) {
      const dueDate = `${year}-${pad(m)}-${pad(lastDay(year, m))}`;
      out.push({
        id: `${p.id}-${dueDate}`,
        planId: p.id,
        projectId: p.projectId,
        site: p.site,
        auditor: p.auditor,
        standard: p.standard,
        frequency: p.frequency,
        dueDate,
        periodStart: `${year}-${pad(m - step + 1)}-01`,
        periodEnd: dueDate,
      });
    }
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Seeded history: most audits that fell due before today are completed, a few are left open. */
export function completedOn(o: Occurrence): string | undefined {
  if (o.dueDate >= TODAY) return undefined;
  const h = hash(o.id);
  if (h % 5 === 0) return undefined;
  return new Date(Date.parse(o.dueDate + "T00:00:00Z") - (h % 6) * 864e5).toISOString().slice(0, 10);
}

export const statusOf = (o: Occurrence): OccStatus =>
  completedOn(o) ? "completed" : o.dueDate < TODAY ? "overdue" : "pending";

/** Latest completion date for a project across the given years. */
export function lastAudited(pid: ProjectId, years: number[]): string | undefined {
  let last: string | undefined;
  for (const y of years)
    for (const o of occurrencesFor(y)) {
      if (o.projectId !== pid) continue;
      const c = completedOn(o);
      if (c && c <= TODAY && (!last || c > last)) last = c;
    }
  return last;
}

/** The first audit still ahead (due today or later) that is not completed. */
export function nextDue(pid: ProjectId, years: number[]): Occurrence | undefined {
  return years
    .flatMap((y) => occurrencesFor(y))
    .filter((o) => o.projectId === pid && o.dueDate >= TODAY && !completedOn(o))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
}
