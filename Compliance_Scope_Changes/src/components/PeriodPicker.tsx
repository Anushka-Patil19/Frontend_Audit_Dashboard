import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { QUARTERS, fmtDate } from "@/data/quarters";
import { quarterScope, type ScopeRange } from "@/data/scope";
import { useReview } from "@/state/review";
import { useQuarter } from "@/state/quarter";
import { QuarterStateChip, quarterStateLabel } from "./ui";
import { RangeCalendar } from "./RangeCalendar";
import type { QuarterKey } from "@/data/types";

// The one period control for every page. A dropdown picks a quarter, or "Custom dates" to open
// a calendar. Nothing changes until Apply, so the page never flickers between ranges.

const isIsoDay = (s: string | null): s is string => Boolean(s && /^\d{4}-\d{2}-\d{2}$/.test(s));
const CUSTOM = "custom";

/** The period in the URL: a quarter (?q=) or, when both are set, a custom range (?from=&to=). */
export function usePeriod(): { q: QuarterKey; isCustom: boolean; range: ScopeRange } {
  const [q] = useQuarter();
  const [params] = useSearchParams();
  const from = params.get("from");
  const to = params.get("to");
  const custom = isIsoDay(from) && isIsoDay(to) && from <= to ? { from, to } : null;
  return { q, isCustom: custom !== null, range: custom ?? quarterScope(q) };
}

export function PeriodPicker() {
  const [q] = useQuarter();
  const [, setParams] = useSearchParams();
  const { quarterState } = useReview();
  const { isCustom, range } = usePeriod();
  const [panelOpen, setPanelOpen] = useState(false);
  const [pending, setPending] = useState<{ from: string; to: string }>({ from: range.from, to: range.to });

  const clearCustom = (p: URLSearchParams) => {
    const n = new URLSearchParams(p);
    n.delete("from");
    n.delete("to");
    return n;
  };

  const onSelect = (value: string) => {
    if (value === CUSTOM) {
      setPending({ from: range.from, to: range.to });
      setPanelOpen(true);
      return;
    }
    setPanelOpen(false);
    // One URL update: two in a row would overwrite each other.
    setParams((p) => {
      const n = clearCustom(p);
      n.set("q", value);
      return n;
    });
  };

  const apply = () => {
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.set("from", pending.from);
      n.set("to", pending.to);
      return n;
    });
    setPanelOpen(false);
  };

  return (
    <div className="relative flex flex-wrap items-center gap-3">
      <label htmlFor="period" className="text-xs text-muted-foreground">Period</label>
      <select
        id="period"
        value={isCustom ? CUSTOM : q}
        onChange={(e) => onSelect(e.target.value)}
        className="rounded-md border border-border bg-panel px-3 py-1.5 text-sm font-medium text-foreground"
      >
        {[...QUARTERS].reverse().map((x) => (
          <option key={x.key} value={x.key}>
            {x.label} ({x.months}) · {quarterStateLabel(quarterState(x.key))}
          </option>
        ))}
        <option value={CUSTOM}>{isCustom ? `Custom: ${fmtDate(range.from)} – ${fmtDate(range.to)}` : "Custom dates…"}</option>
      </select>
      {!isCustom && <QuarterStateChip s={quarterState(q)} />}

      {panelOpen && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[340px] rounded-xl border border-border bg-panel p-4 shadow-lg">
          <p className="text-sm font-medium text-foreground">Choose the dates</p>
          <p className="mb-3 text-xs text-muted-foreground">Start day, then end day. Both are included.</p>
          <RangeCalendar from={pending.from} to={pending.to} onChange={(from, to) => setPending({ from, to })} />
          <p className="mt-3 text-sm text-foreground">
            {fmtDate(pending.from)} – {fmtDate(pending.to)}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setPanelOpen(false)} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-panel-2">
              Cancel
            </button>
            <button type="button" onClick={apply} className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
