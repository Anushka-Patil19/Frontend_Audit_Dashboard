import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Cpu,
  FolderClosed,
  Search,
  ArrowRight,
  TrendingUp,
  FolderKanban,
  Folder,
  ChevronDown,
  Check,
  X,
  Filter,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  statusLabel,
  type Checkpoint,
  type Status,
  categories,
  projectsData,
  type ProjectId,
} from "@/lib/audit-data";
import { useAudit } from "@/lib/audit-store";
import { AutomatedCard } from "@/components/audit/AutomatedCard";
import { ManualCard } from "@/components/audit/ManualCard";
import { Mono, SectionHeading } from "@/components/audit/atoms";
import { PageHeader } from "@/components/layout/PageHeader";

export const Route = createFileRoute("/findings")({
  validateSearch: (search: Record<string, unknown>) => ({
    project: typeof search.project === "string" ? search.project : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Open Findings — Audit Intelligence" },
      {
        name: "description",
        content:
          "Continuous audit findings register, compliance gap analysis, remediation actions, and audit evidence trails.",
      },
      { property: "og:title", content: "Open Findings — Audit Intelligence" },
      {
        property: "og:description",
        content: "Detailed audit findings and compliance processes requiring review or remediation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FindingsPage,
});

function Select({
  label,
  value,
  options,
  onChange,
  render,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  render?: (v: string) => string;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-panel px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-ring"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {render ? render(o) : o}
          </option>
        ))}
      </select>
    </label>
  );
}

