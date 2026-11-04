# Project configuration for CP20 (pull request is mandatory for changes),
# per PRD_Pull_Request_Mandatory.pdf. The repo, the client's protected-branch
# list and the audit period are fixed, human-entered config — never inferred.
import json
from pathlib import Path

from app.models import Cp20Exception, Cp20ProjectConfig

cp20_configs: list[Cp20ProjectConfig] = [
    Cp20ProjectConfig(
        projectId="project-a",
        projectLabel="PIT Armour",
        checkpointId="CP20",
        githubOwner="Anushka34567",
        githubRepo="Github_integration",
        protectedBranches=["main"],
        auditPeriodStart="2026-09-01T00:00:00Z",
        # Fixed end of the audit period (ISO 8601), or None. The day-to-day date
        # range is PR_TICKET_DATE_FROM / PR_TICKET_DATE_TO in backend/.env, which
        # overrides this when set.
        auditPeriodEnd=None,
        # Personal-account repos have no org audit log, so the date the PR rule
        # was switched on can't be read from GitHub. Set it here once the rule is
        # on (e.g. "2026-10-26T00:00:00Z") — until then it's "Not evidenced".
        ruleStartDate=None,
        ledgerId="cp-20",
    ),
]

# FR-7: the exception register — approved, time-limited permissions for specific
# direct pushes (or bot accounts), each with reason, approver and expiry.
_EXCEPTIONS_FILE = Path(__file__).resolve().parent.parent / "data" / "pr_exceptions.json"


def load_pr_exceptions() -> list[Cp20Exception]:
    if not _EXCEPTIONS_FILE.exists():
        return []
    return [Cp20Exception(**e) for e in json.loads(_EXCEPTIONS_FILE.read_text(encoding="utf-8"))]


def resolve_cp20_project(question: str) -> Cp20ProjectConfig | None:
    """Deterministic project resolution — the project label or repo name in the question."""
    q = question.lower()
    for cfg in cp20_configs:
        if cfg.project_label.lower() in q or cfg.github_repo.lower() in q:
            return cfg
    return None
