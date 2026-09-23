import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Send, CheckCircle2, Clock, X, XCircle } from "lucide-react";
import { runCp38Verification, type Cp38Result } from "@/lib/cp38-verify";
import { runCp10Verification, type Cp10Result } from "@/lib/cp10-verify";
import { looksLikeCp10Question } from "@/lib/cp10-config";
import { runCrComplianceVerification, type CrComplianceResult, type CrOutcomeId } from "@/lib/cr-compliance-verify";
import { looksLikeCrComplianceQuestion } from "@/lib/cr-compliance-config";
import { useAudit } from "@/lib/audit-store";
import type { AutoStatus } from "@/lib/audit-data";
import { EvidenceScreenshot, Mono } from "./atoms";

// AutoStatus only has three buckets, so In Progress and Pending both land
// on "needs-review" — the chat bubble still shows the full four-way outcome.
const CR_OUTCOME_TO_STATUS: Record<CrOutcomeId, AutoStatus> = {
  "CR-C": "compliant",
  "CR-NC": "non-compliant",
  "CR-IP": "needs-review",
  "CR-Pending": "needs-review",
};

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  cp38Result?: Cp38Result | null;
  cp10Result?: Cp10Result | null;
  crResult?: CrComplianceResult | null;
};

const SUGGESTIONS = [
  "What's the status of PIT Armour's UAT sign-off?",
  "Check CP10 for PIT Armour.",
  "Can you tell me if ticket CR-POC-4 is compliant?",
];

