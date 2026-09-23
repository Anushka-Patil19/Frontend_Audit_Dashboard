import { createServerFn } from "@tanstack/react-start";
import { fetchRepoFile } from "./github-client";
import { checkAllDependencies, type DependencyResult } from "./version-checker";

const OWNER = "Anushka-Patil19";
const REPO = "Frontend_Audit_Dashboard";
const BRANCH = "main";

export type DependencyMonitorResult = { ok: true; results: DependencyResult[] } | { ok: false; error: string };

// Deterministic keyword routing for the copilot — same approach as
// looksLikeCp10Question/looksLikeCp38Question, never LLM-guessed.
export function looksLikeDependencyQuestion(question: string): boolean {
  const q = question.toLowerCase();
  return (
    q.includes("dependenc") ||
    q.includes("requirements.txt") ||
    q.includes("deprecat") ||
    q.includes("outdated") ||
    q.includes("package version") ||
    q.includes("pypi") ||
    (q.includes("version") && (q.includes("update") || q.includes("upgrade")))
  );
}

// Only reports packages that actually need a version update. A package
// that's already on its latest release is left out even if it's
// separately flagged deprecated — nothing to action there, so nothing to
// report. The deprecation note still rides along on any package that
// does need an update and happens to also be deprecated.
export function formatDependencyReply(res: DependencyMonitorResult): string {
  if (!res.ok) return `Couldn't check dependencies: ${res.error}`;

  const { results } = res;
  const updates = results.filter((r) => r.status === "UPDATE_AVAILABLE");

  if (updates.length === 0) {
    return `All ${results.length} tracked dependencies are up to date — nothing needs an update.`;
  }

  const lines: string[] = [`${updates.length} of ${results.length} dependencies need an update:`, ""];
  for (const r of updates) {
    lines.push(`  • ${r.package}: ${r.currentVersion} → ${r.latestVersion}${r.deprecated ? ` — ⚠ DEPRECATED: ${r.deprecationNote ?? "flagged deprecated"}` : ""}`);
  }

  return lines.join("\n").trimEnd();
}

export const checkRepoDependencies = createServerFn({ method: "GET" }).handler(
  async (): Promise<DependencyMonitorResult> => {
    const file = await fetchRepoFile(OWNER, REPO, "requirements.txt", BRANCH);
    if (!file.ok) return { ok: false, error: file.error };
    const results = await checkAllDependencies(file.content);
    return { ok: true, results };
  },
);
