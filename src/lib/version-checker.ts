// Parses requirements.txt (pkg==version lines only, per PRD scope) and
// performs semantic version comparison against the latest PyPI release.
import { fetchLatestPypiVersion } from "./pypi-registry";

export type DependencyStatus = "UP_TO_DATE" | "UPDATE_AVAILABLE" | "CHECK_FAILED";

export type DependencyResult = {
  package: string;
  currentVersion: string;
  latestVersion: string | null;
  status: DependencyStatus;
  message?: string;
};

// Extracts package==version pairs, skipping comments (# ...) and blank lines.
export function parseRequirementsTxt(content: string): { package: string; version: string }[] {
  const results: { package: string; version: string }[] = [];
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z0-9_.-]+)==([A-Za-z0-9_.-]+)$/);
    if (match) results.push({ package: match[1], version: match[2] });
  }
  return results;
}

// Compares dotted numeric version strings (major.minor.patch, any length).
// Returns negative if a < b, 0 if equal, positive if a > b.
export function compareVersions(a: string, b: string): number {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);
  const length = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < length; i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export async function checkDependency(pkg: string, currentVersion: string): Promise<DependencyResult> {
  const lookup = await fetchLatestPypiVersion(pkg);
  if (!lookup.ok) {
    return { package: pkg, currentVersion, latestVersion: null, status: "CHECK_FAILED", message: lookup.error };
  }
  const status: DependencyStatus = compareVersions(currentVersion, lookup.latestVersion) >= 0 ? "UP_TO_DATE" : "UPDATE_AVAILABLE";
  return { package: pkg, currentVersion, latestVersion: lookup.latestVersion, status };
}

export async function checkAllDependencies(requirementsTxt: string): Promise<DependencyResult[]> {
  const deps = parseRequirementsTxt(requirementsTxt);
  return Promise.all(deps.map((d) => checkDependency(d.package, d.version)));
}
