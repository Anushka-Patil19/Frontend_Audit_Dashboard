import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, CheckCircle2, ChevronDown, Repeat2, TrendingDown, Wrench, UserRound, Eye } from "lucide-react";
import { Mono, StatusPill } from "@/components/audit/atoms";
import { Card, Chips } from "@/components/developer/DevSections";
import { LiveTag } from "@/components/developer/DevKpis";
import { RiskHeatmap } from "@/components/manager/RiskHeatmap";
import {
  AGING,
  BACKLOG_START,
  FLOW_WEEKS,
  HEATMAP_DOMAINS,
  REPEAT_OFFENCES,
  buildHeatmap,
  offenceKind,
  type ComponentId,
  type ManagerView,
  type OffenceKind,
} from "@/lib/manager-data";

/* ───────────────────────── Top problem areas (ranked, real data) ───────────────────────── */

export function ProblemAreas({ view, selected }: { view: ManagerView; selected: ComponentId | null }) {
  const [mode, setMode] = useState<"ranked" | "grid">("ranked");
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const { live, cell } = useMemo(() => buildHeatmap(view.pitCheckpoints), [view.pitCheckpoints]);

  const ranked = useMemo(() => {
    const domainOf = (m: string) => HEATMAP_DOMAINS.find((d) => d.modules.includes(m))?.name ?? "";
    return [...live.entries()]
      .filter(([, c]) => c.total > 0)
      .map(([module, c]) => {
        const lastWeek = cell(module, "w-1");
        const roles = c.failing.reduce<Record<string, number>>((acc, f) => ((acc[f.ownerRole] = (acc[f.ownerRole] ?? 0) + 1), acc), {});
        const topRole = Object.entries(roles).sort((a, b) => b[1] - a[1])[0]?.[0];
        return { module, domain: domainOf(module), ...c, delta: c.bad - lastWeek.bad, topRole };
      })
      .sort((a, b) => b.nc - a.nc || b.bad / b.total - a.bad / a.total || b.bad - a.bad);
  }, [live, cell]);

  const withIssues = ranked.filter((r) => r.bad > 0);
  const rows = showAll ? ranked : withIssues.slice(0, 5);

  return (
    <div id="mgr-problems" className="scroll-mt-6 rounded-xl transition-shadow">
      <Card
        title="Top problem areas"
        icon={BarChart3}
        note={mode === "ranked"
          ? `Where PIT Armour's risk is concentrated right now: ${withIssues.length} of ${ranked.length} modules have failing checks. Worst first.`
          : "Grid view: all 17 modules × components or weeks."}
        right={<Chips value={mode} onChange={setMode} options={[{ value: "ranked", label: "Ranked" }, { value: "grid", label: "Grid view" }]} />}
      >
        {mode === "grid" ? (
          <RiskHeatmap view={view} selected={selected} embedded />
        ) : (
          <>
            <div className="mb-1 grid grid-cols-[minmax(150px,1.4fr)_minmax(90px,1fr)_56px_32px_16px] items-center gap-3 px-2 font-mono text-[10px] uppercase tracking-wide text-faint">
              <span>Module</span><span>Checks not passing</span><span className="text-right">vs last wk</span><span className="text-right">NC</span><span />
            </div>
            <ul className="space-y-1">
              {rows.map((r, i) => {
                const share = r.bad / r.total;
                const color = r.nc ? "var(--fail)" : r.bad ? "var(--warn)" : "var(--ok)";
                const isOpen = open === r.module;
                return (
                  <li key={r.module} className={`rounded-lg border ${isOpen ? "border-primary/40 bg-panel-2/40" : "border-transparent hover:border-border"}`}>
                    <button type="button" onClick={() => setOpen(isOpen ? null : r.module)} aria-expanded={isOpen}
                      className="grid w-full grid-cols-[minmax(150px,1.4fr)_minmax(90px,1fr)_56px_32px_16px] items-center gap-3 px-2 py-2 text-left">
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-faint">{i + 1}</span>
                          <span className="truncate text-sm text-foreground">{r.module}</span>
                        </span>
                        <span className="ml-5 block truncate text-[11px] text-muted-foreground">{r.domain}{r.topRole ? ` · mostly ${r.topRole}` : ""}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-panel-2">
                          <span className="block h-full rounded-full" style={{ width: `${Math.max(share * 100, r.bad ? 4 : 0)}%`, background: color }} />
                        </span>
                        <Mono className="w-10 shrink-0 text-right text-foreground">{r.bad}/{r.total}</Mono>
                      </span>
                      <span className={`text-right font-mono text-[11px] ${r.delta > 0 ? "text-fail" : r.delta < 0 ? "text-ok" : "text-faint"}`}>
                        {r.delta > 0 ? `▲ ${r.delta}` : r.delta < 0 ? `▼ ${-r.delta}` : "—"}
                      </span>
                      <span className={`text-right font-mono text-[11px] ${r.nc ? "text-fail" : "text-faint"}`}>{r.nc || "—"}</span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isOpen && (
                      <div className="border-t border-border px-3 pb-2 pt-1">
                        {r.failing.length === 0 ? (
                          <p className="py-2 text-xs text-ok">All checks passing.</p>
                        ) : (
                          <ul className="divide-y divide-border">
                            {r.failing.map((c) => (
                              <li key={c.id} className="flex flex-wrap items-center gap-3 py-2">
                                <Mono className="text-faint">{c.ref ?? c.id}</Mono>
                                <span className="min-w-0 flex-1 text-xs text-foreground">{c.name}</span>
                                <span className="text-[11px] text-muted-foreground">{c.ownerRole}</span>
                                <StatusPill status={c.status} />
                                <Link to="/projects" search={{ project: "project-a" }} className="rounded-md border border-border px-2 py-0.5 text-[11px] text-foreground hover:bg-panel">Open</Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={() => setShowAll((v) => !v)} className="text-[11px] text-primary hover:underline">
                {showAll ? "Show top 5 only" : `Show all ${ranked.length} modules`}
              </button>
              <span className="flex items-center gap-1.5 text-[11px] text-faint"><LiveTag /> counts are live · "vs last wk" is mock history</span>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

/* ───────────────────────── Repeat offences ───────────────────────── */

const KIND: Record<OffenceKind, { label: string; cls: string; icon: React.ElementType; action: string; done: string }> = {
  process: { label: "Process fix", cls: "bg-primary-soft text-primary", icon: Wrench, action: "Create improvement task", done: "Improvement task created" },
  coaching: { label: "Coaching", cls: "bg-warn/10 text-warn", icon: UserRound, action: "Plan 1:1", done: "1:1 planned" },
  watch: { label: "Watch", cls: "bg-panel-2 text-muted-foreground", icon: Eye, action: "Watch", done: "Watching" },
};

function WeekBars({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  return (
    <span className="flex h-6 items-end gap-0.5" aria-hidden="true">
      {data.map((v, i) => (
        <span key={i} className="w-1.5 rounded-sm" style={{ height: `${Math.max(12, (v / max) * 100)}%`, background: v ? (i === data.length - 1 ? "var(--fail)" : "var(--warn)") : "var(--panel-2)" }} />
      ))}
    </span>
  );
}

export function RepeatOffences({ onLog }: { onLog: (t: string) => void }) {
  const [kind, setKind] = useState<"all" | OffenceKind>("all");
  const [done, setDone] = useState<Record<string, boolean>>({});
  const list = REPEAT_OFFENCES.filter((o) => kind === "all" || offenceKind(o) === kind);
  const n = (k: OffenceKind) => REPEAT_OFFENCES.filter((o) => offenceKind(o) === k).length;

  return (
    <div id="mgr-repeat" className="scroll-mt-6 rounded-xl transition-shadow">
      <Card title="Repeat offences" icon={Repeat2}
        note="Rules broken more than once this month. Several people means fix the process; one person, repeatedly, means coaching.">
        <Chips value={kind} onChange={setKind} options={[
          { value: "all", label: "All", count: REPEAT_OFFENCES.length },
          { value: "process", label: "Process fix", count: n("process") },
          { value: "coaching", label: "Coaching", count: n("coaching") },
          { value: "watch", label: "Watch", count: n("watch") },
        ]} />
        <ul className="space-y-2">
          {list.map((o) => {
            const k = KIND[offenceKind(o)];
            return (
              <li key={o.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-panel-2 font-mono text-base text-foreground">{o.times}×</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm text-foreground">{o.rule}</p>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] ${k.cls}`}><k.icon className="h-3 w-3" />{k.label}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {o.process} · {o.people.length} {o.people.length === 1 ? "person" : "people"}: {o.people.map((p) => `${p.name}${p.times > 1 ? ` ×${p.times}` : ""}`).join(", ")} · last {o.last}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <WeekBars data={o.weekly} />
                    <Mono className="text-faint">6 wks</Mono>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 pl-12">
                  <p className="min-w-0 flex-1 text-xs text-foreground"><span className="text-faint">Suggested: </span>{o.fix}</p>
                  <button type="button" disabled={done[o.id]}
                    onClick={() => { setDone((d) => ({ ...d, [o.id]: true })); onLog(`${k.done.toLowerCase()} for "${o.rule}" (${o.process})`); }}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1 text-xs ${done[o.id] ? "border-ok/30 bg-ok/10 text-ok" : "border-border text-foreground hover:bg-panel-2"}`}
                    title="Demo: logged in activity, no Jira ticket is created yet">
                    {done[o.id] ? <CheckCircle2 className="h-3.5 w-3.5" /> : <k.icon className="h-3.5 w-3.5" />}
                    {done[o.id] ? k.done : k.action}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[11px] text-faint">Mock history for the POC. Actions are logged in Lead activity; no ticket is created yet.</p>
      </Card>
    </div>
  );
}

/* ───────────────────────── Findings flow + aging ───────────────────────── */

export function FindingsFlow() {
  const data = useMemo(() => {
    let backlog = BACKLOG_START;
    return FLOW_WEEKS.map((w) => {
      backlog += w.opened - w.closed;
      return { ...w, backlog };
    });
  }, []);
  const last = data[data.length - 1];
  const first = data[0];
  const net = last ? last.closed - last.opened : 0;
  const agingTotal = AGING.reduce((s, a) => s + a.count, 0);
  const overSla = AGING.filter((a) => a.bucket.startsWith("8") || a.bucket.startsWith(">")).reduce((s, a) => s + a.count, 0);

  return (
    <div id="mgr-flow" className="scroll-mt-6 rounded-xl transition-shadow">
      <Card title="Findings flow & aging" icon={TrendingDown}
        note="Are we closing findings faster than we open them? And how old is what's still open?">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
          <div>
            <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className={`font-mono text-2xl ${net >= 0 ? "text-ok" : "text-fail"}`}>{net >= 0 ? `−${net}` : `+${-net}`}</span>
              <span className="text-xs text-muted-foreground">
                backlog this week ({last?.closed} closed vs {last?.opened} opened) · {first?.backlog} → {last?.backlog} open over 5 weeks
              </span>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="week" stroke="var(--faint)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--faint)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel)", fontSize: 12 }} />
                  <Bar dataKey="opened" name="Opened" fill="var(--warn)" radius={[3, 3, 0, 0]} barSize={14} />
                  <Bar dataKey="closed" name="Closed" fill="var(--ok)" radius={[3, 3, 0, 0]} barSize={14} />
                  <Line dataKey="backlog" name="Open backlog" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} type="monotone" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 flex gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: "var(--warn)" }} /> opened</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: "var(--ok)" }} /> closed</span>
              <span className="flex items-center gap-1"><span className="h-0.5 w-3" style={{ background: "var(--primary)" }} /> open backlog</span>
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs text-foreground">Age of open findings</p>
            <p className="mb-3 text-[11px] text-muted-foreground">{agingTotal} open · <span className={overSla ? "text-fail" : ""}>{overSla} older than a week</span></p>
            <div className="mb-3 flex h-3 overflow-hidden rounded-full bg-panel-2">
              {AGING.map((a) => <div key={a.bucket} title={`${a.bucket}: ${a.count}`} style={{ width: `${(a.count / agingTotal) * 100}%`, background: a.color, opacity: a.bucket.startsWith(">") ? 1 : 0.8 }} />)}
            </div>
            <ul className="space-y-1.5">
              {AGING.map((a) => (
                <li key={a.bucket} className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-full" style={{ background: a.color }} />
                  <span className="w-14 text-muted-foreground">{a.bucket}</span>
                  <span className="h-1.5 flex-1 rounded-full bg-panel-2"><span className="block h-full rounded-full" style={{ width: `${(a.count / agingTotal) * 100}%`, background: a.color }} /></span>
                  <Mono className="w-4 text-right text-foreground">{a.count}</Mono>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-faint">Mock history for the POC. With the backend storing daily results, this becomes live.</p>
      </Card>
    </div>
  );
}
