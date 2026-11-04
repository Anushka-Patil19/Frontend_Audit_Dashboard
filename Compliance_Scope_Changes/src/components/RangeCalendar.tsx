import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// A date-range calendar. Click a start day, then an end day. Clicking a second day before the
// first one swaps them. Dates are plain YYYY-MM-DD, so no time zone conversion is needed.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEK = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export function RangeCalendar({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  const [view, setView] = useState(() => ({ y: Number(from.slice(0, 4)), m: Number(from.slice(5, 7)) - 1 }));
  const [pending, setPending] = useState<string | null>(null);

  const firstWeekday = (new Date(Date.UTC(view.y, view.m, 1)).getUTCDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => isoOf(view.y, view.m, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const shift = (delta: number) =>
    setView((v) => {
      const d = new Date(Date.UTC(v.y, v.m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });

  const pick = (day: string) => {
    if (!pending) {
      setPending(day);
      onChange(day, day);
      return;
    }
    const [a, b] = day < pending ? [day, pending] : [pending, day];
    setPending(null);
    onChange(a, b);
  };

  return (
    <div className="w-[300px] select-none">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} className="grid h-8 w-8 place-items-center rounded-md hover:bg-panel-2" aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-medium text-foreground">
          {MONTHS[view.m]} {view.y}
        </p>
        <button type="button" onClick={() => shift(1)} className="grid h-8 w-8 place-items-center rounded-md hover:bg-panel-2" aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center text-[11px] text-muted-foreground">
        {WEEK.map((w) => (
          <span key={w} className="py-1">{w}</span>
        ))}
        {cells.map((day, i) => {
          if (!day) return <span key={i} />;
          const isStart = day === from;
          const isEnd = day === to;
          const inside = day >= from && day <= to;
          return (
            <button
              key={day}
              type="button"
              onClick={() => pick(day)}
              aria-pressed={inside}
              className={[
                "mx-auto grid h-8 w-8 place-items-center text-sm transition-colors",
                isStart || isEnd ? "rounded-full bg-primary text-primary-foreground" : "",
                inside && !isStart && !isEnd ? "bg-primary-soft text-primary" : "",
                !inside ? "rounded-full text-foreground hover:bg-panel-2" : "",
              ].join(" ")}
            >
              {Number(day.slice(8, 10))}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {pending ? "Now click the last day of the period." : "Click the first day, then the last day."}
      </p>
    </div>
  );
}
