import type { AutoStatus } from "./audit-data";
import { useAudit } from "./audit-store";
import type {
  Cp10VerifyResponse,
  Cp38VerifyResponse,
  CrOutcomeId,
  CrVerifyResponse,
} from "./api-client";

// AutoStatus only has three buckets, so In Progress and Pending both land
// on "needs-review" — the chat bubble still shows the full four-way outcome.
const CR_OUTCOME_TO_STATUS: Record<CrOutcomeId, AutoStatus> = {
  "CR-C": "compliant",
  "CR-NC": "non-compliant",
  "CR-IP": "needs-review",
  "CR-Pending": "needs-review",
};

// Writes a copilot verification back into the checkpoint ledger (evidence,
// gate progress, step/status). Shared by the copilot chat and Simulate, so a
// check run from either place shows up on the checkpoint cards the same way.
export function useLedgerSync() {
  const {
    checkpoints,
    completeStep,
    resolveCheckpoint,
    setCp10Verification,
    setCrVerification,
    setCp38Result,
  } = useAudit();

  const applyCp38 = ({ result, config }: Cp38VerifyResponse) => {
    // The received email is evidence either way — a Pending one shows why it
    // wasn't accepted — so the ledger card gets it whenever there's a screenshot.
    if (result?.evidence_screenshot && config?.ledgerId) setCp38Result(config.ledgerId, result);

    // Compliant per the copilot's real, LLM-gated verification — auto-complete
    // the checkpoint's remaining step, attributed to the copilot rather than
    // the demo human auditor.
    if (result?.outcome_id === "CP38-C" && config?.ledgerId) {
      const cp = checkpoints.find((c) => c.id === config.ledgerId);
      if (cp && cp.kind === "manual") {
        const pendingIndex = cp.steps.findIndex((s) => s.state === "pending");
        if (pendingIndex !== -1)
          completeStep(config.ledgerId, pendingIndex, "CP38 Copilot (AI-verified)");
      }
    }
  };

  const applyCp10 = ({ reply, result, gates, config }: Cp10VerifyResponse) => {
    // Gate progress + evidence are shared with the cp-10 ledger card
    // (AutomatedCard renders the vertical progress + Undo from this state).
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

  const applyCr = ({ reply, result, gates, config }: CrVerifyResponse) => {
    setCrVerification(result, gates);
    // Reflects into the ledger regardless of outcome — a Non-Compliant result
    // (merged without approval, or by the wrong person) is exactly what this
    // control exists to surface.
    if (result && config?.ledgerId) {
      resolveCheckpoint(
        config.ledgerId,
        CR_OUTCOME_TO_STATUS[result.outcome_id],
        "Verified",
        `${result.jira_ticket}: ${reply.split("\n").slice(1).join(" ")}`,
        "CR Compliance Copilot (AI-verified)",
      );
    }
  };

  return { applyCp38, applyCp10, applyCr };
}