function FindingsPage() {
  const searchParams = Route.useSearch();
  const navigate = useNavigate();
  const { checkpoints, resolveCheckpoint, completeStep, undoStep, addComment } = useAudit();

  const [selectedProject, setSelectedProject] = useState<string>(
    searchParams.project ?? "all",
  );

  useEffect(() => {
    if (searchParams.project && searchParams.project !== selectedProject) {
      setSelectedProject(searchParams.project);
    } else if (!searchParams.project && selectedProject !== "all") {
      setSelectedProject("all");
    }
  }, [searchParams.project]);

  const handleSelectProject = (id: string) => {
    setSelectedProject(id);
    navigate({
      to: "/findings",
      search: {
        project: id === "all" ? undefined : id,
      },
      replace: true,
    });
  };

  const [scope, setScope] = useState<"findings" | "non-compliant" | "needs-review" | "all">(
    "findings",
  );
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedRole, setSelectedRole] = useState("All");
  const [selectedSource, setSelectedSource] = useState("All");
  const [search, setSearch] = useState("");

  // Checkpoints filtered by selected project
  const projectCheckpoints = useMemo(() => {
    if (selectedProject === "all") return checkpoints;
    return checkpoints.filter((c) => c.projectId === selectedProject);
  }, [checkpoints, selectedProject]);

  // Project finding counts for selector buttons
  const projectCounts = useMemo(() => {
    const counts: Record<string, { total: number; high: number }> = {
      all: { total: 0, high: 0 },
      "project-a": { total: 0, high: 0 },
      "project-b": { total: 0, high: 0 },
      "project-c": { total: 0, high: 0 },
    };
    checkpoints.forEach((c) => {
      const isFinding = c.status === "non-compliant" || c.status === "needs-review";
      const isHigh = c.status === "non-compliant";
      if (isFinding) {
        counts.all.total += 1;
        if (isHigh) counts.all.high += 1;
        if (c.projectId && counts[c.projectId]) {
          counts[c.projectId].total += 1;
          if (isHigh) counts[c.projectId].high += 1;
        }
      }
    });
    return counts;
  }, [checkpoints]);

  // Findings computation based on project-filtered checkpoints
  const allFindings = useMemo(
    () =>
      projectCheckpoints.filter(
        (c) => c.status === "non-compliant" || c.status === "needs-review",
      ),
    [projectCheckpoints],
  );

  const nonCompliantList = useMemo(
    () => projectCheckpoints.filter((c) => c.status === "non-compliant"),
    [projectCheckpoints],
  );

  const needsReviewList = useMemo(
    () => projectCheckpoints.filter((c) => c.status === "needs-review"),
    [projectCheckpoints],
  );

  // Category breakdown for findings
  const categoryImpactMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of allFindings) {
      map.set(f.category, (map.get(f.category) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [allFindings]);

  const mostImpacted = categoryImpactMap[0] ?? ["None", 0];

  // Dynamic lists for filter dropdowns
  const availableCategories = useMemo(
    () => ["All", ...categories],
    [],
  );

  const availableRoles = useMemo(
    () => ["All", ...new Set(projectCheckpoints.map((c) => c.ownerRole).filter(Boolean))],
    [projectCheckpoints],
  );

  // Filtered dataset
  const filteredItems = useMemo(() => {
    let list: Checkpoint[] = [];

    if (scope === "findings") {
      list = allFindings;
    } else if (scope === "non-compliant") {
      list = nonCompliantList;
    } else if (scope === "needs-review") {
      list = needsReviewList;
    } else {
      list = projectCheckpoints;
    }

    return list.filter((cp) => {
      if (selectedCategory !== "All" && cp.category !== selectedCategory) return false;
      if (selectedRole !== "All" && cp.ownerRole !== selectedRole) return false;
      if (selectedSource !== "All") {
        const keys = cp.sources ? cp.sources.map((s) => s.toLowerCase()) : ["manual"];
        if (!keys.includes(selectedSource.toLowerCase())) return false;
      }
      const q = search.trim().toLowerCase();
      if (
        q &&
        !`${cp.ref} ${cp.name} ${cp.category} ${cp.projectName || ""} ${cp.ownerRole || ""} ${cp.auditEvidence || ""}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [
    projectCheckpoints,
    allFindings,
    nonCompliantList,
    needsReviewList,
    scope,
    selectedCategory,
    selectedRole,
    selectedSource,
    search,
  ]);

  // Group by category
  const groupedByCategory = useMemo(() => {
    const map = new Map<string, Checkpoint[]>();
    for (const cp of filteredItems) {
      map.set(cp.category, [...(map.get(cp.category) ?? []), cp]);
    }
    return [...map.entries()];
  }, [filteredItems]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-7">
      <PageHeader
        title="Open Findings & Gap Register"
        subtitle="Active non-compliant items, audit review queues, and process remediation ledger — Acme Capital"
      >
        <div className="flex items-center gap-2">
          {/* COMPACT TOP-OF-DASHBOARD PROJECT DROPDOWN FILTER */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-panel px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:border-primary/50 hover:bg-panel-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <FolderKanban className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground font-normal">Project:</span>
                <span className="font-semibold text-foreground">
                  {selectedProject === "all"
                    ? "All Projects"
                    : projectsData[selectedProject as ProjectId]?.name || selectedProject}
                </span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-mono font-semibold ${
                    selectedProject === "all"
                      ? "bg-primary/10 text-primary"
                      : selectedProject === "project-a"
                        ? "bg-fail/15 text-fail dark:text-rose-400"
                        : "bg-warn/15 text-warn dark:text-amber-400"
                  }`}
                >
                  {selectedProject === "all"
                    ? `${projectCounts.all.total} findings`
                    : `${projectCounts[selectedProject]?.total ?? 0} findings`}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-0.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-1.5 shadow-xl border border-border bg-panel">
              <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Filter Findings by Project
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              {/* All Projects */}
              <DropdownMenuItem
                onClick={() => handleSelectProject("all")}
                className={`flex items-start justify-between gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                  selectedProject === "all" ? "bg-primary-soft text-primary font-medium" : "hover:bg-panel-2"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <FolderKanban className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground">All Projects</span>
                      {selectedProject === "all" && <Check className="h-3.5 w-3.5 text-primary" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Consolidated cross-project audit (85 processes)
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground">
                  {projectCounts.all.total} findings
                </span>
              </DropdownMenuItem>

              {/* PIT Armour */}
              <DropdownMenuItem
                onClick={() => handleSelectProject("project-a")}
                className={`flex items-start justify-between gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                  selectedProject === "project-a" ? "bg-primary-soft text-primary font-medium" : "hover:bg-panel-2"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <Folder className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground">PIT Armour</span>
                      {selectedProject === "project-a" && <Check className="h-3.5 w-3.5 text-primary" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Production IT Armour — Core Banking Engine
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-fail/15 text-fail px-2 py-0.5 text-[10px] font-mono font-semibold">
                  {projectCounts["project-a"].total} ({projectCounts["project-a"].high} high)
                </span>
              </DropdownMenuItem>

              {/* SAATHI */}
              <DropdownMenuItem
                onClick={() => handleSelectProject("project-b")}
                className={`flex items-start justify-between gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                  selectedProject === "project-b" ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium" : "hover:bg-panel-2"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <Folder className="h-4 w-4 mt-0.5 shrink-0 text-sky-500" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground">SAATHI</span>
                      {selectedProject === "project-b" && <Check className="h-3.5 w-3.5 text-sky-500" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Merchant Payment Gateway & APIs
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-warn/15 text-warn px-2 py-0.5 text-[10px] font-mono font-semibold">
                  {projectCounts["project-b"].total} open
                </span>
              </DropdownMenuItem>

              {/* MPS */}
              <DropdownMenuItem
                onClick={() => handleSelectProject("project-c")}
                className={`flex items-start justify-between gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                  selectedProject === "project-c" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium" : "hover:bg-panel-2"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <Folder className="h-4 w-4 mt-0.5 shrink-0 text-emerald-500" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground">MPS</span>
                      {selectedProject === "project-c" && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Risk Analytics & BI Cloud Data Lake
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-warn/15 text-warn px-2 py-0.5 text-[10px] font-mono font-semibold">
                  {projectCounts["project-c"].total} open
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Reset button if filtered */}
          {selectedProject !== "all" && (
            <button
              type="button"
              onClick={() => handleSelectProject("all")}
              title="Clear project filter and view all projects"
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-panel px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-panel-2 transition-colors shadow-sm"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>
      </PageHeader>

      {/* Slim Active Filter Notice Strip (only shown when a specific project is selected) */}
      {selectedProject !== "all" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary-soft/40 px-3.5 py-1.5 text-xs text-foreground shadow-sm -mt-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary shrink-0 animate-pulse" />
            <span>
              Showing isolated findings for <strong className="font-semibold">{projectsData[selectedProject as ProjectId]?.name || selectedProject}</strong>: {projectsData[selectedProject as ProjectId]?.description}
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleSelectProject("all")}
            className="text-[11px] font-medium text-primary hover:underline"
          >
            Show All Projects (85 processes) →
          </button>
        </div>
      )}

      {/* TOP SECTION: KEY KPIS */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {/* KPI 1: Total Findings */}
        <div className="rounded-xl border border-border bg-panel p-4 shadow-card">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-warn/10 text-warn">
              <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.75} />
            </span>
            <p className="min-w-0 truncate text-xs text-muted-foreground">Total Open Findings</p>
          </div>
          <p className="mt-3 font-mono text-2xl text-foreground font-semibold">
            {allFindings.length}
          </p>
          <Mono className="mt-1 block text-faint">
            across {categoryImpactMap.length} categories
          </Mono>
        </div>

        {/* KPI 2: Critical Non-Compliant */}
        <div className="rounded-xl border border-border bg-panel p-4 shadow-card">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-fail/10 text-fail">
              <AlertCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
            </span>
            <p className="min-w-0 truncate text-xs text-muted-foreground">High / Non-Compliant</p>
          </div>
          <p className="mt-3 font-mono text-2xl text-fail font-semibold">
            {nonCompliantList.length}
          </p>
          <Mono className="mt-1 block text-faint">immediate SLA breach risk</Mono>
        </div>

        {/* KPI 3: Needs Review */}
        <div className="rounded-xl border border-border bg-panel p-4 shadow-card">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-warn/10 text-warn">
              <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.75} />
            </span>
            <p className="min-w-0 truncate text-xs text-muted-foreground">Needs Review</p>
          </div>
          <p className="mt-3 font-mono text-2xl text-warn font-semibold">
            {needsReviewList.length}
          </p>
          <Mono className="mt-1 block text-faint">awaiting sign-off / evidence</Mono>
        </div>

        {/* KPI 4: Top Affected Category */}
        <div className="rounded-xl border border-border bg-panel p-4 shadow-card">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
              <FolderKanban className="h-3.5 w-3.5" strokeWidth={1.75} />
            </span>
            <p className="min-w-0 truncate text-xs text-muted-foreground">Most Impacted</p>
          </div>
          <p className="mt-3 font-serif text-lg text-foreground font-medium truncate">
            {mostImpacted[0]}
          </p>
          <Mono className="mt-1 block text-faint">{mostImpacted[1]} open items</Mono>
        </div>

        {/* KPI 5: Compliance Impact */}
        <div className="rounded-xl border border-border bg-panel p-4 shadow-card">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-ok/10 text-ok">
              <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.75} />
            </span>
            <p className="min-w-0 truncate text-xs text-muted-foreground">Potential Uplift</p>
          </div>
          <p className="mt-3 font-mono text-2xl text-ok font-semibold">
            +{(allFindings.length * 1.8).toFixed(0)}%
          </p>
          <Mono className="mt-1 block text-faint">upon closing open findings</Mono>
        </div>
      </div>

      {/* FILTER AND SCOPE TOOLBAR */}
      <div className="space-y-3">
        {/* Scope tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-border bg-panel p-1 shadow-sm">
            <button
              onClick={() => setScope("findings")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                scope === "findings"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Open Findings ({allFindings.length})
            </button>
            <button
              onClick={() => setScope("non-compliant")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                scope === "non-compliant"
                  ? "bg-fail text-white shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Non-Compliant ({nonCompliantList.length})
            </button>
            <button
              onClick={() => setScope("needs-review")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                scope === "needs-review"
                  ? "bg-warn text-white shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Needs Review ({needsReviewList.length})
            </button>
            <button
              onClick={() => setScope("all")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                scope === "all"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All {projectCheckpoints.length} Audit Processes
            </button>
          </div>

          <Link
            to="/projects"
            search={{ project: selectedProject === "all" ? "project-a" : selectedProject }}
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
          >
            <span>
              View in {selectedProject === "all" ? "Project Controls" : `${projectsData[selectedProject as ProjectId]?.name || selectedProject} Controls`}
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Filters and search row */}
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-panel px-4 py-3 shadow-card">
          <Select
            label="Category"
            value={selectedCategory}
            options={availableCategories}
            onChange={setSelectedCategory}
          />

          <Select
            label="Owner Role"
            value={selectedRole}
            options={availableRoles}
            onChange={setSelectedRole}
          />

          <Select
            label="Source"
            value={selectedSource}
            options={["All", "GitHub", "Jira", "Mail", "Manual"]}
            onChange={setSelectedSource}
          />

          <span className="ml-auto inline-flex items-center gap-2 rounded-md border border-border bg-panel-2 px-2.5 py-1.5 shadow-sm">
            <Search className="h-3.5 w-3.5 text-faint" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search findings, ID, evidence, owner..."
              className="w-44 bg-transparent text-xs outline-none placeholder:text-faint sm:w-64"
            />
          </span>
        </div>
      </div>

      {/* FINDINGS PROCESS LEDGER */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <SectionHeading>
            Processes Requiring Action <Mono className="text-faint">({filteredItems.length})</Mono>
          </SectionHeading>
          {filteredItems.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Showing {filteredItems.length} matching processes across {groupedByCategory.length} categories
            </p>
          )}
        </div>

        {groupedByCategory.map(([cat, items]) => (
          <div
            key={cat}
            className="overflow-hidden rounded-xl border border-border bg-panel shadow-card"
          >
            {/* Category Header */}
            <div className="flex flex-wrap items-center justify-between border-b border-border bg-panel-2 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] font-medium text-primary">
                  {cat}
                </span>
                <span className="font-serif text-base text-foreground font-medium">
                  {cat}
                </span>
                <Mono className="text-faint">({items.length} items)</Mono>
              </div>

              <Link
                to="/projects"
                search={{ project: selectedProject === "all" ? "project-a" : selectedProject }}
                className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
              >
                Open category folder →
              </Link>
            </div>

            {/* Checkpoint Cards List */}
            <div className="divide-y divide-border">
              {items.map((cp) =>
                cp.kind === "automated" ? (
                  <AutomatedCard key={cp.id} cp={cp} onResolve={resolveCheckpoint} />
                ) : (
                  <ManualCard
                    key={cp.id}
                    cp={cp}
                    onStepDone={completeStep}
                    onStepUndo={undoStep}
                    onComment={addComment}
                  />
                ),
              )}
            </div>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="rounded-xl border border-border bg-panel px-6 py-12 text-center shadow-card space-y-3">
            <div className="inline-grid h-10 w-10 place-items-center rounded-full bg-ok/10 text-ok mx-auto">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h3 className="font-serif text-lg text-foreground font-medium">
              No matching findings
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              No audit processes match the selected filters. Change your scope, category, or search
              term to view other items.
            </p>
          </div>
        )}
      </section>

      <footer className="border-t border-border pt-5 pb-2 text-xs text-faint">
        All findings and review items are synchronized in real-time from continuous verification workers,
        JIRA tickets, Mailbox logs, and GitHub repositories.
      </footer>
    </div>
  );
}
