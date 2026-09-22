import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Search,
  Folder,
  Cpu,
  ChevronRight,
  FolderClosed,
  CheckCircle2,
  AlertTriangle,
  FolderKanban,
  FileText,
  Download,
} from "lucide-react";
import {
  checkpointModule,
  modules,
  projectComplianceTrends,
  statusLabel,
  type Checkpoint,
  type ProjectId,
  type Status,
} from "@/lib/audit-data";
import { useAudit } from "@/lib/audit-store";
import { AutomatedCard } from "@/components/audit/AutomatedCard";
import { ManualCard } from "@/components/audit/ManualCard";
import { ModuleGrid } from "@/components/audit/ModuleGrid";
import { AuditReportModal } from "@/components/audit/AuditReportModal";
import { Rollup } from "@/components/audit/panels";
import { Mono, SectionHeading } from "@/components/audit/atoms";
import { PageHeader } from "@/components/layout/PageHeader";

export const Route = createFileRoute("/projects")({
  validateSearch: (search: Record<string, unknown>) => ({
    project: typeof search.project === "string" ? search.project : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Projects — Audit Intelligence" },
      {
        name: "description",
        content:
          "Browse audit projects and environments, drill into compliance controls, evidence, approvals and history.",
      },
      { property: "og:title", content: "Projects — Audit Intelligence" },
      {
        property: "og:description",
        content: "Multi-project compliance ledger for automated and manual verification.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectsPage,
});

interface ProjectMeta {
  id: string;
  name: string;
  client: string;
  description: string;
  compliancePct: number;
  checkpointsCount: number;
  automatedCount: number;
  manualCount: number;
  submodules: string[];
  status: "healthy" | "attention";
  attentionCount?: number;
  isMain?: boolean;
}

const statusOptions: (Status | "all")[] = [
  "all",
  "compliant",
  "non-compliant",
  "needs-review",
  "manual-in-progress",
  "manual-waiting",
];

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
        className="rounded-md border border-border bg-panel px-2 py-1.5 text-xs text-foreground outline-none focus:border-ring"
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

function ProjectsPage() {
  const searchParams = Route.useSearch();
  const navigate = useNavigate();
  const activeProjectId = searchParams.project ?? null;

  const { checkpoints, connectors, countdown, resolveCheckpoint, completeStep, undoStep, addComment } =
    useAudit();

  const [openModule, setOpenModule] = useState<string | null>(null);
  const [evidenceFilter, setEvidenceFilter] = useState("All");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [source, setSource] = useState("All");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportTargetProject, setReportTargetProject] = useState<ProjectMeta | null>(null);

  const automatedCount = checkpoints.filter((c) => c.kind === "automated").length;
  const manualCount = checkpoints.length - automatedCount;
  const healthy = connectors.filter((c) => c.state === "healthy").length;

  const projectScore = checkpoints.reduce((sum, c) => {
    if (c.kind === "automated") return sum + (c.status === "compliant" ? 1 : 0);
    return sum + c.steps.filter((s) => s.state === "done").length / (c.steps.length || 1);
  }, 0);
  const projectCompliancePct = Math.round((projectScore / (checkpoints.length || 1)) * 100);
  const attentionCount = checkpoints.filter(
    (c) => c.status === "non-compliant" || c.status === "needs-review",
  ).length;

  const projectsList: ProjectMeta[] = useMemo(
    () => [
      {
        id: "project-a",
        name: "PIT Armour",
        client: "ACME-CLT-01 — Acme Capital",
        description: "Production IT Armour Platform — Core Banking & Financial Systems Governance covering Application Governance, Change Management, Secure SDLC, Access Control, and Continuous Verification.",
        compliancePct: projectCompliancePct,
        checkpointsCount: checkpoints.length,
        automatedCount: automatedCount,
        manualCount: manualCount,
        submodules: ["Application Governance", "Change Management", "Secure SDLC", "Access Control"],
        status: attentionCount > 0 ? "attention" : "healthy",
        attentionCount,
        isMain: true,
      },
      {
        id: "project-b",
        name: "SAATHI",
        client: "ACME-CLT-02 — Acme Capital",
        description: "SAATHI — Merchant Payment Gateway & Digital Financial Services: IAM policies, API security controls, and transaction compliance.",
        compliancePct: 91,
        checkpointsCount: 12,
        automatedCount: 10,
        manualCount: 2,
        submodules: ["Payment Security", "IAM", "API Gateway", "Transaction Logs"],
        status: "healthy",
      },
      {
        id: "project-c",
        name: "MPS",
        client: "ACME-CLT-03 — Acme Capital",
        description: "MPS — Risk Analytics & BI Cloud Data Platform: Snowflake pipeline compliance, PII masking rules, and access authorization.",
        compliancePct: 82,
        checkpointsCount: 8,
        automatedCount: 6,
        manualCount: 2,
        submodules: ["Data Governance", "PII Masking", "Access Logs", "Risk Models"],
        status: "healthy",
      },
    ],
    [checkpoints.length, automatedCount, manualCount, projectCompliancePct, attentionCount],
  );

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return projectsList;
    return projectsList.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.client.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.submodules.some((s) => s.toLowerCase().includes(q)),
    );
  }, [projectsList, projectSearch]);

  const selectProject = (id: string | null) => {
    setOpenModule(null);
    setSearch("");
    navigate({
      to: "/projects",
      search: id ? { project: id } : {},
    });
  };

  const selectedProjectMeta = projectsList.find((p) => p.id === activeProjectId) ?? projectsList[0];

  const moduleCheckpoints = useMemo(
    () => (openModule ? checkpoints.filter((c) => checkpointModule[c.id] === openModule) : []),
    [checkpoints, openModule],
  );

  const allEvidence = useMemo(
    () => ["All", ...new Set(moduleCheckpoints.map((c) => c.auditEvidence).filter(Boolean))],
    [moduleCheckpoints],
  );
  const allRoles = useMemo(
    () => ["All", ...new Set(moduleCheckpoints.map((c) => c.ownerRole).filter(Boolean))],
    [moduleCheckpoints],
  );

  const filtered = useMemo(
    () =>
      moduleCheckpoints.filter((cp) => {
        if (evidenceFilter !== "All" && cp.auditEvidence !== evidenceFilter) return false;
        if (ownerFilter !== "All" && cp.ownerRole !== ownerFilter) return false;
        if (source !== "All") {
          const keys: string[] = cp.sources ? cp.sources.map((s) => s.toLowerCase()) : ["manual"];
          if (!keys.includes(source.toLowerCase())) return false;
        }
        if (status !== "all" && cp.status !== status) return false;
        const q = search.trim().toLowerCase();
        if (
          q &&
          !`${cp.ref} ${cp.name} ${cp.ownerRole || ""} ${cp.auditEvidence || ""}`
            .toLowerCase()
            .includes(q)
        )
          return false;
        return true;
      }),
    [moduleCheckpoints, evidenceFilter, ownerFilter, source, status, search],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Checkpoint[]>();
    for (const cp of filtered) map.set(cp.category, [...(map.get(cp.category) ?? []), cp]);
    return [...map.entries()];
  }, [filtered]);

  const activeModule = modules.find((m) => m.key === openModule) ?? null;

  const moduleQuery = search.trim().toLowerCase();
  const visibleModules = modules.filter(
    (m) =>
      !openModule &&
      (!moduleQuery || `${m.name} ${m.submodules.join(" ")}`.toLowerCase().includes(moduleQuery)),
  );

  // LEVEL 1: Projects Overview (Folder View)
  if (!activeProjectId) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-7">
        <PageHeader
          title="Projects"
          subtitle="Compliance environments & audit project ledgers — Acme Capital"
        />

        {/* Quick KPI Rollup for Projects */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border bg-panel p-4 shadow-card">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary-soft">
                <FolderKanban className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
              </span>
              <p className="min-w-0 truncate text-xs text-muted-foreground">Active Projects</p>
            </div>
            <p className="mt-3 font-mono text-2xl text-foreground">{projectsList.length}</p>
            <Mono className="mt-1 block text-faint">3 environments monitored</Mono>
          </div>

          <div className="rounded-xl border border-border bg-panel p-4 shadow-card">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-ok/10">
                <CheckCircle2 className="h-3.5 w-3.5 text-ok" strokeWidth={1.75} />
              </span>
              <p className="min-w-0 truncate text-xs text-muted-foreground">Average Compliance</p>
            </div>
            <p className="mt-3 font-mono text-2xl text-ok">80%</p>
            <Mono className="mt-1 block text-faint">+3% across all projects</Mono>
          </div>

          <div className="rounded-xl border border-border bg-panel p-4 shadow-card">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary-soft">
                <Cpu className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
              </span>
              <p className="min-w-0 truncate text-xs text-muted-foreground">Automated Checks</p>
            </div>
            <p className="mt-3 font-mono text-2xl text-foreground">{automatedCount}</p>
            <Mono className="mt-1 block text-faint">continuously verified</Mono>
          </div>

          <div className="rounded-xl border border-border bg-panel p-4 shadow-card">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-warn/10">
                <AlertTriangle className="h-3.5 w-3.5 text-warn" strokeWidth={1.75} />
              </span>
              <p className="min-w-0 truncate text-xs text-muted-foreground">Open Findings</p>
            </div>
            <p className="mt-3 font-mono text-2xl text-warn">2</p>
            <Mono className="mt-1 block text-faint">in PIT Armour</Mono>
          </div>
        </div>

        {/* Project Directory Section */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <SectionHeading>
                Projects Directory <Mono className="text-faint">({filteredProjects.length})</Mono>
              </SectionHeading>
              <p className="mt-1 text-xs text-muted-foreground">
                Select a project folder to view its live audit controls, modules, and checkpoint ledger.
              </p>
            </div>

            <span className="inline-flex shrink-0 items-center gap-2 rounded-md border border-border bg-panel px-2.5 py-1.5 shadow-sm">
              <Search className="h-3.5 w-3.5 text-faint" />
              <input
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="Search projects or submodules..."
                className="w-44 bg-transparent text-xs outline-none placeholder:text-faint sm:w-64"
              />
            </span>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => selectProject(project.id)}
                className={`group relative rounded-xl border p-5 text-left shadow-card transition-all hover:border-primary/50 hover:shadow-panel ${
                  project.id === "project-a"
                    ? "border-primary/40 bg-panel ring-1 ring-primary/20"
                    : "border-border bg-panel"
                }`}
              >
                {/* Header with folder badge and status */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-soft text-primary transition-transform group-hover:scale-105">
                      <Folder className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                    <span className="rounded-full bg-panel-2 px-2.5 py-0.5 text-[11px] font-medium text-foreground">
                      Folder
                    </span>
                  </div>

                  {project.status === "attention" ? (
                    <span className="rounded-full bg-fail/10 px-2.5 py-0.5 text-[11px] font-medium text-fail">
                      {project.attentionCount} needs attention
                    </span>
                  ) : (
                    <span className="rounded-full bg-ok/10 px-2.5 py-0.5 text-[11px] font-medium text-ok">
                      healthy
                    </span>
                  )}
                </div>

                {/* Project Title and Client info */}
                <div className="mt-4 flex items-center justify-between">
                  <h3 className="font-serif text-xl font-medium text-foreground group-hover:text-primary transition-colors">
                    {project.name}
                  </h3>
                  <ChevronRight className="h-4 w-4 text-faint transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </div>

                <Mono className="mt-1 block text-faint">{project.client}</Mono>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                  {project.description}
                </p>

                {/* Compliance Percentage & Progress Bar */}
                <div className="mt-4">
                  <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-2xl font-semibold text-foreground">
                        {project.compliancePct}%
                      </span>
                      <Mono className="text-faint">{project.checkpointsCount} checkpoints verified</Mono>
                    </div>
                  </div>

                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-accent">
                    <span
                      className="block h-full rounded-full bg-ok transition-all"
                      style={{ width: `${project.compliancePct}%` }}
                    />
                  </div>
                </div>

                {/* Verification Mix */}
                <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Cpu className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <Mono>{project.automatedCount} automated</Mono>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-manual">
                    <FolderClosed className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <Mono>{project.manualCount} manual</Mono>
                  </span>
                </div>

                {/* Submodule Tags */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {project.submodules.map((tag) => (
                    <span
                      key={tag}
                      className="border border-border bg-panel-2 px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-primary font-medium">
                  <span>Open controls & modules</span>
                  <span className="transition-transform group-hover:translate-x-0.5">→</span>
                </div>
              </button>
            ))}
          </div>

          {filteredProjects.length === 0 && (
            <p className="rounded-lg border border-border bg-panel px-4 py-8 text-center text-sm text-muted-foreground">
              No projects match your search query "{projectSearch}".
            </p>
          )}
        </section>

        <footer className="border-t border-border pt-5 pb-2 text-xs text-faint">
          All projects are continuously scanned against organizational compliance baselines and SOC 2 / ISO 27001 policies.
        </footer>

        {reportTargetProject && (
          <AuditReportModal
            isOpen={isReportOpen}
            onClose={() => {
              setIsReportOpen(false);
              setReportTargetProject(null);
            }}
            projectName={reportTargetProject.name}
            projectClient={reportTargetProject.client}
            compliancePct={reportTargetProject.compliancePct}
            checkpoints={checkpoints}
          />
        )}
      </div>
    );
  }

  // LEVEL 2: Project Detail View (e.g. Project - A) with Controls & Modules
  return (
    <div className="mx-auto max-w-[1400px] space-y-7">
      {/* Navigation Breadcrumb & Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => selectProject(null)}
            className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All projects
          </button>
          <span className="text-faint">/</span>
          <span className="inline-flex items-center gap-1.5 font-mono text-foreground font-semibold">
            <Folder className="h-3.5 w-3.5 text-primary" />
            {selectedProjectMeta.name}
          </span>
          <span className="text-faint">/</span>
          <span className="text-muted-foreground">Controls</span>
        </div>

        {/* Download Audit Report Button */}
        <button
          onClick={() => {
            setReportTargetProject(selectedProjectMeta);
            setIsReportOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-all cursor-pointer"
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Download Audit Report</span>
        </button>
      </div>

      <PageHeader
        title={`${selectedProjectMeta.name} — Controls`}
        subtitle={`Live view across automated and manual verification — ${selectedProjectMeta.client}`}
      />

      <Rollup
        compliance={selectedProjectMeta.compliancePct}
        automated={automatedCount}
        manual={manualCount}
        trendData={projectComplianceTrends[(activeProjectId || "project-a") as ProjectId]}
      />

      {!activeModule ? (
        <section className="space-y-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <SectionHeading>
              Modules <Mono className="text-faint">({visibleModules.length})</Mono>
            </SectionHeading>
            <span className="inline-flex shrink-0 items-center gap-2 rounded-md border border-border bg-panel px-2 py-1.5">
              <Search className="h-3.5 w-3.5 text-faint" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search module or submodule"
                className="w-40 bg-transparent text-xs outline-none placeholder:text-faint sm:w-60"
              />
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Open a module to walk its submodules and every automated and manual checkpoint inside it.
          </p>
          <ModuleGrid
            modules={visibleModules}
            checkpoints={checkpoints}
            onOpen={(key) => {
              setOpenModule(key);
              setSearch("");
              setEvidenceFilter("All");
              setOwnerFilter("All");
              setSource("All");
              setStatus("all");
            }}
          />
        </section>
      ) : (
        <section className="space-y-3">
          <button
            onClick={() => {
              setOpenModule(null);
              setSearch("");
            }}
            className="inline-flex items-center gap-2 text-xs text-primary hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All category folders
          </button>
          <div>
            <SectionHeading>
              {activeModule.name} — checkpoint ledger{" "}
              <Mono className="text-faint">({moduleCheckpoints.length})</Mono>
            </SectionHeading>
            <Mono className="mt-1 block text-faint">
              Audited Evidence: {activeModule.submodules.join(" · ")}
            </Mono>
          </div>

          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-panel px-4 py-3 shadow-card">
            {allEvidence.length > 2 && (
              <Select
                label="Evidence"
                value={evidenceFilter}
                options={allEvidence}
                onChange={setEvidenceFilter}
              />
            )}
            {allRoles.length > 2 && (
              <Select
                label="Owner Role"
                value={ownerFilter}
                options={allRoles}
                onChange={setOwnerFilter}
              />
            )}
            <Select
              label="Source"
              value={source}
              options={["All", "GitHub", "Jira", "Mail", "Manual"]}
              onChange={setSource}
            />
            <Select
              label="Status"
              value={status}
              options={statusOptions}
              onChange={setStatus}
              render={(v) => (v === "all" ? "All" : statusLabel[v as Status])}
            />
            <span className="ml-auto inline-flex items-center gap-2 rounded-md border border-border bg-panel-2 px-2 py-1.5">
              <Search className="h-3.5 w-3.5 text-faint" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search checkpoint name or ID"
                className="w-40 bg-transparent text-xs outline-none placeholder:text-faint sm:w-56"
              />
            </span>
          </div>

          <div className="space-y-5">
            {grouped.map(([cat, items]) => {
              const isCollapsed = collapsed[cat];
              return (
                <div key={cat} className="overflow-hidden rounded-lg border border-border bg-panel shadow-card">
                  <button
                    onClick={() => setCollapsed((c) => ({ ...c, [cat]: !c[cat] }))}
                    className="flex w-full items-center gap-3 border-b border-border bg-panel-2 px-4 py-2.5 text-left"
                  >
                    <h3 className="font-serif text-base text-foreground">
                      {cat} <Mono className="text-faint">({items.length})</Mono>
                    </h3>
                    <span className="ml-auto text-[11px] text-primary">
                      {isCollapsed ? "show" : "hide"}
                    </span>
                  </button>
                  {!isCollapsed && (
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
                  )}
                </div>
              );
            })}
            {grouped.length === 0 && (
              <p className="rounded-lg border border-border bg-panel px-4 py-8 text-center text-sm text-muted-foreground">
                No checkpoints match the current filters.
              </p>
            )}
          </div>
        </section>
      )}

      <footer className="border-t border-border pt-5 pb-2 text-xs text-faint">
        Checkpoint evidence and history are written continuously by the background verification
        workers and stored with role-based access control per checkpoint.
      </footer>

      {reportTargetProject && (
        <AuditReportModal
          isOpen={isReportOpen}
          onClose={() => {
            setIsReportOpen(false);
            setReportTargetProject(null);
          }}
          projectName={reportTargetProject.name}
          projectClient={reportTargetProject.client}
          compliancePct={reportTargetProject.compliancePct}
          checkpoints={checkpoints}
        />
      )}
    </div>
  );
}
