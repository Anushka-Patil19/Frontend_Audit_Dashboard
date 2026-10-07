import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BellRing,
  CheckCircle2,
  ChevronDown,
  Eye,
  GitPullRequest,
  Hourglass,
  ListChecks,
  Loader2,
  RotateCcw,
  ScrollText,
  Send,
  User,
  Wrench,
} from "lucide-react";
import { Mono } from "@/components/audit/atoms";
import { LiveTag, SEV } from "@/components/developer/DevKpis";
import {
  DEV_ACTIVITY,
  PROJECT_RULES,
  type DevAction,
  type DevActivity,
  type DeveloperView,
  type Rule,
} from "@/lib/developer-data";
import type { FeedEntry } from "@/lib/audit-data";

export function Card({
  title, icon: Icon, note, right, children,
}: { title: string; icon: React.ElementType; note: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col rounded-xl border border-border bg-panel p-5 shadow-card">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary-soft">
            <Icon className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
          </span>
          <h2 className="font-serif text-base text-foreground">{title}</h2>
        </div>
        {right}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{note}</p>
      {children}
    </section>
  );
}

export function Chips<T extends string>({ options, value, onChange }: { options: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="mb-3 flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
            value === o.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-panel text-muted-foreground hover:border-primary/40 hover:text-foreground"
          }`}
        >
          {o.label}{o.count !== undefined && <span className="ml-1 opacity-70">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-panel-2/40 px-4 py-6 text-center">
      <CheckCircle2 className="mb-1 h-5 w-5 text-ok" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

/* ───────────────────────── Fix these ───────────────────────── */

export function FixThese({
  view, onResolve, onUndo, onLog,
}: { view: DeveloperView; onResolve: (id: string) => void; onUndo: (id: string) => void; onLog: (text: string) => void }) {
  const items = view.actions.filter((a) => a.severity !== "waiting");
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null);
  const [checking, setChecking] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});

  const recheck = (a: DevAction) => {
    setChecking(a.id);
    setTimeout(() => {
      setChecking(null);
      if (a.live) {
        setNote((n) => ({ ...n, [a.id]: "This one is checked by a real workflow. Run it from the copilot to update it." }));
        onLog(`You re-checked ${a.process}: still open, run the live check in the copilot`);
      } else {
        onResolve(a.id);
        onLog(`You re-checked ${a.process} on ${a.change}: verified fixed`);
      }
    }, 1200);
  };

  return (
    <Card
      title="Fix these" icon={Wrench}
      note="Findings assigned to you. Click one for the fix steps, then Re-check."
      right={<span className="rounded-full bg-fail/10 px-2 py-0.5 font-mono text-[10px] text-fail">{items.length} open</span>}
    >
      {items.length === 0 ? (
        <Empty text="Nothing to fix. Nice work." />
      ) : (
        <ul className="space-y-2">
          {items.map((a) => {
            const isOpen = open === a.id;
            return (
              <li key={a.id} className={`rounded-lg border transition-colors ${isOpen ? "border-primary/40 bg-panel-2/40" : "border-border hover:border-primary/30"}`}>
                <button type="button" onClick={() => setOpen(isOpen ? null : a.id)} className="flex w-full items-start gap-3 px-3 py-2.5 text-left" aria-expanded={isOpen}>
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: SEV[a.severity].color }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm text-foreground">{a.title}</p>
                      {a.live && <LiveTag />}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <span className={SEV[a.severity].text}>{SEV[a.severity].label}</span> · {a.process} · {a.change}
                    </p>
                  </div>
                  <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="border-t border-border px-3 pb-3 pt-2.5">
                    <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-faint">How to fix</p>
                    <ol className="list-decimal space-y-1 pl-4 text-xs text-foreground">
                      {(a.steps ?? [a.hint]).map((s) => <li key={s}>{s}</li>)}
                    </ol>
                    {note[a.id] && <p className="mt-2 rounded-md bg-primary-soft px-2 py-1.5 text-xs text-primary">{note[a.id]}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button" onClick={() => recheck(a)} disabled={checking === a.id}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
                      >
                        {checking === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        {checking === a.id ? "Checking..." : "Re-check"}
                      </button>
                      <Link to="/projects" search={{ project: "project-a" }} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-panel-2">
                        <Eye className="h-3.5 w-3.5" /> View evidence
                      </Link>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {view.resolvedActions.length > 0 && (
        <div className="mt-3 border-t border-border pt-2">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-ok">Fixed today</p>
          {view.resolvedActions.map((a) => (
            <div key={a.id} className="flex items-center gap-2 py-1 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-ok" />
              <span className="min-w-0 flex-1 truncate text-muted-foreground line-through">{a.title}</span>
              <button type="button" onClick={() => onUndo(a.id)} className="text-[11px] text-primary hover:underline">Undo</button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ───────────────────────── Waiting on others ───────────────────────── */

const initials = (name: string) => name.split(" ").slice(0, 2).map((w) => w[0]).join("");

export function WaitingOnOthers({ view, onLog }: { view: DeveloperView; onLog: (text: string) => void }) {
  const [nudged, setNudged] = useState<Record<string, boolean>>({});
  const items = view.waiting;

  return (
    <Card
      title="Waiting on others" icon={Hourglass}
      note="Your changes waiting on someone else. Nothing for you to fix, but you can nudge them."
      right={<span className="rounded-full bg-panel-2 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{items.length} waiting</span>}
    >
      {items.length === 0 ? (
        <Empty text="Nobody is holding up your changes." />
      ) : (
        <ul className="space-y-2">
          {items.map((a) => {
            const [person, role] = (a.who ?? "Someone · ").split(" · ");
            const days = parseInt(a.since ?? "0", 10) || 0;
            return (
              <li key={a.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 hover:border-primary/30">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft font-mono text-[11px] text-primary">
                  {person ? initials(person) : <User className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-foreground">{a.title}</p>
                    {a.live && <LiveTag />}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    With <span className="text-foreground">{person}</span>{role ? ` (${role})` : ""} · {a.process}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1 w-24 rounded-full bg-panel-2">
                      <div className="h-1 rounded-full" style={{ width: `${Math.min(100, (days / 3) * 100)}%`, background: days >= 2 ? "var(--warn)" : "var(--faint)" }} />
                    </div>
                    <Mono className={days >= 2 ? "text-warn" : "text-faint"}>{a.since} waiting</Mono>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={nudged[a.id]}
                  onClick={() => {
                    setNudged((n) => ({ ...n, [a.id]: true }));
                    onLog(`You nudged ${person} about ${a.change}`);
                  }}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${
                    nudged[a.id] ? "border-ok/30 bg-ok/10 text-ok" : "border-border text-foreground hover:border-primary/50 hover:bg-panel-2"
                  }`}
                  title="Demo only: no message is actually sent"
                >
                  {nudged[a.id] ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                  {nudged[a.id] ? "Nudged" : "Nudge"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-faint">Nudge is a demo: it logs the reminder in your activity but doesn't send a message.</p>
    </Card>
  );
}

