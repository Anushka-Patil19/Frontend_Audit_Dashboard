import type { QuarterKey, QuarterState } from "./types";

// Financial-year quarters (Q1 = Apr–Jun). The quarter of an event is decided by its date
// in IST; the cut-off is 23:59:59 IST on the quarter's last day.

export interface Quarter {
  key: QuarterKey;
  label: string; // Q2 FY27
  months: string; // Jul–Sep 2026
  start: string; // YYYY-MM-DD
  end: string;
  /** State in the demo data before the reviewer does anything. */
  baseState: QuarterState;
}

export const QUARTERS: Quarter[] = [
  { key: "FY27-Q1", label: "Q1 FY27", months: "Apr–Jun 2026", start: "2026-04-01", end: "2026-06-30", baseState: "signed-off" },
  { key: "FY27-Q2", label: "Q2 FY27", months: "Jul–Sep 2026", start: "2026-07-01", end: "2026-09-30", baseState: "ready" },
  { key: "FY27-Q3", label: "Q3 FY27", months: "Oct–Dec 2026", start: "2026-10-01", end: "2026-12-31", baseState: "open" },
];

/** The demo data runs up to this day; Q3 is "so far". */
export const DEMO_TODAY = "2026-10-09";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const CUSTOM_PREFIX = "custom:";
export const isCustomKey = (k: string) => k.startsWith(CUSTOM_PREFIX);
export const customKey = (from: string, to: string) => `${CUSTOM_PREFIX}${from}:${to}` as QuarterKey;
/** The from and to dates of a custom key. */
export const customDates = (k: QuarterKey) => {
  const [, from = "", to = ""] = k.split(":");
  return { from, to };
};

/** A quarter, or a custom period. A custom period is described by its dates, so every screen that
 *  takes a period key works the same way for both. */
export const quarterByKey = (k: QuarterKey): Quarter => {
  if (isCustomKey(k)) {
    const { from, to } = customDates(k);
    return {
      key: k,
      label: `${Number(from.slice(8, 10))} ${MONTHS_SHORT[Number(from.slice(5, 7)) - 1]} – ${Number(to.slice(8, 10))} ${MONTHS_SHORT[Number(to.slice(5, 7)) - 1]} ${to.slice(0, 4)}`,
      months: "Custom period",
      start: from,
      end: to,
      baseState: to < DEMO_TODAY ? "ready" : "open",
    };
  }
  return QUARTERS.find((q) => q.key === k)!;
};

/** Is an ISO date inside the period (a quarter or a custom range)? Day level, IST. */
export const inPeriod = (iso: string, k: QuarterKey) => {
  const p = quarterByKey(k);
  const d = iso.slice(0, 10);
  return d >= p.start && d <= p.end;
};

export const quarterOf = (iso: string): QuarterKey | undefined => {
  const d = iso.slice(0, 10);
  return QUARTERS.find((q) => d >= q.start && d <= q.end)?.key;
};

export const previousQuarter = (k: QuarterKey): QuarterKey | undefined => {
  const i = QUARTERS.findIndex((q) => q.key === k);
  return i > 0 ? QUARTERS[i - 1]!.key : undefined;
};

export const isAfterQuarter = (iso: string, k: QuarterKey) => iso.slice(0, 10) > quarterByKey(k).end;

export const fullLabel = (k: QuarterKey) => {
  const q = quarterByKey(k);
  return `${q.label} (${q.months})`;
};

// Date formatting in IST, the way the team writes dates: 18 Aug 2026, 14:20
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fmtDate = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
export const fmtShort = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
export const fmtDateTime = (iso: string) => (iso.length > 10 ? `${fmtDate(iso)}, ${iso.slice(11, 16)}` : fmtDate(iso));

export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 864e5);

/** ISO date-time in IST from a date and an hh:mm. */
export const ist = (date: string, time = "10:00") => `${date}T${time}:00+05:30`;

export const addDays = (iso: string, days: number, time?: string) => {
  const d = new Date(Date.parse(iso.slice(0, 10) + "T00:00:00Z") + days * 864e5).toISOString().slice(0, 10);
  return ist(d, time ?? (iso.length > 10 ? iso.slice(11, 16) : "10:00"));
};
