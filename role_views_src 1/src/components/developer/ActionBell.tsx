import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LiveTag, SEV } from "@/components/developer/DevKpis";
import type { DeveloperView, Severity } from "@/lib/developer-data";

// The developer's action bar, behind a bell in the header. Badge = things they must act on
// (blocking + due soon); it pulses red while anything is blocking.

const GROUPS: Severity[] = ["blocking", "due", "waiting"];

export function ActionBell({ view }: { view: DeveloperView }) {
  const actionable = view.blocking.length + view.due.length;
  const hasBlocking = view.blocking.length > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Action bar: ${actionable} actions, ${view.blocking.length} blocking`}
          className={`relative grid h-9 w-9 place-items-center rounded-lg border bg-panel shadow-card transition-colors hover:bg-panel-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
            hasBlocking ? "border-fail/40" : "border-border"
          }`}
        >
          <Bell className={`h-4 w-4 ${hasBlocking ? "text-fail" : "text-muted-foreground"}`} strokeWidth={1.9} />
          {actionable > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center">
              {hasBlocking && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fail/50" />}
              <span
                className={`relative inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-mono text-[10px] text-white ${
                  hasBlocking ? "bg-fail" : "bg-warn"
                }`}
              >
                {actionable}
              </span>
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-[min(92vw,460px)] p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <p className="font-serif text-base text-foreground">Action bar</p>
            <p className="text-xs text-muted-foreground">What you need to do on PIT Armour</p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            {GROUPS.map((g) => {
              const n = view.actions.filter((a) => a.severity === g).length;
              return (
                <span key={g} className={`whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[10px] ${SEV[g].bg} ${SEV[g].text}`}>
                  {n} {g === "waiting" ? "waiting" : SEV[g].label.toLowerCase()}
                </span>
              );
            })}
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-4 py-2">
          {view.actions.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">All clear — nothing needs your attention.</p>
          )}
          {GROUPS.map((g) => {
            const items = view.actions.filter((a) => a.severity === g);
            if (!items.length) return null;
            return (
              <div key={g} className="py-2">
                <p className={`mb-1 font-mono text-[10px] uppercase tracking-wide ${SEV[g].text}`}>{SEV[g].label}</p>
                <ul className="divide-y divide-border">
                  {items.map((a) => (
                    <li key={a.id} className="flex items-start gap-3 py-2.5">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: SEV[a.severity].color }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm text-foreground">{a.title}</p>
                          {a.live && <LiveTag />}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{a.process} · {a.change}</p>
                        <p className="mt-1 text-xs text-faint">{a.hint}</p>
                      </div>
                      {a.severity !== "waiting" && (
                        <Link
                          to="/projects"
                          search={{ project: "project-a" }}
                          className="shrink-0 rounded-md border border-border px-2 py-1 text-[11px] text-foreground hover:border-primary/50 hover:bg-panel-2"
                        >
                          Fix
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
