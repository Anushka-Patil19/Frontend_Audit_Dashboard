import { useEffect, useMemo, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, ChevronDown, Folder, RotateCcw, Save, Search, Timer, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Mono } from "@/components/audit/atoms";
import { useAudit } from "@/lib/audit-store";
import { useRole } from "@/lib/role-store";
import { categories, projectsData, type ProjectId } from "@/lib/audit-data";
import { useEscalations } from "@/lib/escalation-store";
import { ORG_DEFAULT_LIMIT_DAYS, resolveLimit, type Level, type Policy, type ProjectConfig } from "@/lib/escalation-data";

export const Route = createFileRoute("/escalations")({
  validateSearch: (search: Record<string, unknown>): { project?: ProjectId } =>
    typeof search["project"] === "string" && search["project"] in projectsData ? { project: search["project"] as ProjectId } : {},
  head: () => ({ meta: [{ title: "Escalations — Audit Intelligence" }] }),
  component: EscalationsPage,
});

const customCount = (c: ProjectConfig | undefined) =>
  c ? Object.keys(c.categoryLimits).length + Object.keys(c.checkpointLimits).length + (c.defaultLimitDays !== undefined ? 1 : 0) : 0;

function EscalationsPage() {
  const { project } = Route.useSearch();
  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Escalations"
        subtitle="How long each checkpoint may stay open, and who is notified when it runs late"
      />
      {project ? <ProjectSettings pid={project} /> : <ProjectFolders />}
    </div>
  );
}

/* ───────────────────────── Project folders ───────────────────────── */

