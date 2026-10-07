import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BellRing,
  CheckCircle2,
  ChevronDown,
  Clock3,
  GitPullRequest,
  Radio,
  X,
  XCircle,
} from "lucide-react";
import { Mono } from "@/components/audit/atoms";
import { CLEAN_TREND, FIX_SLA_DAYS, FIX_TREND, type DeveloperView, type Severity } from "@/lib/developer-data";

type KpiKey = "actions" | "flight" | "clean" | "fix";

export const SEV: Record<Severity, { label: string; color: string; text: string; bg: string }> = {
  blocking: { label: "Blocking", color: "var(--fail)", text: "text-fail", bg: "bg-fail/10" },
  due: { label: "Due soon", color: "var(--warn)", text: "text-warn", bg: "bg-warn/10" },
  waiting: { label: "Waiting on others", color: "var(--faint)", text: "text-muted-foreground", bg: "bg-panel-2" },
};

const BUCKET_COLOR: Record<string, string> = {
  Blocked: "var(--fail)",
  "In review": "var(--primary)",
  "In development": "var(--manual)",
  "Waiting on CAB": "var(--warn)",
  "Waiting on UAT": "var(--faint)",
};

function Sparkline({ data, color, invert = false }: { data: number[]; color: string; invert?: boolean }) {
  const w = 110, h = 32, pad = 3;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / (data.length - 1);
    const norm = (v - min) / span;
    const y = pad + (invert ? norm : 1 - norm) * (h - pad * 2);
    return [x, y] as const;
  });
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[pts.length - 1] ?? [0, 0];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r={2.75} fill={color} />
    </svg>
  );
}

function Segments({ parts }: { parts: { value: number; color: string; label: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div className="mt-3">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-panel-2">
        {parts.filter((p) => p.value > 0).map((p) => (
          <div key={p.label} title={`${p.label}: ${p.value}`} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} className="h-full first:rounded-l-full last:rounded-r-full" />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.value} {p.label.toLowerCase()}
          </span>
        ))}
      </div>
    </div>
  );
}

