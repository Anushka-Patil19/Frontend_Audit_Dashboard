import { Bell, Gavel, Github, Mail, Siren } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  COMPLIANCE_TARGET,
  GATES as GATE_NAMES,
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

/* ───────── KPI tiles: one plain question, one number, why it matters, one action ───────── */

type Tone = "ok" | "warn" | "fail" | "info";
const TONE: Record<Tone, { text: string; border: string }> = {
  ok: { text: "text-ok", border: "border-border" },
  warn: { text: "text-warn", border: "border-warn/40" },
  fail: { text: "text-fail", border: "border-fail/40" },
  info: { text: "text-primary", border: "border-primary/40" },
};

function Tile({ question, value, valueSmall, tone, sentence, why, action, target }: {
  question: string; value: string; valueSmall?: boolean; tone: Tone; sentence: React.ReactNode;
  why: string; action: string; target: string;
}) {
  const t = TONE[tone];
  return (
    <div className={`flex flex-col rounded-xl border bg-panel p-4 shadow-card ${t.border}`}>
      <p className="text-xs text-muted-foreground">{question}</p>
      <p className={`mt-2 font-mono leading-none ${valueSmall ? "text-2xl" : "text-4xl"} ${t.text}`}>{value}</p>
      <p className="mt-2 text-sm text-foreground">{sentence}</p>
      <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">{why}</p>
      <button
        type="button"
        onClick={() => scrollToSection(target)}
        className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/50 hover:bg-panel-2"
      >
        {action} →
      </button>
    </div>
  );
}

const firstName = (full: string) => full.split(" ")[0] ?? full;
const listNames = (names: string[]) =>
  names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

export function ManagerKpis({ view, pending }: { view: ManagerView; pending: Decision[] }) {
  // 1 · Audit-ready
  const failing = view.pitCheckpoints.filter((c) =>
    c.kind === "automated" ? c.status !== "compliant" : !c.steps.every((s) => s.state === "done"),
  ).length;
  const scoreTone: Tone = view.score >= COMPLIANCE_TARGET ? "ok" : view.score >= 70 ? "warn" : "fail";

  // 2 · Decisions
  const highRisk = pending.filter((d) => d.risk === "High").length;

  // 3 · Late
  const owners = Array.from(new Set(view.escalations.map((e) => firstName(e.owner))));

  // 4 · Worst release this week
  const order = { Blocked: 0, "At risk": 1, "On track": 2, Done: 3 } as const;
  const thisWeek = view.releases.filter((r) => r.daysAway >= 0 && r.daysAway <= 7);
  const worst = [...thisWeek].sort((a, b) => order[view.releaseStatus(a)] - order[view.releaseStatus(b)] || a.daysAway - b.daysAway)[0];
  const worstStatus = worst ? view.releaseStatus(worst) : "On track";
  const pendingGate = worst ? GATE_NAMES[worst.gates.findIndex((g) => g === "pending")] : undefined;
  const others = thisWeek.length - 1;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        question="1 · Are we audit-ready?"
        value={`${view.score}%`}
        tone={scoreTone}
        sentence={<>of checks passing · <span className="text-foreground">{failing} failing</span></>}
        why={view.score >= COMPLIANCE_TARGET
          ? `Above the ${COMPLIANCE_TARGET}% target. Keep it there.`
          : `Target is ${COMPLIANCE_TARGET}%. Below it, an audit would find gaps.`}
        action="See what's failing"
        target="mgr-problems"
      />
      <Tile
        question="2 · What needs my decision?"
        value={String(pending.length)}
        tone={pending.length ? "info" : "ok"}
        sentence={pending.length
          ? <>approvals waiting{highRisk ? <> · <span className="text-fail">{highRisk} high risk</span></> : null}</>
          : "Nothing waiting on you."}
        why="Nobody else can approve these, so work waits on you."
        action="Review decisions"
        target="mgr-decisions"
      />
      <Tile
        question="3 · What's late?"
        value={String(view.escalations.length)}
        tone={view.escalations.length ? "fail" : "ok"}
        sentence={view.escalations.length ? <>past deadline · owners: {listNames(owners)}</> : "Nothing is past its deadline."}
        why="Late items become audit findings and delay releases."
        action="Chase or reassign"
        target="mgr-escalations"
      />
      <Tile
        question="4 · Can we ship this week?"
        value={worst ? worstStatus : "Nothing due"}
        valueSmall
        tone={worstStatus === "Blocked" ? "fail" : worstStatus === "At risk" ? "warn" : "ok"}
        sentence={worst ? (
          <>
            {worst.version} on {worst.date.split(" ")[0]}
            {worstStatus === "Blocked" && worst.blocker ? <> · blocked by {worst.blocker}</> : null}
            {worstStatus === "At risk" && pendingGate ? <> · waiting on {pendingGate}</> : null}
            {others > 0 ? <span className="text-muted-foreground"> (+{others} more this week)</span> : null}
          </>
        ) : "No releases in the next 7 days."}
        why="A failed gate means the release can't go out."
        action={worstStatus === "Blocked" ? "Clear the blocker" : "See releases"}
        target="mgr-releases"
      />
    </div>
  );
}
