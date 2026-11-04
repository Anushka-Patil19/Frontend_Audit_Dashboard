import { useState } from "react";
import { ChevronRight, FileCode2, CircleCheck, CircleX } from "lucide-react";
import type { AutomatedCheckpoint, AutoStatus } from "@/lib/audit-data";
import { baseCheckpointId, getCheckpointProjectId, statusTone } from "@/lib/audit-data";
import { useAudit } from "@/lib/audit-store";
import { useEscalations } from "@/lib/escalation-store";
import { EvidenceScreenshot, HistoryStrip, Mono, SourceBadge, StatusPill, tone } from "./atoms";
import { EscalationEvidenceScreenshot } from "./EscalationEvidenceScreenshot";
import { Cp10VerticalProgress } from "./Cp10VerticalProgress";
import { CrComplianceProgress } from "./CrComplianceProgress";
import { Cp6Progress } from "./Cp6Progress";
import { Cp40Progress } from "./Cp40Progress";
import { Cp20Progress } from "./Cp20Progress";
import { DependencyEvidence } from "./DependencyEvidence";

type Props = {
  cp: AutomatedCheckpoint;
  onResolve: (id: string, next: AutoStatus, action: string, reason: string) => void;
};

const actions: { key: string; label: string; next: AutoStatus }[] = [
  { key: "approve", label: "Approve", next: "compliant" },
  { key: "reject", label: "Reject", next: "non-compliant" },
  { key: "override", label: "Override", next: "compliant" },
];

