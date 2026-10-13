import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Repeat2,
  TrendingDown,
  Wrench,
  UserRound,
  Eye,
} from "lucide-react";
import { Mono, StatusPill } from "@/components/audit/atoms";
import { useManagerProject } from "@/components/manager/project-context";
import { Card, Chips } from "@/components/developer/DevSections";
import { LiveTag } from "@/components/developer/DevKpis";
import { RiskHeatmap } from "@/components/manager/RiskHeatmap";
import {
  AGING,
  BACKLOG_START,
  FLOW_WEEKS,
  REPEAT_OFFENCES,
  buildHeatmap,
  offenceKind,
  type ComponentId,
  type ManagerView,
  type OffenceKind,
} from "@/lib/manager-data";

/* ───────────────────────── Which rules are failing most? (real data) ───────────────────────── */

export function ProblemAreas({
  view,
  selected,
}: {
  view: ManagerView;
  selected: ComponentId | null;
}) {
  const mp = useManagerProject();
  const [mode, setMode] = useState<"ranked" | "grid">("ranked");
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const { live, cell } = useMemo(() => buildHeatmap(view.pitCheckpoints), [view.pitCheckpoints]);

  const ranked = useMemo(() => {
    return [...live.entries()]
      .filter(([, c]) => c.total > 0)
      .map(([module, c]) => {
        const lastWeek = cell(module, "w-1");
        const roles = c.failing.reduce<Record<string, number>>(
          (acc, f) => ((acc[f.ownerRole] = (acc[f.ownerRole] ?? 0) + 1), acc),
          {},
        );
        const topRole = Object.entries(roles).sort((a, b) => b[1] - a[1])[0]?.[0];
        return { module, ...c, delta: c.bad - lastWeek.bad, topRole };
      })
      .sort((a, b) => b.nc - a.nc || b.bad / b.total - a.bad / a.total || b.bad - a.bad);
  }, [live, cell]);

  const withIssues = ranked.filter((r) => r.bad > 0);
  const rows = showAll ? ranked : withIssues.slice(0, 3);

  const trend = (d: number) =>
    d > 0
      ? { label: "worse", cls: "bg-fail/10 text-fail" }
      : d < 0
        ? { label: "better", cls: "bg-ok/10 text-ok" }
        : { label: "same", cls: "bg-panel-2 text-muted-foreground" };

  return (
    <div id="mgr-problems" className="scroll-mt-6 rounded-xl transition-shadow">
      <Card
        title="Which rules are failing most?"
        icon={BarChart3}
        note={
          mode === "ranked"
            ? `${withIssues.length} of ${ranked.length} areas have failing checks. Worst first; click one to see the checks.`
            : "Grid view: all 17 areas × components or weeks."
        }
        right={
          <Chips
            value={mode}
            onChange={setMode}
            options={[
              { value: "ranked", label: "Top areas" },
              { value: "grid", label: "Grid view" },
            ]}
          />
        }
      >
        {mode === "grid" ? (
          <RiskHeatmap view={view} selected={selected} embedded />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {rows.map((r) => {
                const isOpen = open === r.module;
                const t = trend(r.delta);
                const color = r.nc ? "var(--fail)" : r.bad ? "var(--warn)" : "var(--ok)";
                return (
                  <li key={r.module}>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : r.module)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center gap-3 py-3 text-left"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: color }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-foreground">{r.module}</span>
                        <span className="block text-xs text-muted-foreground">
                          {r.bad
                            ? `${r.bad} of ${r.total} checks failing`
                            : `All ${r.total} checks passing`}
                          {r.nc ? (
                            <>
                              {" "}
                              · <span className="text-fail">{r.nc} serious</span>
                            </>
                          ) : null}
                          {r.topRole ? ` · owner: ${r.topRole}` : ""}
                        </span>
                      </span>
                      {r.bad > 0 && (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${t.cls}`}>
                          {t.label}
                        </span>
                      )}
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {isOpen && (
                      <div className="mb-2 rounded-lg bg-panel-2/50 px-3 py-1">
                        {r.failing.length === 0 ? (
                          <p className="py-2 text-xs text-ok">All checks passing.</p>
                        ) : (
                          <ul className="divide-y divide-border">
                            {r.failing.map((c) => (
                              <li key={c.id} className="flex flex-wrap items-center gap-3 py-2">
                                <span className="min-w-0 flex-1 text-xs text-foreground">
                                  {c.name}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  {c.ownerRole}
                                </span>
                                <StatusPill status={c.status} />
                                <Link
                                  to="/projects"
                                  search={{ project: mp.pid }}
                                  className="rounded-md border border-border px-2 py-0.5 text-[11px] text-foreground hover:bg-panel"
                                >
                                  Open
                                </Link>
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
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="text-[11px] text-primary hover:underline"
              >
                {showAll ? "Show top 3 only" : `Show all ${ranked.length} areas`}
              </button>
              <span className="flex items-center gap-1.5 text-[11px] text-faint">
                <LiveTag /> counts are live · worse/same vs last week is mock
              </span>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

/* ───────────────────────── Which mistakes keep happening? ───────────────────────── */

const VERDICT: Record<
  OffenceKind,
  { button: (o: { people: { name: string }[] }) => string; done: string; icon: React.ElementType }
> = {
  process: { button: () => "Fix the process", done: "Improvement task created", icon: Wrench },
  coaching: {
    button: (o) => `Talk to ${o.people[0]?.name.split(" ")[0] ?? "them"}`,
    done: "1:1 planned",
    icon: UserRound,
  },
  watch: { button: () => "Keep watching", done: "Watching", icon: Eye },
};

export function RepeatOffences({ onLog }: { onLog: (t: string) => void }) {
  const mp = useManagerProject();
  const [open, setOpen] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState(false);
  const sorted = [...mp.offences].sort((a, b) => b.times - a.times);
  const list = showAll ? sorted : sorted.slice(0, 3);

  return (
    <div id="mgr-repeat" className="scroll-mt-6 rounded-xl transition-shadow">
      <Card
        title="Which mistakes keep happening?"
        icon={Repeat2}
        note="Rules broken more than once this month. Many people = fix the process; one person = a conversation."
      >
        <ul className="divide-y divide-border">
          {list.map((o) => {
            const kind = offenceKind(o);
            const v = VERDICT[kind];
            const isOpen = open === o.id;
            const who =
              o.people.length === 1
                ? `only ${o.people[0]?.name.split(" ")[0]}`
                : `${o.people.length} people`;
            return (
              <li key={o.id} className="py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : o.id)}
                    aria-expanded={isOpen}
                    className="flex min-w-[180px] flex-1 items-center gap-2 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-foreground">{o.rule}</span>
                      <span className="block text-xs text-muted-foreground">
                        {o.times} {o.times === 1 ? "time" : "times"} this month · {who}
                      </span>
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  <button
                    type="button"
                    disabled={done[o.id]}
                    onClick={() => {
                      setDone((d) => ({ ...d, [o.id]: true }));
                      onLog(`${v.done.toLowerCase()} for "${o.rule}"`);
                    }}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs ${done[o.id] ? "border-ok/30 bg-ok/10 text-ok" : kind === "process" ? "border-primary/40 text-primary hover:bg-primary-soft" : kind === "coaching" ? "border-warn/40 text-warn hover:bg-warn/10" : "border-border text-muted-foreground hover:bg-panel-2"}`}
                    title="Demo: logged in Lead activity; nothing is created yet"
                  >
                    {done[o.id] ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <v.icon className="h-3.5 w-3.5" />
                    )}
                    {done[o.id] ? v.done : `${v.button(o)} →`}
                  </button>
                </div>
                {isOpen && (
                  <div className="mt-2 rounded-lg bg-panel-2/50 px-3 py-2 text-xs">
                    <p className="text-foreground">
                      <span className="text-faint">Suggested: </span>
                      {o.fix}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Who:{" "}
                      {o.people
                        .map((p) => `${p.name}${p.times > 1 ? ` (${p.times}×)` : ""}`)
                        .join(", ")}{" "}
                      · last {o.last} · {o.process}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-[11px] text-primary hover:underline"
          >
            {showAll ? "Show top 3 only" : `Show all ${mp.offences.length}`}
          </button>
          <span className="text-[11px] text-faint">Mock history for the POC</span>
        </div>
      </Card>
    </div>
  );
}

/* ───────────────────────── Findings flow + aging ───────────────────────── */

export function FindingsFlow() {
  const mp = useManagerProject();
  const data = useMemo(() => {
    let backlog = mp.backlogStart;
    return mp.flow.map((w) => {
      backlog += w.opened - w.closed;
      return { ...w, backlog };
    });
  }, [mp]);
  const last = data[data.length - 1];
  const first = data[0];
  const net = last ? last.closed - last.opened : 0;
  const agingTotal = mp.aging.reduce((s, a) => s + a.count, 0);
  const overSla = mp.aging
    .filter((a) => a.bucket.startsWith("8") || a.bucket.startsWith(">"))
    .reduce((s, a) => s + a.count, 0);

  return (
    <div id="mgr-flow" className="scroll-mt-6 rounded-xl transition-shadow">
      <Card
        title="Findings flow & aging"
        icon={TrendingDown}
        note="Are we closing findings faster than we open them? And how old is what's still open?"
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
          <div>
            <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className={`font-mono text-2xl ${net >= 0 ? "text-ok" : "text-fail"}`}>
                {net >= 0 ? `−${net}` : `+${-net}`}
              </span>
              <span className="text-xs text-muted-foreground">
                backlog this week ({last?.closed} closed vs {last?.opened} opened) ·{" "}
                {first?.backlog} → {last?.backlog} open over 5 weeks
              </span>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="week"
                    stroke="var(--faint)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--faint)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--panel)",
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="opened"
                    name="Opened"
                    fill="var(--warn)"
                    radius={[3, 3, 0, 0]}
                    barSize={14}
                  />
                  <Bar
                    dataKey="closed"
                    name="Closed"
                    fill="var(--ok)"
                    radius={[3, 3, 0, 0]}
                    barSize={14}
                  />
                  <Line
                    dataKey="backlog"
                    name="Open backlog"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    type="monotone"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 flex gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm" style={{ background: "var(--warn)" }} /> opened
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm" style={{ background: "var(--ok)" }} /> closed
              </span>
              <span className="flex items-center gap-1">
                <span className="h-0.5 w-3" style={{ background: "var(--primary)" }} /> open backlog
              </span>
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs text-foreground">Age of open findings</p>
            <p className="mb-3 text-[11px] text-muted-foreground">
              {agingTotal} open ·{" "}
              <span className={overSla ? "text-fail" : ""}>{overSla} older than a week</span>
            </p>
            <div className="mb-3 flex h-3 overflow-hidden rounded-full bg-panel-2">
              {mp.aging.map((a) => (
                <div
                  key={a.bucket}
                  title={`${a.bucket}: ${a.count}`}
                  style={{
                    width: `${(a.count / agingTotal) * 100}%`,
                    background: a.color,
                    opacity: a.bucket.startsWith(">") ? 1 : 0.8,
                  }}
                />
              ))}
            </div>
            <ul className="space-y-1.5">
              {mp.aging.map((a) => (
                <li key={a.bucket} className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-full" style={{ background: a.color }} />
                  <span className="w-14 text-muted-foreground">{a.bucket}</span>
                  <span className="h-1.5 flex-1 rounded-full bg-panel-2">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${(a.count / agingTotal) * 100}%`, background: a.color }}
                    />
                  </span>
                  <Mono className="w-4 text-right text-foreground">{a.count}</Mono>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-faint">
          Mock history for the POC. With the backend storing daily results, this becomes live.
        </p>
      </Card>
    </div>
  );
}
