import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Loader2, Play, XCircle } from "lucide-react";
import {
  runCp10Verification,
  runCp38Verification,
  runCrComplianceVerification,
  type Cp10Result,
  type Cp38Result,
  type CrComplianceResult,
} from "@/lib/api-client";
import {
  COPILOT_SUGGESTIONS,
  looksLikeCp10Question,
  looksLikeCrComplianceQuestion,
  looksLikeDependencyQuestion,
} from "@/lib/copilot-routing";
import { useLedgerSync } from "@/lib/use-ledger-sync";
import { CopilotResultDetails } from "./CopilotResultDetails";

type SimAnswer = {
  state: "loading" | "done" | "error";
  /** True only when the check actually passed (Compliant / nothing to action). */
  passed?: boolean;
  text?: string;
  cp38Result?: Cp38Result | null;
  cp10Result?: Cp10Result | null;
  crResult?: CrComplianceResult | null;
};

// The dependency question stays in the chat's suggestions but isn't simulated.
const SIMULATE_QUESTIONS = COPILOT_SUGGESTIONS.filter((q) => !looksLikeDependencyQuestion(q));

type LedgerSync = ReturnType<typeof useLedgerSync>;

// Same keyword routing as the copilot chat, and like the chat it writes each
// result back to the checkpoint ledger, so evidence shows on the cards too.
async function answerQuestion(question: string, sync: LedgerSync): Promise<SimAnswer> {
  if (looksLikeCrComplianceQuestion(question)) {
    const res = await runCrComplianceVerification({ data: { question } });
    sync.applyCr(res);
    return { state: "done", passed: res.result?.outcome_id === "CR-C", text: res.reply, crResult: res.result };
  }
  if (looksLikeCp10Question(question)) {
    const res = await runCp10Verification({ data: { question } });
    sync.applyCp10(res);
    return { state: "done", passed: res.result?.outcome_id === "CP10-C", text: res.reply, cp10Result: res.result };
  }
  const res = await runCp38Verification({ data: { question } });
  sync.applyCp38(res);
  return { state: "done", passed: res.result?.outcome_id === "CP38-C", text: res.reply, cp38Result: res.result };
}

// Runs every copilot sample question (CP38, CP10, CR compliance)
// at once and lists each as a collapsible question → answer row.
export function CopilotSimulate() {
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, SimAnswer> | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const sync = useLedgerSync();

  const running = !!answers && Object.values(answers).some((a) => a.state === "loading");

  const simulate = () => {
    setOpen(true);
    setExpanded({});
    setAnswers(Object.fromEntries(SIMULATE_QUESTIONS.map((q) => [q, { state: "loading" } as SimAnswer])));
    for (const q of SIMULATE_QUESTIONS) {
      answerQuestion(q, sync)
        .catch((err): SimAnswer => ({
          state: "error",
          text: err instanceof Error ? err.message : "Something went wrong.",
        }))
        .then((answer) => setAnswers((prev) => (prev ? { ...prev, [q]: answer } : prev)));
    }
  };

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => (answers && !open ? setOpen(true) : simulate())}
        disabled={running}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-panel px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-panel-2 cursor-pointer disabled:opacity-60"
        title="Run all copilot questions"
      >
        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 text-primary" />}
        Simulate
      </button>

      {open && answers && (
        <div className="absolute right-0 z-20 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-panel shadow-panel">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-xs font-semibold text-foreground">Copilot simulation</p>
            <button
              onClick={simulate}
              disabled={running}
              className="text-[11px] text-primary hover:underline cursor-pointer disabled:opacity-60 disabled:no-underline"
            >
              Run again
            </button>
          </div>
          <div className="max-h-[28rem] overflow-y-auto p-2">
            {SIMULATE_QUESTIONS.map((q) => {
              const a = answers[q] ?? { state: "loading" };
              const isOpen = !!expanded[q];
              return (
                <div key={q} className="rounded-md px-2 py-1.5 text-xs hover:bg-panel-2">
                  <button
                    type="button"
                    onClick={() => a.state !== "loading" && setExpanded((e) => ({ ...e, [q]: !e[q] }))}
                    className={`flex w-full items-start gap-1.5 text-left ${a.state !== "loading" ? "cursor-pointer" : ""}`}
                  >
                    <ChevronDown
                      className={`mt-0.5 h-3 w-3 shrink-0 text-faint transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                    <span className="flex-1 text-foreground">{q}</span>
                    {a.state === "loading" && <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin text-faint" />}
                    {a.state !== "loading" &&
                      (a.passed ? (
                        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-ok" />
                      ) : (
                        <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-fail" />
                      ))}
                  </button>
                  {isOpen && a.state !== "loading" && (
                    <div
                      className={`mt-1 rounded border px-2 py-1.5 ${
                        a.state === "error" ? "border-fail/30 bg-fail/10 text-fail" : "border-border bg-panel-2 text-foreground"
                      }`}
                    >
                      <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed">{a.text}</pre>
                      <CopilotResultDetails cp38Result={a.cp38Result} cp10Result={a.cp10Result} crResult={a.crResult} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
