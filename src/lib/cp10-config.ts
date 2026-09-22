// Project configuration for CP10 (CAB Approval Verification).
// Simplification vs. the PRD's literal "CAB Approver custom field": that
// field doesn't exist on the real ticket, so the ticket's existing Reporter
// is used as the authorized-approver identity instead — same idea (read
// identity from the system of record, never guess it), just a field that
// already exists rather than one requiring a Jira schema change.
export type Cp10ProjectConfig = {
  projectId: string;
  projectLabel: string;
  checkpointId: "CP10";
  jiraTicket: string;
  // Subject-line patterns the mailbox search matches on (any one matching).
  subjectMatches: string[];
  // id of the matching entry in the checkpoint ledger (audit-data.ts).
  ledgerId: string;
};

export const cp10Configs: Cp10ProjectConfig[] = [
  {
    projectId: "project-a",
    projectLabel: "PIT Armour",
    checkpointId: "CP10",
    jiraTicket: "POC-3",
    subjectMatches: ["POC-3", "PIT-Arnour CAB Approval"],
    ledgerId: "cp-10",
  },
];

// Deterministic project resolution from free text — substring match on the
// configured project label, same approach as CP38.
export function resolveCp10Project(question: string): Cp10ProjectConfig | null {
  const q = question.toLowerCase();
  return cp10Configs.find((c) => q.includes(c.projectLabel.toLowerCase())) ?? null;
}

// Does this question look like it's about CP10 (CAB approval) rather than
// some other checkpoint? Deterministic keyword routing — never LLM-guessed —
// so the copilot widget knows which flow to run.
export function looksLikeCp10Question(question: string): boolean {
  const q = question.toLowerCase();
  return (
    q.includes("cp10") ||
    q.includes("cp-10") ||
    q.includes("cab approval") ||
    q.includes("cab approver") ||
    cp10Configs.some((c) => q.includes(c.jiraTicket.toLowerCase()))
  );
}
