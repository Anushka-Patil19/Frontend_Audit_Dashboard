import { Fragment, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, ChevronDown, CheckCircle2, AlertTriangle } from "lucide-react";
import { PROJECTS, projectById } from "@/data/catalog";
import { QUARTERS, fmtDate, fmtDateTime, isCustomKey, quarterByKey } from "@/data/quarters";
import { person } from "@/data/people";
import { quarterScope, scopeFor, type ScopeRange } from "@/data/scope";
import { useQuarter } from "@/state/quarter";
import { Card, Mono } from "@/components/ui";
import type { ChangeRequest, ProjectId } from "@/data/types";

type Tab = "crs" | "prs" | "commits" | "open";
type ProjectFilter = ProjectId | "all";
const PAGE = 10;

const TABS: { id: Tab; label: string }[] = [
  { id: "crs", label: "Changes" },
  { id: "prs", label: "Pull requests" },
  { id: "commits", label: "Direct commits" },
  { id: "open", label: "Still open" },
];

export function ScopePage() {
  const [q] = useQuarter();
  const isCustom = isCustomKey(q);
  const range: ScopeRange = quarterScope(q);
  const next = QUARTERS.find((x) => x.key > q)?.label ?? "the next period";
  const rollsInto = isCustom ? "the next period" : next;

  const [tab, setTab] = useState<Tab>("crs");
  const [showDetails, setShowDetails] = useState(false);
  const [project, setProject] = useState<ProjectFilter>("all");
  const [shown, setShown] = useState(PAGE);
  const [openRow, setOpenRow] = useState<string | null>(null);

  const scope = useMemo(
    () => scopeFor(range, project === "all" ? undefined : project),
    [range.from, range.to, project],
  );
  const overall = useMemo(() => scopeFor(range), [range.from, range.to]);

  // The detail list for the selected tab.
  const lists: Record<Tab, { label: string; count: number }> = {
    crs: { label: "Changes", count: scope.crs.length },
    prs: { label: "Pull requests", count: scope.prs.length },
    commits: { label: "Direct commits", count: scope.commits.length },
    open: { label: "Still open", count: scope.openAtEnd.length },
  };
  const openDetail = (t: Tab) => {
    setTab(t);
    setShowDetails(true);
    setShown(PAGE);
    setOpenRow(null);
    document.getElementById("scope-details")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const rangeLabel = `${fmtDate(range.from)} – ${fmtDate(range.to)}`;
  const gaps = overall.gapCommits;

  return (
    <div className="space-y-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Scope</p>
        <h1 className="mt-1 font-serif text-3xl">What did we include?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isCustom ? `Changes from ${rangeLabel}` : `${quarterByKey(q).label} · ${rangeLabel}`}. Each change is counted by the date that closed it.
        </p>
      </header>


      {/* Journey: how the period fills */}
      <Card title="The journey" note="How the changes in this period moved through the process">
        <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <Stage label="Approved" value={overall.approvedCount} sub={`${overall.carriedInCrs} of the deployed ones were approved earlier`} />
          <Arrow />
          <Stage label="Merged" value={overall.prs.length} sub="pull requests merged in the period" />
          <Arrow />
          <Stage label="Deployed" value={overall.crs.length} sub="counted here, by deployment date" tone="ok" />
        </div>
        {overall.openAtEnd.length > 0 && (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {overall.openAtEnd.length} change{overall.openAtEnd.length === 1 ? " is" : "s are"} approved here but still open at the end. {overall.openAtEnd.length === 1 ? "It is" : "They are"} counted in {rollsInto}.
          </p>
        )}
      </Card>

      {/* Needs attention: the only things an auditor has to act on */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Attention
          tone={gaps ? "fail" : "ok"}
          title={gaps ? `${gaps} commit${gaps === 1 ? "" : "s"} with no CR` : "Every commit names a CR"}
          text={gaps ? "A direct push to a protected branch must name its change request before the review closes." : "Nothing to fix here."}
          action={gaps ? "See the commits" : undefined}
          onAction={() => openDetail("commits")}
        />
        <Attention
          tone={overall.openAtEnd.length ? "warn" : "ok"}
          title={`${overall.openAtEnd.length} still open at the end`}
          text={overall.openAtEnd.length ? `Counted in ${rollsInto}. No action needed in this period.` : "Nothing rolls into the next period."}
          action={overall.openAtEnd.length ? "See them" : undefined}
          onAction={() => openDetail("open")}
        />
        <Attention
          tone="info"
          title={`${overall.carriedInCrs} approved in an earlier period`}
          text="Counted here by when they were deployed. Their approval date is shown for context."
          action={overall.carriedInCrs ? "See the changes" : undefined}
          onAction={() => openDetail("crs")}
        />
      </div>

      {/* Full detail, closed by default */}
      <div id="scope-details" className="scroll-mt-6">
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-panel px-5 py-3 text-left shadow-card hover:bg-panel-2/50"
        >
          <span className="text-sm font-medium text-foreground">
            {showDetails ? "Hide the full list" : "Show the full list"}
            <span className="ml-2 font-normal text-muted-foreground">
              {overall.crs.length} changes · {overall.prs.length} PRs · {overall.commits.length} commits
            </span>
          </span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showDetails ? "rotate-180" : ""}`} />
        </button>

        {showDetails && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div role="tablist" aria-label="Lists" className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-panel p-1">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => {
                      setTab(t.id);
                      setShown(PAGE);
                      setOpenRow(null);
                    }}
                    className={`rounded-md px-3 py-1.5 text-sm transition-colors ${tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-panel-2 hover:text-foreground"}`}
                  >
                    {t.label} <span className="ml-1 opacity-70">{lists[t.id].count}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {(["all", ...PROJECTS.map((p) => p.id)] as ProjectFilter[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setProject(p);
                      setShown(PAGE);
                    }}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${project === p ? "border-primary/50 bg-primary-soft text-primary" : "border-border text-muted-foreground hover:bg-panel-2"}`}
                  >
                    {p === "all" ? "All projects" : projectById(p).name}
                  </button>
                ))}
              </div>
            </div>

            <DetailList tab={tab} scope={scope} rollsInto={rollsInto} shown={shown} openRow={openRow} setOpenRow={setOpenRow} />

            {shownCount(tab, scope) > shown && (
              <div className="flex justify-center">
                <button type="button" onClick={() => setShown(shown + PAGE)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-panel-2">
                  Show {Math.min(PAGE, shownCount(tab, scope) - shown)} more
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function shownCount(tab: Tab, scope: ReturnType<typeof scopeFor>) {
  return tab === "crs" ? scope.crs.length : tab === "prs" ? scope.prs.length : tab === "commits" ? scope.commits.length : scope.openAtEnd.length;
}

function DetailList({
  tab,
  scope,
  rollsInto,
  shown,
  openRow,
  setOpenRow,
}: {
  tab: Tab;
  scope: ReturnType<typeof scopeFor>;
  rollsInto: string;
  shown: number;
  openRow: string | null;
  setOpenRow: (k: string | null) => void;
}) {
  const rows: { key: string; title: ReactNode; sub: string; project: string; date: string; badge?: ReactNode; detail?: ChangeRequest }[] =
    tab === "crs"
      ? scope.crs.slice(0, shown).map((x) => ({
          key: x.cr.id,
          title: x.cr.title,
          sub: `${x.cr.id} · ${x.cr.pr}`,
          project: projectById(x.cr.projectId).name,
          date: fmtDate(x.cr.deployedAt),
          badge: x.carriedIn ? <Pill tone="info">Approved earlier</Pill> : <Pill tone="ok">Deployed</Pill>,
          detail: x.cr,
        }))
      : tab === "prs"
        ? scope.prs.slice(0, shown).map((x) => ({
            key: x.cr.pr + x.cr.id,
            title: x.cr.title,
            sub: `${x.cr.pr} · ${x.cr.id}`,
            project: projectById(x.cr.projectId).name,
            date: fmtDate(x.cr.mergedAt),
            badge: x.deploysLater ? <Pill tone="warn">Deploys in {rollsInto}</Pill> : <Pill tone="ok">Merged</Pill>,
            detail: x.cr,
          }))
        : tab === "commits"
          ? scope.commits.slice(0, shown).map((x) => ({
              key: x.commit.sha,
              title: x.commit.message,
              sub: x.commit.sha.slice(0, 7),
              project: projectById(x.commit.projectId).name,
              date: fmtDate(x.commit.pushedAt),
              badge: x.linked ? <Pill tone="ok">CR {x.commit.crKey}</Pill> : <Pill tone="fail">No CR named</Pill>,
            }))
          : scope.openAtEnd.slice(0, shown).map((x) => ({
              key: x.cr.id,
              title: x.cr.title,
              sub: `${x.cr.pr} · ${x.cr.id}`,
              project: projectById(x.cr.projectId).name,
              date: `Merges ${fmtDate(x.cr.mergedAt)}`,
              badge: <Pill tone="warn">Counted in {rollsInto}</Pill>,
              detail: x.cr,
            }));

  if (rows.length === 0) {
    return <p className="rounded-xl border border-border bg-panel px-5 py-8 text-center text-sm text-muted-foreground">Nothing here for this period.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-panel shadow-card">
      <ul className="divide-y divide-border">
        {rows.map((r) => {
          const isOpen = openRow === r.key;
          return (
            <Fragment key={r.key}>
              <li>
                <button
                  type="button"
                  onClick={() => r.detail && setOpenRow(isOpen ? null : r.key)}
                  className={`grid w-full grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-left md:grid-cols-[2fr_1fr_1fr_auto] ${r.detail ? "hover:bg-panel-2/50" : "cursor-default"}`}
                  aria-expanded={r.detail ? isOpen : undefined}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-foreground">{r.title}</span>
                    <span className="block font-mono text-[11px] text-muted-foreground">{r.sub}</span>
                  </span>
                  <span className="hidden text-sm text-muted-foreground md:block">{r.project}</span>
                  <span className="hidden text-sm text-muted-foreground md:block">{r.date}</span>
                  <span className="flex items-center gap-2">
                    {r.badge}
                    {r.detail && <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />}
                  </span>
                </button>
              </li>
              {isOpen && r.detail && (
                <li className="bg-panel-2/30 px-4 py-4">
                  <Chain cr={r.detail} />
                </li>
              )}
            </Fragment>
          );
        })}
      </ul>
    </div>
  );
}

const TONES = {
  info: "bg-primary-soft text-primary",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  fail: "bg-fail-soft text-fail",
} as const;

function Pill({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${TONES[tone]}`}>{children}</span>;
}

function Stage({ label, value, sub, tone = "info" }: { label: string; value: number; sub: string; tone?: "info" | "ok" }) {
  return (
    <div className="rounded-xl border border-border bg-panel-2/40 px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-4xl leading-none ${tone === "ok" ? "text-ok" : "text-primary"}`}>{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function Arrow() {
  return (
    <div className="hidden items-center justify-center text-muted-foreground md:flex">
      <ArrowRight className="h-5 w-5" />
    </div>
  );
}

function Attention({
  tone,
  title,
  text,
  action,
  onAction,
}: {
  tone: "ok" | "warn" | "fail" | "info";
  title: string;
  text: string;
  action?: string;
  onAction: () => void;
}) {
  const border = { ok: "border-border", warn: "border-warn/40", fail: "border-fail/40", info: "border-primary/30" }[tone];
  const icon = tone === "ok" ? <CheckCircle2 className="h-4 w-4 text-ok" /> : <AlertTriangle className={`h-4 w-4 ${tone === "fail" ? "text-fail" : tone === "warn" ? "text-warn" : "text-primary"}`} />;
  return (
    <div className={`flex flex-col rounded-xl border bg-panel p-4 shadow-card ${border}`}>
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        {icon} {title}
      </p>
      <p className="mt-2 flex-1 text-xs text-muted-foreground">{text}</p>
      {action && (
        <button type="button" onClick={onAction} className="mt-3 w-fit text-xs text-primary hover:underline">
          {action} →
        </button>
      )}
    </div>
  );
}

const STEP_STYLE = "min-w-[150px] rounded-lg border border-border bg-panel px-3 py-2";

function Chain({ cr }: { cr: ChangeRequest }) {
  const steps = [
    { label: "Approved", at: cr.approvedAt },
    { label: "Merged", at: cr.mergedAt },
    { label: "Deployed", at: cr.deployedAt },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-2">
          <div className={STEP_STYLE}>
            <p className="text-xs font-medium text-foreground">{s.label}</p>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{fmtDateTime(s.at)}</p>
          </div>
          {i < steps.length - 1 && <span className="text-muted-foreground">→</span>}
        </div>
      ))}
      <p className="ml-1 text-xs text-muted-foreground">
        <Mono>{cr.jira}</Mono> · {cr.release} · approved by {person(cr.approver).name}
      </p>
    </div>
  );
}
