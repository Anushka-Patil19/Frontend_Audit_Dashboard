import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { projectsData, type ProjectId } from "@/lib/audit-data";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  FREQUENCY_LABEL,
  PLANS,
  TODAY,
  completedOn,
  lastAudited,
  nextDue,
  occurrencesFor,
  statusOf,
  type Occurrence,
  type OccStatus,
} from "@/lib/schedule";

export const Route = createFileRoute("/audit-calendar")({
  head: () => ({ meta: [{ title: "Audit calendar — Audit Intelligence" }] }),
  component: AuditCalendarPage,
});

const YEARS = [2025, 2026, 2027];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const TODAY_YEAR = Number(TODAY.slice(0, 4));
const TODAY_MONTH = Number(TODAY.slice(5, 7));
const TODAY_DAY = Number(TODAY.slice(8, 10));
const pad = (n: number) => String(n).padStart(2, "0");
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const fmt = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS_LONG[Number(iso.slice(5, 7)) - 1]!.slice(0, 3)} ${iso.slice(0, 4)}`;
const monthOf = (iso: string) => Number(iso.slice(5, 7));

function AuditCalendarPage() {
  const [year, setYear] = useState(TODAY_YEAR);
  const [month, setMonth] = useState(TODAY_MONTH);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const occs = occurrencesFor(year);
  const count = (s: OccStatus) => occs.filter((o) => statusOf(o) === s).length;
  const selected = occs.find((o) => o.id === selectedId) ?? null;

  const shiftMonth = (delta: number) => {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth() + 1);
    setSelectedId(null);
  };

  const lead = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const cells: (number | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: daysIn(year, month) }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const dayKey = (d: number) => `${year}-${pad(month)}-${pad(d)}`;
  const onDay = (d: number) => occs.filter((o) => o.dueDate === dayKey(d));
  const isToday = (d: number) => year === TODAY_YEAR && month === TODAY_MONTH && d === TODAY_DAY;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Audit calendar"
        subtitle="Read-only. Audits are completed and signed off by the compliance team; this board shows the schedule and the last audit for each site."
      />

      {/* Year */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setYear(year - 1)} disabled={year <= YEARS[0]!} className="grid h-8 w-8 place-items-center rounded-md border border-border disabled:opacity-40" aria-label="Previous year">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="w-16 text-center font-serif text-xl">{year}</span>
        <button type="button" onClick={() => setYear(year + 1)} disabled={year >= YEARS[YEARS.length - 1]!} className="grid h-8 w-8 place-items-center rounded-md border border-border disabled:opacity-40" aria-label="Next year">
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="ml-2 flex flex-wrap gap-1">
          {YEARS.map((y) => (
            <button key={y} type="button" onClick={() => setYear(y)} className={`rounded-full border px-3 py-1 text-sm ${y === year ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-panel-2"}`}>
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Due this year" value={occs.length} tone="info" />
        <Stat label="Completed" value={count("completed")} tone="ok" />
        <Stat label="Pending" value={count("pending")} tone="warn" />
        <Stat label="Overdue" value={count("overdue")} tone={count("overdue") ? "fail" : "ok"} />
      </div>

      {/* Last audited per site */}
      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(projectsData) as ProjectId[]).map((pid) => {
          const last = lastAudited(pid, YEARS);
          const next = nextDue(pid, YEARS);
          return (
            <div key={pid} className="rounded-xl border border-border bg-panel p-4 shadow-card">
              <p className="text-sm font-medium text-foreground">{projectsData[pid].name}</p>
              <div className="mt-2 flex justify-between text-xs">
                <span className="text-muted-foreground">Last audited</span>
                <span className="font-mono">{last ? fmt(last) : "Never"}</span>
              </div>
              <div className="mt-1 flex justify-between text-xs">
                <span className="text-muted-foreground">Next due</span>
                <span className="font-mono">{next ? fmt(next.dueDate) : "Nothing ahead"}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Calendar and details */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-xl border border-border bg-panel shadow-card">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <button type="button" onClick={() => shiftMonth(-1)} className="grid h-8 w-8 place-items-center rounded-md border border-border hover:bg-panel-2" aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="w-44 text-center font-serif text-xl">
              {MONTHS_LONG[month - 1]} {year}
            </h2>
            <button type="button" onClick={() => shiftMonth(1)} className="grid h-8 w-8 place-items-center rounded-md border border-border hover:bg-panel-2" aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-border bg-panel-2/40 text-center text-[11px] uppercase tracking-wide text-muted-foreground">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-2">{w}</div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {cells.map((d, i) => {
              if (d === null) return <div key={i} className="min-h-[104px] border-b border-r border-border bg-panel-2/20" />;
              return (
                <div key={i} className={`min-h-[104px] border-b border-r border-border p-1.5 ${isToday(d) ? "bg-primary-soft/40" : ""}`}>
                  <span className={`mb-1 grid h-6 w-6 place-items-center rounded-full text-xs ${isToday(d) ? "bg-primary text-primary-foreground" : "text-foreground"}`}>{d}</span>
                  <div className="space-y-1">
                    {onDay(d).map((o) => (
                      <AuditChip key={o.id} o={o} active={o.id === selectedId} onPick={() => setSelectedId(o.id)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-4 px-5 py-3 text-xs text-muted-foreground">
            <Legend cls="bg-ok-soft text-ok" label="Completed" />
            <Legend cls="bg-warn-soft text-warn" label="Pending" />
            <Legend cls="bg-fail-soft text-fail" label="Overdue" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-panel p-5 shadow-card">
          <p className="mb-3 text-sm font-medium text-foreground">Audit details</p>
          {selected ? <Details o={selected} /> : <p className="py-6 text-center text-sm text-muted-foreground">Select an audit on the calendar.</p>}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Demo data: plans and completions are seeded for the POC. The compliance dashboard holds the live schedule.
      </p>
    </div>
  );
}

function AuditChip({ o, active, onPick }: { o: Occurrence; active: boolean; onPick: () => void }) {
  const s = statusOf(o);
  const cls = s === "completed" ? "bg-ok-soft text-ok" : s === "overdue" ? "bg-fail-soft text-fail" : "bg-warn-soft text-warn";
  return (
    <button
      type="button"
      onClick={onPick}
      title={`${o.site} · ${FREQUENCY_LABEL[o.frequency]} · ${s}`}
      className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium ${cls} ${active ? "ring-2 ring-primary" : ""}`}
    >
      {o.site}
    </button>
  );
}

function Details({ o }: { o: Occurrence }) {
  const s = statusOf(o);
  const c = completedOn(o);
  const icon = s === "completed" ? <CheckCircle2 className="h-3 w-3" /> : s === "overdue" ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />;
  const pill = s === "completed" ? "bg-ok-soft text-ok" : s === "overdue" ? "bg-fail-soft text-fail" : "bg-warn-soft text-warn";
  const label = s === "completed" ? "Completed" : s === "overdue" ? "Overdue" : "Pending";
  return (
    <div className="space-y-3 text-sm">
      <p className="font-serif text-lg">{o.site}</p>
      <p className="text-xs text-muted-foreground">{o.standard}</p>
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${pill}`}>
        {icon} {label}
      </span>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <dt className="text-muted-foreground">Due date</dt>
        <dd className="font-mono">{fmt(o.dueDate)}</dd>
        <dt className="text-muted-foreground">Review period</dt>
        <dd className="font-mono">{fmt(o.periodStart)} – {fmt(o.periodEnd)}</dd>
        <dt className="text-muted-foreground">Frequency</dt>
        <dd>{FREQUENCY_LABEL[o.frequency]}</dd>
        <dt className="text-muted-foreground">Auditor</dt>
        <dd>{o.auditor}</dd>
        <dt className="text-muted-foreground">Completed on</dt>
        <dd className="font-mono">{c ? fmt(c) : "Not yet"}</dd>
      </dl>
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`inline-block h-3 w-3 rounded ${cls}`} /> {label}
    </span>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "info" | "ok" | "warn" | "fail" }) {
  const text = { info: "text-primary", ok: "text-ok", warn: "text-warn", fail: "text-fail" }[tone];
  return (
    <div className="rounded-xl border border-border bg-panel p-4 shadow-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-2 font-mono text-3xl leading-none ${text}`}>{value}</p>
    </div>
  );
}
