// Project configuration for CP38, stored once per project.
// Per the PRD: required_role / authorized_name / authorized_email are never
// inferred or guessed by the AI — they're fixed, human-entered config.
export type Cp38ProjectConfig = {
  projectId: string;
  projectLabel: string;
  checkpointId: "CP38";
  requiredRole: string;
  authorizedName: string;
  authorizedEmail: string;
  // Subject-line convention the mailbox search matches on — keeps evidence
  // retrieval targeted rather than a full inbox scan.
  subjectMatch: string;
  // id of the matching entry in the checkpoint ledger (audit-data.ts) —
  // lets a Compliant result auto-complete that checkpoint's remaining step.
  ledgerId: string;
};

// NOTE: authorizedEmail/subjectMatch below are PRD placeholder values.
// For a real demo, point authorizedEmail at whoever will actually send the
// test sign-off email, and send yourself a message whose subject contains
// subjectMatch — see the PRD's "dummy test emails" section.
export const cp38Configs: Cp38ProjectConfig[] = [
  {
    projectId: "project-a",
    projectLabel: "PIT Armour",
    checkpointId: "CP38",
    requiredRole: "Business",
    authorizedName: "Anushka Patil",
    authorizedEmail: "Anushka.p@neweltechnologies.com",
    subjectMatch: "PIT Armour UAT Sign-off",
    ledgerId: "cp-38",
  },
];

// Deterministic project resolution from a free-text copilot question —
// substring match on the configured project label, never LLM-guessed.
export function resolveCp38Project(question: string): Cp38ProjectConfig | null {
  const q = question.toLowerCase();
  return cp38Configs.find((c) => q.includes(c.projectLabel.toLowerCase())) ?? null;
}

// Exact-match lookup by project_id or label — used by the MCP tool, where
// the caller passes a specific project identifier rather than free text.
export function findCp38Config(projectIdOrLabel: string): Cp38ProjectConfig | null {
  const q = projectIdOrLabel.trim().toLowerCase();
  return (
    cp38Configs.find((c) => c.projectId.toLowerCase() === q || c.projectLabel.toLowerCase() === q) ?? null
  );
}