function ProjectFolders() {
  const { items, getConfig, ageOf, ready } = useEscalations();
  return (
    <section className="rounded-xl border border-border bg-panel p-5 shadow-card">
      <h2 className="font-serif text-base text-foreground">Projects</h2>
      <p className="mt-1 text-xs text-muted-foreground">Each project inherits the default template (2 days per checkpoint) and stores only what differs.</p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(projectsData) as ProjectId[]).map((pid) => {
          const p = projectsData[pid];
          const n = customCount(getConfig(pid));
          const open = items.filter((i) => i.projectId === pid && i.status !== "compliant");
          const overdue = open.filter((i) => i.status === "open" && ageOf(i).overdueDays > 0).length;
          return (
            <Link
              key={pid}
              to="/escalations"
              search={{ project: pid }}
              className="group rounded-lg border border-border p-4 transition-colors hover:border-primary/50 hover:bg-panel-2/50"
            >
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-primary" strokeWidth={1.75} />
                <span className="text-sm font-medium text-foreground">{p.name}</span>
                <span className="ml-auto rounded-full bg-panel-2 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">BU: {p.businessUnit}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${n ? "bg-primary-soft text-primary" : "bg-panel-2 text-muted-foreground"}`}>
                  {n ? `${n} custom ${n === 1 ? "limit" : "limits"}` : "Default template"}
                </span>
                {ready && open.length > 0 && (
                  <span className="rounded-full bg-warn/10 px-2 py-0.5 font-mono text-[10px] text-warn">{open.length} open items</span>
                )}
                {ready && overdue > 0 && (
                  <span className="rounded-full bg-fail/10 px-2 py-0.5 font-mono text-[10px] text-fail">{overdue} overdue</span>
                )}
              </div>
              <p className="mt-3 text-[11px] text-primary opacity-70 group-hover:opacity-100">Open settings →</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ───────────────────────── Project settings ───────────────────────── */

function DaysInput({ id, value, placeholder, onChange, disabled, label }: {
  id: string; value: number | undefined; placeholder: number; onChange: (v: number | undefined) => void; disabled: boolean; label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        id={id}
        type="number"
        min={0}
        max={60}
        inputMode="numeric"
        aria-label={label}
        disabled={disabled}
        value={value ?? ""}
        placeholder={String(placeholder)}
        onChange={(e) => {
          const raw = e.target.value.trim();
          if (raw === "") return onChange(undefined);
          const n = Math.max(0, Math.min(60, Math.round(Number(raw))));
          if (!Number.isNaN(n)) onChange(n);
        }}
        className="h-7 w-14 rounded-md border border-border bg-panel px-2 text-right font-mono text-xs text-foreground placeholder:text-faint disabled:opacity-60"
      />
      <span className="text-[11px] text-muted-foreground">days</span>
    </span>
  );
}

function SourceChip({ custom, onReset, disabled }: { custom: boolean; onReset: () => void; disabled: boolean }) {
  return custom ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 font-mono text-[10px] text-primary">
      custom
      {!disabled && (
        <button type="button" onClick={onReset} aria-label="Reset to default" className="hover:text-foreground">
          <RotateCcw className="h-3 w-3" />
        </button>
      )}
    </span>
  ) : (
    <span className="rounded-full bg-panel-2 px-2 py-0.5 font-mono text-[10px] text-faint">default</span>
  );
}

function ProjectSettings({ pid }: { pid: ProjectId }) {
  const esc = useEscalations();
  const { checkpoints } = useAudit();
  const { role } = useRole();
  // Managers can fill the matrix and people; only checkpoint limits stay CTO / admin.
  const readOnly = role === "manager";
  const matrixReadOnly = false;
  const cfg = esc.getConfig(pid);
  // Matrix + people are edited as a draft and saved with the Save button.
  const savedPolicy = cfg.policy;
  const savedKey = JSON.stringify(savedPolicy);
  const [draft, setDraft] = useState<Policy>(savedPolicy);
  const dirty = JSON.stringify(draft) !== savedKey;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    // follow outside changes (another tab, reset to template) unless there are unsaved edits
    if (!dirtyRef.current) setDraft(JSON.parse(savedKey) as Policy);
  }, [savedKey]);
  const p = draft;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(0);

  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(0), 1800);
    return () => window.clearTimeout(t);
  }, [saved]);
  const touch = () => setSaved(Date.now());

  const projectDefault = cfg.defaultLimitDays ?? ORG_DEFAULT_LIMIT_DAYS;
  const q = query.trim().toLowerCase();
  const groups = useMemo(
    () =>
      categories
        .map((cat) => ({
          cat,
          rows: checkpoints.filter((c) => c.category === cat && (!q || `${c.ref} ${c.name}`.toLowerCase().includes(q))),
          total: checkpoints.filter((c) => c.category === cat).length,
        }))
        .filter((g) => g.rows.length > 0),
    [checkpoints, q],
  );

  const people: { level: Level; role: string }[] = [
    { level: "developer", role: "Developer (checkpoint owner)" },
    { level: "manager", role: "Manager" },
    { level: "cto", role: "CTO" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/escalations" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> All projects
        </Link>
        <span className="text-xs text-faint">/</span>
        <span className="text-sm font-medium text-foreground">{projectsData[pid].name}</span>
        <span className="text-xs text-muted-foreground">· Deadlines &amp; escalation</span>
        <span className="ml-auto flex items-center gap-3">
          {saved > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-ok">
              <CheckCircle2 className="h-3.5 w-3.5" /> Saved
            </span>
          )}
          {!readOnly && (
            <button
              type="button"
              onClick={() => {
                esc.resetProject(pid);
                touch();
              }}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-panel-2"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset to default template
            </button>
          )}
        </span>
      </div>

      {readOnly && (
        <p className="rounded-lg border border-border bg-panel-2/50 px-4 py-2.5 text-xs text-muted-foreground">
          You can edit the escalation matrix and people. Checkpoint limits are view only: the CTO or a compliance admin sets them.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[3fr_2fr]">
        {/* Escalation matrix */}
        <section className="rounded-xl border border-border bg-panel p-5 shadow-card">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary-soft">
              <Timer className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
            </span>
            <h2 className="font-serif text-base text-foreground">Escalation matrix</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Who is notified, and when. Days count from each checkpoint's own limit.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-xs">
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase tracking-wide text-faint">
                  <th className="pb-2 font-normal">Stage</th>
                  <th className="pb-2 font-normal">Notify</th>
                  <th className="pb-2 font-normal">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td rowSpan={3} className="py-2.5 pr-3 align-top text-sm text-foreground">Fixing the issue<br /><span className="text-[11px] text-muted-foreground">Developer has the checkpoint's limit</span></td>
                  <td className="py-2.5 text-foreground">{p.people.developer.name} · reminder</td>
                  <td className="py-2.5"><DaysInput id="m-reminder" label="Reminder days before the limit" disabled={matrixReadOnly} value={p.reminderBeforeDays} placeholder={1} onChange={(v) => setDraft((d) => ({ ...d, reminderBeforeDays: v ?? 1 }))} /> <span className="text-[11px] text-muted-foreground">before the limit</span></td>
                </tr>
                <tr>
                  <td className="py-2.5 text-foreground">{p.people.manager.name} · Manager</td>
                  <td className="py-2.5"><DaysInput id="m-manager" label="Manager days after the limit" disabled={matrixReadOnly} value={p.managerAfterDays} placeholder={0} onChange={(v) => setDraft((d) => ({ ...d, managerAfterDays: v ?? 0 }))} /> <span className="text-[11px] text-muted-foreground">after the limit (0 = at it)</span></td>
                </tr>
                <tr>
                  <td className="py-2.5 text-foreground">{p.people.cto.name === "CTO" ? "CTO" : `${p.people.cto.name} · CTO`}</td>
                  <td className="py-2.5"><DaysInput id="m-cto" label="CTO days after the limit" disabled={matrixReadOnly} value={p.ctoAfterDays} placeholder={2} onChange={(v) => setDraft((d) => ({ ...d, ctoAfterDays: v ?? 2 }))} /> <span className="text-[11px] text-muted-foreground">after the limit</span></td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-3 text-sm text-foreground">Approving the fix<br /><span className="text-[11px] text-muted-foreground">Manager decides</span></td>
                  <td className="py-2.5 text-foreground">{p.people.cto.name === "CTO" ? "CTO" : `${p.people.cto.name} · CTO`}</td>
                  <td className="py-2.5"><DaysInput id="m-approval" label="Approval limit in days" disabled={matrixReadOnly} value={p.approvalLimitDays} placeholder={2} onChange={(v) => setDraft((d) => ({ ...d, approvalLimitDays: v ?? 2 }))} /> <span className="text-[11px] text-muted-foreground">after the fix, if not approved</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* People */}
        <section className="rounded-xl border border-border bg-panel p-5 shadow-card">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary-soft">
              <Users className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
            </span>
            <h2 className="font-serif text-base text-foreground">People</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Notifications always show on their dashboards. Email is added once addresses are set.</p>
          <div className="mt-4 space-y-3">
            {people.map(({ level, role: r }) => (
              <div key={level} className="grid grid-cols-1 gap-1.5 sm:grid-cols-[110px_1fr_1fr] sm:items-center">
                <span className="text-xs text-muted-foreground">{r}</span>
                <input
                  id={`person-${level}-name`}
                  aria-label={`${r} name`}
                  disabled={matrixReadOnly}
                  value={p.people[level].name}
                  onChange={(e) => setDraft((d) => ({ ...d, people: { ...d.people, [level]: { ...d.people[level], name: e.target.value } } }))}
                  className="h-8 rounded-md border border-border bg-panel px-2 text-xs text-foreground disabled:opacity-60"
                />
                <input
                  id={`person-${level}-email`}
                  type="email"
                  aria-label={`${r} email`}
                  placeholder="email (optional)"
                  disabled={matrixReadOnly}
                  value={p.people[level].email}
                  onChange={(e) => setDraft((d) => ({ ...d, people: { ...d.people, [level]: { ...d.people[level], email: e.target.value } } }))}
                  className="h-8 rounded-md border border-border bg-panel px-2 text-xs text-foreground placeholder:text-faint disabled:opacity-60"
                />
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Save bar for the matrix + people draft */}
      <div className={`flex flex-wrap items-center justify-end gap-3 rounded-lg border px-4 py-2.5 ${dirty ? "border-warn/40 bg-warn/5" : "border-border bg-panel"}`}>
        <span className="mr-auto text-xs text-muted-foreground">
          {dirty ? "You have unsaved changes to the escalation matrix or people." : "Escalation matrix and people are saved."}
        </span>
        <button
          type="button"
          disabled={!dirty}
          onClick={() => setDraft(JSON.parse(savedKey) as Policy)}
          className="h-8 rounded-md border border-border px-3 text-xs text-foreground hover:bg-panel-2 disabled:opacity-50"
        >
          Discard
        </button>
        <button
          type="button"
          disabled={!dirty}
          onClick={() => {
            esc.setPolicy(pid, draft);
            touch();
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" /> Save changes
        </button>
      </div>

      {/* Checkpoint limits */}
      <section className="rounded-xl border border-border bg-panel p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-serif text-base text-foreground">How long each checkpoint may stay open</h2>
          <span className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1">
            <span className="text-xs text-muted-foreground">Project default</span>
            <DaysInput id="project-default" label="Project default limit" disabled={readOnly} value={cfg.defaultLimitDays} placeholder={ORG_DEFAULT_LIMIT_DAYS} onChange={(v) => { esc.setDefaultLimit(pid, v); touch(); }} />
          </span>
          <label className="relative ml-auto">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            <input
              id="limit-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search checkpoints"
              className="h-8 w-56 rounded-md border border-border bg-panel pl-7 pr-2 text-xs text-foreground placeholder:text-faint"
            />
          </label>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Set a limit for a whole category, then override single checkpoints if needed. Blank = inherited (shown in grey).</p>

        <ul className="mt-4 space-y-2">
          {groups.map(({ cat, rows, total }) => {
            const isOpen = !!q || !!open[cat];
            const catLimit = cfg.categoryLimits[cat];
            const overrides = rows.filter((c) => cfg.checkpointLimits[c.id] !== undefined).length;
            return (
              <li key={cat} className={`rounded-lg border ${isOpen ? "border-primary/30" : "border-border"}`}>
                <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <button type="button" onClick={() => setOpen((o) => ({ ...o, [cat]: !o[cat] }))} aria-expanded={isOpen} className="flex min-w-[200px] flex-1 items-center gap-2 text-left">
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    <Folder className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.75} />
                    <span className="text-sm text-foreground">{cat}</span>
                    <Mono className="text-faint">{q ? `${rows.length} of ${total}` : `${total} checkpoints`}</Mono>
                    {overrides > 0 && <span className="rounded-full bg-primary-soft px-2 py-0.5 font-mono text-[10px] text-primary">{overrides} overridden</span>}
                  </button>
                  <DaysInput id={`cat-${cat}`} label={`${cat} limit`} disabled={readOnly} value={catLimit} placeholder={projectDefault} onChange={(v) => { esc.setCategoryLimit(pid, cat, v); touch(); }} />
                  <SourceChip custom={catLimit !== undefined} disabled={readOnly} onReset={() => { esc.setCategoryLimit(pid, cat, undefined); touch(); }} />
                </div>
                {isOpen && (
                  <ul className="divide-y divide-border border-t border-border">
                    {rows.map((c) => {
                      const own = cfg.checkpointLimits[c.id];
                      const inherited = resolveLimit({ ...cfg, checkpointLimits: {} }, c.id, cat).days;
                      return (
                        <li key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2 pl-12">
                          <Mono className="w-10 text-faint">{c.ref}</Mono>
                          <span className="min-w-[200px] flex-1 text-xs text-foreground">{c.name}</span>
                          <span className="w-28 text-[11px] text-muted-foreground">{c.ownerRole}</span>
                          <DaysInput id={`cp-${c.id}`} label={`${c.ref} limit`} disabled={readOnly} value={own} placeholder={inherited} onChange={(v) => { esc.setCheckpointLimit(pid, c.id, v); touch(); }} />
                          <SourceChip custom={own !== undefined} disabled={readOnly} onReset={() => { esc.setCheckpointLimit(pid, c.id, undefined); touch(); }} />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
          {groups.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No checkpoint matches “{query}”.</li>}
        </ul>
      </section>
    </div>
  );
}
