import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Mono } from "@/components/audit/atoms";
import { PrTrace } from "@/components/audit/GithubTrace";
import { projectsData, type ProjectId } from "@/lib/audit-data";
import {
  getProjectTracking,
  type ProjectTracking,
  type TrackedPr,
} from "@/lib/api-client";

export const Route = createFileRoute("/github")({
  validateSearch: (search: Record<string, unknown>): { project?: ProjectId } =>
    typeof search["project"] === "string" && search["project"] in projectsData
      ? { project: search["project"] as ProjectId }
      : {},
  head: () => ({ meta: [{ title: "GitHub tracking — Audit Intelligence" }] }),
  component: GithubTrackingPage,
});

const PROJECT_IDS = Object.keys(projectsData) as ProjectId[];
type Tab = "prs" | "pushes" | "deployments" | "rules";

const fmt = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

function GithubTrackingPage() {
  const { project } = Route.useSearch();
  const pid = project ?? "project-a";
  const [data, setData] = useState<ProjectTracking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("prs");
  const [repo, setRepo] = useState<string>("all");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [openPr, setOpenPr] = useState<string | null>(null);

  const load = (refresh = false) => {
    setLoading(true);
    setError(null);
    getProjectTracking(pid, refresh)
      .then((d) => {
        setData(d);
        // Open the first flagged PR's trace, so the flow is visible straight away.
        const first = d.prs.find((p) => p.result !== "clean") ?? d.prs[0];
        setOpenPr(first ? `${first.repo}#${first.number}` : null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't read GitHub."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setData(null);
    setRepo("all");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid]);

  const inRepo = <T extends { repo: string }>(list: T[]) => (repo === "all" ? list : list.filter((x) => x.repo === repo));
  const prs = useMemo(
    () => (data ? inRepo(data.prs).filter((p) => !flaggedOnly || p.result !== "clean") : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, repo, flaggedOnly],
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <PageHeader
        title={`GitHub tracking · ${projectsData[pid].name}`}
        subtitle="Read-only. Pull requests, direct pushes, deployments and branch rules as GitHub recorded them, each change traced to its CR key."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-panel p-1 shadow-card">
          {PROJECT_IDS.map((id) => (
            <Link
              key={id}
              to="/github"
              search={{ project: id }}
              className={`rounded-lg px-3 py-1.5 text-sm ${id === pid ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-panel-2"}`}
            >
              {projectsData[id].name}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {data && <span>Read from GitHub {fmt(data.fetched_at)}</span>}
          <button
            type="button"
            onClick={() => load(true)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel px-2.5 py-1.5 text-foreground hover:bg-panel-2 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {error && <p className="rounded-lg border border-fail/30 bg-fail/10 p-3 text-sm text-fail">{error}</p>}
      {!data && !error && (
        <p className="flex items-center gap-2 rounded-xl border border-border bg-panel p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading pull requests, pushes, rules and deployments from GitHub and Jira…
        </p>
      )}

      {data && !data.connected && (
        <div className="rounded-xl border border-border bg-panel p-6 shadow-card">
          <p className="font-serif text-lg text-foreground">No repository connected for {data.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add the project's repositories to <Mono className="text-foreground">backend/app/data/github_projects.json</Mono>{" "}
            (owner, repo, protected branches) and its Jira project key. Tracking picks them up on the next refresh — no code change.
          </p>
        </div>
      )}

      {data && data.connected && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Open pull requests" value={data.kpis.open_prs} tone="ok" note={`${data.prs.length} pull requests read`} />
            <Kpi
              label="Flagged pull requests"
              value={data.kpis.flagged_prs}
              tone={data.kpis.flagged_prs ? "fail" : "ok"}
              note="Self-approved, unapproved, stale, merged by someone else, or no CR key"
              onClick={() => {
                setTab("prs");
                setFlaggedOnly(true);
              }}
            />
            <Kpi
              label="Pushes that bypassed a rule"
              value={data.kpis.bypassed_pushes}
              tone={data.kpis.bypassed_pushes ? "fail" : "ok"}
              note="Straight to a protected branch, or force-pushed"
              onClick={() => setTab("pushes")}
            />
            <Kpi
              label="Branch rule gaps"
              value={data.kpis.rule_gaps}
              tone={data.kpis.rule_gaps ? "fail" : "ok"}
              note={`${data.kpis.deploys_to_check} deploys to check · ${data.kpis.deploys_without_tag} with no tag`}
              onClick={() => setTab("rules")}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Repository</span>
            {["all", ...data.repos.map((r) => r.repo)].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRepo(r)}
                className={`rounded-full border px-2.5 py-1 font-mono ${repo === r ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground hover:bg-panel-2"}`}
              >
                {r === "all" ? "All repos" : r}
              </button>
            ))}
            {data.repos
              .filter((r) => r.error)
              .map((r) => (
                <span key={r.repo} className="text-fail">
                  {r.repo}: {r.error}
                </span>
              ))}
          </div>

          <div className="rounded-xl border border-border bg-panel shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-2">
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ["prs", "Pull requests", data.prs.length],
                    ["pushes", "Direct pushes", data.pushes.length],
                    ["deployments", "Deployments", data.deployments.length],
                    ["rules", "Branch rules", data.rules.length],
                  ] as const
                ).map(([key, label, count]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`rounded-md px-3 py-1.5 text-sm ${tab === key ? "bg-panel-2 font-medium text-foreground" : "text-muted-foreground hover:bg-panel-2/60"}`}
                  >
                    {label} <Mono className="text-faint">{count}</Mono>
                  </button>
                ))}
              </div>
              {tab === "prs" && (
                <label className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
                  Flagged only
                </label>
              )}
            </div>

            {tab === "prs" && (
              <PrTable prs={prs} openPr={openPr} onToggle={(k) => setOpenPr((o) => (o === k ? null : k))} />
            )}
            {tab === "pushes" && <PushTable data={data} inRepo={inRepo} />}
            {tab === "deployments" && <DeployTable data={data} inRepo={inRepo} />}
            {tab === "rules" && <RuleTable data={data} inRepo={inRepo} />}
          </div>

          <p className="text-xs text-faint">
            Who changed a branch rule, and when, isn't in GitHub's REST API — it needs the organisation audit log, which depends on
            the GitHub plan. Repositories are configured in <Mono>backend/app/data/github_projects.json</Mono>.
          </p>
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
  note,
  onClick,
}: {
  label: string;
  value: number;
  tone: "ok" | "fail";
  note: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-xl border bg-panel p-4 text-left shadow-card transition-colors enabled:hover:bg-panel-2/50 ${tone === "fail" ? "border-fail/40" : "border-border"}`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-2 font-mono text-3xl ${tone === "fail" ? "text-fail" : "text-ok"}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </button>
  );
}

const RESULT_BADGE: Record<TrackedPr["result"], string> = {
  fail: "bg-fail/10 text-fail",
  warn: "bg-warn/10 text-warn",
  clean: "bg-ok/10 text-ok",
};

function PrTable({
  prs,
  openPr,
  onToggle,
}: {
  prs: TrackedPr[];
  openPr: string | null;
  onToggle: (key: string) => void;
}) {
  if (!prs.length) return <p className="p-6 text-sm text-muted-foreground">No pull requests to show.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border font-mono text-[10px] uppercase tracking-wide text-faint">
          <tr>
            <th className="px-4 py-2 font-normal">PR</th>
            <th className="px-2 py-2 font-normal">Title</th>
            <th className="px-2 py-2 font-normal">Repo</th>
            <th className="px-2 py-2 font-normal">Author</th>
            <th className="px-2 py-2 font-normal">Approved by</th>
            <th className="px-2 py-2 font-normal">Merged by</th>
            <th className="px-2 py-2 font-normal">CR</th>
            <th className="px-2 py-2 font-normal">Check</th>
          </tr>
        </thead>
        <tbody>
          {prs.map((p) => {
            const key = `${p.repo}#${p.number}`;
            const open = openPr === key;
            return (
              <Fragment key={key}>
                <tr
                  onClick={() => onToggle(key)}
                  className={`cursor-pointer border-b border-border hover:bg-panel-2/50 ${open ? "bg-panel-2/40" : ""}`}
                >
                  <td className="px-4 py-2.5 font-mono">
                    <ChevronRight className={`mr-1 inline h-3 w-3 text-faint transition-transform ${open ? "rotate-90" : ""}`} />#
                    {p.number}
                  </td>
                  <td className="px-2 py-2.5 text-foreground">{p.title}</td>
                  <td className="px-2 py-2.5 font-mono text-xs text-muted-foreground">{p.repo.split("/")[1]}</td>
                  <td className="px-2 py-2.5">{p.author ?? "—"}</td>
                  <td className={`px-2 py-2.5 ${p.approvers.length ? "" : "text-fail"}`}>{p.approvers.join(", ") || "None"}</td>
                  <td className="px-2 py-2.5">{p.state === "merged" ? p.merged_by ?? "?" : <span className="text-muted-foreground">{p.state === "open" ? "Open" : "Closed"}</span>}</td>
                  <td className="px-2 py-2.5 font-mono text-xs">{p.cr_key ?? "—"}</td>
                  <td className="px-2 py-2.5">
                    <span className="flex flex-wrap gap-1">
                      {p.flags.length ? (
                        p.flags.map((f) => (
                          <span key={f.code} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${f.level === "fail" ? RESULT_BADGE.fail : RESULT_BADGE.warn}`}>
                            {f.label}
                          </span>
                        ))
                      ) : (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${RESULT_BADGE.clean}`}>Clean</span>
                      )}
                    </span>
                  </td>
                </tr>
                {open && (
                  <tr className="border-b border-border bg-panel-2/30">
                    <td colSpan={8} className="px-4 py-3">
                      <PrTrace pr={p} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type InRepo = <T extends { repo: string }>(list: T[]) => T[];

function PushTable({ data, inRepo }: { data: ProjectTracking; inRepo: InRepo }) {
  const rows = inRepo(data.pushes);
  if (!rows.length) return <p className="p-6 text-sm text-ok">No direct pushes or force pushes on the protected branches.</p>;
  return (
    <table className="w-full text-left text-sm">
      <thead className="border-b border-border font-mono text-[10px] uppercase tracking-wide text-faint">
        <tr>
          <th className="px-4 py-2 font-normal">Commit</th>
          <th className="px-2 py-2 font-normal">What</th>
          <th className="px-2 py-2 font-normal">Branch</th>
          <th className="px-2 py-2 font-normal">By</th>
          <th className="px-2 py-2 font-normal">When</th>
          <th className="px-2 py-2 font-normal">Message</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((x) => (
          <tr key={`${x.repo}-${x.kind}-${x.sha}-${x.date}`} className="border-b border-border last:border-0">
            <td className="px-4 py-2.5 font-mono">
              {x.url ? (
                <a href={x.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  {x.sha?.slice(0, 7)}
                </a>
              ) : (
                x.sha?.slice(0, 7) ?? "—"
              )}
            </td>
            <td className="px-2 py-2.5 text-fail">{x.kind} — no PR</td>
            <td className="px-2 py-2.5 font-mono text-xs">{x.branch}</td>
            <td className="px-2 py-2.5">{x.author ?? "—"}</td>
            <td className="px-2 py-2.5 text-muted-foreground">{fmt(x.date)}</td>
            <td className="px-2 py-2.5 text-muted-foreground">{x.message || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DeployTable({ data, inRepo }: { data: ProjectTracking; inRepo: InRepo }) {
  const rows = inRepo(data.deployments);
  if (!rows.length)
    return (
      <p className="p-6 text-sm text-muted-foreground">
        No deployments recorded in GitHub for this project. Deployments appear here once the pipeline creates GitHub deployments
        (environments).
      </p>
    );
  return (
    <table className="w-full text-left text-sm">
      <thead className="border-b border-border font-mono text-[10px] uppercase tracking-wide text-faint">
        <tr>
          <th className="px-4 py-2 font-normal">Environment</th>
          <th className="px-2 py-2 font-normal">Commit</th>
          <th className="px-2 py-2 font-normal">Tag</th>
          <th className="px-2 py-2 font-normal">By</th>
          <th className="px-2 py-2 font-normal">When</th>
          <th className="px-2 py-2 font-normal">Window</th>
          <th className="px-2 py-2 font-normal">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((d) => (
          <tr key={`${d.repo}-${d.id}`} className="border-b border-border last:border-0">
            <td className="px-4 py-2.5">{d.environment ?? "—"}</td>
            <td className="px-2 py-2.5 font-mono text-xs">{d.sha?.slice(0, 7) ?? "—"}</td>
            <td className={`px-2 py-2.5 ${d.tag ? "" : "text-warn"}`}>{d.tag ?? "no tag"}</td>
            <td className="px-2 py-2.5">{d.creator ?? "—"}</td>
            <td className="px-2 py-2.5 text-muted-foreground">{fmt(d.created_at)}</td>
            <td className={`px-2 py-2.5 ${d.in_window === false ? "text-fail" : "text-muted-foreground"}`}>
              {d.in_window === null ? "no window set" : d.in_window ? "inside" : "outside"}
            </td>
            <td className="px-2 py-2.5">{d.status ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RuleTable({ data, inRepo }: { data: ProjectTracking; inRepo: InRepo }) {
  const rows = inRepo(data.rules);
  const cell = (readable: boolean, ok: boolean) =>
    !readable ? <span className="text-faint">not readable</span> : ok ? <span className="text-ok">yes</span> : <span className="text-fail">no</span>;
  return (
    <table className="w-full text-left text-sm">
      <thead className="border-b border-border font-mono text-[10px] uppercase tracking-wide text-faint">
        <tr>
          <th className="px-4 py-2 font-normal">Branch</th>
          <th className="px-2 py-2 font-normal">PR required</th>
          <th className="px-2 py-2 font-normal">Admins enforced</th>
          <th className="px-2 py-2 font-normal">Force push blocked</th>
          <th className="px-2 py-2 font-normal">Deletion blocked</th>
          <th className="px-2 py-2 font-normal">Source</th>
          <th className="px-2 py-2 font-normal">Gaps</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={`${r.repo}-${r.branch}`} className="border-b border-border last:border-0">
            <td className="px-4 py-2.5 font-mono text-xs">
              {r.repo.split("/")[1]} / {r.branch}
            </td>
            <td className="px-2 py-2.5">{cell(r.readable, r.pr_required)}</td>
            <td className="px-2 py-2.5">{cell(r.readable, r.admins_enforced)}</td>
            <td className="px-2 py-2.5">{cell(r.readable, r.force_push_blocked)}</td>
            <td className="px-2 py-2.5">{cell(r.readable, r.deletion_blocked)}</td>
            <td className="px-2 py-2.5 text-xs text-muted-foreground">{r.source}</td>
            <td className={`px-2 py-2.5 text-xs ${r.gaps.length ? "text-fail" : "text-ok"}`}>{r.gaps.join(", ") || "none"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
