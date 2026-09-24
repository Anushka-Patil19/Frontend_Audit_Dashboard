# Queries PyPI's JSON endpoint for a package's latest stable version. No API
# key required — PyPI's registry API is public.
import re
from dataclasses import dataclass
from typing import Literal
from urllib.parse import quote

import httpx

DeprecationSource = Literal["official-classifier", "maintainer-text"] | None


@dataclass
class PypiLookupOk:
    latest_version: str
    deprecated: bool
    deprecation_note: str | None
    deprecation_source: DeprecationSource
    replacement_package: str | None
    ok: Literal[True] = True


@dataclass
class PypiLookupError:
    error: str
    ok: Literal[False] = False


PypiLookupResult = PypiLookupOk | PypiLookupError

# PyPI has no single formal "deprecated" field (unlike e.g. npm's registry).
# Two real signals exist instead, checked separately so callers know which
# one actually fired:
# 1. Official — the standardized Trove classifier "Development Status ::
#    7 - Inactive", a structured field maintainers can set.
# 2. Maintainer text — the package's own summary/description says so in
#    plain words.


def _detect_classifier_inactive(classifiers: list[str] | None) -> bool:
    return any("Development Status :: 7 - Inactive" in c for c in (classifiers or []))


_DEPRECAT_RE = re.compile(r"deprecat", re.IGNORECASE)
_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+|\n{2,}")
_HEADING_RE = re.compile(r"^#+\s*")
_MD_LINK_RE = re.compile(r"\[([^\]]+)\]\([^)]+\)")
_WHITESPACE_RE = re.compile(r"\s+")


def _detect_maintainer_text(summary: str | None, description: str | None) -> str | None:
    text = summary or ""
    if _DEPRECAT_RE.search(text):
        return text.strip()
    if description:
        # Deprecation notices often live in the long-form description rather
        # than the one-line summary. Pull out just the sentence(s) mentioning
        # it instead of a raw character slice.
        window = description[:1000]
        sentences = _SENTENCE_SPLIT_RE.split(window)
        matching = sorted((s for s in sentences if _DEPRECAT_RE.search(s)), key=len, reverse=True)
        if matching:
            hit = matching[0]
            hit = _HEADING_RE.sub("", hit)
            hit = _MD_LINK_RE.sub(r"\1", hit)
            hit = _WHITESPACE_RE.sub(" ", hit)
            return hit.strip()
    return None


_USE_INSTEAD_RE = re.compile(r"use\s+([A-Za-z0-9][A-Za-z0-9_.-]*)\s+instead", re.IGNORECASE)
_SEE_THE_RE = re.compile(r"see\s+the\s+'([^']+)'\s+package", re.IGNORECASE)
_IN_FAVOR_OF_RE = re.compile(r"in\s+favor\s+of\s+([A-Za-z0-9][A-Za-z0-9_.-]*)", re.IGNORECASE)


def _extract_replacement_package(note: str | None) -> str | None:
    if not note:
        return None

    def clean(name: str | None) -> str | None:
        return name[:-1] if name and name.endswith(".") else name

    m = _USE_INSTEAD_RE.search(note)
    if m:
        return clean(m.group(1))
    m = _SEE_THE_RE.search(note)
    if m:
        return clean(m.group(1))
    m = _IN_FAVOR_OF_RE.search(note)
    if m:
        return clean(m.group(1))
    return None


async def fetch_latest_pypi_version(package_name: str) -> PypiLookupResult:
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"https://pypi.org/pypi/{quote(package_name)}/json")

        if res.status_code == 404:
            return PypiLookupError(error=f'Package "{package_name}" not found in registry.')
        if res.status_code >= 400:
            return PypiLookupError(error=f'Registry offline for package "{package_name}" (HTTP {res.status_code}).')

        data = res.json()
        info = data.get("info") or {}
        version = info.get("version")
        if not version:
            return PypiLookupError(error=f'Package "{package_name}" has no published version.')

        is_officially_inactive = _detect_classifier_inactive(info.get("classifiers"))
        maintainer_note = _detect_maintainer_text(info.get("summary"), info.get("description"))

        deprecation_source: DeprecationSource = None
        deprecation_note: str | None = None
        if is_officially_inactive:
            deprecation_source = "official-classifier"
            deprecation_note = (
                f'Officially marked "Development Status :: 7 - Inactive" on PyPI. {maintainer_note}'
                if maintainer_note
                else 'Officially marked "Development Status :: 7 - Inactive" on PyPI.'
            )
        elif maintainer_note:
            deprecation_source = "maintainer-text"
            deprecation_note = maintainer_note

        return PypiLookupOk(
            latest_version=version,
            deprecated=deprecation_source is not None,
            deprecation_note=deprecation_note,
            deprecation_source=deprecation_source,
            replacement_package=_extract_replacement_package(maintainer_note),
        )
    except httpx.HTTPError as error:
        return PypiLookupError(error=f'Registry offline for package "{package_name}": {error}')
