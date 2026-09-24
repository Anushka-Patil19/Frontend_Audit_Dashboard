from app.clients.github_client import fetch_repo_file
from app.clients.version_checker import check_all_dependencies
from app.models import DependencyMonitorError, DependencyMonitorOk, DependencyMonitorResult, DependencyResult

OWNER = "Anushka-Patil19"
REPO = "Frontend_Audit_Dashboard"
BRANCH = "main"


async def check_repo_dependencies() -> DependencyMonitorResult:
    file = await fetch_repo_file(OWNER, REPO, "requirements.txt", BRANCH)
    if not file["ok"]:
        return DependencyMonitorError(error=file["error"])
    results = await check_all_dependencies(file["content"])
    return DependencyMonitorOk(results=results)


# Reports packages needing action — either a version update, or a switch
# away from a deprecated package (regardless of whether that deprecated
# package happens to also be on its latest release — deprecation isn't
# undone by a version bump of the same abandoned package). Packages that
# are both up to date and not deprecated are left out entirely.
def format_dependency_reply(res: DependencyMonitorResult) -> str:
    if not res.ok:
        return f"Couldn't check dependencies: {res.error}"

    results: list[DependencyResult] = res.results
    updates = [r for r in results if r.status == "UPDATE_AVAILABLE" and not r.deprecated]
    deprecated = [r for r in results if r.deprecated]

    if not updates and not deprecated:
        return f"All {len(results)} tracked dependencies are up to date and none are deprecated."

    lines = [
        f"{len(updates) + len(deprecated)} of {len(results)} dependencies need action — "
        f"{len(updates)} need an update, {len(deprecated)} deprecated.",
        "",
    ]

    if updates:
        lines.append("Need an update:")
        for r in updates:
            lines.append(f"  • {r.package}: {r.current_version} → {r.latest_version}")
        lines.append("")

    if deprecated:
        lines.append("Deprecated (currently in use):")
        for r in deprecated:
            source_label = (
                "PyPI official classifier"
                if r.deprecation_source == "official-classifier"
                else "maintainer's own package description"
            )
            replacement = f" — use {r.replacement_package} instead" if r.replacement_package else ""
            lines.append(
                f"  • You're using {r.package} ({r.current_version}), but it's deprecated{replacement}. "
                f"[source: {source_label}]"
            )

    return "\n".join(lines).rstrip()
