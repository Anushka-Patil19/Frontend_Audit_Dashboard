import { ArrowRight, FolderKanban, Users } from "lucide-react";
import { Mono } from "@/components/audit/atoms";
import { Card } from "@/components/developer/DevSections";
import { Tile, type Tone } from "@/components/manager/ManagerHeader";
import { useEscalations } from "@/lib/escalation-store";
import {
  COMPLIANCE_TARGET,
  MANAGER_PROJECTS,
  MANAGER_PROJECT_IDS,
  type Decision,
  type ManagerView,
  type Release,
} from "@/lib/manager-data";
import type { ProjectId } from "@/lib/audit-data";

// "All projects" tab: the Manager's portfolio. One row per project they own, with an Open
// button that switches to that project's tab. Numbers are rolled up from the per-project views.

type Views = Record<ProjectId, ManagerView>;

const STATUS_ORDER = { Blocked: 0, "At risk": 1, "On track": 2, Done: 3 } as const;
const toneFor = (score: number): Tone =>
  score >= COMPLIANCE_TARGET ? "ok" : score >= 70 ? "warn" : "fail";
const TONE_TEXT: Record<Tone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  fail: "text-fail",
  info: "text-primary",
};

function worstRelease(
  view: ManagerView,
): { r: Release; status: keyof typeof STATUS_ORDER } | undefined {
  const week = view.releases.filter((r) => r.daysAway >= 0 && r.daysAway <= 7);
  const r = [...week].sort(
    (a, b) =>
      STATUS_ORDER[view.releaseStatus(a)] - STATUS_ORDER[view.releaseStatus(b)] ||
      a.daysAway - b.daysAway,
  )[0];
  return r ? { r, status: view.releaseStatus(r) } : undefined;
}

/** Open escalation items per project that are past their limit (from the escalation store). */
function useOverdueByProject(): Record<ProjectId, number> {
  const { items, ageOf, ready } = useEscalations();
  const out = { "project-a": 0, "project-b": 0, "project-c": 0 } as Record<ProjectId, number>;
  if (!ready) return out;
  for (const i of items) if (i.status === "open" && ageOf(i).overdueDays > 0) out[i.projectId] += 1;
  return out;
}

export function PortfolioKpis({
  views,
  pendingBy,
}: {
  views: Views;
  pendingBy: Record<ProjectId, Decision[]>;
}) {
  const overdue = useOverdueByProject();
  const ids = MANAGER_PROJECT_IDS;
  const name = (pid: ProjectId) => MANAGER_PROJECTS[pid].name;

  const below = ids.filter((p) => views[p].score < COMPLIANCE_TARGET);
  const lowest = [...ids].sort((a, b) => views[a].score - views[b].score)[0]!;
  const pending = ids.reduce((n, p) => n + pendingBy[p].length, 0);
  const highRisk = ids.reduce(
    (n, p) => n + pendingBy[p].filter((d) => d.risk === "High").length,
    0,
  );
  const late = ids.reduce((n, p) => n + views[p].escalations.length + overdue[p], 0);
  const lateProjects = ids.filter((p) => views[p].escalations.length + overdue[p] > 0);
  const releases = ids.flatMap((p) => {
    const w = worstRelease(views[p]);
    return w ? [{ pid: p, ...w }] : [];
  });
  const worst = [...releases].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])[0];
  const blocked = releases.filter((x) => x.status === "Blocked").length;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        question="1 · Are my projects audit-ready?"
        value={`${below.length} of ${ids.length}`}
        valueSmall
        tone={below.length === 0 ? "ok" : toneFor(views[lowest].score)}
        sentence={
          below.length ? (
            <>
              below the {COMPLIANCE_TARGET}% target · lowest{" "}
              <span className="text-foreground">
                {name(lowest)} {views[lowest].score}%
              </span>
            </>
          ) : (
            `All projects at or above ${COMPLIANCE_TARGET}%.`
          )
        }
        why="Each project is audited on its own; one weak project is still a finding."
        action="Compare projects"
        target="mgr-portfolio"
      />
      <Tile
        question="2 · What needs my decision?"
        value={String(pending)}
        tone={pending ? "info" : "ok"}
        sentence={
          pending ? (
            <>
              approvals across {ids.filter((p) => pendingBy[p].length).length} projects
              {highRisk ? (
                <>
                  {" "}
                  · <span className="text-fail">{highRisk} high risk</span>
                </>
              ) : null}
            </>
          ) : (
            "Nothing waiting on you."
          )
        }
        why="Fixes and exceptions wait on you until you decide."
        action="Review fixes"
        target="mgr-fixes"
      />
      <Tile
        question="3 · What's late?"
        value={String(late)}
        tone={late ? "fail" : "ok"}
        sentence={
          late ? (
            <>past deadline in {lateProjects.map(name).join(", ")}</>
          ) : (
            "Nothing is past its deadline."
          )
        }
        why="Late items become audit findings and delay releases."
        action="See by project"
        target="mgr-portfolio"
      />
      <Tile
        question="4 · Can we ship this week?"
        value={worst ? worst.status : "Nothing due"}
        valueSmall
        tone={worst?.status === "Blocked" ? "fail" : worst?.status === "At risk" ? "warn" : "ok"}
        sentence={
          worst ? (
            <>
              {name(worst.pid)} {worst.r.version} on {worst.r.date.split(" ")[0]}
              {blocked > 1 ? (
                <span className="text-muted-foreground"> · {blocked} projects blocked</span>
              ) : null}
            </>
          ) : (
            "No releases in the next 7 days."
          )
        }
        why="A failed gate means the release can't go out."
        action="See by project"
        target="mgr-portfolio"
      />
    </div>
  );
}