export function Cp38Copilot() {
  const runCp38 = useServerFn(runCp38Verification);
  const runCp10 = useServerFn(runCp10Verification);
  const runCr = useServerFn(runCrComplianceVerification);
  const { checkpoints, completeStep, resolveCheckpoint, setCp10Verification, setCrVerification } = useAudit();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const askCp38 = async (question: string) => {
    const { reply, result, config } = await runCp38({ data: { question } });
    setMessages((m) => [...m, { role: "assistant", text: reply, cp38Result: result }]);

    // Compliant per the copilot's real, LLM-gated verification — reflect
    // that in the checkpoint ledger by auto-completing its remaining step,
    // attributed to the copilot rather than the demo human auditor.
    if (result?.outcome_id === "CP38-C" && config?.ledgerId) {
      const cp = checkpoints.find((c) => c.id === config.ledgerId);
      if (cp && cp.kind === "manual") {
        const pendingIndex = cp.steps.findIndex((s) => s.state === "pending");
        if (pendingIndex !== -1) {
          completeStep(config.ledgerId, pendingIndex, "CP38 Copilot (AI-verified)");
        }
      }
    }
  };

  const askCp10 = async (question: string) => {
    const { reply, result, gates, config } = await runCp10({ data: { question } });
    // Gate progress itself is shared with the ledger card (AutomatedCard
    // renders the vertical progress + Undo for cp-10 from this same state) —
    // no duplicate stepper here in the chat. The result (incl. the evidence
    // screenshot) is still worth showing inline on the reply itself, though.
    setMessages((m) => [...m, { role: "assistant", text: reply, cp10Result: result }]);
    setCp10Verification(result, gates);
    if (result?.outcome_id === "CP10-C" && config?.ledgerId) {
      resolveCheckpoint(
        config.ledgerId,
        "compliant",
        "Verified",
        reply.split("\n").slice(1).join(" "),
        "CP10 Copilot (AI-verified)",
      );
    }
  };

  const askCr = async (question: string) => {
    const { reply, result, gates, config } = await runCr({ data: { question } });
    // Shared with the cp-18 ledger card (AutomatedCard renders
    // CrComplianceProgress from this same state), same pattern as CP10.
    setMessages((m) => [...m, { role: "assistant", text: reply, crResult: result }]);
    setCrVerification(result, gates);

    // Reflects into the checkpoint ledger regardless of outcome (not just
    // Compliant) — a Non-Compliant result (merged without approval, or by
    // the wrong person) is exactly the kind of thing this control exists to
    // surface, so it belongs on the ledger too, not just Compliant ones.
    if (result && config?.ledgerId) {
      const status = CR_OUTCOME_TO_STATUS[result.outcome_id];
      resolveCheckpoint(
        config.ledgerId,
        status,
        "Verified",
        `${result.jira_ticket}: ${reply.split("\n").slice(1).join(" ")}`,
        "CR Compliance Copilot (AI-verified)",
      );
    }
  };

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setBusy(true);
    try {
      if (looksLikeCrComplianceQuestion(question)) {
        await askCr(question);
      } else if (looksLikeCp10Question(question)) {
        await askCp10(question);
      } else {
        await askCp38(question);
      }
    } catch (error) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: error instanceof Error ? error.message : "Something went wrong." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[80vh] max-h-[720px] w-[min(560px,calc(100vw-2.5rem))] flex-col rounded-xl border border-border bg-panel shadow-card">
          <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
            <span className="inline-flex items-center gap-2 text-base font-medium text-foreground">
              <Bot className="h-5 w-5 text-primary" strokeWidth={1.75} />
              Checkpoint Copilot
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-faint hover:text-foreground"
              aria-label="Close copilot"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <p className="border-b border-border px-5 py-2.5 text-xs text-muted-foreground">
            CP38 (UAT sign-off) and CP10 (CAB approval) work the same way: identity/eligibility checks are
            always deterministic — the LLM only classifies language, and only once every check ahead of it
            has already passed. CR compliance is fully deterministic: Jira approval, then a matching GitHub
            branch, then a merged PR.
          </p>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    className="rounded-md border border-border bg-panel-2 px-3 py-2 text-xs text-muted-foreground hover:border-primary hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-3 text-sm ${
                    m.role === "user"
                      ? "bg-primary-soft text-primary"
                      : "border border-border bg-panel-2 text-foreground"
                  }`}
                >
                  <pre className="whitespace-pre-wrap font-sans">{m.text}</pre>

                  {m.cp38Result && (
                    <div className="mt-3 border-t border-border pt-2.5 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        {m.cp38Result.outcome_id === "CP38-C" ? (
                          <span className="inline-flex items-center gap-1 text-ok">
                            <CheckCircle2 className="h-3.5 w-3.5" /> CP38-Compliant
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-warn">
                            <Clock className="h-3.5 w-3.5" /> CP38-Pending
                            {m.cp38Result.pending_reason ? ` · ${m.cp38Result.pending_reason}` : ""}
                          </span>
                        )}
                        {m.cp38Result.confidence != null && (
                          <Mono className="text-faint">confidence {m.cp38Result.confidence}%</Mono>
                        )}
                        {m.cp38Result.evidence_ref && (
                          <Mono className="text-faint">
                            evidence {m.cp38Result.evidence_ref.slice(0, 10)}…
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
                    <div className="mt-3 border-t border-border pt-2.5 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        {m.cp10Result.outcome_id === "CP10-C" ? (
                          <span className="inline-flex items-center gap-1 text-ok">
                            <CheckCircle2 className="h-3.5 w-3.5" /> CP10-Compliant
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-warn">
                            <Clock className="h-3.5 w-3.5" /> CP10-Pending
                            {m.cp10Result.pending_reason ? ` · ${m.cp10Result.pending_reason}` : ""}
                          </span>
                        )}
                        {m.cp10Result.confidence != null && (
                          <Mono className="text-faint">confidence {m.cp10Result.confidence}%</Mono>
                        )}
                        {m.cp10Result.evidence_ref && (
                          <Mono className="text-faint">
                            evidence {m.cp10Result.evidence_ref.slice(0, 10)}…
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
                    <div className="mt-3 border-t border-border pt-2.5 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        {m.crResult.outcome_id === "CR-C" && (
                          <span className="inline-flex items-center gap-1 text-ok">
                            <CheckCircle2 className="h-3.5 w-3.5" /> CR-Compliant
                          </span>
                        )}
                        {m.crResult.outcome_id === "CR-NC" && (
                          <span className="inline-flex items-center gap-1 text-fail">
                            <XCircle className="h-3.5 w-3.5" /> CR-Non-Compliant
                          </span>
                        )}
                        {m.crResult.outcome_id === "CR-IP" && (
                          <span className="inline-flex items-center gap-1 text-warn">
                            <Clock className="h-3.5 w-3.5" /> CR-In Progress
                          </span>
                        )}
                        {m.crResult.outcome_id === "CR-Pending" && (
                          <span className="inline-flex items-center gap-1 text-warn">
                            <Clock className="h-3.5 w-3.5" /> CR-Pending
                          </span>
                        )}
                        {m.crResult.jira_status && (
                          <Mono className="text-faint">jira {m.crResult.jira_status}</Mono>
                        )}
                        {m.crResult.pr_number != null && (
                          <Mono className="text-faint">
                            PR #{m.crResult.pr_number} ·{" "}
                            {m.crResult.pr_merged ? `merged by ${m.crResult.pr_merged_by ?? "unknown"}` : m.crResult.pr_state}
                          </Mono>
                        )}
                        {m.crResult.required_merger && (
                          <Mono className={m.crResult.merger_matches ? "text-ok" : "text-fail"}>
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
                    </div>
                  )}
                </div>
              </div>
            ))}

            {busy && <p className="text-xs text-faint">Copilot is checking…</p>}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex gap-2 border-t border-border p-4"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about CP38 or CP10 for PIT Armour…"
              className="min-w-0 flex-1 border border-border bg-panel-2 px-3 py-2.5 text-sm outline-none placeholder:text-faint focus:border-ring"
            />
            <button
              type="submit"
              disabled={!input.trim() || busy}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2.5 text-sm text-foreground disabled:opacity-40"
            >
              <Send className="h-4 w-4" /> Ask
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-card transition-transform hover:scale-105"
        aria-label={open ? "Close copilot" : "Open copilot"}
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>
    </div>
  );
}
