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

// Only reports currently-deprecated packages — version drift (update
// available / up to date) is deliberately left out of every surface
// (bell, copilot, evidence). A deprecated package stays reported even if
// it has since shipped a newer release; deprecation doesn't get undone by
// a version bump of the same abandoned package.
export function formatDependencyReply(res: DependencyMonitorResult): string {
  if (!res.ok) return `Couldn't check dependencies: ${res.error}`;

  const deprecated = res.results.filter((r) => r.deprecated);

  if (deprecated.length === 0) {
    return `No deprecated packages currently in use (${res.results.length} dependencies checked).`;
  }

  const lines: string[] = [`${deprecated.length} deprecated package${deprecated.length === 1 ? "" : "s"} currently in use:`, ""];
  for (const r of deprecated) {
    lines.push(`  • ${r.package} (${r.currentVersion}) — ${r.deprecationNote ?? "flagged deprecated"}`);
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
