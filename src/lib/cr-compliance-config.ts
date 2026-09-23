// Project configuration for CR Compliance — unlike CP10/CP38 (one fixed
// Jira ticket per project), this checkpoint answers ad hoc questions about
// *any* change-request ticket, so the ticket key comes from the question
// text and only the GitHub repo it maps to is fixed config.
export type CrComplianceProjectConfig = {
  projectId: string;
  projectLabel: string;
  checkpointId: "CR";
  // Jira project key (e.g. "POC") that this GitHub repo's tickets live under.
  jiraProjectKey: string;
  githubOwner: string;
  githubRepo: string;
  // id of the matching entry in the checkpoint ledger (audit-data.ts) —
  // lets a definitive result update that checkpoint's status, same as
  // CP10/CP38.
  ledgerId: string;
};

export const crComplianceConfigs: CrComplianceProjectConfig[] = [
  {
    projectId: "project-a",
    projectLabel: "PIT Armour",
    checkpointId: "CR",
    jiraProjectKey: "POC",
    githubOwner: "Anushka34567",
    githubRepo: "Github_integration",
    // cp-18 in the ledger ("Git commits are traceable to approved CRs") is
    // exactly this control — reused rather than adding a duplicate line
    // item for the same requirement.
    ledgerId: "cp-18",
  },
];

// Jira issue keys are PROJECTKEY-NUMBER. Users naturally write "CR-POC-4" or
// "CR POC-4" to mean "change request POC-4" — the CR- is describing the
// ticket type, not part of the real key — so it's stripped when present,
// but a bare "POC-4" resolves the same way.
const TICKET_KEY_RE = /\bcr[-\s]?([a-z][a-z0-9]{1,9}-\d+)\b|\b([a-z][a-z0-9]{1,9}-\d+)\b/i;

export function extractTicketKey(question: string): string | null {
  const m = question.match(TICKET_KEY_RE);
  const key = m?.[1] ?? m?.[2];
  return key ? key.toUpperCase() : null;
}

// Deterministic routing, same approach as CP10/CP38: never LLM-guessed.
export function looksLikeCrComplianceQuestion(question: string): boolean {
  const q = question.toLowerCase();
  const mentionsCompliance = q.includes("compliant") || q.includes("compliance");
  const mentionsTicket = q.includes("ticket") || q.includes("cr-") || q.includes("cr ");
  return mentionsCompliance && mentionsTicket && extractTicketKey(question) !== null;
}

export function resolveCrComplianceProject(ticketKey: string): CrComplianceProjectConfig | null {
  const prefix = ticketKey.split("-")[0]?.toUpperCase();
  return crComplianceConfigs.find((c) => c.jiraProjectKey.toUpperCase() === prefix) ?? null;
}
