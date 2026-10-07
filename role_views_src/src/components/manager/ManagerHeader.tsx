import { Bell, CalendarDays, Clock3, Gavel, Github, Mail, ShieldCheck, Siren } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Mono } from "@/components/audit/atoms";
import {
  COMPLIANCE_TARGET,
  MTTR_DAYS,
  MTTR_SLA_DAYS,
  MTTR_TREND,
  type Decision,
  type ManagerView,
} from "@/lib/manager-data";

export const scrollToSection = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.classList.add("ring-2", "ring-primary/40");
  window.setTimeout(() => el.classList.remove("ring-2", "ring-primary/40"), 1400);
};

/* ───────── Tool shortcuts (icons only for the POC) ───────── */

function JiraGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
      <path d="M8 1.5 14.5 8 8 14.5 1.5 8Z" fill="#2684FF" />
      <path d="M8 5 11 8 8 11 5 8Z" fill="#fff" />
    </svg>
  );
}
function BitbucketGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
      <path d="M1.5 2.5h13l-2 11h-9Z" fill="#2684FF" />
      <path d="M6 6.5h4l-.6 3.5H6.6Z" fill="#fff" />
    </svg>
  );
}

const TOOLS = [
  { key: "jira", label: "Jira", icon: <JiraGlyph /> },
  { key: "mail", label: "Mail", icon: <Mail className="h-4 w-4 text-[#0078D4]" strokeWidth={1.9} /> },
  { key: "github", label: "GitHub", icon: <Github className="h-4 w-4 text-foreground" strokeWidth={1.9} /> },
  { key: "bitbucket", label: "Bitbucket", icon: <BitbucketGlyph /> },
];

