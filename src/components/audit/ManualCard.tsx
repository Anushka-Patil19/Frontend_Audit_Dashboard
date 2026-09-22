import { useState } from "react";
import { ChevronRight, FolderClosed, Lock, Check, MessageSquare, Mail } from "lucide-react";
import type { ManualCheckpoint } from "@/lib/audit-data";
import { statusLabel } from "@/lib/audit-data";
import { HistoryStrip, Mono } from "./atoms";

type Props = {
  cp: ManualCheckpoint;
  onStepDone: (id: string, stepIndex: number) => void;
  onStepUndo: (id: string, stepIndex: number) => void;
  onComment: (id: string, text: string) => void;
};

export function ManualCard({ cp, onStepDone, onStepUndo, onComment }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const done = cp.steps.filter((s) => s.state === "done").length;
  const activeIndex = cp.steps.findIndex((s) => s.state === "pending");
  const lastDoneIndex = (activeIndex === -1 ? cp.steps.length : activeIndex) - 1;

  return (
    <div className="border-l-2 border-l-manual bg-panel">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-4 px-4 py-5 text-left transition-colors hover:bg-panel-2"
      >
        <ChevronRight
          className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-faint transition-transform ${open ? "rotate-90" : ""}`}
        />
        <FolderClosed className="mt-0.5 h-4 w-4 shrink-0 text-manual" strokeWidth={1.75} />
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-manual">{statusLabel[cp.status]}</span>
            <Mono className="text-faint">{cp.ref}</Mono>
            <span className="text-sm font-medium text-foreground">{cp.name}</span>
            {cp.projectName && (
              <span
                className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-mono font-semibold ${
                  cp.projectId === "project-a"
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : cp.projectId === "project-b"
                    ? "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {cp.projectName}
              </span>
            )}
            {cp.auditEvidence && (
              <span className="rounded border border-border bg-panel-2 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {cp.auditEvidence}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {cp.steps.map((s, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-10 ${s.state === "done" ? "bg-manual" : "bg-accent"}`}
                />
              ))}
            </div>
            <Mono className="text-faint">
              {done} of {cp.steps.length} steps
            </Mono>
          </div>
        </div>
        <span className="shrink-0 border border-manual/40 px-2 py-0.5 text-[11px] text-manual">
          Owner: {cp.ownerRole || cp.waitingOn}
        </span>
        {cp.ownerEmail && (
          <span className="inline-flex shrink-0 items-center gap-1 border border-border bg-panel-2 px-2 py-0.5 text-[11px] text-muted-foreground">
            <Mail className="h-3 w-3" /> {cp.ownerEmail}
          </span>
        )}
        <span className="shrink-0 border border-border bg-panel-2 px-2 py-0.5 text-[11px] text-muted-foreground">
          {cp.category}
        </span>
      </button>

      {open && (
        <div className="space-y-5 border-t border-border px-4 py-4 pl-11">
          <ol className="space-y-0">
            {cp.steps.map((s, i) => {
              const locked = s.state === "locked";
              return (
                <li key={i} className="flex gap-3 py-2.5">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-mono ${
                      s.state === "done"
                        ? "border-manual bg-manual/15 text-manual"
                        : s.state === "pending"
                          ? "border-warn text-warn"
                          : "border-border text-faint"
                    }`}
                  >
                    {s.state === "done" ? (
                      <Check className="h-3 w-3" />
                    ) : locked ? (
                      <Lock className="h-2.5 w-2.5" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <div className={`min-w-0 flex-1 ${locked ? "opacity-40" : ""}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm">{s.name}</span>
                      <Mono className="text-faint">{s.role}</Mono>
                      {s.ownerEmail && (
                        <span className="inline-flex items-center gap-1 border border-border bg-panel-2 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          <Mail className="h-2.5 w-2.5" /> {s.ownerEmail}
                        </span>
                      )}
                      <span
                        className={`text-[11px] ${
                          s.state === "done"
                            ? "text-manual"
                            : s.state === "pending"
                              ? "text-warn"
                              : "text-faint"
                        }`}
                      >
                        {s.state === "done" ? "done" : s.state === "pending" ? "pending" : "locked"}
                      </span>
                    </div>
                    {s.state === "done" && (
                      <div className="mt-0.5 flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">
                          {s.completedBy} · <Mono className="text-faint">{s.completedAt}</Mono>
                        </p>
                        {i === lastDoneIndex && (
                          <button
                            onClick={() => onStepUndo(cp.id, i)}
                            className="text-[11px] text-faint underline decoration-dotted hover:text-foreground"
                          >
                            Undo
                          </button>
                        )}
                      </div>
                    )}
                    {s.state === "pending" && i === activeIndex && (
                      <button
                        onClick={() => onStepDone(cp.id, i)}
                        className="mt-2 border border-manual/50 px-3 py-1 text-xs text-manual transition-colors hover:bg-manual/10"
                      >
                        Mark done
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="border-t border-border pt-3">
            <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] text-faint">
              <MessageSquare className="h-3 w-3" /> Comments ({cp.comments.length})
            </p>
            <ul className="space-y-2.5">
              {cp.comments.map((c, i) => (
                <li key={i} className="text-xs">
                  <span className="text-foreground">{c.author}</span>{" "}
                  <Mono className="text-faint">{c.at}</Mono>
                  <p className="mt-0.5 text-muted-foreground">{c.text}</p>
                </li>
              ))}
              {cp.comments.length === 0 && <li className="text-xs text-faint">No comments yet.</li>}
            </ul>
            <div className="mt-3 flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Add comment"
                className="min-w-56 flex-1 border border-border bg-panel-2 px-2 py-1.5 text-xs outline-none placeholder:text-faint focus:border-ring"
              />
              <button
                disabled={!draft.trim()}
                onClick={() => {
                  onComment(cp.id, draft.trim());
                  setDraft("");
                }}
                className="border border-border bg-panel-2 px-3 py-1.5 text-xs disabled:opacity-40"
              >
                Post
              </button>
            </div>
          </div>

          <HistoryStrip items={cp.history} />
        </div>
      )}
    </div>
  );
}
