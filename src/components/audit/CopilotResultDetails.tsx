import { CheckCircle2, Clock, XCircle } from "lucide-react";
import type {
  Cp20Result,
  Cp10Result,
  Cp38Result,
  Cp40Result,
  Cp6Result,
  CrComplianceResult,
} from "@/lib/api-client";
import { EvidenceScreenshot, Mono } from "./atoms";
import { Cp20Flows } from "./GithubTrace";

// Outcome badges + evidence for a copilot answer. Shared by the copilot chat
// bubbles and the Simulate panel in the Dependency alerts dropdown.
export function CopilotResultDetails({
  cp38Result,
  cp10Result,
  crResult,
  cp6Result,
  cp40Result,
  cp20Result,
}: {
  cp38Result?: Cp38Result | null | undefined;
  cp10Result?: Cp10Result | null | undefined;
  crResult?: CrComplianceResult | null | undefined;
  cp6Result?: Cp6Result | null | undefined;
  cp40Result?: Cp40Result | null | undefined;
  cp20Result?: Cp20Result | null | undefined;
}) {
  const m = { cp38Result, cp10Result, crResult, cp6Result, cp40Result, cp20Result };
  const cp20Badge = m.cp20Result
    ? {
        "CP20-C": { cls: "text-emerald-600", Icon: CheckCircle2, label: "CP20-Compliant" },
        "CP20-CE": { cls: "text-emerald-600", Icon: CheckCircle2, label: "CP20-Compliant with exception" },
        "CP20-OBS": { cls: "text-amber-600", Icon: Clock, label: "CP20-Observation" },
        "CP20-NC": { cls: "text-red-600", Icon: XCircle, label: "CP20-Non-Compliant" },
        "CP20-NE": { cls: "text-neutral-500", Icon: Clock, label: "CP20-Not evidenced" },
      }[m.cp20Result.outcome_id]
    : null;
  return (
    <>
      {m.cp20Result && cp20Badge && (
        <div className="mt-3 border-t border-neutral-200 pt-2.5 text-[11px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 font-medium ${cp20Badge.cls}`}>
              <cp20Badge.Icon className="h-3.5 w-3.5" /> {cp20Badge.label}
            </span>
            <Mono className="text-neutral-500">{m.cp20Result.repo}</Mono>
            <Mono className="text-neutral-500">
              {m.cp20Result.commits.filter((c) => c.pr_number).length}/{m.cp20Result.commits.length} commits via PR
            </Mono>
          </div>
          {/* Same flows as the GitHub tracking page: branch rule, each PR's trace, each direct push. */}
          <div className="mt-2">
            <Cp20Flows result={m.cp20Result} compact />
          </div>
          {/* Evidence image only for a passing result, like the other checks. */}
          {(m.cp20Result.outcome_id === "CP20-C" || m.cp20Result.outcome_id === "CP20-CE") &&
            m.cp20Result.evidence_screenshot && (
            <EvidenceScreenshot
              fileName={m.cp20Result.evidence_screenshot}
              source="cp20"
              label="View pull request rule evidence"
              alt={`Pull request rule check for ${m.cp20Result.repo}`}
            />
          )}
        </div>
      )}

      {m.cp40Result && (
        <div className="mt-3 border-t border-neutral-200 pt-2.5 text-[11px]">
          <div className="flex flex-wrap items-center gap-2">
            {m.cp40Result.outcome_id === "CP40-C" && (
              <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> CP40-Compliant
              </span>
            )}
            {m.cp40Result.outcome_id === "CP40-NC" && (
              <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                <XCircle className="h-3.5 w-3.5" /> CP40-Non-Compliant
              </span>
            )}
            {m.cp40Result.outcome_id === "CP40-Pending" && (
              <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                <Clock className="h-3.5 w-3.5" /> CP40-Pending
              </span>
            )}
            {m.cp40Result.outcome_id === "CP40-Manual" && (
              <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                <Clock className="h-3.5 w-3.5" /> CP40-Manual check
              </span>
            )}
            <Mono className="text-neutral-500">
              {m.cp40Result.jira_ticket} · {m.cp40Result.jira_status}
            </Mono>
            {m.cp40Result.attachment_name && (
              <Mono className="text-neutral-500">file {m.cp40Result.attachment_name}</Mono>
            )}
            {m.cp40Result.llm_confidence != null && (
              <Mono className="text-neutral-500">conf. {m.cp40Result.llm_confidence}%</Mono>
            )}
          </div>
          {m.cp40Result.evidence_screenshot && (
            <EvidenceScreenshot
              fileName={m.cp40Result.evidence_screenshot}
              source="cp40"
              label="View Jira approval screenshot"
              alt={`Screenshot of ${m.cp40Result.jira_ticket} approved in Jira`}
            />
          )}
        </div>
      )}

      {m.cp6Result && (
        <div className="mt-3 border-t border-neutral-200 pt-2.5 text-[11px]">
          <div className="flex flex-wrap items-center gap-2">
            {m.cp6Result.outcome_id === "CP6-C" ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> CP6-Compliant
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                <XCircle className="h-3.5 w-3.5" /> CP6-Non-Compliant
              </span>
            )}
            <Mono className="text-neutral-500">
              {m.cp6Result.jira_ticket} · {m.cp6Result.jira_status}
            </Mono>
          </div>
          {m.cp6Result.evidence_screenshot && (
            <EvidenceScreenshot
              fileName={m.cp6Result.evidence_screenshot}
              source="cp6"
              label="View Jira approval screenshot"
              alt={`Screenshot of ${m.cp6Result.jira_ticket} with status ${m.cp6Result.jira_status} in Jira`}
            />
          )}
        </div>
      )}

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
          </div>
          {/* Two separate checks: the Jira approval (as it stood when the PR was
              merged) and who merged the PR. */}
          <div className="mt-1.5 space-y-0.5">
            {m.crResult.pr_merged ? (
              <p className={m.crResult.jira_approved_at_merge ? "text-emerald-600" : "text-red-600"}>
                {m.crResult.jira_approved_at_merge ? "✓" : "✗"} Jira approval:{" "}
                {m.crResult.jira_approved_at_merge
                  ? `approved by ${m.crResult.jira_approved_by ?? "unknown"} before the merge`
                  : `not approved when merged (was "${m.crResult.jira_status_at_merge}")`}
                {m.crResult.approval_withdrawn_after_merge && (
                  <span className="text-amber-600"> · now "{m.crResult.jira_status}" (changed after the merge)</span>
                )}
              </p>
            ) : (
              <p className={m.crResult.jira_approved ? "text-emerald-600" : "text-neutral-500"}>
                {m.crResult.jira_approved ? "✓" : "○"} Jira approval: status "{m.crResult.jira_status}"
              </p>
            )}
            {m.crResult.pr_number != null && (
              <p
                className={
                  !m.crResult.pr_merged ? "text-neutral-500" : m.crResult.merger_matches ? "text-emerald-600" : "text-red-600"
                }
              >
                {!m.crResult.pr_merged ? "○" : m.crResult.merger_matches ? "✓" : "✗"} PR merge: PR #{m.crResult.pr_number}{" "}
                {m.crResult.pr_merged ? `merged by ${m.crResult.pr_merged_by ?? "unknown"}` : m.crResult.pr_state}
                {m.crResult.required_merger &&
                  (m.crResult.pr_merged
                    ? m.crResult.merger_matches
                      ? ` — matches required @${m.crResult.required_merger}`
                      : ` — ticket requires @${m.crResult.required_merger}`
                    : ` — must be merged by @${m.crResult.required_merger}`)}
              </p>
            )}
          </div>
          {m.crResult.pr_url && (
            <a
              href={m.crResult.pr_url}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 block text-primary hover:underline"
            >
              View pull request
            </a>
          )}
          {/* Screenshot evidence only for a Compliant result. */}
          {m.crResult.outcome_id === "CR-C" && m.crResult.evidence_screenshot && (
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
