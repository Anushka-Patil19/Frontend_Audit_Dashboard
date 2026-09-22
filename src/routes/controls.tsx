import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import {
  checkpointModule,
  modules,
  statusLabel,
  type Checkpoint,
  type Status,
} from "@/lib/audit-data";
import { useAudit } from "@/lib/audit-store";
import { AutomatedCard } from "@/components/audit/AutomatedCard";
import { ManualCard } from "@/components/audit/ManualCard";
import { ModuleGrid } from "@/components/audit/ModuleGrid";
import { Rollup } from "@/components/audit/panels";
import { Mono, SectionHeading } from "@/components/audit/atoms";
import { PageHeader } from "@/components/layout/PageHeader";

export const Route = createFileRoute("/controls")({
  beforeLoad: () => {
    throw redirect({
      to: "/projects",
      search: { project: "project-a" },
    });
  },
  head: () => ({
    meta: [
      { title: "Controls — Audit Intelligence" },
      {
        name: "description",
        content:
          "Browse audit modules and drill into every automated and manual compliance checkpoint with evidence, approvals and history.",
      },
      { property: "og:title", content: "Controls — Audit Intelligence" },
      {
        property: "og:description",
        content: "Module-by-module checkpoint ledger for automated and manual verification.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ControlsPage,
});

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

function ControlsPage() {
  const { checkpoints, connectors, countdown, resolveCheckpoint, completeStep, undoStep, addComment } =
    useAudit();
  const [openModule, setOpenModule] = useState<string | null>(null);
  const [category, setCategory] = useState("All");
  const [source, setSource] = useState("All");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const moduleCheckpoints = useMemo(
    () => (openModule ? checkpoints.filter((c) => checkpointModule[c.id] === openModule) : []),
    [checkpoints, openModule],
  );

  const filtered = useMemo(
    () =>
      moduleCheckpoints.filter((cp) => {
        if (category !== "All" && cp.category !== category) return false;
        if (source !== "All") {
          const keys: string[] = cp.kind === "automated" ? cp.sources : ["manual"];
          if (!keys.includes(source.toLowerCase())) return false;
        }
        if (status !== "all" && cp.status !== status) return false;
        const q = search.trim().toLowerCase();
        if (q && !`${cp.ref} ${cp.name}`.toLowerCase().includes(q)) return false;
        return true;
      }),
    [moduleCheckpoints, category, source, status, search],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Checkpoint[]>();
    for (const cp of filtered) map.set(cp.category, [...(map.get(cp.category) ?? []), cp]);
    return [...map.entries()];
  }, [filtered]);

  const activeModule = modules.find((m) => m.key === openModule) ?? null;
  const allCategories = ["All", ...new Set(moduleCheckpoints.map((c) => c.category))];
  const automatedCount = checkpoints.filter((c) => c.kind === "automated").length;
  const manualCount = checkpoints.length - automatedCount;
  const healthy = connectors.filter((c) => c.state === "healthy").length;

  const moduleQuery = search.trim().toLowerCase();
  const visibleModules = modules.filter(
    (m) =>
      !openModule &&
      (!moduleQuery || `${m.name} ${m.submodules.join(" ")}`.toLowerCase().includes(moduleQuery)),
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-7">
      <PageHeader
        title="Controls"
        subtitle="Live view across automated and manual verification — Acme Capital"
      />

      <Rollup
        compliance={78}
        automated={automatedCount}
        manual={manualCount}
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
              setCategory("All");
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
            All modules
          </button>
          <div>
            <SectionHeading>
              {activeModule.name} — checkpoint ledger{" "}
              <Mono className="text-faint">({moduleCheckpoints.length})</Mono>
            </SectionHeading>
            <Mono className="mt-1 block text-faint">
              submodules: {activeModule.submodules.join(" · ")}
            </Mono>
          </div>

          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-panel px-4 py-3 shadow-card">
            <Select
              label="Submodule"
              value={category}
              options={allCategories}
              onChange={setCategory}
            />
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

    </div>
  );
}
