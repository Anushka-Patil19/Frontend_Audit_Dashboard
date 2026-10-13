import { useEffect, useRef, useState } from "react";
import { BellRing, CheckCircle2, ChevronDown, Loader2, Mail, Play, RotateCcw, XCircle } from "lucide-react";
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
import type { ProjectId } from "@/lib/audit-data";
import { useEscalations } from "@/lib/escalation-store";
import { LEVEL_LABEL, type Level, type RunSummary } from "@/lib/escalation-data";

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
// Simulate = step A (live copilot checks, above) + step B (escalation run): ages every open
// checkpoint of this project against its limit and notifies Developer / Manager / CTO.
export function CopilotSimulate({ projectId = "project-a" }: { projectId?: ProjectId }) {
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, SimAnswer> | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const sync = useLedgerSync();
  const esc = useEscalations();
  const [run, setRun] = useState<RunSummary | null>(null);

  const running = !!answers && Object.values(answers).some((a) => a.state === "loading");

  const simulate = () => {
    setOpen(true);
    setExpanded({});
    setAnswers(Object.fromEntries(SIMULATE_QUESTIONS.map((q) => [q, { state: "loading" } as SimAnswer])));
    setRun(esc.runEscalation(projectId));
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
          <div className="max-h-[32rem] overflow-y-auto p-2">
            {run && <EscalationResult run={run} onReset={() => { esc.resetDemo(); setRun(null); }} />}
            <p className="px-2 pb-1 pt-2 font-mono text-[10px] uppercase tracking-wide text-faint">Live checks</p>
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

const LEVELS: Level[] = ["developer", "manager", "cto"];

function EscalationResult({ run, onReset }: { run: RunSummary; onReset: () => void }) {
  const [showAll, setShowAll] = useState(false);
  const total = run.notifications.length;
  const time = new Date(run.runAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const list = showAll ? run.notifications : run.notifications.slice(0, 4);
  return (
    <div className="mb-2 rounded-md border border-border bg-panel-2/40 p-2.5 text-xs">
      <div className="flex items-center gap-1.5">
        <BellRing className="h-3.5 w-3.5 text-primary" />
        <p className="font-semibold text-foreground">Escalations · run {time}</p>
        <button type="button" onClick={onReset} className="ml-auto inline-flex items-center gap-1 text-[11px] text-primary hover:underline" title="Reload the demo items and clear notifications">
          <RotateCcw className="h-3 w-3" /> Reset demo
        </button>
      </div>
      {total === 0 ? (
        <p className="mt-1.5 text-muted-foreground">No open checkpoints are near or past their limit.</p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {LEVELS.map((l) => (
              <span key={l} className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${run.counts[l] ? (l === "cto" ? "bg-fail/10 text-fail" : l === "manager" ? "bg-warn/10 text-warn" : "bg-primary-soft text-primary") : "bg-panel-2 text-faint"}`}>
                {LEVEL_LABEL[l]} {run.counts[l]}
              </span>
            ))}
          </div>
          <ul className="mt-2 space-y-1">
            {list.map((n) => (
              <li key={n.id} className="rounded border border-border bg-panel px-2 py-1">
                <span className="font-mono text-[10px] text-faint">→ {LEVEL_LABEL[n.recipient]}{n.kind === "approval-stalled" ? " · approval stalled" : ""}</span>
                <p className="text-foreground">{n.title}</p>
                <p className="text-[11px] text-muted-foreground">{n.detail}</p>
              </li>
            ))}
          </ul>
          {total > 4 && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-1 text-[11px] text-primary hover:underline">
              {showAll ? "Show fewer" : `Show all ${total} notifications`}
            </button>
          )}
        </>
      )}
      <p className="mt-2 flex items-start gap-1 text-[11px] text-faint">
        <Mail className="mt-0.5 h-3 w-3 shrink-0" /> {run.emailNote}
      </p>
    </div>
  );
}