export function ToolLinks() {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-panel p-1 shadow-card">
      {TOOLS.map((t) => (
        <button
          key={t.key}
          type="button"
          title={`${t.label} for PIT Armour (link not configured yet)`}
          aria-label={`Open ${t.label}`}
          className="grid h-7 w-7 place-items-center rounded-md hover:bg-panel-2"
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}

/* ───────── Bell: decisions + escalations ───────── */

export function ManagerBell({ pending, view }: { pending: Decision[]; view: ManagerView }) {
  const count = pending.length + view.escalations.length;
  const high = view.escalations.some((e) => e.severity === "high") || pending.some((d) => d.risk === "High");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Alerts: ${pending.length} decisions, ${view.escalations.length} escalations`}
          className={`relative grid h-9 w-9 place-items-center rounded-lg border bg-panel shadow-card hover:bg-panel-2 ${high ? "border-fail/40" : "border-border"}`}
        >
          <Bell className={`h-4 w-4 ${high ? "text-fail" : "text-muted-foreground"}`} strokeWidth={1.9} />
          {count > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center">
              {high && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fail/50" />}
              <span className={`relative inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-mono text-[10px] text-white ${high ? "bg-fail" : "bg-warn"}`}>
                {count}
              </span>
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(92vw,440px)] p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="font-serif text-base text-foreground">Alerts</p>
          <p className="text-xs text-muted-foreground">Waiting on you, and blockers past their SLA</p>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-4 py-2">
          <p className="mb-1 mt-1 font-mono text-[10px] uppercase tracking-wide text-primary">Decisions waiting on you · {pending.length}</p>
          {pending.length === 0 && <p className="py-2 text-xs text-muted-foreground">No decisions pending.</p>}
          {pending.map((d) => (
            <button key={d.id} type="button" onClick={() => scrollToSection("mgr-decisions")} className="flex w-full items-start gap-2 border-b border-border py-2 text-left last:border-0 hover:bg-panel-2/50">
              <Gavel className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-foreground">{d.title}</span>
                <span className="text-xs text-muted-foreground">{d.requester} · {d.process} · risk {d.risk}</span>
              </span>
            </button>
          ))}
          <p className="mb-1 mt-3 font-mono text-[10px] uppercase tracking-wide text-fail">Escalations · {view.escalations.length}</p>
          {view.escalations.map((e) => (
            <button key={e.id} type="button" onClick={() => scrollToSection("mgr-escalations")} className="flex w-full items-start gap-2 border-b border-border py-2 text-left last:border-0 hover:bg-panel-2/50">
              <Siren className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${e.severity === "high" ? "text-fail" : "text-warn"}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-foreground">{e.title}</span>
                <span className="text-xs text-muted-foreground">{e.owner} · overdue {e.overdueBy} · blocks {e.blocks}</span>
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ───────── KPI tiles (click = jump to the section) ───────── */

function Spark({ data, color, invert = false }: { data: number[]; color: string; invert?: boolean }) {
  const w = 96, h = 28, p = 3;
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => [p + (i * (w - 2 * p)) / (data.length - 1), p + ((invert ? v - min : max - v) / span) * (h - 2 * p)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1] ?? [0, 0];
  return (
    <svg width={w} height={h} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={color} />
    </svg>
  );
}

function Tile({ label, icon: Icon, value, unit, tone, sub, badge, target, children }: {
  label: string; icon: React.ElementType; value: string; unit?: string; tone: string; sub: string;
  badge?: React.ReactNode; target: string; children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => scrollToSection(target)}
      className="group flex flex-col rounded-xl border border-border bg-panel p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary-soft">
            <Icon className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
          </span>
          <p className="whitespace-nowrap text-xs text-muted-foreground">{label}</p>
        </div>
        {badge}
      </div>
      <p className={`mt-3 font-mono text-3xl leading-none ${tone}`}>
        {value}{unit && <span className="ml-1 text-sm text-muted-foreground">{unit}</span>}
      </p>
      <Mono className="mt-1.5 block text-faint">{sub}</Mono>
      {children}
      <span className="mt-auto pt-3 text-[11px] text-primary opacity-70 group-hover:opacity-100">Go to section →</span>
    </button>
  );
}

export function ManagerKpis({ view, pending }: { view: ManagerView; pending: Decision[] }) {
  const upcoming = view.releases.filter((r) => r.daysAway >= 0);
  const rs = (s: string) => upcoming.filter((r) => view.releaseStatus(r) === s).length;
  const high = view.escalations.filter((e) => e.severity === "high").length;
  const scoreDelta = (view.scoreTrend.at(-1) ?? 0) - (view.scoreTrend.at(-2) ?? 0);
  const pill = (cls: string, t: string) => <span className={`whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[10px] ${cls}`}>{t}</span>;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Tile label="Compliance score" icon={ShieldCheck} target="mgr-health"
        value={String(view.score)} unit="%" tone={view.score >= COMPLIANCE_TARGET ? "text-ok" : view.score >= 70 ? "text-warn" : "text-fail"}
        sub={`target ${COMPLIANCE_TARGET}% · PIT Armour`} badge={pill("bg-ok/10 text-ok", "live")}>
        <div className="mt-2 flex items-center justify-between">
          <span className={`font-mono text-[11px] ${scoreDelta >= 0 ? "text-ok" : "text-fail"}`}>{scoreDelta >= 0 ? "▲" : "▼"} {Math.abs(scoreDelta)} pts</span>
          <Spark data={view.scoreTrend} color="var(--primary)" />
        </div>
      </Tile>

      <Tile label="Overdue findings" icon={Siren} target="mgr-escalations"
        value={String(view.escalations.length)} tone={view.escalations.length ? "text-fail" : "text-ok"}
        sub="past SLA · escalated to you" badge={high ? pill("bg-fail/10 text-fail", `${high} high`) : undefined}>
        <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-panel-2">
          <div style={{ width: `${(high / (view.escalations.length || 1)) * 100}%`, background: "var(--fail)" }} />
          <div style={{ width: `${((view.escalations.length - high) / (view.escalations.length || 1)) * 100}%`, background: "var(--warn)" }} />
        </div>
      </Tile>

      <Tile label="Release readiness" icon={CalendarDays} target="mgr-releases"
        value={`${rs("On track") + rs("Done")}/${upcoming.length}`} tone={rs("Blocked") ? "text-fail" : rs("At risk") ? "text-warn" : "text-ok"}
        sub="upcoming releases ready">
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span><span className="text-fail">●</span> {rs("Blocked")} blocked</span>
          <span><span className="text-warn">●</span> {rs("At risk")} at risk</span>
          <span><span className="text-ok">●</span> {rs("On track") + rs("Done")} on track</span>
        </div>
      </Tile>

      <Tile label="Time to remediate" icon={Clock3} target="mgr-flow"
        value={MTTR_DAYS.toFixed(1)} unit="days" tone={MTTR_DAYS <= MTTR_SLA_DAYS ? "text-ok" : "text-fail"}
        sub={`team average · SLA ${MTTR_SLA_DAYS} d`}>
        <div className="mt-2 flex items-center justify-between">
          <span className="font-mono text-[11px] text-ok">▼ 0.2 d vs last month</span>
          <Spark data={MTTR_TREND} color="var(--ok)" invert />
        </div>
      </Tile>

      <Tile label="Decisions waiting" icon={Gavel} target="mgr-decisions"
        value={String(pending.length)} tone={pending.length ? "text-primary" : "text-ok"}
        sub="need your approval" badge={pending.some((d) => d.risk === "High") ? pill("bg-fail/10 text-fail", "high risk") : undefined}>
        <div className="mt-2 flex flex-wrap gap-1">
          {pending.slice(0, 4).map((d) => (
            <span key={d.id} className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{d.process.split(" ")[0]}</span>
          ))}
        </div>
      </Tile>
    </div>
  );
}