function Tile({
  active, onClick, icon: Icon, label, value, valueClass, unit, badge, children,
}: {
  active: boolean; onClick: () => void; icon: React.ElementType; label: string;
  value: string; valueClass: string; unit?: string; badge?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={`group relative flex flex-col rounded-xl border bg-panel p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        active ? "border-primary ring-2 ring-primary/20" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary-soft">
            <Icon className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
          </span>
          <p className="whitespace-nowrap text-xs text-muted-foreground">{label}</p>
        </div>
        {badge}
      </div>
      <p className={`mt-3 font-mono text-4xl leading-none ${valueClass}`}>
        {value}
        {unit && <span className="ml-1 text-base text-muted-foreground">{unit}</span>}
      </p>
      {children}
      <span className="mt-auto flex items-center gap-1 pt-3 text-[11px] text-primary opacity-70 group-hover:opacity-100">
        {active ? "Hide details" : "View details"}
        <ChevronDown className={`h-3 w-3 transition-transform ${active ? "rotate-180" : ""}`} />
      </span>
    </button>
  );
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${className}`}>{children}</span>;
}

export function LiveTag() {
  return (
    <span title="Driven by a real verification workflow" className="inline-flex items-center gap-1 rounded-full bg-ok/10 px-1.5 py-0.5 font-mono text-[10px] text-ok">
      <Radio className="h-2.5 w-2.5" /> live
    </span>
  );
}

export function DevKpis({ view }: { view: DeveloperView }) {
  const [open, setOpen] = useState<KpiKey | null>(null);
  const toggle = (k: KpiKey) => setOpen((o) => (o === k ? null : k));

  const openActions = view.blocking.length + view.due.length;
  const buckets = Object.entries(
    view.inFlight.reduce<Record<string, number>>((acc, c) => ((acc[c.bucket] = (acc[c.bucket] ?? 0) + 1), acc), {}),
  );
  const fixVsSla = Math.min(100, (view.avgFix / FIX_SLA_DAYS) * 100);
  const last = (a: number[], i: number) => a[a.length - i] ?? 0;
  const cleanDelta = last(CLEAN_TREND, 1) - last(CLEAN_TREND, 2);
  const fixDelta = Math.round((last(FIX_TREND, 1) - last(FIX_TREND, 2)) * 10) / 10;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          active={open === "actions"} onClick={() => toggle("actions")} icon={BellRing} label="Open actions"
          value={String(openActions)} valueClass={view.blocking.length ? "text-fail" : openActions ? "text-warn" : "text-ok"}
          badge={view.blocking.length ? <Badge className="bg-fail/10 text-fail">{view.blocking.length} blocking</Badge> : <Badge className="bg-ok/10 text-ok">all clear</Badge>}
        >
          <Segments parts={[
            { value: view.blocking.length, color: SEV.blocking.color, label: "Blocking" },
            { value: view.due.length, color: SEV.due.color, label: "Due soon" },
            { value: view.waiting.length, color: SEV.waiting.color, label: "Waiting" },
          ]} />
        </Tile>

        <Tile
          active={open === "flight"} onClick={() => toggle("flight")} icon={GitPullRequest} label="Changes in flight"
          value={String(view.inFlight.length)} valueClass="text-foreground"
          badge={<Badge className="bg-primary-soft text-primary">{view.inFlight.filter((c) => c.pr).length} PRs</Badge>}
        >
          <Segments parts={buckets.map(([label, value]) => ({ label, value, color: BUCKET_COLOR[label] ?? "var(--faint)" }))} />
        </Tile>

        <Tile
          active={open === "clean"} onClick={() => toggle("clean")} icon={CheckCircle2} label="Clean merges · 30 days"
          value={`${view.cleanPct}`} unit="%" valueClass={view.cleanPct >= 90 ? "text-ok" : view.cleanPct >= 75 ? "text-warn" : "text-fail"}
          badge={<Badge className="bg-panel-2 text-muted-foreground">{view.cleanCount}/{view.merged.length} PRs</Badge>}
        >
          <div className="mt-3 flex items-end justify-between gap-2">
            <Mono className="text-faint">target 90%</Mono>
            <div className="flex items-center gap-2">
              <span className={`font-mono text-[11px] ${cleanDelta >= 0 ? "text-ok" : "text-fail"}`}>
                {cleanDelta >= 0 ? "▲" : "▼"} {Math.abs(cleanDelta)} pts
              </span>
              <Sparkline data={CLEAN_TREND} color="var(--ok)" />
            </div>
          </div>
        </Tile>

        <Tile
          active={open === "fix"} onClick={() => toggle("fix")} icon={Clock3} label="Avg time to fix"
          value={view.avgFix.toFixed(1)} unit="days" valueClass={view.avgFix <= FIX_SLA_DAYS ? "text-ok" : "text-fail"}
          badge={<Badge className={view.avgFix <= FIX_SLA_DAYS ? "bg-ok/10 text-ok" : "bg-fail/10 text-fail"}>SLA {FIX_SLA_DAYS} d</Badge>}
        >
          <div className="mt-3">
            <div className="relative h-2 w-full rounded-full bg-panel-2">
              <div className="h-2 rounded-full" style={{ width: `${fixVsSla}%`, background: "var(--ok)" }} />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className={`font-mono text-[11px] ${fixDelta <= 0 ? "text-ok" : "text-fail"}`}>
                {fixDelta <= 0 ? "▼" : "▲"} {Math.abs(fixDelta)} d vs last month
              </span>
              <Sparkline data={FIX_TREND} color="var(--primary)" invert />
            </div>
          </div>
        </Tile>
      </div>

      {open && (
        <section className="rounded-xl border border-primary/30 bg-panel p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-serif text-base text-foreground">
              {open === "actions" && "Open actions — what you need to do"}
              {open === "flight" && "Changes in flight — where each one is"}
              {open === "clean" && "Merged PRs, last 30 days"}
              {open === "fix" && "Findings you fixed, last 30 days"}
            </h3>
            <button type="button" onClick={() => setOpen(null)} className="rounded-md p-1 text-muted-foreground hover:bg-panel-2" aria-label="Close details">
              <X className="h-4 w-4" />
            </button>
          </div>

          {open === "actions" && (
            <ul className="divide-y divide-border">
              {view.actions.map((a) => (
                <li key={a.id} className="flex flex-wrap items-start gap-3 py-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: SEV[a.severity].color }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm text-foreground">{a.title}</p>
                      {a.live && <LiveTag />}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <span className={SEV[a.severity].text}>{SEV[a.severity].label}</span> · {a.process} · {a.change}
                    </p>
                    <p className="mt-1 text-xs text-faint">{a.hint}</p>
                  </div>
                  <Link to="/projects" search={{ project: "project-a" }} className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:border-primary/50 hover:bg-panel-2">
                    Open checkpoint
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {open === "flight" && (
            <ul className="divide-y divide-border">
              {view.inFlight.map((c) => (
                <li key={c.key} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: BUCKET_COLOR[c.bucket] }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">
                      <span className="font-mono text-xs text-primary">{c.key}</span> · {c.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c.pr ?? "No PR yet"} · {c.bucket}{c.waitingOn ? ` · with ${c.waitingOn}` : ""} · {c.since}
                    </p>
                  </div>
                  <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ color: BUCKET_COLOR[c.bucket], background: "var(--panel-2)" }}>
                    {c.bucket}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {open === "clean" && (
            <ul className="divide-y divide-border">
              {view.merged.map((m) => (
                <li key={m.pr} className="flex items-center gap-3 py-2.5">
                  {m.clean ? <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" /> : <XCircle className="h-4 w-4 shrink-0 text-fail" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">
                      {m.pr} <span className="font-mono text-xs text-primary">{m.change}</span> {m.live && <LiveTag />}
                    </p>
                    <p className="text-xs text-muted-foreground">{m.clean ? "No findings" : m.reason}</p>
                  </div>
                  <Mono className="text-faint">{m.mergedAgo}</Mono>
                </li>
              ))}
            </ul>
          )}

          {open === "fix" && (
            <ul className="divide-y divide-border">
              {view.fixes.map((f) => (
                <li key={f.finding} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">{f.finding}</p>
                    <p className="text-xs text-muted-foreground">{f.process} · closed {f.closed}</p>
                  </div>
                  <div className="w-32">
                    <div className="h-1.5 w-full rounded-full bg-panel-2">
                      <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, (f.days / FIX_SLA_DAYS) * 100)}%`, background: f.days <= FIX_SLA_DAYS ? "var(--ok)" : "var(--fail)" }} />
                    </div>
                  </div>
                  <span className="w-14 text-right font-mono text-xs text-foreground">{f.days} d</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
