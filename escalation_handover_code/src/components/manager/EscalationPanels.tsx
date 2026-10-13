import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { BellRing, Check, CheckCircle2, ChevronDown, ClipboardCheck, FileCheck2, Send, X } from "lucide-react";
import { Mono } from "@/components/audit/atoms";
import { Card, Empty } from "@/components/developer/DevSections";
import { useEscalations, useRoleNotifications } from "@/lib/escalation-store";
import { daysSince, type ApprovalRecord, type Level } from "@/lib/escalation-data";
import { projectsData, type ProjectId } from "@/lib/audit-data";

export type Scope = ProjectId | "all";
const inScope = (scope: Scope, pid: ProjectId) => scope === "all" || scope === pid;
const ProjectTag = ({ pid }: { pid: ProjectId }) => (
  <span className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{projectsData[pid].name}</span>
);
import type { Decision } from "@/lib/manager-data";

export const ago = (iso: string) => {
  const ms = Date.now() - Date.parse(iso);
  const m = Math.round(ms / 6e4);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} ${d === 1 ? "day" : "days"} ago`;
};

/** Pending fixes as Decisions, so the Manager's bell and KPI count them. */
export function useFixDecisions(pid: Scope): Decision[] {
  const { items, meta, ready } = useEscalations();
  if (!ready) return [];
  return items
    .filter((i) => inScope(pid, i.projectId) && i.status === "pending-approval")
    .map((i) => {
      const m = meta(i.checkpointId);
      return {
        id: i.id,
        type: "escalation",
        process: `${m.ref} ${m.category}`,
        title: `Approve fix: ${pid === "all" ? `${projectsData[i.projectId].name} · ` : ""}${m.ref} ${m.name}`,
        requester: `${i.fixedBy ?? i.owner} · Developer`,
        why: "Marked fixed and waiting for your approval.",
        risk: i.fixedAt && daysSince(i.fixedAt, Date.now()) >= 2 ? "High" : "Medium",
        evidence: "Approval record is captured when you approve",
      } satisfies Decision;
    });
}

export function ApprovalRecordCard({ r }: { r: ApprovalRecord }) {
  const t = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="rounded-lg border border-ok/40 bg-panel p-3 text-xs">
      <div className="flex items-center gap-1.5">
        <FileCheck2 className="h-4 w-4 text-ok" />
        <p className="font-semibold text-foreground">Approval record · evidence</p>
        <span className="ml-auto rounded-full bg-ok/10 px-2 py-0.5 font-mono text-[10px] text-ok">Compliant</span>
      </div>
      <dl className="mt-2 grid grid-cols-[110px_1fr] gap-x-2 gap-y-1">
        <dt className="text-faint">Checkpoint</dt><dd className="text-foreground">{r.checkpointRef} {r.checkpointName}</dd>
        <dt className="text-faint">Project</dt><dd className="text-foreground">{r.projectName}</dd>
        <dt className="text-faint">Fixed by</dt><dd className="text-foreground">{r.fixedBy} · {t(r.fixedAt)}</dd>
        <dt className="text-faint">Overdue at fix</dt><dd className="text-foreground">{r.overdueDaysAtFix} {r.overdueDaysAtFix === 1 ? "day" : "days"}</dd>
        <dt className="text-faint">Nudges</dt><dd className="text-foreground">{r.nudges}</dd>
        <dt className="text-faint">Approved by</dt><dd className="text-foreground">{r.approvedBy} · {t(r.approvedAt)}</dd>
      </dl>
      <p className="mt-2 text-[11px] text-faint">The screenshot agent saves this record as a PNG once the backend is connected.</p>
    </div>
  );
}

/* ───────────────────────── Fixes waiting for approval ───────────────────────── */

export function FixApprovals({ pid, managerName, onLog }: { pid: Scope; managerName: string; onLog: (t: string) => void }) {
  const { items, meta, approve, reject, getConfig, ready } = useEscalations();
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [openRecord, setOpenRecord] = useState<string | null>(null);
  const pending = items.filter((i) => inScope(pid, i.projectId) && i.status === "pending-approval");
  const approved = items.filter((i) => inScope(pid, i.projectId) && i.status === "compliant" && i.approval);

  return (
    <div id="mgr-fixes" className="scroll-mt-6 rounded-xl transition-shadow">
      <Card
        title="Fixes waiting for your approval"
        icon={ClipboardCheck}
        note={`A developer marked these fixed. Approve to make them compliant, or reject with a reason. Approve within the project's approval limit (2 days by default) or the CTO is notified.`}
        right={<span className="rounded-full bg-primary-soft px-2 py-0.5 font-mono text-[10px] text-primary">{pending.length} pending</span>}
      >
        {!ready ? null : pending.length === 0 ? (
          <Empty text="No fixes waiting for you." />
        ) : (
          <ul className="space-y-2">
            {pending.map((i) => {
              const m = meta(i.checkpointId);
              const waiting = i.fixedAt ? daysSince(i.fixedAt, Date.now()) : 0;
              const late = waiting >= getConfig(i.projectId).policy.approvalLimitDays;
              const lastNudge = i.nudges.at(-1);
              return (
                <li key={i.id} className={`rounded-lg border p-3 ${late ? "border-fail/40" : "border-border"}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    {pid === "all" && <ProjectTag pid={i.projectId} />}
                    <Mono className="text-faint">{m.ref}</Mono>
                    <p className="text-sm text-foreground">{m.name}</p>
                    {i.nudges.length > 0 && lastNudge && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warn/10 px-2 py-0.5 font-mono text-[10px] text-warn">
                        <Send className="h-3 w-3" /> Nudged ×{i.nudges.length} · last {ago(lastNudge)}
                      </span>
                    )}
                    {late && <span className="rounded-full bg-fail/10 px-2 py-0.5 font-mono text-[10px] text-fail">approval late · CTO alerted on next run</span>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Fixed by <span className="text-foreground">{i.fixedBy ?? i.owner}</span> {i.fixedAt ? ago(i.fixedAt) : ""} · was {i.overdueDaysAtFix ?? 0} {(i.overdueDaysAtFix ?? 0) === 1 ? "day" : "days"} overdue · waiting {waiting} {waiting === 1 ? "day" : "days"}
                  </p>
                  {rejecting === i.id ? (
                    <form
                      className="mt-2 flex flex-wrap gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!reason.trim()) return;
                        reject(i.id, managerName, reason.trim());
                        onLog(`rejected the fix for ${m.ref}: ${reason.trim()}`);
                        setRejecting(null);
                        setReason("");
                      }}
                    >
                      <input id={`reject-${i.id}`} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for rejecting (required)" className="h-7 min-w-0 flex-1 rounded-md border border-border bg-panel px-2 text-xs" />
                      <button type="submit" disabled={!reason.trim()} className="h-7 rounded-md bg-fail px-2.5 text-xs text-white disabled:opacity-50">Reject</button>
                      <button type="button" onClick={() => setRejecting(null)} className="h-7 rounded-md px-2 text-xs text-muted-foreground">Cancel</button>
                    </form>
                  ) : (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          approve(i.id, managerName);
                          onLog(`approved the fix for ${m.ref}; it is now compliant`);
                          setOpenRecord(i.id);
                        }}
                        className="inline-flex h-7 items-center gap-1 rounded-md bg-ok px-2.5 text-xs text-white hover:opacity-90"
                      >
                        <Check className="h-3.5 w-3.5" /> Approve
                      </button>
                      <button type="button" onClick={() => { setRejecting(i.id); setReason(""); }} className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2.5 text-xs text-foreground hover:bg-panel-2">
                        <X className="h-3.5 w-3.5" /> Reject
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {approved.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-ok">Approved · compliant</p>
            <ul className="space-y-1.5">
              {approved.map((i) => {
                const m = meta(i.checkpointId);
                const isOpen = openRecord === i.id;
                return (
                  <li key={i.id}>
                    <button type="button" onClick={() => setOpenRecord(isOpen ? null : i.id)} className="flex w-full items-center gap-2 text-left text-xs" aria-expanded={isOpen}>
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-ok" />
                      <span className="flex-1 text-foreground">{m.ref} {m.name}</span>
                      <span className="text-[11px] text-primary">{isOpen ? "Hide evidence" : "View evidence"}</span>
                      <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isOpen && i.approval && <div className="mt-2"><ApprovalRecordCard r={i.approval} /></div>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ───────────────────────── Escalated to you (latest Simulate run) ───────────────────────── */

export function EscalationAlerts({ pid, role, title }: { pid: Scope; role: Level; title: string }) {
  const { lastRun, notifications } = useEscalations();
  const projectNotes = useRoleNotifications(role, pid === "all" ? "project-a" : pid);
  // "all": each project's notifications since its own latest Simulate run.
  const scoped =
    pid === "all"
      ? notifications.filter((n) => n.recipient === role && (!lastRun[n.projectId] || n.runAt >= lastRun[n.projectId]!.runAt))
      : projectNotes;
  const notes = scoped.filter((n) => n.kind === "escalation" || n.kind === "approval-stalled");
  const runs = (pid === "all" ? (Object.values(lastRun) as NonNullable<(typeof lastRun)[ProjectId]>[]) : lastRun[pid] ? [lastRun[pid]!] : []);
  const run = runs.sort((a, b) => b.runAt.localeCompare(a.runAt))[0];
  return (
    <div id={`esc-alerts-${role}`} className="scroll-mt-6 rounded-xl transition-shadow">
      <Card
        title={title}
        icon={BellRing}
        note={run ? `From the Simulate run at ${new Date(run.runAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.` : "Run Simulate on the project page to check deadlines."}
        right={<span className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${notes.length ? "bg-fail/10 text-fail" : "bg-panel-2 text-muted-foreground"}`}>{notes.length} {notes.length === 1 ? "alert" : "alerts"}</span>}
      >
        {notes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-panel-2/40 px-4 py-5 text-center">
            <p className="text-sm text-muted-foreground">{run ? "Nothing escalated to you in the last run." : "No escalation run yet."}</p>
            <Link to="/projects" search={pid === "all" ? {} : { project: pid }} className="mt-2 inline-block text-xs text-primary hover:underline">Open a project and click Simulate →</Link>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {notes.map((n) => (
              <li key={n.id} className="flex items-start gap-2 py-2">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: n.kind === "approval-stalled" ? "var(--warn)" : "var(--fail)" }} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm text-foreground">{pid === "all" && <ProjectTag pid={n.projectId} />}{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.kind === "approval-stalled" ? "Approval stalled · " : ""}{n.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
