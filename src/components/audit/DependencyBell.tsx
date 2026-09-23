import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, ChevronDown, Loader2 } from "lucide-react";
import { checkRepoDependencies } from "@/lib/dependency-monitor";
import type { DependencyResult } from "@/lib/version-checker";

// Polls the GitHub Dependency Version Monitoring POC (src/lib/dependency-monitor.ts)
// and surfaces packages that need action — either a version update or a
// switch away from a deprecated package — as a red notification bell,
// matching the compliance-alert visual language used elsewhere
// (bg-fail/text-fail). A package that's both up to date and not deprecated
// is left out; nothing to action there.
export function DependencyBell() {
  const checkDependencies = useServerFn(checkRepoDependencies);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [results, setResults] = useState<DependencyResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setState("loading");
    setError(null);
    const res = await checkDependencies();
    if (!res.ok) {
      setError(res.error);
      setState("error");
      return;
    }
    setResults(res.results);
    setState("idle");
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const flaggedResults = results.filter((r) => r.status === "UPDATE_AVAILABLE" || r.deprecated);
  const alertCount = flaggedResults.length;
  const hasAlerts = alertCount > 0 || state === "error";

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`relative grid h-8 w-8 place-items-center rounded-lg border transition-all cursor-pointer ${
          hasAlerts
            ? "border-fail/40 bg-fail/10 text-fail hover:bg-fail/20"
            : "border-border bg-panel text-muted-foreground hover:bg-panel-2"
        }`}
        title="Dependency version alerts"
      >
        {state === "loading" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Bell className="h-4 w-4" strokeWidth={1.75} />
        )}
        {hasAlerts && state !== "loading" && (
          <span className="absolute -top-1.5 -right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-fail px-1 text-[10px] font-semibold text-white">
            {state === "error" ? "!" : alertCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-border bg-panel shadow-panel">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-xs font-semibold text-foreground">Dependency alerts</p>
            <button onClick={load} className="text-[11px] text-primary hover:underline cursor-pointer">
              Re-check
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {state === "error" && (
              <p className="px-2 py-3 text-xs text-fail">{error}</p>
            )}
            {state !== "error" && flaggedResults.length === 0 && (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                {state === "loading" ? "Checking requirements.txt against PyPI…" : "Everything is up to date."}
              </p>
            )}
            {flaggedResults.map((r) => {
              const isExpanded = !!expanded[r.package];
              return (
                <div key={r.package} className="rounded-md px-2 py-1.5 text-xs hover:bg-panel-2">
                  <button
                    type="button"
                    onClick={() => r.deprecated && setExpanded((e) => ({ ...e, [r.package]: !e[r.package] }))}
                    className={`flex w-full items-center justify-between gap-2 text-left ${r.deprecated ? "cursor-pointer" : ""}`}
                  >
                    <span className="flex items-center gap-1">
                      {r.deprecated && (
                        <ChevronDown
                          className={`h-3 w-3 shrink-0 text-faint transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      )}
                      <span className="font-mono text-foreground">{r.package}</span>
                    </span>
                    {r.deprecated ? (
                      <span className="font-mono text-faint">→ {r.replacementPackage ?? "see notice"}</span>
                    ) : (
                      <span className="font-mono text-faint">
                        {r.currentVersion} → {r.latestVersion}
                      </span>
                    )}
                    <span className={r.deprecated ? "font-medium text-fail" : "font-medium text-warn"}>
                      {r.deprecated ? "deprecated" : "update"}
                    </span>
                  </button>
                  {r.deprecated && isExpanded && (
                    <div className="mt-1 rounded border border-fail/30 bg-fail/10 px-1.5 py-1">
                      <p className="text-[11px] font-medium text-fail" title={r.deprecationNote ?? undefined}>
                        You're using {r.package} ({r.currentVersion}), but it's deprecated
                        {r.replacementPackage ? ` — use ${r.replacementPackage} instead` : ""}.
                        {r.status === "UPDATE_AVAILABLE" ? ` (an update to ${r.latestVersion} is also available, but it's still the same deprecated package.)` : ""}
                      </p>
                      <p className="mt-1 text-[10px] text-fail/70">
                        Source:{" "}
                        {r.deprecationSource === "official-classifier"
                          ? "PyPI official classifier (Development Status :: 7 - Inactive)"
                          : "maintainer's own package description"}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