export function MyProjects({
  views,
  pendingBy,
  onOpen,
}: {
  views: Views;
  pendingBy: Record<ProjectId, Decision[]>;
  onOpen: (pid: ProjectId) => void;
}) {
  const overdue = useOverdueByProject();
  const { lastRun } = useEscalations();
  return (
    <div id="mgr-portfolio" className="scroll-mt-6">
      <Card
        title="My projects"
        icon={FolderKanban}
        note="Every project you manage. Open one to see its full Manager view."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-normal">Project</th>
                <th className="py-2 pr-3 font-normal">Audit-ready</th>
                <th className="hidden py-2 pr-3 font-normal xl:table-cell">Failing</th>
                <th className="py-2 pr-3 font-normal">Decisions</th>
                <th className="py-2 pr-3 font-normal">Late</th>
                <th className="py-2 pr-3 font-normal">Release this week</th>
                <th className="hidden py-2 pr-3 font-normal xl:table-cell">Last Simulate</th>
                <th className="py-2 font-normal" />
              </tr>
            </thead>
            <tbody>
              {MANAGER_PROJECT_IDS.map((pid) => {
                const mp = MANAGER_PROJECTS[pid];
                const v = views[pid];
                const prev = v.scoreTrend[v.scoreTrend.length - 2];
                const delta = prev === undefined ? 0 : v.score - prev;
                const failing = v.pitCheckpoints.filter((c) =>
                  c.kind === "automated"
                    ? c.status !== "compliant"
                    : !c.steps.every((s) => s.state === "done"),
                ).length;
                const late = v.escalations.length + overdue[pid];
                const w = worstRelease(v);
                const run = lastRun[pid];
                return (
                  <tr
                    key={pid}
                    className="border-b border-border last:border-0 hover:bg-panel-2/40"
                  >
                    <td className="py-3 pr-3">
                      <p className="text-foreground">{mp.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {mp.bu} BU · {mp.team.length} people
                      </p>
                    </td>
                    <td className="py-3 pr-3">
                      <span className={`font-mono ${TONE_TEXT[toneFor(v.score)]}`}>{v.score}%</span>
                      {delta !== 0 && (
                        <span
                          className={`ml-1.5 font-mono text-[11px] ${delta > 0 ? "text-ok" : "text-fail"}`}
                        >
                          {delta > 0 ? "▲" : "▼"}
                          {Math.abs(delta)}
                        </span>
                      )}
                    </td>
                    <td className="hidden py-3 pr-3 font-mono xl:table-cell">{failing}</td>
                    <td className="py-3 pr-3 font-mono">{pendingBy[pid].length}</td>
                    <td className={`py-3 pr-3 font-mono ${late ? "text-fail" : "text-ok"}`}>
                      {late}
                    </td>
                    <td className="py-3 pr-3">
                      {w ? (
                        <span
                          className={
                            w.status === "Blocked"
                              ? "text-fail"
                              : w.status === "At risk"
                                ? "text-warn"
                                : "text-ok"
                          }
                        >
                          {w.status}{" "}
                          <span className="text-xs text-muted-foreground">· {w.r.version}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Nothing due</span>
                      )}
                    </td>
                    <td className="hidden py-3 pr-3 xl:table-cell">
                      <Mono className="text-muted-foreground">
                        {run
                          ? new Date(run.runAt).toLocaleString([], {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "never"}
                      </Mono>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onOpen(pid)}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:border-primary/50 hover:bg-panel-2"
                      >
                        Open <ArrowRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function PortfolioTeam() {
  // People can sit on more than one project; show each person once with all their projects.
  const people = new Map<
    string,
    { name: string; role: string; open: number; overdue: number; projects: string[] }
  >();
  for (const pid of MANAGER_PROJECT_IDS) {
    const mp = MANAGER_PROJECTS[pid];
    for (const t of mp.team) {
      const p = people.get(t.name) ?? {
        name: t.name,
        role: t.role,
        open: 0,
        overdue: 0,
        projects: [],
      };
      p.open += t.open;
      p.overdue += t.overdue;
      if (!p.projects.includes(mp.name)) p.projects.push(mp.name);
      people.set(t.name, p);
    }
  }
  const list = [...people.values()].sort((a, b) => b.overdue - a.overdue || b.open - a.open);
  return (
    <Card
      title="Team across my projects"
      icon={Users}
      note={`${list.length} people. Sorted by overdue work, so you know who to check in with first.`}
    >
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {list.map((p) => (
          <li
            key={p.name}
            className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft font-mono text-[11px] text-primary">
              {p.name
                .split(" ")
                .map((s) => s[0])
                .join("")
                .slice(0, 2)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">
                {p.name} <span className="text-xs text-muted-foreground">· {p.role}</span>
              </p>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {p.projects.map((n) => (
                  <span
                    key={n}
                    className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-right font-mono text-[11px]">
              <p className="text-foreground">{p.open} open</p>
              <p className={p.overdue ? "text-fail" : "text-muted-foreground"}>
                {p.overdue} overdue
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
