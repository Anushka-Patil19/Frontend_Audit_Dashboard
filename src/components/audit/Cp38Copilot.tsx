import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import logoGif from "./logo.gif";
import {
  Bot,
  CheckCircle2,
  XCircle,
  Clock,
  X,
  ArrowRight,
  ArrowUp,
  Menu,
  ChevronDown,
  SquarePen,
  PanelRight,
  MoreHorizontal,
  Plus,
  MessageSquare,
  Sparkles,
  ExternalLink,
  Check,
  Mail,
  Globe,
  Building2,
  Layers,
  Settings,
  Monitor,
  Smartphone,
  HelpCircle,
  MessageSquarePlus,
} from "lucide-react";
import { runCp38Verification, type Cp38Result } from "@/lib/cp38-verify";
import { runCp10Verification, type Cp10Result } from "@/lib/cp10-verify";
import { looksLikeCp10Question } from "@/lib/cp10-config";
import { runCrComplianceVerification, type CrComplianceResult, type CrOutcomeId } from "@/lib/cr-compliance-verify";
import { looksLikeCrComplianceQuestion } from "@/lib/cr-compliance-config";
import { checkRepoDependencies, formatDependencyReply, looksLikeDependencyQuestion } from "@/lib/dependency-monitor";
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
  "Are any of my work items overdue?",
  "What should I work on next?",
  "Write an update about my week.",
];

