// Server-only: fetches a single file's raw content from a GitHub repo via
// the REST v3 Contents API. GITHUB_TOKEN is optional — public repos can be
// read unauthenticated, just at a much lower rate limit (60/hr vs 5000/hr).
if (typeof process !== "undefined" && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile();
  } catch {
    // no .env file present — fine, envs may already be set another way
  }
}

export type GithubFileResult = { ok: true; content: string } | { ok: false; error: string };

export async function fetchRepoFile(
  owner: string,
  repo: string,
  path: string,
  branch: string,
): Promise<GithubFileResult> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
  if (token) headers.Authorization = `token ${token}`;

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`,
      { headers },
    );

    if (res.status === 404) {
      return { ok: false, error: `${path} not found in ${owner}/${repo} (branch: ${branch}).` };
    }
    if (res.status === 401) {
      return { ok: false, error: "Unable to authenticate with GitHub API. Check GITHUB_TOKEN." };
    }
    if (!res.ok) {
      return { ok: false, error: `GitHub API error (HTTP ${res.status}).` };
    }

    const data = (await res.json()) as { content?: string; encoding?: string };
    if (!data.content || data.encoding !== "base64") {
      return { ok: false, error: `Unexpected response shape fetching ${path}.` };
    }
    return { ok: true, content: Buffer.from(data.content, "base64").toString("utf8") };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Network error contacting GitHub API." };
  }
}
