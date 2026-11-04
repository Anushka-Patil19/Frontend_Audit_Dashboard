import { CheckCircle2, XCircle, Circle, Undo2 } from "lucide-react";
import type { Cp6Result, GateState } from "@/lib/api-client";
import { Mono } from "./atoms";

function GateIcon({ state }: { state: GateState }) {
  if (state === "passed") return <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" />;
  if (state === "failed") return <XCircle className="h-4 w-4 shrink-0 text-fail" />;
  return <Circle className="h-4 w-4 shrink-0 text-faint" />;
}

// CP6 stepper: the change's CR ticket is found in Jira, then its status must be
// Approved. Both steps ticked = complete; a non-approved status is a cross.
export function Cp6Progress({ result, onUndo }: { result: Cp6Result | null; onUndo: () => void }) {
  const approved = result?.outcome_id === "CP6-C";
  const steps: { label: string; state: GateState }[] = [
    { label: result ? `CR ticket ${result.jira_ticket} found in Jira` : "CR ticket found in Jira", state: result ? "passed" : "pending" },
    { label: "Jira status Approved", state: !result ? "pending" : approved ? "passed" : "failed" },
  ];
  const done = steps.filter((s) => s.state === "passed").length;

  return (
    <div className="rounded-lg border border-border bg-panel-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium text-muted-foreground">
          Approved CR check{result ? ` — ${result.jira_ticket}` : ""}
        </p>
        {result && (
          <button
            onClick={onUndo}
            className="inline-flex items-center gap-1 text-[11px] text-faint underline decoration-dotted hover:text-foreground"
          >
            <Undo2 className="h-3 w-3" /> Undo
          </button>
        )}
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full transition-all ${result && !approved ? "bg-fail" : "bg-ok"}`}
          style={{ width: `${(done / steps.length) * 100}%` }}
        />
      </div>
      <p className="mt-1 text-[10px] text-faint">
        {!result ? "Not checked yet" : approved ? "Completed" : "Blocked — CR not approved"}
      </p>

      <div className="mt-2 flex flex-col items-start">
        {steps.map((s, i) => (
          <div key={s.label} className="flex w-full items-stretch gap-2">
            <div className="flex flex-col items-center">
              <GateIcon state={s.state} />
              {i < steps.length - 1 && <div className="my-0.5 h-5 w-px bg-border" />}
            </div>
            <span className={`pb-3 text-xs ${s.state === "pending" ? "text-faint" : "text-foreground"}`}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {result && (
        <div className="space-y-1 border-t border-border pt-2 text-xs">
          <p className="text-muted-foreground">
            Jira status <Mono className={approved ? "text-ok" : "text-fail"}>{result.jira_status}</Mono>
          </p>
          <a href={result.jira_url} target="_blank" rel="noreferrer" className="inline-block text-primary hover:underline">
            Open {result.jira_ticket} in Jira
          </a>
        </div>
      )}
    </div>
  );
}
