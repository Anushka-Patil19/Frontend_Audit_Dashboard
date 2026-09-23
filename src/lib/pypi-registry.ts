// Server-only: queries PyPI's JSON endpoint for a package's latest stable
// version. No API key required — PyPI's registry API is public.
export type PypiLookupResult =
  | {
      ok: true;
      latestVersion: string;
      deprecated: boolean;
      deprecationNote: string | null;
      replacementPackage: string | null;
    }
  | { ok: false; error: string };

// PyPI has no formal "deprecated" field — this reads the package's own
// summary/description for maintainers explicitly saying so (e.g. sklearn:
// "deprecated sklearn package, use scikit-learn instead"; nose-parameterized:
// "...DEPRECATED; See the 'parameterized' package"). Real signal from the
// registry, not a guess — silence just means nothing was said, not that the
// package is definitely still maintained.
function detectDeprecation(summary: string | undefined, description: string | undefined): string | null {
  const text = summary ?? "";
  if (/deprecat/i.test(text)) return text;
  if (description && /deprecat/i.test(description.slice(0, 500))) return description.slice(0, 200);
  return null;
}

// Best-effort extraction of the maintainer-suggested replacement package
// from their own deprecation note (e.g. "use scikit-learn instead", "See
// the 'parameterized' package"). Returns null rather than guessing when no
// such phrasing is found.
function extractReplacementPackage(note: string | null): string | null {
  if (!note) return null;
  const useInstead = note.match(/use\s+([A-Za-z0-9][A-Za-z0-9_.-]*)\s+instead/i);
  if (useInstead) return useInstead[1] ?? null;
  const seeThe = note.match(/see\s+the\s+'([^']+)'\s+package/i);
  if (seeThe) return seeThe[1] ?? null;
  return null;
}

export async function fetchLatestPypiVersion(packageName: string): Promise<PypiLookupResult> {
  try {
    const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`);
    if (res.status === 404) {
      return { ok: false, error: `Package "${packageName}" not found in registry.` };
    }
    if (!res.ok) {
      return { ok: false, error: `Registry offline for package "${packageName}" (HTTP ${res.status}).` };
    }
    const data = (await res.json()) as {
      info?: { version?: string; summary?: string; description?: string };
    };
    if (!data.info?.version) {
      return { ok: false, error: `Package "${packageName}" has no published version.` };
    }
    const deprecationNote = detectDeprecation(data.info.summary, data.info.description);
    return {
      ok: true,
      latestVersion: data.info.version,
      deprecated: deprecationNote !== null,
      deprecationNote,
      replacementPackage: extractReplacementPackage(deprecationNote),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : `Registry offline for package "${packageName}".`,
    };
  }
}
