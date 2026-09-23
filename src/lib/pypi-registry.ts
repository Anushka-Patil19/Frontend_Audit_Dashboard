// Server-only: queries PyPI's JSON endpoint for a package's latest stable
// version. No API key required — PyPI's registry API is public.
export type DeprecationSource = "official-classifier" | "maintainer-text" | null;

export type PypiLookupResult =
  | {
      ok: true;
      latestVersion: string;
      deprecated: boolean;
      deprecationNote: string | null;
      deprecationSource: DeprecationSource;
      replacementPackage: string | null;
    }
  | { ok: false; error: string };

// PyPI has no single formal "deprecated" field (unlike e.g. npm's registry,
// which has a real per-version `deprecated` boolean). Two real signals exist
// instead, checked separately so callers know which one actually fired:
//
// 1. Official — the standardized Trove classifier "Development Status ::
//    7 - Inactive" (https://pypi.org/classifiers/), a structured field
//    maintainers can set. Authoritative when present, but many genuinely
//    abandoned packages never set it (e.g. sklearn, nose-parameterized).
// 2. Maintainer text — the package's own summary/description says so in
//    plain words (e.g. sklearn: "deprecated sklearn package, use
//    scikit-learn instead"). Not structured, but still the maintainer's own
//    real statement, not a guess.
//
// Silence on both means nothing was said — not proof the package is
// definitely still maintained.
function detectClassifierInactive(classifiers: string[] | undefined): boolean {
  return (classifiers ?? []).some((c) => c.includes("Development Status :: 7 - Inactive"));
}

function detectMaintainerText(summary: string | undefined, description: string | undefined): string | null {
  const text = summary ?? "";
  if (/deprecat/i.test(text)) return text.trim();
  if (description) {
    // Deprecation notices often live in the long-form description rather
    // than the one-line summary. Pull out just the sentence(s) mentioning
    // it instead of a raw character slice, which tends to cut mid-word or
    // include markdown headers/links.
    const window = description.slice(0, 1000);
    const sentences = window.split(/(?<=[.!?])\s+|\n{2,}/);
    // Prefer the longest matching sentence — a short one is usually just a
    // markdown heading like "# Deprecation Notice", not the actual detail.
    const hit = sentences.filter((s) => /deprecat/i.test(s)).sort((a, b) => b.length - a.length)[0];
    if (hit) {
      return hit
        .replace(/^#+\s*/, "") // strip a leading markdown heading like "# Deprecation Notice"
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // strip markdown links, keep the link text
        .replace(/\s+/g, " ")
        .trim();
    }
  }
  return null;
}

// Best-effort extraction of the maintainer-suggested replacement package
// from their own deprecation note (e.g. "use scikit-learn instead", "See
// the 'parameterized' package"). Returns null rather than guessing when no
// such phrasing is found.
function extractReplacementPackage(note: string | null): string | null {
  if (!note) return null;
  // Trailing "." is sentence-ending punctuation, not part of the name, in
  // every real case seen so far (e.g. "...in favor of avro.").
  const clean = (name: string | undefined) => name?.replace(/\.$/, "") ?? null;
  const useInstead = note.match(/use\s+([A-Za-z0-9][A-Za-z0-9_.-]*)\s+instead/i);
  if (useInstead) return clean(useInstead[1]);
  const seeThe = note.match(/see\s+the\s+'([^']+)'\s+package/i);
  if (seeThe) return clean(seeThe[1]);
  const inFavorOf = note.match(/in\s+favor\s+of\s+([A-Za-z0-9][A-Za-z0-9_.-]*)/i);
  if (inFavorOf) return clean(inFavorOf[1]);
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
      info?: { version?: string; summary?: string; description?: string; classifiers?: string[] };
    };
    if (!data.info?.version) {
      return { ok: false, error: `Package "${packageName}" has no published version.` };
    }

    const isOfficiallyInactive = detectClassifierInactive(data.info.classifiers);
    const maintainerNote = detectMaintainerText(data.info.summary, data.info.description);

    let deprecationSource: DeprecationSource = null;
    let deprecationNote: string | null = null;
    if (isOfficiallyInactive) {
      deprecationSource = "official-classifier";
      deprecationNote = maintainerNote
        ? `Officially marked "Development Status :: 7 - Inactive" on PyPI. ${maintainerNote}`
        : 'Officially marked "Development Status :: 7 - Inactive" on PyPI.';
    } else if (maintainerNote) {
      deprecationSource = "maintainer-text";
      deprecationNote = maintainerNote;
    }

    return {
      ok: true,
      latestVersion: data.info.version,
      deprecated: deprecationSource !== null,
      deprecationNote,
      deprecationSource,
      replacementPackage: extractReplacementPackage(maintainerNote),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : `Registry offline for package "${packageName}".`,
    };
  }
}
