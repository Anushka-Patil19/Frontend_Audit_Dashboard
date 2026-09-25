import { useState } from "react";
import { ChevronRight, FileCode2, CircleCheck, CircleX } from "lucide-react";
import type { AutomatedCheckpoint, AutoStatus } from "@/lib/audit-data";
import { statusTone } from "@/lib/audit-data";
import { useAudit } from "@/lib/audit-store";
import { EvidenceScreenshot, HistoryStrip, Mono, SourceBadge, StatusPill, tone } from "./atoms";
import { Cp10VerticalProgress } from "./Cp10VerticalProgress";
import { CrComplianceProgress } from "./CrComplianceProgress";
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
  const { cp10Gates, cp10Result, undoCp10Gate, crGates, crResult, undoCrVerification } = useAudit();
  const t = tone[statusTone[cp.status]];
  const isCp10 = cp.id === "cp-10";
  const isCr = cp.id === "cp-18";
  const isCp16 = cp.id === "cp-16";

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
                Owner Role: <span className="font-mono font-medium text-foreground">{cp.ownerRole}</span>
              </span>
            )}
            {cp.auditEvidence && (
              <span className="text-faint">
                Audit Evidence: <span className="font-mono font-medium text-primary">{cp.auditEvidence}</span>
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
              {isCp10 && cp10Result?.evidence_screenshot ? (
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

          {isCp10 && (
            <Cp10VerticalProgress gates={cp10Gates} result={cp10Result} onUndo={() => undoCp10Gate(cp.id)} />
          )}

          {isCr && (
            <CrComplianceProgress gates={crGates} result={crResult} onUndo={() => undoCrVerification(cp.id)} />
          )}

          <div className="border border-border bg-panel-2 px-3 py-2.5">
            <p className="mb-1.5 text-[11px] text-faint">Approval authorization</p>
            {cp.approver ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>{cp.approver.name}</span>
                <Mono className="text-faint">{cp.approver.role}</Mono>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs ${cp.approver.valid ? "text-ok" : "text-fail"}`}
                >
                  {cp.approver.valid ? (
                    <CircleCheck className="h-3.5 w-3.5" />
                  ) : (
                    <CircleX className="h-3.5 w-3.5" />
                  )}
                  {cp.approver.note}
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
