import { Fragment, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Grid3x3, X } from "lucide-react";
import { Mono, StatusPill } from "@/components/audit/atoms";
import { useManagerProject } from "@/components/manager/project-context";
import { Card, Chips } from "@/components/developer/DevSections";
import { LiveTag } from "@/components/developer/DevKpis";
import {
  componentColumns,
  HEATMAP_DOMAINS,
  WEEK_COLUMNS,
  buildHeatmap,
  type ComponentId,
  type HeatCell,
  type ManagerView,
} from "@/lib/manager-data";

// Rows = the 17 control modules grouped by domain; columns = Overall (live) + components (mock),
// or the last 6 weeks (history mock, this week live). Cell = checks not passing / checks in scope,
// shaded by how large that share is. Click a cell for the failing checkpoints.

type Mode = "components" | "weeks";

function tone(c: HeatCell) {
  if (!c.total) return { bg: "var(--panel-2)", fg: "var(--faint)", opacity: 1 };
  if (!c.bad) return { bg: "var(--ok)", fg: "white", opacity: 0.8 };
  const share = c.bad / c.total;
  return { bg: c.nc ? "var(--fail)" : "var(--warn)", fg: "white", opacity: 0.45 + 0.55 * share };
}

const worst = (cells: HeatCell[]): HeatCell =>
  cells.reduce<HeatCell>(
    (w, c) => (c.nc > w.nc || (c.nc === w.nc && c.bad / (c.total || 1) > w.bad / (w.total || 1)) ? c : w),
    { bad: 0, nc: 0, total: 0 },
  );

