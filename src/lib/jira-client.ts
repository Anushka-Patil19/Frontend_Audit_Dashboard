// Minimal Jira Cloud REST client for the CR-compliance checkpoint — reads
// only, via Basic auth (account email + API token), as an alternative to
// the Rovo MCP OAuth flow CP10 uses. Simpler for this checkpoint: a single
// static token, no interactive browser login / callback server required.
function jiraAuthHeader(): string {
  const email = process.env["JIRA_EMAIL"];
  const token = process.env["JIRA_API_TOKEN"];
  if (!email || !token) {
    throw new Error("JIRA_EMAIL / JIRA_API_TOKEN are not configured (set them in .env)");
  }
  return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
}

function jiraBaseUrl(): string {
  const baseUrl = process.env["JIRA_BASE_URL"];
  if (!baseUrl) throw new Error("JIRA_BASE_URL is not configured (set it in .env)");
  return baseUrl.replace(/\/+$/, "");
}

// Atlassian Document Format node — comment bodies are a doc tree of these;
// only the shapes this module actually reads are typed.
type AdfNode = {
  type?: string;
  text?: string;
  attrs?: { text?: string };
  content?: AdfNode[];
};

export type JiraIssue = {
  key: string;
  fields: {
    summary?: string;
    status: {
      name: string;
      statusCategory: { key: string };
    };
    comment?: { comments: { body: AdfNode }[] };
  };
};

export async function getJiraIssue(issueKey: string): Promise<JiraIssue | null> {
  const res = await fetch(
    `${jiraBaseUrl()}/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=summary,status,comment`,
    { headers: { Authorization: jiraAuthHeader(), Accept: "application/json" } },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Jira issue lookup failed: HTTP ${res.status}`);
  return (await res.json()) as JiraIssue;
}

function adfPlainText(node: AdfNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "mention") return node.attrs?.text ?? "";
  return (node.content ?? []).map(adfPlainText).join("");
}

function firstMention(node: AdfNode): string | null {
  if (node.type === "mention") return node.attrs?.text ?? null;
  for (const child of node.content ?? []) {
    const found = firstMention(child);
    if (found) return found;
  }
  return null;
}

// Looks for a comment like "The PR should be merged by @rahul" and returns
// the mentioned name ("rahul", "@" stripped). Deterministic text + mention
// match — never LLM-guessed — same approach as every other identity check
// in this app (CP10's sender match, CP38's authorized signer).
export function extractRequiredMerger(issue: JiraIssue): string | null {
  for (const comment of issue.fields.comment?.comments ?? []) {
    const text = adfPlainText(comment.body).toLowerCase();
    if (!text.includes("merged by")) continue;
    const mention = firstMention(comment.body);
    if (mention) return mention.replace(/^@/, "");
  }
  return null;
}
