import { useMemo } from "react";
import { AlarmClock, CheckCircle2, Info, RotateCcw } from "lucide-react";
import { Mono } from "@/components/audit/atoms";
import { Card, Empty } from "@/components/developer/DevSections";
import { useEscalations } from "@/lib/escalation-store";
import { ageLabel, daysSince, type Level } from "@/lib/escalation-data";
import type { ProjectId } from "@/lib/audit-data";
import type { DevAction } from "@/lib/developer-data";

const LEVEL_BADGE: Record<Level, { text: string; cls: string }> = {
  cto: { text: "Escalated to CTO", cls: "bg-fail/10 text-fail" },
  manager: { text: "Escalated to Manager", cls: "bg-warn/10 text-warn" },
  developer: { text: "Due soon", cls: "bg-primary-soft text-primary" },
};

/** Escalation items as developer actions, so the bell, KPIs and Waiting on others include them. */
export function useEscalationActions(pid: ProjectId): DevAction[] {
  const { items, meta, ageOf, getConfig, ready } = useEscalations();
  return useMemo(() => {
    if (!ready) return [];
    const manager = getConfig(pid).policy.people.manager.name;
    const out: DevAction[] = [];
    for (const i of items.filter((x) => x.projectId === pid)) {
      const m = meta(i.checkpointId);
      if (i.status === "open") {
        const a = ageOf(i);
        if (!a.level) continue;
        out.push({
          id: i.id,
          source: "escalation",
          severity: a.overdueDays > 0 ? "blocking" : "due",
          title: `${m.ref} ${m.name}`,
          process: `${m.ref} ${m.category}`,
          change: "Escalation",
          hint: ageLabel(a),
        });
      } else if (i.status === "pending-approval" && i.fixedAt) {
        const d = daysSince(i.fixedAt, Date.now());
        out.push({
          id: i.id,
          source: "escalation",
          severity: "waiting",
          title: `${m.ref} ${m.name}: waiting for approval`,
          process: `${m.ref} ${m.category}`,
          change: m.ref,
          hint: "Marked fixed; waiting for the Manager to approve.",
          who: `${manager} · Manager`,
          since: `${d} ${d === 1 ? "day" : "days"}`,
        });
      }
    }
    return out;
  }, [items, meta, ageOf, getConfig, pid, ready]);
}

export function EscalatedWork({ pid, onLog }: { pid: ProjectId; onLog: (t: string) => void }) {
  const { items, meta, ageOf, markFixed, getConfig, ready, resetDemo, error } = useEscalations();
  const manager = getConfig(pid).policy.people.manager.name;
  const open = items
    .filter((i) => i.projectId === pid && i.status === "open")
    .map((i) => ({ i, a: ageOf(i), m: meta(i.checkpointId) }))
    .sort((x, y) => y.a.overdueDays - x.a.overdueDays);
  const overdue = open.filter((x) => x.a.overdueDays > 0).length;

  return (
    <div id="dev-escalated" className="scroll-mt-6">
      <Card
        title="Overdue & escalated"
        icon={AlarmClock}
        note={`Checkpoints you own that are open past, or close to, their limit. Fixed sends them to ${manager} for approval.`}
        right={
          <span className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${overdue ? "bg-fail/10 text-fail" : "bg-panel-2 text-muted-foreground"}`}
            >
              {overdue} overdue · {open.length} open
            </span>
            <button
              type="button"
              onClick={() => {
                resetDemo();
                onLog("You reset the demo items");
              }}
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
              title="Reload the demo items: undo all fixes, approvals and notifications"
            >
              <RotateCcw className="h-3 w-3" /> Reset demo
            </button>
          </span>
        }
      >
        {error && (
          <p
            role="alert"
            className="mb-3 rounded-md border border-fail/30 bg-fail/10 px-3 py-2 text-xs text-fail"
          >
            {error}
          </p>
        )}
        {!ready ? null : open.length === 0 ? (
          <Empty text="Nothing open. Every escalated checkpoint is fixed." />
        ) : (
          <ul className="space-y-2">
            {open.map(({ i, a, m }) => {
              const badge = a.level ? LEVEL_BADGE[a.level] : null;
              return (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2.5 hover:border-primary/30"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      background:
                        a.overdueDays > 0
                          ? "var(--fail)"
                          : a.level
                            ? "var(--warn)"
                            : "var(--faint)",
                    }}
                  />
                  <div className="min-w-[220px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Mono className="text-faint">{m.ref}</Mono>
                      <p className="text-sm text-foreground">{m.name}</p>
                      {badge && (
                        <span
                          className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${badge.cls}`}
                        >
                          {badge.text}
                        </span>
                      )}
                    </div>
                    <p
                      className={`mt-0.5 font-mono text-[11px] ${a.overdueDays > 0 ? "text-fail" : "text-muted-foreground"}`}
                    >
                      {ageLabel(a)}
                    </p>
                    {i.rejectReason && (
                      <p className="mt-1 flex items-start gap-1 text-xs text-warn">
                        <Info className="mt-0.5 h-3 w-3 shrink-0" /> Rejected: {i.rejectReason}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      markFixed(i.id);
                      onLog(`You marked ${m.ref} fixed; sent to ${manager} for approval`);
                    }}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Fixed
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
