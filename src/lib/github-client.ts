// Minimal GitHub REST client for the CR-compliance checkpoint — reads only
// (branches, pull requests), never writes. Auth is a PAT read from
// GITHUB_TOKEN (server-side env var, never a VITE_ prefix — see .env.example).
const GITHUB_API = "https://api.github.com";

function githubHeaders(): HeadersInit {
  const token = process.env["GITHUB_TOKEN"];
  if (!token) throw new Error("GITHUB_TOKEN is not configured (set it in .env)");
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export type GithubBranch = {
  name: string;
  commit: { sha: string; url: string };
};

export type GithubPull = {
  number: number;
  state: "open" | "closed";
  merged_at: string | null;
  html_url: string;
  title: string;
  head: { ref: string; sha: string };
  base: { ref: string };
};

// Direct lookup by name — the branches/{branch} endpoint 404s cleanly when
// there's no match, so no need to page through the full branch list.
export async function findBranch(owner: string, repo: string, branchName: string): Promise<GithubBranch | null> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/branches/${encodeURIComponent(branchName)}`, {
    headers: githubHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub branch lookup failed: HTTP ${res.status}`);
  return (await res.json()) as GithubBranch;
}

// GitHub's pulls endpoint supports filtering by head ref directly
// (`owner:branch`), so this never needs to page through unrelated PRs.
export async function findPullRequestsForBranch(
  owner: string,
  repo: string,
  branchName: string,
): Promise<GithubPull[]> {
  const params = new URLSearchParams({
    state: "all",
    head: `${owner}:${branchName}`,
    per_page: "20",
  });
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/pulls?${params.toString()}`, {
    headers: githubHeaders(),
  });
  if (!res.ok) throw new Error(`GitHub pull request lookup failed: HTTP ${res.status}`);
  return (await res.json()) as GithubPull[];
}

// merged_by is only present on the single-PR detail endpoint, not the list
// endpoint above — fetched separately, and only once a PR is already known.
export async function getPullRequest(
  owner: string,
  repo: string,
  number: number,
): Promise<GithubPull & { merged_by: { login: string } | null }> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/pulls/${number}`, {
    headers: githubHeaders(),
  });
  if (!res.ok) throw new Error(`GitHub pull request detail lookup failed: HTTP ${res.status}`);
  return (await res.json()) as GithubPull & { merged_by: { login: string } | null };
}
