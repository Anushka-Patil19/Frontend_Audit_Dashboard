import { useSearchParams } from "react-router-dom";
import { QUARTERS, customDates, customKey, isCustomKey } from "@/data/quarters";
import type { QuarterKey } from "@/data/types";

// The period lives in the URL, so a shared link opens the same period:
// - ?q=FY27-Q2 is a quarter.
// - ?from=2026-07-02&to=2026-07-31 is a custom period. It takes priority over ?q=.
// Every screen reads the period from here, so the whole dashboard follows the dates.

export const DEFAULT_QUARTER: QuarterKey = "FY27-Q2";

const isIsoDay = (s: string | null): s is string => Boolean(s && /^\d{4}-\d{2}-\d{2}$/.test(s));

/** The period from the URL: a quarter key, or a custom key when valid from/to dates are set. */
export function periodFromParams(params: URLSearchParams): QuarterKey {
  const from = params.get("from");
  const to = params.get("to");
  if (isIsoDay(from) && isIsoDay(to) && from <= to) return customKey(from, to);
  const raw = params.get("q");
  return (QUARTERS.some((x) => x.key === raw) ? raw : DEFAULT_QUARTER) as QuarterKey;
}

export function useQuarter(): [QuarterKey, (next: QuarterKey) => void] {
  const [params, setParams] = useSearchParams();
  const q = periodFromParams(params);
  const set = (next: QuarterKey) =>
    setParams((p) => {
      // One update: a quarter clears the dates, a custom key writes them.
      const n = new URLSearchParams(p);
      n.delete("from");
      n.delete("to");
      if (isCustomKey(next)) {
        const { from, to } = customDates(next);
        n.set("from", from);
        n.set("to", to);
      } else {
        n.set("q", next);
      }
      return n;
    });
  return [q, set];
}

/** Keep the period when linking between pages. */
export const withQ = (path: string, q: QuarterKey) => {
  const sep = path.includes("?") ? "&" : "?";
  if (isCustomKey(q)) {
    const { from, to } = customDates(q);
    return `${path}${sep}from=${from}&to=${to}`;
  }
  return `${path}${sep}q=${q}`;
};
