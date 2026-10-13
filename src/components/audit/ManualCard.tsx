import { useState } from "react";
import {
  ChevronRight,
  FolderClosed,
  Lock,
  Check,
  MessageSquare,
  Mail,
  Paperclip,
  Upload,
  X,
} from "lucide-react";
import type { ManualCheckpoint, ManualStep } from "@/lib/audit-data";
import { statusLabel, stepRequiresEvidence } from "@/lib/audit-data";
import { useAudit } from "@/lib/audit-store";
import { EvidenceScreenshot, HistoryStrip, Mono, openImageInNewTab } from "./atoms";

const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;

/** Upload-an-image panel for steps that must attach evidence before "Mark done". */
function StepEvidencePanel({
  step,
  canEdit,
  onSave,
  onRemove,
}: {
  step: ManualStep;
  canEdit: boolean;
  onSave: (file: { fileName: string; dataUrl: string }) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ fileName: string; dataUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Please choose an image file.");
    if (file.size > MAX_EVIDENCE_BYTES) return setError("Image must be 5 MB or smaller.");
    const reader = new FileReader();
    reader.onload = () => setDraft({ fileName: file.name, dataUrl: String(reader.result) });
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsDataURL(file);
  };

  const evidence = step.evidence;
  if (evidence)
    return (
      <div className="mt-2 flex max-w-md flex-wrap items-center gap-3 border border-border bg-panel-2/60 px-2.5 py-2">
        <button
          type="button"
          onClick={() => openImageInNewTab(evidence.dataUrl)}
          className="h-12 w-16 shrink-0 cursor-zoom-in overflow-hidden border border-border"
          title="Open evidence in a new tab"
        >
          <img
            src={evidence.dataUrl}
            alt={evidence.fileName}
            className="h-full w-full object-cover"
          />
        </button>
        <div className="min-w-0 flex-1 text-xs">
          <p className="inline-flex items-center gap-1 text-foreground">
            <Paperclip className="h-3 w-3" /> {evidence.fileName}
          </p>
          <p className="text-muted-foreground">
            Uploaded by {evidence.uploadedBy} ·{" "}
            <Mono className="text-faint">{evidence.uploadedAt}</Mono>
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={onRemove}
            className="text-[11px] text-faint underline decoration-dotted hover:text-foreground"
          >
            Remove
          </button>
        )}
      </div>
    );

  if (!canEdit) return null;

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1.5 border border-border bg-panel-2 px-3 py-1 text-xs text-foreground transition-colors hover:bg-accent"
      >
        <Paperclip className="h-3 w-3" /> Evidence
      </button>
    );

  return (
    <div className="mt-2 max-w-md space-y-2 border border-border bg-panel-2/60 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-faint">Upload an image as evidence for this step</p>
        <button
          type="button"
          aria-label="Close"
          onClick={() => {
            setOpen(false);
            setDraft(null);
            setError(null);
          }}
          className="text-faint hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <label className="flex cursor-pointer items-center justify-center gap-1.5 border border-dashed border-border bg-panel px-3 py-3 text-xs text-muted-foreground hover:border-ring">
        <Upload className="h-3.5 w-3.5" />
        {draft ? draft.fileName : "Choose image (PNG, JPG, ...)"}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </label>
      {draft && (
        <img
          src={draft.dataUrl}
          alt="Evidence preview"
          className="max-h-40 border border-border object-contain"
        />
      )}
      {error && <p className="text-[11px] text-fail">{error}</p>}
      <button
        type="button"
        disabled={!draft}
        onClick={() => {
          if (!draft) return;
          onSave(draft);
          setDraft(null);
          setOpen(false);
        }}
        className="border border-manual/50 px-3 py-1 text-xs text-manual transition-colors hover:bg-manual/10 disabled:opacity-40"
      >
        Save
      </button>
    </div>
  );
}

type Props = {
  cp: ManualCheckpoint;
  onStepDone: (id: string, stepIndex: number) => void;
  onStepUndo: (id: string, stepIndex: number) => void;
  onComment: (id: string, text: string) => void;
};

export function ManualCard({ cp, onStepDone, onStepUndo, onComment }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const { cp38Results, setStepEvidence } = useAudit();
  const cp38Result = cp38Results[cp.id];
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
              const needsEvidence = stepRequiresEvidence(s);
              const missingEvidence = needsEvidence && !s.evidence;
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
                    {needsEvidence && (
                      <StepEvidencePanel
                        step={s}
                        canEdit={s.state === "pending" && i === activeIndex}
                        onSave={(file) => setStepEvidence(cp.id, i, file)}
                        onRemove={() => setStepEvidence(cp.id, i, null)}
                      />
                    )}
                    {s.state === "pending" && i === activeIndex && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => onStepDone(cp.id, i)}
                          disabled={missingEvidence}
                          title={
                            missingEvidence ? "Upload and save an evidence image first" : undefined
                          }
                          className="border border-manual/50 px-3 py-1 text-xs text-manual transition-colors hover:bg-manual/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                        >
                          Mark done
                        </button>
                        {missingEvidence && (
                          <span className="text-[11px] text-warn">
                            Upload and save an evidence image to enable Mark done.
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {cp38Result?.evidence_screenshot && (
            <div className="border-t border-border pt-3">
              <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] text-faint">
                <Paperclip className="h-3 w-3" /> Evidence
              </p>
              {cp38Result.outcome_id === "CP38-C" ? (
                <p className="text-xs text-muted-foreground">
                  Sign-off email from {cp38Result.approver_actor ?? "the authorized signer"}
                  {cp38Result.confidence != null && <> · conf. {cp38Result.confidence}%</>} ·{" "}
                  <Mono className="text-faint">{cp38Result.timestamp}</Mono>
                </p>
              ) : (
                <p className="text-xs text-warn">
                  Email received but not accepted yet ·{" "}
                  {cp38Result.pending_reason === "wrong_sender"
                    ? `sent by ${cp38Result.wrong_sender_email}, not the authorized signer`
                    : "sign-off wording wasn't explicit enough"}{" "}
                  · <Mono className="text-faint">{cp38Result.timestamp}</Mono>
                </p>
              )}
              <EvidenceScreenshot
                fileName={cp38Result.evidence_screenshot}
                source="cp38"
                label="View sign-off email screenshot"
                alt="Screenshot of the UAT sign-off email"
              />
            </div>
          )}

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
