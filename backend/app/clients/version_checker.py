# Parses requirements.txt (pkg==version lines only, per PRD scope) and
# performs semantic version comparison against the latest PyPI release.
import asyncio
import re

from app.clients.pypi_registry import fetch_latest_pypi_version
from app.models import DependencyResult

_REQUIREMENT_RE = re.compile(r"^([A-Za-z0-9_.-]+)==([A-Za-z0-9_.-]+)$")


def parse_requirements_txt(content: str) -> list[tuple[str, str]]:
    """Extracts package==version pairs, skipping comments (# ...) and blank lines."""
    results: list[tuple[str, str]] = []
    for raw_line in content.split("\n"):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        match = _REQUIREMENT_RE.match(line)
        if match:
            results.append((match.group(1), match.group(2)))
    return results


def compare_versions(a: str, b: str) -> int:
    """Compares dotted numeric version strings (major.minor.patch, any
    length). Returns negative if a < b, 0 if equal, positive if a > b."""
    if a == b:
        return 0
    parts_a = [int(p) for p in a.split(".")]
    parts_b = [int(p) for p in b.split(".")]
    length = max(len(parts_a), len(parts_b))
    for i in range(length):
        diff = (parts_a[i] if i < len(parts_a) else 0) - (parts_b[i] if i < len(parts_b) else 0)
        if diff != 0:
            return diff
    return 0


async def check_dependency(package: str, current_version: str) -> DependencyResult:
    lookup = await fetch_latest_pypi_version(package)
    if not lookup.ok:
        return DependencyResult(
            package=package,
            currentVersion=current_version,
            latestVersion=None,
            status="CHECK_FAILED",
            message=lookup.error,
            deprecated=False,
            deprecationNote=None,
            deprecationSource=None,
            replacementPackage=None,
        )
    status = "UP_TO_DATE" if compare_versions(current_version, lookup.latest_version) >= 0 else "UPDATE_AVAILABLE"
    return DependencyResult(
        package=package,
        currentVersion=current_version,
        latestVersion=lookup.latest_version,
        status=status,
        deprecated=lookup.deprecated,
        deprecationNote=lookup.deprecation_note,
        deprecationSource=lookup.deprecation_source,
        replacementPackage=lookup.replacement_package,
    )


async def check_all_dependencies(requirements_txt: str) -> list[DependencyResult]:
    deps = parse_requirements_txt(requirements_txt)
    return list(await asyncio.gather(*(check_dependency(pkg, version) for pkg, version in deps)))
