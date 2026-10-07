import { CheckCircle2, Clock, XCircle } from "lucide-react";
import type { Cp10Result, Cp38Result, CrComplianceResult } from "@/lib/api-client";
import { EvidenceScreenshot, Mono } from "./atoms";

// Outcome badges + evidence for a copilot answer. Shared by the copilot chat
// bubbles and the Simulate panel in the Dependency alerts dropdown.
export function CopilotResultDetails({
  cp38Result,
  cp10Result,
  crResult,
}: {
  cp38Result?: Cp38Result | null | undefined;
  cp10Result?: Cp10Result | null | undefined;
  crResult?: CrComplianceResult | null | undefined;
}) {
  const m = { cp38Result, cp10Result, crResult };
  return (
    <>
      {m.cp38Result && (
        <div className="mt-3 border-t border-neutral-200 pt-2.5 text-[11px]">
          <div className="flex flex-wrap items-center gap-2">
            {m.cp38Result.outcome_id === "CP38-C" ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> CP38-Compliant
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                <Clock className="h-3.5 w-3.5" /> CP38-Pending
                {m.cp38Result.pending_reason ? ` · ${m.cp38Result.pending_reason}` : ""}
              </span>
            )}
            {m.cp38Result.confidence != null && (
              <Mono className="text-neutral-500">conf. {m.cp38Result.confidence}%</Mono>
            )}
            {m.cp38Result.evidence_ref && (
              <Mono className="text-neutral-500">
                ref {m.cp38Result.evidence_ref.slice(0, 10)}…
              </Mono>
            )}
          </div>
          {m.cp38Result.evidence_screenshot && (
            <EvidenceScreenshot
              fileName={m.cp38Result.evidence_screenshot}
              source="cp38"
              label="View sign-off email screenshot"
              alt="Screenshot of the UAT sign-off email"
            />
          )}
        </div>
      )}

      {m.cp10Result && (
        <div className="mt-3 border-t border-neutral-200 pt-2.5 text-[11px]">
          <div className="flex flex-wrap items-center gap-2">
            {m.cp10Result.outcome_id === "CP10-C" ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> CP10-Compliant
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                <Clock className="h-3.5 w-3.5" /> CP10-Pending
                {m.cp10Result.pending_reason ? ` · ${m.cp10Result.pending_reason}` : ""}
              </span>
            )}
            {m.cp10Result.confidence != null && (
              <Mono className="text-neutral-500">conf. {m.cp10Result.confidence}%</Mono>
            )}
            {m.cp10Result.evidence_ref && (
              <Mono className="text-neutral-500">
                ref {m.cp10Result.evidence_ref.slice(0, 10)}…
              </Mono>
            )}
          </div>
          {m.cp10Result.evidence_screenshot && (
            <EvidenceScreenshot
              fileName={m.cp10Result.evidence_screenshot}
              source="cp10"
            />
          )}
        </div>
      )}

      {m.crResult && (
        <div className="mt-3 border-t border-neutral-200 pt-2.5 text-[11px]">
          <div className="flex flex-wrap items-center gap-2">
            {m.crResult.outcome_id === "CR-C" && (
              <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> CR-Compliant
              </span>
            )}
            {m.crResult.outcome_id === "CR-NC" && (
              <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                <XCircle className="h-3.5 w-3.5" /> CR-Non-Compliant
              </span>
            )}
            {m.crResult.outcome_id === "CR-IP" && (
              <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                <Clock className="h-3.5 w-3.5" /> CR-In Progress
              </span>
            )}
            {m.crResult.outcome_id === "CR-Pending" && (
              <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                <Clock className="h-3.5 w-3.5" /> CR-Pending
              </span>
            )}
            {m.crResult.jira_status && (
              <Mono className="text-neutral-500">jira {m.crResult.jira_status}</Mono>
            )}
            {m.crResult.pr_number != null && (
              <Mono className="text-neutral-500">
                PR #{m.crResult.pr_number} ·{" "}
                {m.crResult.pr_merged ? `merged by ${m.crResult.pr_merged_by ?? "unknown"}` : m.crResult.pr_state}
              </Mono>
            )}
            {m.crResult.required_merger && (
              <Mono className={m.crResult.merger_matches ? "text-emerald-600" : "text-red-600"}>
                requires @{m.crResult.required_merger}
                {m.crResult.pr_merged ? (m.crResult.merger_matches ? " ✓" : " ✗") : ""}
              </Mono>
            )}
          </div>
          {m.crResult.pr_url && (
            <a
              href={m.crResult.pr_url}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-block text-primary hover:underline"
            >
              View pull request
            </a>
          )}
          {m.crResult.evidence_screenshot && (
            <EvidenceScreenshot
              fileName={m.crResult.evidence_screenshot}
              source="cr"
              label="View pull request screenshot"
              alt="Screenshot of the pull request on GitHub"
            />
          )}
        </div>
      )}
    </>
  );
}
