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

// Reports packages needing action — either a version update, or a switch
// away from a deprecated package (regardless of whether that deprecated
// package happens to also be on its latest release — deprecation isn't
// undone by a version bump of the same abandoned package). Packages that
// are both up to date and not deprecated are left out entirely.
export function formatDependencyReply(res: DependencyMonitorResult): string {
  if (!res.ok) return `Couldn't check dependencies: ${res.error}`;

  const { results } = res;
  const updates = results.filter((r) => r.status === "UPDATE_AVAILABLE" && !r.deprecated);
  const deprecated = results.filter((r) => r.deprecated);

  if (updates.length === 0 && deprecated.length === 0) {
    return `All ${results.length} tracked dependencies are up to date and none are deprecated.`;
  }

  const lines: string[] = [
    `${updates.length + deprecated.length} of ${results.length} dependencies need action — ${updates.length} need an update, ${deprecated.length} deprecated.`,
    "",
  ];

  if (updates.length > 0) {
    lines.push("Need an update:");
    for (const r of updates) lines.push(`  • ${r.package}: ${r.currentVersion} → ${r.latestVersion}`);
    lines.push("");
  }

  if (deprecated.length > 0) {
    lines.push("Deprecated (currently in use):");
    for (const r of deprecated) {
      const sourceLabel =
        r.deprecationSource === "official-classifier"
          ? "PyPI official classifier"
          : "maintainer's own package description";
      lines.push(
        `  • You're using ${r.package} (${r.currentVersion}), but it's deprecated${r.replacementPackage ? ` — use ${r.replacementPackage} instead` : ""}. [source: ${sourceLabel}]`,
      );
    }
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
