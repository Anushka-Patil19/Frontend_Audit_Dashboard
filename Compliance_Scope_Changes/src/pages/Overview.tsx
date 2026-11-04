import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Bot, CalendarCheck2, Repeat2 } from "lucide-react";
import { counted, quarterStats, ncsIn } from "@/data/api";
import { summariseQuarter, whatChanged } from "@/data/copilot";
import { projectById } from "@/data/catalog";
import { QUARTERS, fmtDate, fullLabel, previousQuarter, quarterByKey } from "@/data/quarters";
import { person } from "@/data/people";
import { useReview } from "@/state/review";
import { useQuarter, withQ } from "@/state/quarter";
import { Card, Delta, KIND_LABEL, Mono, QuarterStateChip } from "@/components/ui";
import type { NcKind, QuarterKey, Severity } from "@/data/types";

// The period (a quarter, or a custom range) comes from the top bar through the URL. Every number
// on this page is for that period.
export function Overview() {
  const [q, setQ] = useQuarter();
  const { decisions, quarterState, signoffOf } = useReview();
  const stats = quarterStats(q, decisions);
  const prevQ = previousQuarter(q);
  const prev = prevQ ? quarterStats(prevQ, decisions) : undefined;
  const state = quarterState(q);
  const signoff = signoffOf(q);
  const all = ncsIn(q);
  const decided = all.filter((n) => decisions[n.id] && decisions[n.id]!.decision !== "info").length;
  const unsignedEarlier = QUARTERS.filter((x) => x.key < q && quarterState(x.key) === "ready");
  const worst = [...stats.per].sort((a, b) => b.ncs - a.ncs)[0];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Compliance review</p>
          <h1 className="mt-1 font-serif text-3xl">{fullLabel(q)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {state === "open" && `In progress. Numbers are live; review opens after ${fmtDate(quarterByKey(q).end)}.`}
            {state === "ready" && `The period has ended. ${all.length - decided} of ${all.length} NCs still need a decision.`}
            {state === "signed-off" && signoff && `Signed off by ${person(signoff.by).name} on ${fmtDate(signoff.at)} · ${signoff.documentId}`}
          </p>
        </div>
        {state === "ready" && worst && (
          <Link to={withQ(`/projects/${worst.projectId}`, q)} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Start review: {projectById(worst.projectId).name} <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </header>

      {unsignedEarlier.length > 0 && (
        <p className="flex items-center gap-2 rounded-lg border border-warn/40 bg-warn-soft px-4 py-2.5 text-sm text-warn">
          <AlertTriangle className="h-4 w-4" /> {unsignedEarlier.map((x) => x.label).join(", ")} not signed off yet.
        </p>
      )}

      <QuarterStrip current={q} onPick={setQ} />

      <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi label="Controls effective" value={`${stats.score}%`} sub={<>across {stats.per.length} projects <Delta now={stats.score} prev={prev?.score} suffix=" pts" /></>} tone={stats.score >= 90 ? "ok" : "warn"} />
        <Kpi label="Non-compliances" value={String(stats.ncs)} sub={<SevLine s={stats.bySeverity} />} tone={stats.ncs ? "fail" : "ok"} />
        <Kpi label="Open at quarter end" value={String(stats.openAtEnd)} sub={state === "open" ? "open right now" : "carry forward or except"} tone={stats.openAtEnd ? "warn" : "ok"} />
        <Kpi label="Fixed after TAT" value={String(stats.pastTat)} sub="SLA breaches in the quarter" tone={stats.pastTat ? "warn" : "ok"} />
        <Kpi label="Review progress" value={state === "open" ? "—" : `${decided}/${all.length}`} sub={state === "open" ? "opens after quarter end" : state === "signed-off" ? "all decided, signed off" : "NCs decided"} tone={state === "signed-off" ? "ok" : "info"} />
      </div>

      <Card title="Projects" note="Non-compliances in the quarter, worst first. Open a project to review its NCs.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-normal">Project</th>
                <th className="py-2 pr-3 font-normal">Controls effective</th>
                <th className="py-2 pr-3 font-normal">NCs</th>
                <th className="py-2 pr-3 font-normal">Critical / High</th>
                <th className="py-2 pr-3 font-normal">Open at end</th>
                <th className="py-2 pr-3 font-normal">After TAT</th>
                <th className="py-2 pr-3 font-normal">Repeat</th>
                <th className="py-2 pr-3 font-normal">Decided</th>
                <th className="py-2 font-normal" />
              </tr>
            </thead>
            <tbody>
              {[...stats.per].sort((a, b) => b.ncs - a.ncs).map((s) => {
                const p = projectById(s.projectId);
                const pp = prev?.per.find((x) => x.projectId === s.projectId);
                const list = all.filter((n) => n.projectId === s.projectId);
                const dec = list.filter((n) => decisions[n.id] && decisions[n.id]!.decision !== "info").length;
                return (
                  <tr key={s.projectId} className="border-b border-border last:border-0 hover:bg-panel-2/50">
                    <td className="py-3 pr-3">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.businessUnit} BU · {s.crs} changes{s.partial ? " · partial quarter" : ""}</p>
                    </td>
                    <td className="py-3 pr-3 tabular"><span className={s.score >= 90 ? "text-ok" : "text-warn"}>{s.score}%</span> <Delta now={s.score} prev={pp?.score} /></td>
                    <td className="py-3 pr-3 tabular font-medium">{s.ncs}</td>
                    <td className="py-3 pr-3 tabular"><span className="text-fail">{s.bySeverity.Critical}</span> / {s.bySeverity.High}</td>
                    <td className={`py-3 pr-3 tabular ${s.openAtEnd ? "text-warn" : ""}`}>{s.openAtEnd}</td>
                    <td className="py-3 pr-3 tabular">{s.pastTat}</td>
                    <td className="py-3 pr-3 tabular">{s.repeat ? <span className="inline-flex items-center gap-1 text-fail"><Repeat2 className="h-3.5 w-3.5" />{s.repeat}</span> : 0}</td>
                    <td className="py-3 pr-3 tabular text-muted-foreground">{state === "open" ? "—" : `${dec} of ${list.length}`}</td>
                    <td className="py-3 text-right">
                      <Link to={withQ(`/projects/${s.projectId}`, q)} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:border-primary/50">
                        Open <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="NCs by kind" note="One NC can have more than one kind.">
          <KindBars byKind={stats.byKind} />
        </Card>
        <Card title="Most-failed controls" note="Across all projects this quarter.">
          <ol className="space-y-2.5">
            {stats.topControls.map((t) => (
              <li key={t.checkpoint.id} className="flex items-start gap-3 text-sm">
                <Mono className="mt-0.5 w-8 text-faint">{t.checkpoint.ref}</Mono>
                <span className="min-w-0 flex-1">{t.checkpoint.name}<span className="block text-xs text-muted-foreground">{t.checkpoint.category}</span></span>
                <span className="tabular font-medium">{t.count}</span>
              </li>
            ))}
          </ol>
        </Card>
        <Card title="Periodic controls" note="Controls due in this quarter (access review, VA/PT, restore test…).">
          <PeriodicSummary q={q} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CopilotOverview q={q} />
        <PeopleView q={q} />
      </div>

      <p className="text-xs text-faint">
        {stats.checksPerformed.toLocaleString("en-IN")} checks performed on {stats.crs} changes in {fullLabel(q)}. "Controls effective" is the share of applicable controls with no confirmed NC in the quarter; dismissed false positives are not counted.
      </p>
      </>
    </div>
  );
}

function CopilotOverview({ q }: { q: QuarterKey }) {
  const { decisions, observations } = useReview();
  const [mode, setMode] = useState<"summary" | "changes" | null>(null);
  const lines = mode === "summary" ? summariseQuarter(q, decisions, observations) : mode === "changes" ? whatChanged(q, decisions) : [];
  return (
    <Card title="Copilot" note="Drafts built from this quarter's data. You edit and approve; the copilot never decides.">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setMode("summary")} className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${mode === "summary" ? "border-primary bg-primary-soft text-primary" : "border-border hover:bg-panel-2"}`}><Bot className="h-4 w-4" /> Summarise the quarter</button>
        <button type="button" onClick={() => setMode("changes")} className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${mode === "changes" ? "border-primary bg-primary-soft text-primary" : "border-border hover:bg-panel-2"}`}><Bot className="h-4 w-4" /> What changed since last quarter?</button>
      </div>
      {mode && <div className="mt-3 space-y-1.5 rounded-lg bg-panel-2 p-3 text-sm">{lines.map((l, i) => <p key={i}>{l}</p>)}</div>}
    </Card>
  );
}

function PeopleView({ q }: { q: QuarterKey }) {
  const { decisions } = useReview();
  const counts = new Map<string, { n: number; late: number }>();
  counted(ncsIn(q), decisions).forEach((n) => {
    const c = counts.get(n.owner) ?? { n: 0, late: 0 };
    counts.set(n.owner, { n: c.n + 1, late: c.late + (n.kinds.includes("sla-breach") ? 1 : 0) });
  });
  const list = [...counts.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 6);
  const max = Math.max(1, ...list.map(([, c]) => c.n));
  return (
    <Card title="NCs by owner" note="Who owns the most NCs this quarter, and how many were fixed after TAT. Useful for coaching.">
      <ul className="space-y-2">
        {list.map(([id, c]) => (
          <li key={id} className="text-sm">
            <div className="flex justify-between"><span>{person(id).name} <span className="text-xs text-muted-foreground">· {person(id).role}</span></span><span className="tabular">{c.n} <span className="text-xs text-warn">({c.late} late)</span></span></div>
            <div className="mt-1 h-1.5 rounded-full bg-panel-2"><div className="h-1.5 rounded-full bg-warn" style={{ width: `${(c.n / max) * 100}%` }} /></div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: React.ReactNode; tone: "ok" | "warn" | "fail" | "info" }) {
  const c = { ok: "text-ok", warn: "text-warn", fail: "text-fail", info: "text-primary" }[tone];
  return (
    <div className="rounded-xl border border-border bg-panel p-4 shadow-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1.5 font-mono text-3xl leading-none tabular ${c}`}>{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function SevLine({ s }: { s: Record<Severity, number> }) {
  return (
    <span className="tabular">
      <span className="text-fail">{s.Critical} critical</span> · {s.High} high · {s.Medium} medium · {s.Low} low
    </span>
  );
}

function KindBars({ byKind }: { byKind: Record<NcKind, number> }) {
  const max = Math.max(1, ...Object.values(byKind));
  return (
    <ul className="space-y-2.5">
      {(Object.keys(byKind) as NcKind[]).map((k) => (
        <li key={k} className="text-sm">
          <div className="flex justify-between"><span>{KIND_LABEL[k]}</span><span className="tabular font-medium">{byKind[k]}</span></div>
          <div className="mt-1 h-1.5 rounded-full bg-panel-2"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${(byKind[k] / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

function PeriodicSummary({ q }: { q: QuarterKey }) {
  const { decisions } = useReview();
  const p = quarterStats(q, decisions).periodic.filter((r) => r.status !== "not-due" || q === "FY27-Q3");
  const count = (s: string) => p.filter((r) => r.status === s).length;
  if (q === "FY27-Q3") {
    const done = p.filter((r) => r.doneOn).length;
    return <p className="text-sm text-muted-foreground"><CalendarCheck2 className="mr-1 inline h-4 w-4 text-primary" />{done} done so far; the rest are due by 31 Dec.</p>;
  }
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      {[["On time", count("on-time"), "text-ok"], ["Late", count("late"), "text-warn"], ["Missed", count("missed"), "text-fail"]].map(([l, n, c]) => (
        <div key={l as string} className="rounded-lg bg-panel-2 py-3">
          <p className={`font-mono text-2xl tabular ${c}`}>{n}</p>
          <p className="text-xs text-muted-foreground">{l}</p>
        </div>
      ))}
    </div>
  );
}

function QuarterStrip({ current, onPick }: { current: QuarterKey | null; onPick: (q: QuarterKey) => void }) {
  const { decisions, quarterState } = useReview();
  return (
    <div className="grid gap-3 sm:grid-cols-3" role="tablist" aria-label="Quarters">
      {QUARTERS.map((x) => {
        const s = quarterStats(x.key, decisions);
        const active = x.key === current;
        return (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onPick(x.key)}
            className={`rounded-xl border bg-panel p-4 text-left shadow-card transition-colors ${active ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{x.label}</span>
              <QuarterStateChip s={quarterState(x.key)} />
            </div>
            <p className="text-xs text-muted-foreground">{x.months}{x.key === "FY27-Q3" ? " · so far" : ""}</p>
            <p className="mt-2 flex items-baseline gap-3">
              <span className="font-mono text-2xl tabular">{s.score}%</span>
              <span className="text-xs text-muted-foreground">{s.ncs} NCs</span>
            </p>
          </button>
        );
      })}
    </div>
  );
}

