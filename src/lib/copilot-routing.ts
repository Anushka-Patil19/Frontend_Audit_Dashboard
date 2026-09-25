// Deterministic keyword routing for the copilot chat — decides which
// backend endpoint a free-text question should hit, before any network
// call happens. Never LLM-guessed. Kept on the frontend (unlike the rest of
// the checkpoint logic, which now lives in the Python backend) since this
// is pure client-side triage with no server-only dependency.

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

export function looksLikeCrComplianceQuestion(question: string): boolean {
  const q = question.toLowerCase();
  const mentionsCompliance = q.includes("compliant") || q.includes("compliance");
  const mentionsTicket = q.includes("ticket") || q.includes("cr-") || q.includes("cr ");
  return mentionsCompliance && mentionsTicket && extractTicketKey(question) !== null;
}

// Known CP10 Jira ticket(s) this app tracks — mirrors the backend's static
// cp10 config closely enough for routing purposes (never used to resolve
// the actual project, only to decide "does this look like a CP10 question").
const CP10_JIRA_TICKETS = ["POC-3"];

export function looksLikeCp10Question(question: string): boolean {
  const q = question.toLowerCase();
  return (
    q.includes("cp10") ||
    q.includes("cp-10") ||
    q.includes("cab approval") ||
    q.includes("cab approver") ||
    CP10_JIRA_TICKETS.some((t) => q.includes(t.toLowerCase()))
  );
}

export function looksLikeDependencyQuestion(question: string): boolean {
  const q = question.toLowerCase();
  return (
    q.includes("dependenc") ||
    q.includes("requirements.txt") ||
    q.includes("deprecat") ||
    q.includes("outdated") ||
    q.includes("package version") ||
    q.includes("pypi") ||
    ((q.includes("package") || q.includes("librar")) && (q.includes("upgrade") || q.includes("update"))) ||
    (q.includes("version") && (q.includes("update") || q.includes("upgrade")))
  );
}