/* ───────────────────────── Project rules ───────────────────────── */

export function ProjectRules() {
  const [group, setGroup] = useState<"All" | Rule["group"]>("All");
  const [open, setOpen] = useState<string | null>(null);
  const rules = PROJECT_RULES.filter((r) => group === "All" || r.group === group);
  const count = (g: Rule["group"]) => PROJECT_RULES.filter((r) => r.group === g).length;

  return (
    <Card title="Project rules" icon={ScrollText} note="PIT Armour's rules at a glance. Click a rule to see why and how it's checked.">
      <Chips
        value={group}
        onChange={setGroup}
        options={[
          { value: "All", label: "All", count: PROJECT_RULES.length },
          { value: "Code", label: "Code", count: count("Code") },
          { value: "Approvals", label: "Approvals", count: count("Approvals") },
          { value: "Release", label: "Release", count: count("Release") },
        ]}
      />
      <ul className="divide-y divide-border">
        {rules.map((r) => {
          const isOpen = open === r.id;
          return (
            <li key={r.id}>
              <button type="button" onClick={() => setOpen(isOpen ? null : r.id)} className="flex w-full items-center gap-3 py-2.5 text-left" aria-expanded={isOpen}>
                <GitPullRequest className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 text-sm text-foreground">{r.rule}</span>
                <Mono className="shrink-0 text-faint">{r.process}</Mono>
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && <p className="mb-2.5 ml-6 rounded-md bg-panel-2/60 px-3 py-2 text-xs text-muted-foreground">{r.detail}</p>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ───────────────────────── My recent activity ───────────────────────── */

const RELEVANT = /#(10|16|18|38)\b|CR-POC|UAT|CAB/i;

type Kind = DevActivity["kind"];
const KIND_STYLE: Record<Kind, { label: string; icon: React.ElementType; cls: string }> = {
  verification: { label: "Verification", icon: BellRing, cls: "bg-warn/10 text-warn" },
  review: { label: "Review", icon: GitPullRequest, cls: "bg-primary-soft text-primary" },
  you: { label: "You", icon: User, cls: "bg-ok/10 text-ok" },
};

export function MyActivity({ feed, local }: { feed: FeedEntry[]; local: DevActivity[] }) {
  const [kind, setKind] = useState<"all" | Kind>("all");
  const fromFeed: DevActivity[] = feed
    .filter((f) => RELEVANT.test(f.text))
    .map((f) => ({ id: `feed-${f.id}`, at: `Today ${f.at}`, kind: "verification", text: f.text }));
  const all = [...local, ...fromFeed, ...DEV_ACTIVITY];
  const shown = all.filter((a) => kind === "all" || a.kind === kind);
  const n = (k: Kind) => all.filter((a) => a.kind === k).length;

  return (
    <Card title="My recent activity" icon={ListChecks} note="Verifications, reviews and your own actions, on your changes only.">
      <Chips
        value={kind}
        onChange={setKind}
        options={[
          { value: "all", label: "All", count: all.length },
          { value: "verification", label: "Verifications", count: n("verification") },
          { value: "review", label: "Reviews", count: n("review") },
          { value: "you", label: "You", count: n("you") },
        ]}
      />
      <ol className="relative ml-2 space-y-3 border-l border-border pl-4">
        {shown.slice(0, 8).map((a) => {
          const k = KIND_STYLE[a.kind];
          return (
            <li key={a.id} className="relative">
              <span className={`absolute -left-[25px] top-0.5 grid h-4 w-4 place-items-center rounded-full ring-2 ring-panel ${k.cls}`}>
                <k.icon className="h-2.5 w-2.5" />
              </span>
              <p className="text-sm text-foreground">{a.text}</p>
              <Mono className="text-faint">{a.at} · {k.label}</Mono>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