export function AutomatedCard({ cp, onResolve }: Props) {
  const [open, setOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const {
    cp10Gates,
    cp10Result,
    undoCp10Gate,
    crGates,
    crResult,
    undoCrVerification,
    cp6Result,
    undoCp6Verification,
    cp40Gates,
    cp40Result,
    undoCp40Verification,
    cp20Gates,
    cp20Result,
    undoCp20Verification,
  } = useAudit();
  const { items: escalationItems } = useEscalations();
  const t = tone[statusTone[cp.status]];
  const isCp6 = cp.id === "cp-6";
  const isCp20 = cp.id === "cp-20";
  const isCp40 = cp.id === "cp-40";
  const isCp10 = cp.id === "cp-10";
  // Once CP6 has been checked against Jira, the approval box shows that result
  // instead of the static seed approver.
  const cp20Merge = cp20Result?.commits.find((c) => c.pr_number);
  const approver =
    isCp20 && cp20Result
      ? {
          name: cp20Merge?.merged_by ?? "No merged PR",
          role: cp20Merge ? `merged PR #${cp20Merge.pr_number}` : cp20Result.repo,
          valid: cp20Result.outcome_id === "CP20-C" || cp20Result.outcome_id === "CP20-CE",
          note:
            cp20Result.findings.find((f) => f.level !== "info" && f.level !== "exception")?.text ??
            "Every change reached the protected branches through a merged pull request",
        }
      : isCp40 && cp40Result
      ? {
          name: cp40Result.approver_name ?? "Not found",
          role: cp40Result.jira_ticket,
          valid: cp40Result.outcome_id === "CP40-C",
          note:
            cp40Result.outcome_id === "CP40-C"
              ? "Approved in Jira and confirmed by the attached approval email"
              : (cp40Result.reasons[0] ?? "Not verified"),
        }
      : isCp6 && cp6Result
      ? {
          name: cp6Result.jira_reporter ?? "Jira",
          role: cp6Result.jira_ticket,
          valid: cp6Result.outcome_id === "CP6-C",
          note:
            cp6Result.outcome_id === "CP6-C"
              ? `CR approved in Jira (${cp6Result.jira_status})`
              : `CR not approved — Jira status is ${cp6Result.jira_status}`,
        }
      : cp.approver;
  const isCr = cp.id === "cp-18";
  const isCp16 = cp.id === "cp-16";
  const approvalEvidence = escalationItems.find(
    (item) =>
      item.projectId === (cp.projectId ?? getCheckpointProjectId(cp.id)) &&
      // Escalation items name the checklist item ("cp-25") plus a project; match any project's copy.
      item.checkpointId === baseCheckpointId(cp.id) &&
      item.status === "compliant" &&
      item.approval?.evidenceFile,
  )?.approval;

  return (
    <div className={`border-l-2 ${t.border} bg-panel`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-panel-2"
      >
        <ChevronRight
          className={`h-3.5 w-3.5 shrink-0 text-faint transition-transform ${open ? "rotate-90" : ""}`}
        />
        <span className="w-40 shrink-0">
          <StatusPill status={cp.status} />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">
          <Mono className="mr-2 text-faint">{cp.ref}</Mono>
          <span className="font-medium text-foreground">{cp.name}</span>
          {cp.projectName && (
            <span
              className={`ml-2 inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-mono font-semibold ${
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
            <span className="ml-2 hidden rounded border border-border bg-panel-2 px-1.5 py-0.5 text-[10px] text-muted-foreground lg:inline-block">
              {cp.auditEvidence}
            </span>
          )}
        </span>
        {cp.ownerRole && (
          <span className="hidden rounded bg-primary-soft/60 px-2 py-0.5 text-[11px] text-primary xl:inline-block">
            {cp.ownerRole}
          </span>
        )}
        <SourceBadge sources={cp.sources} label={cp.sourceLabel} />
        <Mono className="w-14 text-right text-muted-foreground">{cp.confidence}%</Mono>
        <Mono className="w-32 text-right text-faint">synced {cp.syncedMinutesAgo}m ago</Mono>
        <span
          className={`w-12 shrink-0 text-right text-[11px] ${cp.stale ? "text-warn" : "text-ok"}`}
        >
          {cp.stale ? "stale" : "fresh"}
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-border px-4 py-4 pl-11">
          <p className="text-sm text-muted-foreground">{cp.detail}</p>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            {cp.ownerRole && (
              <span className="text-faint">
                Owner Role:{" "}
                <span className="font-mono font-medium text-foreground">{cp.ownerRole}</span>
              </span>
            )}
            {cp.auditEvidence && (
              <span className="text-faint">
                Audit Evidence:{" "}
                <span className="font-mono font-medium text-primary">{cp.auditEvidence}</span>
              </span>
            )}
            <span className="text-faint">
              Entity checked <Mono className="ml-1 text-foreground">{cp.entity}</Mono>
            </span>
            <button
              onClick={() => setEvidenceOpen((e) => !e)}
              className="inline-flex items-center gap-1.5 text-xs text-manual hover:underline"
            >
              <FileCode2 className="h-3.5 w-3.5" />
              {evidenceOpen ? "Hide evidence" : "View evidence"}
            </button>
          </div>

          {evidenceOpen && (
            <div className="border border-border bg-panel-2">
              {/* For CP6, Jira is the source of truth: once checked, its result wins over
                  any escalation approval record, so a non-approved CR shows no screenshot. */}
              {isCp20 && cp20Result ? (
                <>
                  <div className="border-b border-border px-3 py-1.5">
                    <Mono className="text-faint">
                      {cp20Result.evidence_file ?? "PR rule evidence"} · SHA-256{" "}
                      {cp20Result.evidence_hash?.slice(0, 16)}…
                    </Mono>
                  </div>
                  <div className="px-3 py-3">
                    {(cp20Result.outcome_id === "CP20-C" || cp20Result.outcome_id === "CP20-CE") &&
                    cp20Result.evidence_screenshot ? (
                      <EvidenceScreenshot
                        fileName={cp20Result.evidence_screenshot}
                        source="cp20"
                        label="View pull request rule evidence"
                        alt={`Pull request rule check for ${cp20Result.repo}`}
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No evidence image — the PR rule isn't met yet. The flows below show what failed; every run is still
                        recorded in {cp20Result.hash_log_file ?? "the hash log"}.
                      </p>
                    )}
                  </div>
                </>
              ) : isCp40 && cp40Result ? (
                <>
                  <div className="border-b border-border px-3 py-1.5">
                    <Mono className="text-faint">
                      {cp40Result.jira_ticket} production approval —{" "}
                      {cp40Result.outcome_id === "CP40-C" ? "Compliant" : "no evidence yet"}
                    </Mono>
                  </div>
                  <div className="space-y-1 px-3 py-3 text-xs">
                    {cp40Result.outcome_id === "CP40-C" ? (
                      <>
                        <p className="text-muted-foreground">
                          Stored file <Mono className="text-foreground">{cp40Result.evidence_file}</Mono>
                        </p>
                        <p className="text-muted-foreground">
                          SHA-256{" "}
                          <Mono className="break-all text-faint">{cp40Result.attachment_sha256}</Mono>
                        </p>
                        {cp40Result.evidence_screenshot && (
                          <EvidenceScreenshot
                            fileName={cp40Result.evidence_screenshot}
                            source="cp40"
                            label="View Jira approval screenshot"
                            alt={`Screenshot of ${cp40Result.jira_ticket} approved in Jira`}
                          />
                        )}
                      </>
                    ) : (
                      <p className="text-muted-foreground">
                        No evidence — the production approval isn't proven yet. See the check below.
                      </p>
                    )}
                  </div>
                </>
              ) : isCp6 && cp6Result ? (
                <>
                  <div className="border-b border-border px-3 py-1.5">
                    <Mono className="text-faint">
                      {cp6Result.jira_ticket} Jira status — {cp6Result.jira_status}
                    </Mono>
                  </div>
                  <div className="px-3 py-3">
                    {cp6Result.evidence_screenshot ? (
                      <EvidenceScreenshot
                        fileName={cp6Result.evidence_screenshot}
                        source="cp6"
                        label="View Jira approval screenshot"
                        alt={`Screenshot of ${cp6Result.jira_ticket} with status ${cp6Result.jira_status} in Jira`}
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No evidence — the CR isn't approved in Jira yet.
                      </p>
                    )}
                  </div>
                </>
              ) : approvalEvidence?.evidenceFile ? (
                <div className="px-3 py-3">
                  <EscalationEvidenceScreenshot
                    fileName={approvalEvidence.evidenceFile}
                    alt={`Manager approval evidence for ${approvalEvidence.projectName}, ${approvalEvidence.checkpointRef} ${approvalEvidence.checkpointName}`}
                  />
                </div>
              ) : isCp10 && cp10Result?.evidence_screenshot ? (
                <>
                  <div className="border-b border-border px-3 py-1.5">
                    <Mono className="text-faint">Approved CAB email — screenshot</Mono>
                  </div>
                  <div className="px-3 py-3">
                    <EvidenceScreenshot fileName={cp10Result.evidence_screenshot} source="cp10" />
                  </div>
                </>
              ) : isCp16 ? (
                <DependencyEvidence />
              ) : cp.evidenceImage ? (
                <>
                  <div className="border-b border-border px-3 py-1.5">
                    <Mono className="text-faint">{cp.evidenceFile}</Mono>
                  </div>
                  <div className="px-3 py-3">
                    <img
                      src={cp.evidenceImage}
                      alt="Dependency version monitoring notification"
                      className="max-h-96 w-full rounded border border-border object-contain object-left-top"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="border-b border-border px-3 py-1.5">
                    <Mono className="text-faint">{cp.evidenceFile}</Mono>
                  </div>
                  <pre className="overflow-x-auto px-3 py-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                    {cp.evidence}
                  </pre>
                </>
              )}
            </div>
          )}

          {isCp6 && <Cp6Progress result={cp6Result} onUndo={() => undoCp6Verification(cp.id)} />}

          {isCp20 && (
            <Cp20Progress
              gates={cp20Gates}
              result={cp20Result}
              onUndo={() => undoCp20Verification(cp.id)}
            />
          )}

          {isCp40 && (
            <Cp40Progress
              gates={cp40Gates}
              result={cp40Result}
              onUndo={() => undoCp40Verification(cp.id)}
            />
          )}

          {isCp10 && (
            <Cp10VerticalProgress
              gates={cp10Gates}
              result={cp10Result}
              onUndo={() => undoCp10Gate(cp.id)}
            />
          )}

          {isCr && (
            <CrComplianceProgress
              gates={crGates}
              result={crResult}
              onUndo={() => undoCrVerification(cp.id)}
            />
          )}

          <div className="border border-border bg-panel-2 px-3 py-2.5">
            <p className="mb-1.5 text-[11px] text-faint">Approval authorization</p>
            {approver ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>{approver.name}</span>
                <Mono className="text-faint">{approver.role}</Mono>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs ${approver.valid ? "text-ok" : "text-fail"}`}
                >
                  {approver.valid ? (
                    <CircleCheck className="h-3.5 w-3.5" />
                  ) : (
                    <CircleX className="h-3.5 w-3.5" />
                  )}
                  {approver.note}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No approver required — system configuration check.
              </p>
            )}
          </div>

          {cp.status === "needs-review" && (
            <div className="border border-warn/40 bg-warn/5 px-3 py-3">
              <p className="mb-2 text-xs text-warn">
                Human decision required — record a reason with your action.
              </p>
              <div className="flex flex-wrap gap-2">
                {actions.map((a) => (
                  <button
                    key={a.key}
                    onClick={() => {
                      setAction(a.key);
                      setReason("");
                    }}
                    className={`border px-3 py-1 text-xs transition-colors ${
                      action === a.key
                        ? "border-foreground text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              {action && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason (required)"
                    className="min-w-56 flex-1 border border-border bg-panel px-2 py-1.5 text-xs outline-none placeholder:text-faint focus:border-ring"
                  />
                  <button
                    disabled={!reason.trim()}
                    onClick={() => {
                      const a = actions.find((x) => x.key === action)!;
                      onResolve(cp.id, a.next, a.label, reason.trim());
                      setAction(null);
                      setReason("");
                    }}
                    className="border border-border bg-panel-2 px-3 py-1.5 text-xs text-foreground disabled:opacity-40"
                  >
                    Submit {actions.find((x) => x.key === action)!.label.toLowerCase()}
                  </button>
                </div>
              )}
            </div>
          )}

          <HistoryStrip items={cp.history} />
        </div>
      )}
    </div>
  );
}
