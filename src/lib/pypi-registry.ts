// Server-only: queries PyPI's JSON endpoint for a package's latest stable
// version. No API key required — PyPI's registry API is public.
export type PypiLookupResult = { ok: true; latestVersion: string } | { ok: false; error: string };

export async function fetchLatestPypiVersion(packageName: string): Promise<PypiLookupResult> {
  try {
    const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`);
    if (res.status === 404) {
      return { ok: false, error: `Package "${packageName}" not found in registry.` };
    }
    if (!res.ok) {
      return { ok: false, error: `Registry offline for package "${packageName}" (HTTP ${res.status}).` };
    }
    const data = (await res.json()) as { info?: { version?: string } };
    if (!data.info?.version) {
      return { ok: false, error: `Package "${packageName}" has no published version.` };
    }
    return { ok: true, latestVersion: data.info.version };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : `Registry offline for package "${packageName}".`,
    };
  }
}
