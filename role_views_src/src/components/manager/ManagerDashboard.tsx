import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ManagerBell, ManagerKpis, ToolLinks } from "@/components/manager/ManagerHeader";
import {
  AuditReadiness,
  DecisionsInbox,
  DeveloperIssues,
  Escalations,
  HealthCards,
  LeadActivityFeed,
  ReleaseCalendar,
  Team,
} from "@/components/manager/ManagerSections";
import { FindingsFlow, ProblemAreas, RepeatOffences } from "@/components/manager/ManagerInsights";
import { useAudit } from "@/lib/audit-store";
import {
  DECISIONS,
  MANAGER_PERSONA as M,
  buildManagerView,
  type ComponentId,
  type LeadActivity,
} from "@/lib/manager-data";

// Manager view (frontend only, PIT Armour scope). Decisions, reassignments, SLA extensions,
// comments and invites are kept in local state for the session; nothing is sent to the backend.

export function ManagerDashboard() {
  const { checkpoints, clock } = useAudit();
  const view = useMemo(() => buildManagerView(checkpoints), [checkpoints]);
  const [selected, setSelected] = useState<ComponentId | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, { outcome: "approved" | "rejected"; reason: string }>>({});
  const [local, setLocal] = useState<LeadActivity[]>([]);

  const pending = DECISIONS.filter((d) => !outcomes[d.id]);
  const log = (text: string) =>
    setLocal((l) => [{ id: `you-${Date.now()}-${l.length}`, at: `Today ${clock}`, actor: "You", source: "you", text }, ...l]);
  const decide = (id: string, outcome: "approved" | "rejected", reason: string) => {
    setOutcomes((o) => ({ ...o, [id]: { outcome, reason } }));
    const d = DECISIONS.find((x) => x.id === id);
    if (d) log(`${outcome} "${d.title}"${reason ? `: ${reason}` : ""}`);
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="PIT Armour · Manager view"
        subtitle={`${M.bu} business unit · ${M.name} (${M.role}) — health, risk, releases, team and decisions`}
        trailing={
          <div className="flex items-center gap-2">
            <ToolLinks />
            <ManagerBell pending={pending} view={view} />
          </div>
        }
      />

      <ManagerKpis view={view} pending={pending} />

      <HealthCards selected={selected} onSelect={setSelected} liveScore={view.score} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ProblemAreas view={view} selected={selected} />
        <RepeatOffences onLog={log} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Escalations view={view} selected={selected} onLog={log} />
        <DecisionsInbox decisions={DECISIONS} outcomes={outcomes} onDecide={decide} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DeveloperIssues view={view} selected={selected} />
        <ReleaseCalendar view={view} selected={selected} />
      </div>

      <FindingsFlow />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Team onLog={log} />
        <LeadActivityFeed local={local} />
      </div>

      <AuditReadiness view={view} />
    </div>
  );
}
