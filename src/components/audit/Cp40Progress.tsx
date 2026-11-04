import { CheckCircle2, XCircle, Circle, Undo2 } from "lucide-react";
import type { Cp40GateStatus, Cp40Result, GateState } from "@/lib/api-client";
import { Mono } from "./atoms";

const GATE_ORDER: { key: keyof Cp40GateStatus; label: string }[] = [
  { key: "ticket", label: "Ticket approved in Jira" },
  { key: "approver", label: "Approved by an authorised person" },
  { key: "attachment", label: "Approval email attached by the approver" },
  { key: "content", label: "Email checked — sender, date, subject, approval" },
];

const OUTCOME: Record<Cp40Result["outcome_id"], { label: string; tone: string; bar: string }> = {
  "CP40-C": { label: "Completed — Compliant", tone: "text-ok", bar: "bg-ok" },
  "CP40-Pending": { label: "Pending — waiting on the team", tone: "text-warn", bar: "bg-warn" },
  "CP40-NC": { label: "Non-compliant — a rule failed", tone: "text-fail", bar: "bg-fail" },
  "CP40-Manual": { label: "Manual check — a person must read the file", tone: "text-warn", bar: "bg-warn" },
};

function GateIcon({ state }: { state: GateState }) {
  if (state === "passed") return <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" />;
  if (state === "failed") return <XCircle className="h-4 w-4 shrink-0 text-fail" />;
  return <Circle className="h-4 w-4 shrink-0 text-faint" />;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// CP40 stepper, per Jira_Attachment_Evidence_Check.pdf: ticket approved →
// approver authorised → email attached by that approver → email content checked.
export function Cp40Progress({
  gates,
  result,
  onUndo,
}: {
  gates: Cp40GateStatus;
  result: Cp40Result | null;
  onUndo: () => void;
}) {
  const passed = GATE_ORDER.filter(({ key }) => gates[key] === "passed").length;
  const outcome = result ? OUTCOME[result.outcome_id] : null;

  return (
    <div className="rounded-lg border border-border bg-panel-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium text-muted-foreground">
          Production approval check{result ? ` — ${result.jira_ticket}` : ""}
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
          className={`h-full rounded-full transition-all ${outcome?.bar ?? "bg-ok"}`}
          style={{ width: `${(passed / GATE_ORDER.length) * 100}%` }}
        />
      </div>
      <p className={`mt-1 text-[10px] ${outcome?.tone ?? "text-faint"}`}>
        {outcome ? `${passed}/${GATE_ORDER.length} · ${outcome.label}` : "Not checked yet"}
      </p>

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
        <div className="space-y-1.5 border-t border-border pt-2 text-xs">
          {result.reasons.length > 0 && (
            <ul className={`space-y-0.5 ${outcome?.tone ?? ""}`}>
              {result.reasons.map((r) => (
                <li key={r}>• {r}</li>
              ))}
            </ul>
          )}
          <p className="text-muted-foreground">
            Jira status <Mono className="text-foreground">{result.jira_status}</Mono>
            {result.approver_name && (
              <>
                {" "}· approved by <span className="text-foreground">{result.approver_name}</span>
                {result.approver_email && <Mono className="ml-1 text-faint">{result.approver_email}</Mono>}
              </>
            )}
          </p>
          {result.attachment_name && (
            <p className="text-muted-foreground">
              Attachment <Mono className="text-foreground">{result.attachment_name}</Mono>
              {result.attachment_author && <> · added by {result.attachment_author}</>}
            </p>
          )}
          {result.attachment_sha256 && (
            <p className="text-muted-foreground">
              SHA-256 <Mono className="break-all text-faint">{result.attachment_sha256}</Mono>
            </p>
          )}
          {(result.email_from || result.email_subject) && (
            <div className="rounded border border-border bg-panel px-2 py-1.5">
              <p>
                <span className="text-faint">From</span> {result.email_from ?? "—"}
              </p>
              <p>
                <span className="text-faint">Date</span> {formatDate(result.email_date)}
              </p>
              <p>
                <span className="text-faint">Subject</span> {result.email_subject ?? "—"}
              </p>
              {result.email_excerpt && (
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">“{result.email_excerpt}”</p>
              )}
            </div>
          )}
          {result.llm_approved != null && (
            <p className={result.llm_approved ? "text-ok" : "text-fail"}>
              LLM reading: {result.llm_approved ? "approval" : "not an approval"}
              {result.llm_confidence != null && ` (${result.llm_confidence}%)`}
              {result.llm_reason && <span className="text-muted-foreground"> — {result.llm_reason}</span>}
            </p>
          )}
          <a href={result.jira_url} target="_blank" rel="noreferrer" className="inline-block text-primary hover:underline">
            Open {result.jira_ticket} in Jira
          </a>
        </div>
      )}
    </div>
  );
}