export function Cp38Copilot() {
  const runCp38 = useServerFn(runCp38Verification);
  const runCp10 = useServerFn(runCp10Verification);
  const runCr = useServerFn(runCrComplianceVerification);
  const checkDependencies = useServerFn(checkRepoDependencies);
  const { checkpoints, completeStep, resolveCheckpoint, setCp10Verification, setCrVerification } = useAudit();
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"floating" | "sidebar">("floating");
  const [showSwitchMenu, setShowSwitchMenu] = useState(false);
  const [showSourcesMenu, setShowSourcesMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [sources, setSources] = useState({
    web: false,
    company: true,
    github: true,
    jira: true,
    gmail: true,
    confluence: true,
  });
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

  const askDependencies = async () => {
    const res = await checkDependencies();
    setMessages((m) => [...m, { role: "assistant", text: formatDependencyReply(res) }]);
  };

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setBusy(true);
    try {
      if (looksLikeDependencyQuestion(question)) {
        await askDependencies();
      } else if (looksLikeCrComplianceQuestion(question)) {
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
    <div
      className={
        viewMode === "sidebar" && open
          ? "fixed inset-y-0 right-0 z-50 flex flex-col items-end"
          : "fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2.5"
      }
    >
      {open && (
        <div
          className={
            viewMode === "sidebar"
              ? "flex h-screen w-[380px] max-w-[100vw] flex-col border-l border-neutral-400 bg-white text-neutral-900 shadow-2xl animate-in slide-in-from-right duration-200 overflow-hidden"
              : "flex min-h-[600px] max-h-[780px] w-[370px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-neutral-400 bg-white text-neutral-900 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150 overflow-hidden"
          }
        >
          {/* Top Bar - Clean White Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-neutral-100 bg-[#f9fafb]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-neutral-500 hover:text-neutral-800 transition-colors p-1 rounded hover:bg-neutral-200/60"
                title="Menu"
              >
                <Menu className="h-3.5 w-3.5" />
              </button>
              <div className="flex items-center gap-1.5 cursor-pointer font-medium text-xs text-neutral-900 hover:text-black transition-colors">
                <img
                  src={logoGif}
                  alt="Audit AI"
                  className="h-4 w-4 object-contain"
                />
                <span className="font-semibold text-[13px]">Audit AI</span>
                <ChevronDown className="h-3 w-3 text-neutral-400" />
              </div>
            </div>

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setMessages([])}
                className="text-neutral-500 hover:text-neutral-800 p-1 rounded hover:bg-neutral-200/60 transition-colors"
                title="New chat"
              >
                <SquarePen className="h-3.5 w-3.5" />
              </button>

              {/* PanelRight / Switch View Icon with Hover Tooltip & Dropdown Menu */}
              <div
                className="relative"
                onMouseEnter={() => setShowSwitchMenu(true)}
                onMouseLeave={() => setShowSwitchMenu(false)}
              >
                <button
                  type="button"
                  onClick={() => setViewMode((m) => (m === "floating" ? "sidebar" : "floating"))}
                  className={`p-1 rounded transition-colors ${viewMode === "sidebar"
                      ? "bg-neutral-200 text-primary"
                      : "text-neutral-500 hover:text-neutral-800 hover:bg-neutral-200/60"
                    }`}
                  aria-label="Switch view"
                  title="Switch on"
                >
                  <PanelRight className="h-3.5 w-3.5" />
                </button>

                {/* Popover Menu with 'Switch on' / View options including 'Sidebar' */}
                {showSwitchMenu && (
                  <div className="absolute right-0 top-full pt-1 z-50 animate-in fade-in-0 zoom-in-95 duration-100">
                    <div className="w-44 rounded-xl border border-neutral-200 bg-white p-1 text-xs text-neutral-800 shadow-xl">
                      <div className="px-2.5 py-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider border-b border-neutral-100">
                        Switch on
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setViewMode("sidebar");
                          setShowSwitchMenu(false);
                        }}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors ${viewMode === "sidebar"
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900"
                          }`}
                      >
                        <span className="flex items-center gap-2">
                          <PanelRight className="h-3.5 w-3.5" />
                          <span>Sidebar</span>
                        </span>
                        {viewMode === "sidebar" && <Check className="h-3 w-3 text-primary" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setViewMode("floating");
                          setShowSwitchMenu(false);
                        }}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors ${viewMode === "floating"
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900"
                          }`}
                      >
                        <span className="flex items-center gap-2">
                          <Bot className="h-3.5 w-3.5" />
                          <span>Floating modal</span>
                        </span>
                        {viewMode === "floating" && <Check className="h-3 w-3 text-primary" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* More options button with hover tooltip and dropdown menu */}
              <div
                className="relative"
                onMouseEnter={() => setShowMoreMenu(true)}
                onMouseLeave={() => setShowMoreMenu(false)}
              >
                <button
                  type="button"
                  onClick={() => setShowMoreMenu((m) => !m)}
                  className={`p-1 rounded transition-colors ${showMoreMenu
                      ? "bg-neutral-200 text-neutral-900"
                      : "text-neutral-500 hover:text-neutral-800 hover:bg-neutral-200/60"
                    }`}
                  aria-label="More"
                  title="More"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>

                {/* More Dropdown Menu matching screenshot */}
                {showMoreMenu && (
                  <div className="absolute right-0 top-full pt-1 z-50 animate-in fade-in-0 zoom-in-95 duration-100">
                    <div className="w-52 rounded-xl border border-neutral-200 bg-white p-1.5 text-xs text-neutral-800 shadow-xl">
                      {/* Section 1: Settings and memory */}
                      <button
                        type="button"
                        onClick={() => setShowMoreMenu(false)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-left text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
                      >
                        <Settings className="h-3.5 w-3.5 text-neutral-500" />
                        <span>Settings and memory</span>
                      </button>

                      <div className="my-1 border-t border-neutral-100" />

                      {/* Section 2: Apps & Extension */}
                      <button
                        type="button"
                        onClick={() => setShowMoreMenu(false)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-left text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
                      >
                        <Monitor className="h-3.5 w-3.5 text-neutral-500" />
                        <span>Desktop app</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowMoreMenu(false)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-left text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
                      >
                        <Smartphone className="h-3.5 w-3.5 text-neutral-500" />
                        <span>Mobile app</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowMoreMenu(false)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-left text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
                      >
                        {/* Chrome extension icon */}
                        <svg className="h-3.5 w-3.5 text-neutral-500 fill-current" viewBox="0 0 24 24">
                          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4.5a7.5 7.5 0 016.928 4.5H12a3 3 0 00-2.829 2H4.804A7.485 7.485 0 0112 4.5zm-4.5 7.5a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zm-2.928 2h4.356a3 3 0 002.829 2l-3.563 6.171A7.514 7.514 0 014.572 14zm9.856 5.5l3.564-6.171a3 3 0 000-2.658h4.528A7.502 7.502 0 0114.428 19.5z" />
                        </svg>
                        <span>Chrome Extension</span>
                      </button>

                      <div className="my-1 border-t border-neutral-100" />

                      {/* Section 3: Updates, Feedback, Help */}
                      <button
                        type="button"
                        onClick={() => setShowMoreMenu(false)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-left text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                        <span>What's new in Rovo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowMoreMenu(false)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-left text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
                      >
                        <MessageSquarePlus className="h-3.5 w-3.5 text-neutral-500" />
                        <span>Feedback</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowMoreMenu(false)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-left text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
                      >
                        <HelpCircle className="h-3.5 w-3.5 text-neutral-500" />
                        <span>Get help</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-neutral-500 hover:text-neutral-800 p-1 rounded hover:bg-neutral-200/60 transition-colors ml-0.5"
                aria-label="Close copilot"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Chat Messages & Suggested prompts */}
          <div className="flex-1 space-y-2.5 overflow-y-auto px-3.5 py-3 text-xs bg-white">
            {messages.length === 0 ? (
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    className="group flex items-start gap-2.5 w-full text-left rounded-lg bg-neutral-50 hover:bg-neutral-100/90 border border-neutral-200/80 px-3 py-2 text-xs text-neutral-800 transition-all hover:border-neutral-300"
                  >
                    <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-neutral-500 group-hover:text-primary transition-colors flex-shrink-0" />
                    <span className="leading-snug flex-1 font-normal">{s}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[88%] rounded-xl px-4 py-3 text-xs leading-relaxed ${m.role === "user"
                      ? "bg-primary text-primary-foreground font-medium rounded-br-xs"
                      : "bg-neutral-100 border border-neutral-200 text-neutral-800 shadow-xs rounded-bl-xs"
                    }`}
                >
                  <pre className="whitespace-pre-wrap font-sans">{m.text}</pre>

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
                          label="View sign-off screenshot"
                          alt="Screenshot of UAT sign-off"
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

            {busy && (
              <div className="flex items-center gap-2 text-xs text-neutral-500 pt-1">
                <Sparkles className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>Checkpoint is thinking…</span>
              </div>
            )}
          </div>

          {/* Bottom Prompt Card - Clean White Style */}
          <div className="p-3 bg-white border-t border-neutral-100">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask(input);
              }}
              className="rounded-xl border border-neutral-300 bg-white p-2.5 shadow-sm focus-within:border-neutral-400 focus-within:ring-2 focus-within:ring-neutral-100 transition-all"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    ask(input);
                  }
                }}
                rows={2}
                placeholder="Ask, @mention a person, team or agent..."
                className="w-full resize-none bg-transparent text-xs text-neutral-900 placeholder:text-neutral-400 outline-none"
              />

              {/* Bottom bar of prompt card */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 transition-colors"
                    title="Add attachment / context"
                  >
                    <Plus className="h-4 w-4" />
                  </button>

                  {/* Filtered sources pill button & popup menu */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowSourcesMenu((s) => !s)}
                      className="group/pill flex items-center gap-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200/80 border border-neutral-200 px-2 py-0.5 transition-colors cursor-pointer"
                      title="Manage sources"
                    >
                      {/* GitHub icon badge */}
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#24292e] text-[10px] text-white">
                        <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24">
                          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                        </svg>
                      </span>

                      {/* Jira icon badge */}
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#0052CC] text-[9px] font-bold text-white">
                        J
                      </span>

                      {/* Gmail icon badge */}
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#EA4335] text-white">
                        <Mail className="h-2.5 w-2.5" />
                      </span>

                      <span className="text-[10px] text-neutral-600 font-medium ml-0.5">
                        +3
                      </span>
                    </button>

                    {/* Sources Floating Popup Drawer matching screenshot in White Theme */}
                    {showSourcesMenu && (
                      <div className="absolute bottom-[calc(100%+8px)] left-0 w-72 rounded-2xl border border-neutral-200 bg-white p-3 text-xs text-neutral-800 shadow-2xl z-50 animate-in fade-in-0 zoom-in-95 duration-150">
                        <div className="text-[11px] font-semibold text-neutral-500 pb-2">
                          Sources
                        </div>

                        {/* Include web results toggle */}
                        <div className="flex items-center justify-between py-1.5 border-b border-neutral-100">
                          <div className="flex items-center gap-2 text-neutral-700">
                            <Globe className="h-4 w-4 text-neutral-500" />
                            <span>Include web results</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSources((s) => ({ ...s, web: !s.web }))}
                            className={`h-5 w-9 rounded-full transition-colors p-0.5 flex items-center ${sources.web ? "bg-emerald-500 justify-end" : "bg-neutral-300 justify-start"
                              }`}
                          >
                            <span className="h-4 w-4 rounded-full bg-white shadow-xs" />
                          </button>
                        </div>

                        {/* Search company sources toggle */}
                        <div className="flex items-center justify-between py-1.5 border-b border-neutral-100">
                          <div className="flex items-center gap-2 text-neutral-700">
                            <Building2 className="h-4 w-4 text-neutral-500" />
                            <span>Search company sources</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSources((s) => ({ ...s, company: !s.company }))}
                            className={`h-5 w-9 rounded-full transition-colors p-0.5 flex items-center ${sources.company ? "bg-emerald-500 justify-end" : "bg-neutral-300 justify-start"
                              }`}
                          >
                            <span className="h-4 w-4 rounded-full bg-white shadow-xs" />
                          </button>
                        </div>

                        {/* Connected apps count */}
                        <div className="text-[11px] font-medium text-neutral-500 pt-2.5 pb-1.5">
                          3 of your connected apps
                        </div>

                        {/* App 1: GitHub */}
                        <div className="flex items-center justify-between py-1.5">
                          <div className="flex items-center gap-2 text-neutral-800">
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#24292e] text-white">
                              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                              </svg>
                            </div>
                            <span className="font-medium text-xs">GitHub</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSources((s) => ({ ...s, github: !s.github }))}
                            className={`h-5 w-9 rounded-full transition-colors p-0.5 flex items-center ${sources.github ? "bg-emerald-500 justify-end" : "bg-neutral-300 justify-start"
                              }`}
                          >
                            <span className="h-4 w-4 rounded-full bg-white shadow-xs" />
                          </button>
                        </div>

                        {/* App 2: Jira */}
                        <div className="flex items-center justify-between py-1.5">
                          <div className="flex items-center gap-2 text-neutral-800">
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0052CC] text-[10px] font-bold text-white">
                              J
                            </div>
                            <span className="font-medium text-xs">Jira</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSources((s) => ({ ...s, jira: !s.jira }))}
                            className={`h-5 w-9 rounded-full transition-colors p-0.5 flex items-center ${sources.jira ? "bg-emerald-500 justify-end" : "bg-neutral-300 justify-start"
                              }`}
                          >
                            <span className="h-4 w-4 rounded-full bg-white shadow-xs" />
                          </button>
                        </div>

                        {/* App 3: Gmail */}
                        <div className="flex items-center justify-between py-1.5">
                          <div className="flex items-center gap-2 text-neutral-800">
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#EA4335] text-white">
                              <Mail className="h-3 w-3" />
                            </div>
                            <span className="font-medium text-xs">Gmail</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSources((s) => ({ ...s, gmail: !s.gmail }))}
                            className={`h-5 w-9 rounded-full transition-colors p-0.5 flex items-center ${sources.gmail ? "bg-emerald-500 justify-end" : "bg-neutral-300 justify-start"
                              }`}
                          >
                            <span className="h-4 w-4 rounded-full bg-white shadow-xs" />
                          </button>
                        </div>

                        {/* Discover more apps button */}
                        <button
                          type="button"
                          className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
                        >
                          <Layers className="h-4 w-4" />
                          <span>Discover more apps</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-[11px] text-neutral-700 bg-neutral-100 hover:bg-neutral-200/70 px-2 py-0.5 rounded-md cursor-pointer transition-colors">
                    <Sparkles className="h-3 w-3 text-neutral-500" />
                    <span>Auto</span>
                  </div>

                  <button
                    type="submit"
                    disabled={!input.trim() || busy}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-200 text-neutral-700 hover:bg-primary hover:text-primary-foreground disabled:opacity-40 transition-all cursor-pointer disabled:cursor-not-allowed"
                    title="Send"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </form>

            <div className="flex items-center justify-center gap-1 pt-2 text-[10px] text-neutral-400 select-none">
              <span>Uses AI. Verify results.</span>
              <ExternalLink className="h-2.5 w-2.5 opacity-60" />
            </div>
          </div>
        </div>
      )}

      {/* Unified interactive hover zone: includes the bar, the gap, and the button (only shown when sidebar is closed) */}
      {!open && (
        <div className="group relative flex items-center">
          {/* Atlassian-style "Ask anything..." pill popup in White Theme */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!input.trim() || busy) return;
              setOpen(true);
              ask(input);
            }}
            className="absolute right-[calc(100%+8px)] flex h-12 w-72 md:w-80 items-center justify-between rounded-full border border-neutral-200 bg-white/95 pl-4 pr-1.5 shadow-xl backdrop-blur-md transition-all duration-300 ease-out translate-x-2 opacity-0 pointer-events-none group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100 focus-within:pointer-events-auto focus-within:translate-x-0 focus-within:opacity-100 hover:border-neutral-300 focus-within:border-primary/80 focus-within:ring-2 focus-within:ring-primary/20"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Checkpoint anything..."
              className="min-w-0 flex-1 bg-transparent text-xs md:text-sm text-neutral-800 placeholder:text-neutral-400 outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || busy}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 hover:bg-primary hover:text-primary-foreground disabled:opacity-40 transition-colors"
              aria-label="Send message"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <button
            onClick={() => setOpen(true)}
            className="relative z-10 flex h-14 w-14 items-center justify-center rounded-xl bg-white border border-neutral-400 shadow-card transition-all duration-300 hover:scale-105 hover:shadow-xl active:scale-95 overflow-hidden"
            aria-label="Open copilot"
          >
            <img
              src={logoGif}
              alt="Copilot Logo"
              className="h-12 w-12 object-contain select-none pointer-events-none"
            />
          </button>
        </div>
      )}
    </div>
  );
}