export function RiskHeatmap({ view, selected, embedded = false }: { view: ManagerView; selected: ComponentId | null; embedded?: boolean }) {
  const mp = useManagerProject();
  const [mode, setMode] = useState<Mode>("components");
  const [issuesOnly, setIssuesOnly] = useState(true);
  const { live, cell } = useMemo(() => buildHeatmap(view.pitCheckpoints), [view.pitCheckpoints]);
  const columns = mode === "components" ? componentColumns(mp.components) : WEEK_COLUMNS;

  const moduleHasIssue = (m: string) => columns.some((col) => cell(m, col.key).bad > 0);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(HEATMAP_DOMAINS.map((d) => [d.name, !d.modules.some((m) => (live.get(m)?.bad ?? 0) > 0)])),
  );
  const [picked, setPicked] = useState<{ module: string; col: string } | null>(null);

  const hiddenHealthy = issuesOnly
    ? HEATMAP_DOMAINS.flatMap((d) => d.modules).filter((m) => !moduleHasIssue(m)).length
    : 0;

  const pickedCell = picked ? cell(picked.module, picked.col) : null;
  const pickedCol = picked ? columns.find((c) => c.key === picked.col) : null;
  const failing = picked ? live.get(picked.module)?.failing ?? [] : [];

  const modeChips = (
    <Chips
      value={mode}
      onChange={(m) => { setMode(m); setPicked(null); }}
      options={[{ value: "components", label: "By component" }, { value: "weeks", label: "Last 6 weeks" }]}
    />
  );

  const body = (
      <>
        {embedded && <div className="flex justify-end">{modeChips}</div>}
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={issuesOnly} onChange={(e) => setIssuesOnly(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--primary)]" />
            Issues only
            {hiddenHealthy > 0 && <span className="text-faint">· {hiddenHealthy} healthy areas hidden</span>}
          </label>
          <span className="text-[11px] text-faint">
            {mode === "components" ? "Overall is live · component split is mock until checks are mapped to repos" : "This week is live · earlier weeks are mock history"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] table-fixed border-separate border-spacing-1 text-xs">
            <colgroup>
              <col className="w-[250px]" />
              {columns.map((c) => <col key={c.key} />)}
            </colgroup>
            <thead>
              <tr>
                <th />
                {columns.map((c) => {
                  const dim = mode === "components" && selected && c.key !== "overall" && c.key !== selected;
                  return (
                    <th key={c.key} className={`px-1 pb-1 text-center font-normal ${dim ? "text-faint" : "text-muted-foreground"} ${mode === "components" && c.key === selected ? "text-primary" : ""}`}>
                      <span className="inline-flex items-center gap-1">{c.label}{c.live && <LiveTag />}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {HEATMAP_DOMAINS.map((d) => {
                const rows = d.modules.filter((m) => !issuesOnly || moduleHasIssue(m));
                const isCollapsed = collapsed[d.name];
                const domainCells = columns.map((col) => worst(d.modules.map((m) => cell(m, col.key))));
                const issueCount = d.modules.filter(moduleHasIssue).length;
                return (
                  <Fragment key={d.name}>
                    <tr>
                      <td className="pt-2">
                        <button
                          type="button"
                          onClick={() => setCollapsed((c) => ({ ...c, [d.name]: !c[d.name] }))}
                          className="flex items-center gap-1 whitespace-nowrap font-mono text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
                          aria-expanded={!isCollapsed}
                        >
                          <ChevronRight className={`h-3 w-3 transition-transform ${isCollapsed ? "" : "rotate-90"}`} />
                          {d.name}
                          <span className={`normal-case tracking-normal ${issueCount ? "text-warn" : "text-ok"}`}>· {issueCount ? `${issueCount} flagged` : "all healthy"}</span>
                        </button>
                      </td>
                      {isCollapsed
                        ? domainCells.map((c, i) => {
                            const t = tone(c);
                            return <td key={i} className="pt-2"><div className="h-2 rounded-full" style={{ background: t.bg, opacity: t.opacity }} /></td>;
                          })
                        : columns.map((c) => <td key={c.key} />)}
                    </tr>
                    {!isCollapsed && rows.map((m) => (
                      <tr key={m}>
                        <td className="truncate pl-4 pr-2 text-foreground" title={m}>{m}</td>
                        {columns.map((col) => {
                          const c = cell(m, col.key);
                          const t = tone(c);
                          const isPicked = picked?.module === m && picked.col === col.key;
                          const dim = mode === "components" && selected && col.key !== "overall" && col.key !== selected;
                          const label = c.total ? `${c.bad}/${c.total}` : "—";
                          return (
                            <td key={col.key} className="p-0">
                              <button
                                type="button"
                                disabled={!c.total}
                                onClick={() => setPicked(isPicked ? null : { module: m, col: col.key })}
                                title={`${m} · ${col.label}: ${c.total ? `${c.bad} of ${c.total} checks not passing${c.nc ? `, ${c.nc} non-compliant` : ""}` : "no checks in scope"}`}
                                className={`relative block h-8 w-full rounded-md font-mono text-[11px] transition-transform enabled:hover:scale-[1.04] ${isPicked ? "ring-2 ring-foreground/60" : ""} ${dim ? "opacity-30" : ""}`}
                              >
                                <span className="absolute inset-0 rounded-md" style={{ background: t.bg, opacity: t.opacity }} />
                                <span className="relative" style={{ color: t.fg }}>{label}</span>
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {!isCollapsed && rows.length === 0 && (
                      <tr><td colSpan={columns.length + 1} className="pl-4 text-[11px] text-faint">All {d.modules.length} modules healthy.</td></tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--ok)" }} /> all passing</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--warn)" }} /> needs attention</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--fail)" }} /> has non-compliant</span>
          <span>darker = larger share failing · cell = not passing / total</span>
        </div>

        {picked && pickedCell && (
          <div className="mt-3 rounded-lg border border-primary/30 bg-panel-2/40 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-foreground">
                  {picked.module} · {pickedCol?.label}: {pickedCell.bad} of {pickedCell.total} checks not passing
                  {pickedCell.nc ? <span className="text-fail"> · {pickedCell.nc} non-compliant</span> : null}
                </p>
                {pickedCell.mock && (
                  <p className="mt-0.5 text-[11px] text-faint">
                    {mode === "weeks" ? "Historical week (mock)." : "Component split is mock."} Showing the project's current failing checks for this module.
                  </p>
                )}
              </div>
              <button type="button" onClick={() => setPicked(null)} aria-label="Close" className="rounded p-0.5 text-muted-foreground hover:bg-panel-2"><X className="h-4 w-4" /></button>
            </div>
            {failing.length === 0 ? (
              <p className="mt-2 text-xs text-ok">All checks in this module are passing right now.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {failing.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 py-2">
                    <Mono className="text-faint">{c.ref ?? c.id}</Mono>
                    <span className="min-w-0 flex-1 text-xs text-foreground">{c.name}</span>
                    <span className="text-[11px] text-muted-foreground">{c.ownerRole}</span>
                    <StatusPill status={c.status} />
                    <Link to="/projects" search={{ project: mp.pid }} className="rounded-md border border-border px-2 py-0.5 text-[11px] text-foreground hover:bg-panel">Open</Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </>
  );

  if (embedded) return body;
  return (
    <div id="mgr-heatmap" className="scroll-mt-6 rounded-xl transition-shadow">
      <Card
        title="Risk heatmap"
        icon={Grid3x3}
        note="17 control modules × where the problems are. A dark column cell = a team/component problem; a module dark across all columns = a process problem."
        right={modeChips}
      >
        {body}
      </Card>
    </div>
  );
}
