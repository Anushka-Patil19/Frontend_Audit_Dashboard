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

export function formatDependencyReply(res: DependencyMonitorResult): string {
  if (!res.ok) return `Couldn't check dependencies: ${res.error}`;

  const { results } = res;
  const updates = results.filter((r) => r.status === "UPDATE_AVAILABLE");
  const deprecated = results.filter((r) => r.deprecated);
  const failed = results.filter((r) => r.status === "CHECK_FAILED");
  const upToDate = results.filter((r) => r.status === "UP_TO_DATE" && !r.deprecated);

  if (updates.length === 0 && deprecated.length === 0 && failed.length === 0) {
    return `All ${results.length} tracked dependencies are up to date and none are deprecated.`;
  }

  const lines: string[] = [
    `${results.length} dependencies tracked — ${updates.length} need an update, ${deprecated.length} deprecated, ${upToDate.length} up to date${failed.length ? `, ${failed.length} failed` : ""}.`,
    "",
  ];

  if (updates.length > 0) {
    lines.push("Need an update:");
    for (const r of updates) lines.push(`  • ${r.package}: ${r.currentVersion} → ${r.latestVersion}`);
    lines.push("");
  }

  if (deprecated.length > 0) {
    lines.push("Deprecated:");
    for (const r of deprecated) lines.push(`  • ${r.package} (${r.currentVersion}) — ${r.deprecationNote ?? "flagged deprecated"}`);
    lines.push("");
  }

  if (failed.length > 0) {
    lines.push("Failed to check:");
    for (const r of failed) lines.push(`  • ${r.package} — ${r.message}`);
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
