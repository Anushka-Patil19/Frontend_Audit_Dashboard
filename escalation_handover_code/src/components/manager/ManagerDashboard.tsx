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
import { MyProjects, PortfolioKpis, PortfolioTeam } from "@/components/manager/ManagerPortfolio";
import { ManagerProjectProvider } from "@/components/manager/project-context";
import { useAudit } from "@/lib/audit-store";
import { EscalationAlerts, FixApprovals, useFixDecisions } from "@/components/manager/EscalationPanels";
import {
  MANAGER_PERSONA as M,
  MANAGER_PROJECTS,
  MANAGER_PROJECT_IDS,
  buildManagerView,
  type ComponentId,
  type Decision,
  type LeadActivity,
  type ManagerView,
} from "@/lib/manager-data";
import type { ProjectId } from "@/lib/audit-data";

// Manager view (frontend only). The Manager owns several projects: "All projects" is the
// portfolio, and each project tab is the full per-project view. Decisions, reassignments,
// comments and invites are kept in local state for the session; nothing is sent to the backend.

type Tab = "all" | ProjectId;
type Outcomes = Record<string, { outcome: "approved" | "rejected"; reason: string }>;

export function ManagerDashboard() {
  const { checkpoints, clock } = useAudit();
  const [tab, setTab] = useState<Tab>("all");
  const [outcomes, setOutcomes] = useState<Outcomes>({});
  const [local, setLocal] = useState<LeadActivity[]>([]);

  const views = useMemo(
    () => Object.fromEntries(MANAGER_PROJECT_IDS.map((p) => [p, buildManagerView(checkpoints, p)])) as Record<ProjectId, ManagerView>,
    [checkpoints],
  );

  const fixA = useFixDecisions("project-a");
  const fixB = useFixDecisions("project-b");
  const fixC = useFixDecisions("project-c");
  const fixAll = useFixDecisions("all");
  const fixBy: Record<ProjectId, Decision[]> = { "project-a": fixA, "project-b": fixB, "project-c": fixC };
  // Fixes waiting for approval count in the bell and the "What needs my decision?" KPI.
  const pendingBy = Object.fromEntries(
    MANAGER_PROJECT_IDS.map((p) => [p, [...fixBy[p], ...MANAGER_PROJECTS[p].decisions.filter((d) => !outcomes[d.id])]]),
  ) as Record<ProjectId, Decision[]>;

  const log = (text: string) =>
    setLocal((l) => [{ id: `you-${Date.now()}-${l.length}`, at: `Today ${clock}`, actor: "You", source: "you", text }, ...l]);
  const decide = (pid: ProjectId) => (id: string, outcome: "approved" | "rejected", reason: string) => {
    setOutcomes((o) => ({ ...o, [id]: { outcome, reason } }));
    const d = MANAGER_PROJECTS[pid].decisions.find((x) => x.id === id);
    if (d) log(`${outcome} "${d.title}"${reason ? `: ${reason}` : ""}`);
  };

  // Bell on the All projects tab: every project's escalations, tagged with the project.
  const allPending = [...fixAll, ...MANAGER_PROJECT_IDS.flatMap((p) => MANAGER_PROJECTS[p].decisions.filter((d) => !outcomes[d.id]))];
  const allView: ManagerView = {
    ...views["project-a"],
    escalations: MANAGER_PROJECT_IDS.flatMap((p) =>
      views[p].escalations.map((e) => ({ ...e, id: `${p}-${e.id}`, title: `${MANAGER_PROJECTS[p].name} · ${e.title}` })),
    ),
  };

  // Activity feed on All projects: every project's feed, interleaved and tagged.
  const allActivity: LeadActivity[] = [];
  const longest = Math.max(...MANAGER_PROJECT_IDS.map((p) => MANAGER_PROJECTS[p].activity.length));
  for (let i = 0; i < longest; i++)
    for (const p of MANAGER_PROJECT_IDS) {
      const a = MANAGER_PROJECTS[p].activity[i];
      if (a) allActivity.push({ ...a, id: `${p}-${a.id}`, text: `[${MANAGER_PROJECTS[p].name}] ${a.text}` });
    }

  const mp = tab === "all" ? null : MANAGER_PROJECTS[tab];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title={mp ? `${mp.name} · Manager view` : "My projects · Manager view"}
        subtitle={mp
          ? `${mp.bu} business unit · ${M.name} (${M.role}) — health, risk, releases, team and decisions`
          : `${M.name} (${M.role}) · ${MANAGER_PROJECT_IDS.length} projects — what needs you across all of them`}
        trailing={
          <div className="flex items-center gap-2">
            <ToolLinks />
            {tab === "all"
              ? <ManagerBell pending={allPending} view={allView} />
              : <ManagerBell pending={pendingBy[tab]} view={views[tab]} />}
          </div>
        }
      />

      <div role="tablist" aria-label="Projects" className="flex flex-wrap gap-1 rounded-lg border border-border bg-panel p-1 shadow-card">
        {(["all", ...MANAGER_PROJECT_IDS] as Tab[]).map((t) => {
          const active = t === tab;
          const count = t === "all" ? allPending.length : pendingBy[t].length;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t)}
              className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-panel-2 hover:text-foreground"}`}
            >
              {t === "all" ? "All projects" : MANAGER_PROJECTS[t].name}
              {count > 0 && (
                <span className={`rounded-full px-1.5 font-mono text-[10px] ${active ? "bg-white/20" : "bg-primary-soft text-primary"}`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "all" ? (
        <>
          <PortfolioKpis views={views} pendingBy={pendingBy} />
          <MyProjects views={views} pendingBy={pendingBy} onOpen={setTab} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <EscalationAlerts pid="all" role="manager" title="Escalated to you · all projects" />
            <FixApprovals pid="all" managerName={M.name} onLog={log} />
          </div>
          <PortfolioTeam />
          <LeadActivityFeed local={local} activity={allActivity} />
        </>
      ) : (
        <ManagerProjectProvider key={tab} pid={tab}>
          <ProjectTab
            pid={tab}
            view={views[tab]}
            pending={pendingBy[tab]}
            outcomes={outcomes}
            onDecide={decide(tab)}
            local={local}
            onLog={log}
          />
        </ManagerProjectProvider>
      )}
    </div>
  );
}

function ProjectTab({ pid, view, pending, outcomes, onDecide, local, onLog }: {
  pid: ProjectId; view: ManagerView; pending: Decision[]; outcomes: Outcomes;
  onDecide: (id: string, outcome: "approved" | "rejected", reason: string) => void;
  local: LeadActivity[]; onLog: (t: string) => void;
}) {
  const [selected, setSelected] = useState<ComponentId | null>(null);
  return (
    <>
      <ManagerKpis view={view} pending={pending} />

      <HealthCards selected={selected} onSelect={setSelected} liveScore={view.score} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ProblemAreas view={view} selected={selected} />
        <RepeatOffences onLog={onLog} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <EscalationAlerts pid={pid} role="manager" title="Escalated to you" />
        <FixApprovals pid={pid} managerName={M.name} onLog={onLog} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Escalations view={view} selected={selected} onLog={onLog} />
        <DecisionsInbox decisions={MANAGER_PROJECTS[pid].decisions} outcomes={outcomes} onDecide={onDecide} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DeveloperIssues view={view} selected={selected} />
        <ReleaseCalendar view={view} selected={selected} />
      </div>

      <FindingsFlow />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Team onLog={onLog} />
        <LeadActivityFeed local={local} />
      </div>

      <AuditReadiness view={view} />
    </>
  );
}
