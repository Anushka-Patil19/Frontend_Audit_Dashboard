import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Loader2 } from "lucide-react";
import { checkRepoDependencies } from "@/lib/dependency-monitor";
import type { DependencyResult } from "@/lib/version-checker";

// Polls the GitHub Dependency Version Monitoring POC (src/lib/dependency-monitor.ts)
// and surfaces only currently-deprecated packages as a red notification bell,
// matching the compliance-alert visual language used elsewhere
// (bg-fail/text-fail). Up-to-date and update-available packages are
// deliberately not shown here — deprecation is the one thing worth
// interrupting someone for, and it persists regardless of whether a newer
// release of the same (deprecated) package exists.
export function DependencyBell() {
  const checkDependencies = useServerFn(checkRepoDependencies);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [results, setResults] = useState<DependencyResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
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

  const deprecatedResults = results.filter((r) => r.deprecated);
  const alertCount = deprecatedResults.length;
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
            <p className="text-xs font-semibold text-foreground">Deprecated dependencies in use</p>
            <button onClick={load} className="text-[11px] text-primary hover:underline cursor-pointer">
              Re-check
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {state === "error" && (
              <p className="px-2 py-3 text-xs text-fail">{error}</p>
            )}
            {state !== "error" && deprecatedResults.length === 0 && (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                {state === "loading" ? "Checking requirements.txt for deprecated packages…" : "No deprecated packages currently in use."}
              </p>
            )}
            {deprecatedResults.map((r) => (
              <div key={r.package} className="rounded-md px-2 py-1.5 text-xs hover:bg-panel-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-foreground">{r.package}</span>
                  <span className="font-mono text-faint">{r.currentVersion}</span>
                </div>
                <p className="mt-1 rounded bg-fail/10 px-1.5 py-1 text-[11px] text-fail" title={r.deprecationNote ?? undefined}>
                  ⚠ DEPRECATED{r.deprecationNote ? ` — ${r.deprecationNote}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
