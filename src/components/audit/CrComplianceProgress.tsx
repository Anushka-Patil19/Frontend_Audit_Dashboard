import { CheckCircle2, XCircle, Circle, Undo2 } from "lucide-react";
import type { CrGateStatus, GateState, CrComplianceResult } from "@/lib/api-client";
import { Mono } from "./atoms";

const GATE_ORDER: { key: keyof CrGateStatus; label: string }[] = [
  { key: "jira", label: "Jira Approval" },
  { key: "branch", label: "GitHub Branch" },
  { key: "pr", label: "PR Merged" },
];

function GateIcon({ state }: { state: GateState }) {
  if (state === "passed") return <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" />;
  if (state === "failed") return <XCircle className="h-4 w-4 shrink-0 text-fail" />;
  return <Circle className="h-4 w-4 shrink-0 text-faint" />;
}

// Unlike CP10's blocking gate stepper, Jira and GitHub are checked in
// parallel here (see backend/app/services/cr_compliance_verify.py) — a "failed" row means that
// side's own condition wasn't met, not that a later check got skipped, so
// there's no "— stopped here" note.
export function CrComplianceProgress({
  gates,
  result,
  onUndo,
}: {
  gates: CrGateStatus;
  result?: CrComplianceResult | null;
  onUndo: () => void;
}) {
  const anyResolved = GATE_ORDER.some(({ key }) => gates[key] !== "pending");

  return (
    <div className="rounded-lg border border-border bg-panel-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium text-muted-foreground">
          CR compliance{result ? ` — ${result.jira_ticket}` : ""}
        </p>
        {anyResolved && (
          <button
            onClick={onUndo}
            className="inline-flex items-center gap-1 text-[11px] text-faint underline decoration-dotted hover:text-foreground"
          >
            <Undo2 className="h-3 w-3" /> Undo
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-col items-start">
        {GATE_ORDER.map(({ key, label }, i) => (
          <div key={key} className="flex w-full items-stretch gap-2">
            <div className="flex flex-col items-center">
              <GateIcon state={gates[key]} />
              {i < GATE_ORDER.length - 1 && <div className="my-0.5 h-5 w-px bg-border" />}
            </div>
            <span className={`pb-3 text-xs ${gates[key] === "pending" ? "text-faint" : "text-foreground"}`}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {result && (
        <div className="space-y-1 border-t border-border pt-2 text-xs">
          <p className="text-muted-foreground">
            Jira status <Mono className="text-foreground">{result.jira_status}</Mono>
          </p>
          {result.pr_number != null && (
            <p className="text-muted-foreground">
              PR #{result.pr_number} ·{" "}
              {result.pr_merged ? `merged by ${result.pr_merged_by ?? "unknown"}` : result.pr_state}
            </p>
          )}
          {result.required_merger && (
            <p className={result.merger_matches ? "text-ok" : "text-fail"}>
              Requires @{result.required_merger}
              {result.pr_merged ? (result.merger_matches ? " — matched" : " — mismatch") : ""}
            </p>
          )}
          {result.pr_url && (
            <a
              href={result.pr_url}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-primary hover:underline"
            >
              View pull request
            </a>
          )}
        </div>
      )}
    </div>
  );
}
