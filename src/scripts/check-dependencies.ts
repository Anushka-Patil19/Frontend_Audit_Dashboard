// Standalone check for the GitHub Dependency Version Monitoring POC:
// fetches requirements.txt from a GitHub repo, checks each pinned version
// against PyPI's latest release, and prints the status table.
//
// Run: npm run check-deps
import { fetchRepoFile } from "../lib/github-client";
import { checkAllDependencies } from "../lib/version-checker";

const OWNER = "Anushka-Patil19";
const REPO = "Frontend_Audit_Dashboard";
const BRANCH = "main";

async function main() {
  console.log(`Fetching requirements.txt from ${OWNER}/${REPO}@${BRANCH} ...`);
  const file = await fetchRepoFile(OWNER, REPO, "requirements.txt", BRANCH);
  if (!file.ok) {
    console.error(`❌ ${file.error}`);
    process.exit(1);
  }

  const results = await checkAllDependencies(file.content);
  const upToDate = results.filter((r) => r.status === "UP_TO_DATE").length;
  const updateAvailable = results.filter((r) => r.status === "UPDATE_AVAILABLE").length;
  const failed = results.filter((r) => r.status === "CHECK_FAILED").length;

  console.log(`\nTotal: ${results.length}  |  Up to date: ${upToDate}  |  Updates available: ${updateAvailable}  |  Failed: ${failed}\n`);

  for (const r of results) {
    const icon = r.status === "UP_TO_DATE" ? "✅" : r.status === "UPDATE_AVAILABLE" ? "⚠️" : "❌";
    const latest = r.latestVersion ?? "?";
    const deprecatedTag = r.deprecated ? " ⚠️ DEPRECATED" : "";
    console.log(`${icon} ${r.package.padEnd(20)} current=${r.currentVersion.padEnd(12)} latest=${latest.padEnd(12)} ${r.status}${r.message ? ` (${r.message})` : ""}${deprecatedTag}`);
  }
}

main().catch((error) => {
  console.error("Dependency check failed:", error);
  process.exit(1);
});
