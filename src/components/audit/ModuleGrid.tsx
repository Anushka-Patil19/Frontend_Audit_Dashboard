import { ChevronRight, FolderClosed, Cpu } from "lucide-react";
import type { Checkpoint, Module } from "@/lib/audit-data";
import { checkpointModule } from "@/lib/audit-data";
import { Mono } from "./atoms";

export function moduleStats(checkpoints: Checkpoint[], key: string) {
  const items = checkpoints.filter((c) => checkpointModule[c.id] === key);
  const score = items.reduce((sum, c) => {
    if (c.kind === "automated") return sum + (c.status === "compliant" ? 1 : 0);
    return sum + c.steps.filter((s) => s.state === "done").length / c.steps.length;
  }, 0);
  return {
    items,
    automated: items.filter((c) => c.kind === "automated"),
    manual: items.filter((c) => c.kind === "manual"),
    pct: items.length ? Math.round((score / items.length) * 100) : 0,
    attention: items.filter((c) => c.status === "non-compliant" || c.status === "needs-review")
      .length,
  };
}

export function ModuleGrid({

  modules,
  checkpoints,
  onOpen,
}: {
  modules: Module[];
  checkpoints: Checkpoint[];
  onOpen: (key: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {modules.map((m) => {
        const { items, automated, manual, pct, attention } = moduleStats(checkpoints, m.key);

        return (
          <button
            key={m.key}
            onClick={() => onOpen(m.key)}
            className="group rounded-xl border border-border bg-panel p-5 text-left shadow-card transition-shadow hover:border-primary/40 hover:shadow-panel"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] text-primary">
                {m.kindTag}
              </span>
              {attention > 0 ? (
                <span className="rounded-full bg-fail/10 px-2.5 py-0.5 text-[11px] text-fail">
                  {attention} needs attention
                </span>
              ) : (
                <span className="rounded-full bg-ok/10 px-2.5 py-0.5 text-[11px] text-ok">
                  healthy
                </span>
              )}
              <ChevronRight className="ml-auto h-4 w-4 text-faint transition-transform group-hover:translate-x-0.5" />
            </div>

            <h3 className="mt-4 font-serif text-xl text-foreground">{m.name}</h3>
            <Mono className="mt-1 block text-faint">{m.client}</Mono>
            <p className="mt-2 text-sm text-muted-foreground">{m.description}</p>

            <div className="mt-4 flex items-baseline gap-3">
              <span className="font-mono text-2xl text-foreground">{pct}%</span>
              <Mono className="text-faint">{items.length} checkpoints verified</Mono>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-accent">
              <span className="block h-full rounded-full bg-ok" style={{ width: `${pct}%` }} />
            </div>


            <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-3">
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Cpu className="h-3.5 w-3.5" strokeWidth={1.75} />
                <Mono>{automated.length} automated</Mono>
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-manual">
                <FolderClosed className="h-3.5 w-3.5" strokeWidth={1.75} />
                <Mono>{manual.length} manual</Mono>
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {m.submodules.map((s) => (
                <span
                  key={s}
                  className="border border-border bg-panel-2 px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {s}
                </span>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
