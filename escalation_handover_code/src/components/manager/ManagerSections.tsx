import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  FileDown,
  Gavel,
  Github,
  LayoutGrid,
  Mail,
  MessageSquare,
  Siren,
  UserPlus,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { Mono } from "@/components/audit/atoms";
import { useManagerProject } from "@/components/manager/project-context";
import { Card, Chips, Empty } from "@/components/developer/DevSections";
import { LiveTag } from "@/components/developer/DevKpis";
import { AuditReportModal } from "@/components/audit/AuditReportModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  COMPONENTS,
  GATES,
  LEAD_ACTIVITY,
  TEAM,
  type Component,
  type ComponentId,
  type Decision,
  type GateState,
  type LeadActivity,
  type ManagerView,
  type TeamMember,
} from "@/lib/manager-data";

const initials = (n: string) => n.split(" ").slice(0, 2).map((w) => w[0]).join("");
const compName = (id: ComponentId, list: Component[] = COMPONENTS) => list.find((c) => c.id === id)?.name ?? id;

function Anchor({ id, children }: { id: string; children: React.ReactNode }) {
  return <div id={id} className="scroll-mt-6 rounded-xl transition-shadow">{children}</div>;
}

/* ───────────────────────── Project health: which part needs attention? ───────────────────────── */

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function HealthCards({ selected, onSelect, liveScore }: { selected: ComponentId | null; onSelect: (id: ComponentId | null) => void; liveScore: number }) {
  const mp = useManagerProject();
  const rows = mp.components.map((c) => {
    const status = c.nc > 0 ? "attention" : c.overdue > 0 ? "late" : "ok";
    return { ...c, status };
  }).sort((a, b) => b.nc - a.nc || b.overdue - a.overdue || a.score - b.score);
  const needs = rows.filter((r) => r.status !== "ok");
  const healthy = rows.filter((r) => r.status === "ok");

  const see = (id: ComponentId) => {
    onSelect(id);
    window.setTimeout(() => document.getElementById("mgr-issues")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  return (
    <Anchor id="mgr-health">
      <Card title={`Which part of ${mp.name} needs attention?`} icon={LayoutGrid}
        note={`${needs.length} of ${rows.length} parts need attention · project overall ${liveScore}% (live). Worst first.`}
        right={selected && <button type="button" onClick={() => onSelect(null)} className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary-soft px-2 py-0.5 text-[11px] text-primary"><X className="h-3 w-3" /> Showing {compName(selected, mp.components)} · clear</button>}>
        <ul className="divide-y divide-border">
          {needs.map((r) => {
            const serious = r.status === "attention";
            const parts = [
              r.nc ? plural(r.nc, "serious issue", "serious issues") : null,
              r.overdue ? plural(r.overdue, "late item", "late items") : null,
            ].filter(Boolean).join(", ");
            return (
              <li key={r.id} className={`flex flex-wrap items-center gap-3 py-3 ${selected === r.id ? "bg-primary-soft/40" : ""}`}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: serious ? "var(--fail)" : "var(--warn)" }} />
                <div className="min-w-[200px] flex-1">
                  <p className="text-sm text-foreground">
                    {r.name} · <span className={serious ? "text-fail" : "text-warn"}>{serious ? "Needs attention" : plural(r.overdue, "late item", "late items")}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{serious ? `${parts} · ` : ""}e.g. {r.topIssue.replace(/\s*\(#[^)]*\)$/, "")}</p>
                </div>
                <button type="button" onClick={() => see(r.id)} className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:border-primary/50 hover:bg-panel-2">
                  See issues →
                </button>
              </li>
            );
          })}
        </ul>
        {healthy.length > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-ok">
            <CheckCircle2 className="h-3.5 w-3.5" /> {healthy.map((h) => h.name).join(", ")} {healthy.length === 1 ? "is" : "are"} on track
          </p>
        )}
      </Card>
    </Anchor>
  );
}

/* ───────────────────────── Issues by developers ───────────────────────── */

export function DeveloperIssues({ view, selected }: { view: ManagerView; selected: ComponentId | null }) {
  const mp = useManagerProject();
  const [person, setPerson] = useState<string>("All");
  const [status, setStatus] = useState<"open" | "all">("open");
  const people = ["All", ...Array.from(new Set(view.issues.map((i) => i.who)))];
  const shown = view.issues.filter((i) =>
    (person === "All" || i.who === person) && (status === "all" || i.status !== "fixed") && (!selected || i.component === selected));

  const statusPill = (s: string) =>
    s === "open" ? "bg-fail/10 text-fail" : s === "verifying" ? "bg-warn/10 text-warn" : "bg-ok/10 text-ok";

  return (
    <Anchor id="mgr-issues">
      <Card title="Issues by developers" icon={AlertTriangle}
        note={`Process breaches by people on ${mp.name}, so you can coach, not just count.`}
        right={<Chips value={status} onChange={setStatus} options={[{ value: "open", label: "Open" }, { value: "all", label: "All" }]} />}>
        <Chips value={person} onChange={setPerson} options={people.map((p) => ({ value: p, label: p }))} />
        {shown.length === 0 ? <Empty text="No matching issues." /> : (
          <ul className="divide-y divide-border">
            {shown.map((i) => (
              <li key={i.id} className="flex items-start gap-3 py-2.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary-soft font-mono text-[10px] text-primary">{initials(i.who)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-foreground">{i.what}</p>
                    {i.live && <LiveTag />}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {i.who} · {i.process} · {i.change} · {compName(i.component, mp.components)} · {i.when}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${statusPill(i.status)}`}>{i.status}</span>
                  <span className={`font-mono text-[10px] ${i.severity === "nc" ? "text-fail" : "text-warn"}`}>{i.severity === "nc" ? "Non-compliant" : "Observation"}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Anchor>
  );
}

/* ───────────────────────── Escalations ───────────────────────── */

export function Escalations({ view, selected, onLog }: { view: ManagerView; selected: ComponentId | null; onLog: (t: string) => void }) {
  const mp = useManagerProject();
  const [owner, setOwner] = useState<Record<string, string>>({});
  const [extending, setExtending] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [extended, setExtended] = useState<Record<string, string>>({});
  const [commenting, setCommenting] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<Record<string, string[]>>({});
  const items = view.escalations.filter((e) => !selected || e.component === selected);

  return (
    <Anchor id="mgr-escalations">
      <Card title="Escalations" icon={Siren} note="Developer blockers that passed their SLA. Reassign, extend the SLA with a reason, or comment."
        right={<span className="rounded-full bg-fail/10 px-2 py-0.5 font-mono text-[10px] text-fail">{items.length} past SLA</span>}>
        {items.length === 0 ? <Empty text="Nothing escalated." /> : (
          <ul className="space-y-2">
            {items.map((e) => {
              const current = owner[e.id] ?? e.owner;
              return (
                <li key={e.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-start gap-2">
                    <Siren className={`mt-0.5 h-4 w-4 shrink-0 ${e.severity === "high" ? "text-fail" : "text-warn"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm text-foreground">{e.title}</p>
                        {e.live && <LiveTag />}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {e.process} · owner <span className="text-foreground">{current}</span> · overdue{" "}
                        <span className="text-fail">{extended[e.id] ? `extended (${extended[e.id]})` : e.overdueBy}</span> · blocks{" "}
                        <span className="text-foreground">{e.blocks}</span>
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
                    <select
                      value={current}
                      onChange={(ev) => { setOwner((o) => ({ ...o, [e.id]: ev.target.value })); onLog(`reassigned "${e.title}" to ${ev.target.value}`); }}
                      className="h-7 rounded-md border border-border bg-panel px-2 text-xs text-foreground"
                      aria-label="Reassign"
                    >
                      {mp.team.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
                    </select>
                    <button type="button" onClick={() => { setExtending(e.id); setReason(""); }} className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-xs hover:bg-panel-2">
                      <Clock3 className="h-3.5 w-3.5" /> Extend SLA
                    </button>
                    <button type="button" onClick={() => { setCommenting(e.id); setComment(""); }} className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-xs hover:bg-panel-2">
                      <MessageSquare className="h-3.5 w-3.5" /> Comment{comments[e.id]?.length ? ` (${comments[e.id]?.length})` : ""}
                    </button>
                  </div>
                  {extending === e.id && (
                    <form className="mt-2 flex flex-wrap gap-2 pl-6" onSubmit={(ev) => {
                      ev.preventDefault();
                      if (!reason.trim()) return;
                      setExtended((x) => ({ ...x, [e.id]: "+3 d" }));
                      onLog(`extended the SLA on "${e.title}" by 3 days: ${reason.trim()}`);
                      setExtending(null);
                    }}>
                      <input autoFocus value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder="Reason (required), e.g. waiting on vendor patch"
                        className="h-7 min-w-0 flex-1 rounded-md border border-border bg-panel px-2 text-xs" />
                      <button type="submit" disabled={!reason.trim()} className="h-7 rounded-md bg-primary px-2.5 text-xs text-primary-foreground disabled:opacity-50">Extend +3 d</button>
                      <button type="button" onClick={() => setExtending(null)} className="h-7 rounded-md px-2 text-xs text-muted-foreground">Cancel</button>
                    </form>
                  )}
                  {commenting === e.id && (
                    <form className="mt-2 flex flex-wrap gap-2 pl-6" onSubmit={(ev) => {
                      ev.preventDefault();
                      if (!comment.trim()) return;
                      setComments((c) => ({ ...c, [e.id]: [...(c[e.id] ?? []), comment.trim()] }));
                      onLog(`commented on "${e.title}"`);
                      setComment("");
                      setCommenting(null);
                    }}>
                      <input autoFocus value={comment} onChange={(ev) => setComment(ev.target.value)} placeholder="Add a comment for the owner"
                        className="h-7 min-w-0 flex-1 rounded-md border border-border bg-panel px-2 text-xs" />
                      <button type="submit" disabled={!comment.trim()} className="h-7 rounded-md bg-primary px-2.5 text-xs text-primary-foreground disabled:opacity-50">Post</button>
                    </form>
                  )}
                  {(comments[e.id] ?? []).map((c, i) => (
                    <p key={i} className="ml-6 mt-1.5 rounded-md bg-panel-2/60 px-2 py-1 text-xs text-muted-foreground">You: {c}</p>
                  ))}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </Anchor>
  );
}

/* ───────────────────────── Decisions inbox ───────────────────────── */

const DEC_LABEL: Record<Decision["type"], string> = {
  exception: "Exception", access: "Access request", review: "Access review", escalation: "Escalation",
};

export function DecisionsInbox({
  decisions, outcomes, onDecide,
}: { decisions: Decision[]; outcomes: Record<string, { outcome: "approved" | "rejected"; reason: string }>; onDecide: (id: string, outcome: "approved" | "rejected", reason: string) => void }) {
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const pending = decisions.filter((d) => !outcomes[d.id]);

  return (
    <Anchor id="mgr-decisions">
      <Card title="Decisions inbox" icon={Gavel} note="Only you can decide these. Each shows who's asking, why, the risk and the evidence."
        right={<span className="rounded-full bg-primary-soft px-2 py-0.5 font-mono text-[10px] text-primary">{pending.length} pending</span>}>
        <ul className="space-y-2">
          {decisions.map((d) => {
            const done = outcomes[d.id];
            return (
              <li key={d.id} className={`rounded-lg border p-3 ${done ? "border-border bg-panel-2/40" : "border-border"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-primary-soft px-1.5 py-0.5 font-mono text-[10px] text-primary">{DEC_LABEL[d.type]}</span>
                  <Mono className="text-faint">{d.process}</Mono>
                  <span className={`ml-auto rounded-full px-2 py-0.5 font-mono text-[10px] ${d.risk === "High" ? "bg-fail/10 text-fail" : d.risk === "Medium" ? "bg-warn/10 text-warn" : "bg-panel-2 text-muted-foreground"}`}>risk {d.risk}</span>
                </div>
                <p className={`mt-1.5 text-sm ${done ? "text-muted-foreground" : "text-foreground"}`}>{d.title}</p>
                <dl className="mt-1.5 grid grid-cols-[70px_1fr] gap-x-2 gap-y-0.5 text-xs">
                  <dt className="text-faint">Asked by</dt><dd className="text-muted-foreground">{d.requester}</dd>
                  <dt className="text-faint">Why</dt><dd className="text-muted-foreground">{d.why}</dd>
                  <dt className="text-faint">Evidence</dt><dd className="text-muted-foreground">{d.evidence}</dd>
                </dl>
                {done ? (
                  <p className={`mt-2 flex items-center gap-1 text-xs ${done.outcome === "approved" ? "text-ok" : "text-fail"}`}>
                    {done.outcome === "approved" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {done.outcome === "approved" ? "Approved by you" : `Rejected by you: ${done.reason}`}
                  </p>
                ) : rejecting === d.id ? (
                  <form className="mt-2 flex flex-wrap gap-2" onSubmit={(ev) => {
                    ev.preventDefault();
                    if (!reason.trim()) return;
                    onDecide(d.id, "rejected", reason.trim());
                    setRejecting(null);
                  }}>
                    <input autoFocus value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder="Reason for rejecting (required)"
                      className="h-7 min-w-0 flex-1 rounded-md border border-border bg-panel px-2 text-xs" />
                    <button type="submit" disabled={!reason.trim()} className="h-7 rounded-md bg-fail px-2.5 text-xs text-white disabled:opacity-50">Reject</button>
                    <button type="button" onClick={() => setRejecting(null)} className="h-7 rounded-md px-2 text-xs text-muted-foreground">Cancel</button>
                  </form>
                ) : (
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => onDecide(d.id, "approved", "")} className="inline-flex h-7 items-center gap-1 rounded-md bg-ok px-2.5 text-xs text-white hover:opacity-90">
                      <Check className="h-3.5 w-3.5" /> Approve
                    </button>
                    <button type="button" onClick={() => { setRejecting(d.id); setReason(""); }} className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2.5 text-xs text-foreground hover:bg-panel-2">
                      <X className="h-3.5 w-3.5" /> Reject
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </Anchor>
  );
}

/* ───────────────────────── Release calendar ───────────────────────── */

const GATE_STYLE: Record<GateState, { cls: string; icon: React.ElementType; label: string }> = {
  done: { cls: "bg-ok/10 text-ok border-ok/30", icon: CheckCircle2, label: "done" },
  pending: { cls: "bg-panel-2 text-muted-foreground border-border", icon: Circle, label: "pending" },
  fail: { cls: "bg-fail/10 text-fail border-fail/30", icon: XCircle, label: "failed" },
  na: { cls: "bg-panel text-faint border-dashed border-border", icon: Circle, label: "n/a" },
};
const STATUS_CLS: Record<string, string> = {
  Blocked: "bg-fail/10 text-fail", "At risk": "bg-warn/10 text-warn", "On track": "bg-ok/10 text-ok", Done: "bg-panel-2 text-muted-foreground",
};

export function ReleaseCalendar({ view, selected }: { view: ManagerView; selected: ComponentId | null }) {
  const mp = useManagerProject();
  const [showPast, setShowPast] = useState(false);
  const list = view.releases
    .filter((r) => (showPast || r.daysAway >= 0) && (!selected || r.component === selected))
    .sort((a, b) => a.daysAway - b.daysAway);
  return (
    <Anchor id="mgr-releases">
      <Card title="Release calendar" icon={CalendarDays} note="Upcoming deployments and their gates: CR → review → scans → CAB → window → UAT. Red means at risk."
        right={<Chips value={showPast ? "all" : "up"} onChange={(v) => setShowPast(v === "all")} options={[{ value: "up", label: "Upcoming" }, { value: "all", label: "Incl. recent" }]} />}>
        {list.length === 0 ? <Empty text="No releases for this filter." /> : (
          <ul className="space-y-2">
            {list.map((r) => {
              const status = view.releaseStatus(r);
              return (
                <li key={r.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm text-foreground">{r.version}</span>
                    <span className="text-xs text-muted-foreground">{r.date} · {compName(r.component, mp.components)} · {r.changes}</span>
                    <span className={`ml-auto rounded-full px-2 py-0.5 font-mono text-[10px] ${STATUS_CLS[status]}`}>{status}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {GATES.map((g, i) => {
                      const s = GATE_STYLE[r.gates[i] ?? "na"];
                      return (
                        <span key={g} className="flex items-center gap-1">
                          <span title={`${g}: ${s.label}`} className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] ${s.cls}`}>
                            <s.icon className="h-3 w-3" /> {g}
                          </span>
                          {i < GATES.length - 1 && <span className="text-faint">→</span>}
                        </span>
                      );
                    })}
                  </div>
                  {r.liveNote && <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground"><LiveTag /> {r.liveNote}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </Anchor>
  );
}

/* ───────────────────────── Team ───────────────────────── */

export function Team({ onLog }: { onLog: (t: string) => void }) {
  const mp = useManagerProject();
  const [team, setTeam] = useState<TeamMember[]>(mp.team);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Developer");
  const [err, setErr] = useState("");
  const maxOpen = Math.max(...team.map((t) => t.open), 1);

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setErr("Enter a valid work email"); return; }
    const name = email.trim().split("@")[0]?.replace(/[._]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()) ?? email;
    setTeam((t) => [...t, { name, role, open: 0, overdue: 0, access: [mp.name], status: "invited" }]);
    onLog(`invited ${email.trim()} to ${mp.name} as ${role}`);
    setEmail(""); setErr(""); setOpen(false);
  };

  return (
    <Anchor id="mgr-team">
      <Card title={`Team · ${mp.name}`} icon={Users} note="Workload per person (open and overdue items), and who has access to which project."
        right={<button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground hover:bg-primary/90"><UserPlus className="h-3.5 w-3.5" /> Invite developer</button>}>
        <ul className="divide-y divide-border">
          {team.map((t) => (
            <li key={t.name} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft font-mono text-[11px] text-primary">{initials(t.name)}</span>
              <div className="min-w-[140px] flex-1">
                <p className="text-sm text-foreground">{t.name} {t.status === "invited" && <span className="ml-1 rounded-full bg-warn/10 px-1.5 py-0.5 font-mono text-[10px] text-warn">invite pending</span>}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
              <div className="w-40">
                <div className="flex h-2 overflow-hidden rounded-full bg-panel-2">
                  <div style={{ width: `${((t.open - t.overdue) / maxOpen) * 100}%`, background: "var(--primary)" }} />
                  <div style={{ width: `${(t.overdue / maxOpen) * 100}%`, background: "var(--fail)" }} />
                </div>
                <Mono className="text-faint">{t.open} open{t.overdue ? ` · ${t.overdue} overdue` : ""}</Mono>
              </div>
              <div className="flex flex-wrap gap-1">
                {t.access.map((a) => <span key={a} className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${a === mp.name ? "bg-primary-soft text-primary" : "bg-panel-2 text-muted-foreground"}`}>{a}</span>)}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-faint">Workload, not a ranking. Invites are a demo: no email is sent yet.</p>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite to {mp.name}</DialogTitle>
            <DialogDescription>They'll get an email link to set up their account and will only see {mp.name}. (Demo: nothing is sent yet.)</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <label className="block text-xs text-muted-foreground">Work email
              <input autoFocus value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} placeholder="name@company.com"
                className="mt-1 h-9 w-full rounded-md border border-border bg-panel px-2 text-sm text-foreground" />
            </label>
            {err && <p className="text-xs text-fail">{err}</p>}
            <label className="block text-xs text-muted-foreground">Role
              <select value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-border bg-panel px-2 text-sm text-foreground">
                {["Developer", "Reviewer", "DevOps", "Release Manager", "QA"].map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
            <label className="block text-xs text-muted-foreground">Project
              <input value={mp.name} readOnly className="mt-1 h-9 w-full rounded-md border border-border bg-panel-2 px-2 text-sm text-muted-foreground" />
            </label>
            <DialogFooter>
              <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-md px-3 text-sm text-muted-foreground">Cancel</button>
              <button type="submit" className="h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground">Send invite</button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Anchor>
  );
}

/* ───────────────────────── Lead activity ───────────────────────── */

const SRC: Record<LeadActivity["source"], { label: string; icon: React.ElementType; cls: string }> = {
  jira: { label: "Jira", icon: LayoutGrid, cls: "bg-[#2684FF]/10 text-[#2684FF]" },
  github: { label: "GitHub", icon: Github, cls: "bg-foreground/10 text-foreground" },
  mail: { label: "Mail", icon: Mail, cls: "bg-[#0078D4]/10 text-[#0078D4]" },
  bitbucket: { label: "Bitbucket", icon: LayoutGrid, cls: "bg-[#2684FF]/10 text-[#2684FF]" },
  system: { label: "Audit bot", icon: Activity, cls: "bg-warn/10 text-warn" },
  you: { label: "You", icon: CheckCircle2, cls: "bg-ok/10 text-ok" },
};

export function LeadActivityFeed({ local, activity }: { local: LeadActivity[]; activity?: LeadActivity[] | undefined }) {
  const mp = useManagerProject();
  const [src, setSrc] = useState<"all" | LeadActivity["source"]>("all");
  const all = [...local, ...(activity ?? mp.activity)];
  const shown = all.filter((a) => src === "all" || a.source === src);
  const n = (s: LeadActivity["source"]) => all.filter((a) => a.source === s).length;
  return (
    <Anchor id="mgr-activity">
      <Card title="Lead activity" icon={Activity} note="What your team did across Jira, GitHub, Bitbucket and Mail, plus your own decisions.">
        <Chips value={src} onChange={setSrc} options={[
          { value: "all", label: "All", count: all.length },
          { value: "jira", label: "Jira", count: n("jira") },
          { value: "github", label: "GitHub", count: n("github") },
          { value: "bitbucket", label: "Bitbucket", count: n("bitbucket") },
          { value: "mail", label: "Mail", count: n("mail") },
          { value: "you", label: "You", count: n("you") },
        ]} />
        <ol className="relative ml-2 space-y-3 border-l border-border pl-4">
          {shown.slice(0, 9).map((a) => {
            const s = SRC[a.source];
            return (
              <li key={a.id} className="relative">
                <span className={`absolute -left-[25px] top-0.5 grid h-4 w-4 place-items-center rounded-full ring-2 ring-panel ${s.cls}`}><s.icon className="h-2.5 w-2.5" /></span>
                <p className="text-sm text-foreground"><span className="text-foreground">{a.actor}</span> <span className="text-muted-foreground">{a.text}</span></p>
                <Mono className="text-faint">{a.at} · {s.label}</Mono>
              </li>
            );
          })}
        </ol>
      </Card>
    </Anchor>
  );
}

/* ───────────────────────── Audit readiness ───────────────────────── */

export function AuditReadiness({ view }: { view: ManagerView }) {
  const mp = useManagerProject();
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? view.readiness : view.readiness.slice(0, 6);
  return (
    <Anchor id="mgr-audit">
      <Card title="Audit readiness" icon={FileDown}
        note={`Share of ${mp.name} checkpoints with verified evidence captured (live), weakest areas first.`}
        right={<button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-panel-2"><FileDown className="h-3.5 w-3.5" /> Download report</button>}>
        <div className="mb-3 flex items-end gap-3">
          <span className={`font-mono text-3xl leading-none ${view.readinessPct >= 90 ? "text-ok" : view.readinessPct >= 70 ? "text-warn" : "text-fail"}`}>{view.readinessPct}%</span>
          <span className="text-xs text-muted-foreground">evidence ready for audit · <LiveTag /></span>
        </div>
        <ul className="space-y-2">
          {rows.map((r) => {
            const tone = r.pct >= 90 ? "var(--ok)" : r.pct >= 70 ? "var(--warn)" : "var(--fail)";
            return (
              <li key={r.category} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
                <span className="text-xs text-foreground">{r.category}</span>
                <Mono className="text-faint">{r.captured}/{r.total}</Mono>
                <div className="col-span-2 h-1.5 w-full rounded-full bg-panel-2"><div className="h-1.5 rounded-full" style={{ width: `${r.pct}%`, background: tone }} /></div>
              </li>
            );
          })}
        </ul>
        {view.readiness.length > 6 && (
          <button type="button" onClick={() => setShowAll((s) => !s)} className="mt-2 text-[11px] text-primary hover:underline">
            {showAll ? "Show fewer" : `Show all ${view.readiness.length} areas`}
          </button>
        )}
      </Card>
      <AuditReportModal isOpen={open} onClose={() => setOpen(false)} projectName={mp.name} projectClient={`Newel Technologies · ${mp.bu} BU`}
        compliancePct={view.score} checkpoints={view.pitCheckpoints} />
    </Anchor>
  );
}
