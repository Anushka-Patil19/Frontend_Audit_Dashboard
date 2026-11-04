# GitHub tracking: which repositories belong to which project. Edit
# app/data/github_projects.json to connect a repo — no code change needed.
#   repos[]            owner / repo / protected_branches (the client's list)
#   jira_project_keys  CR keys are only accepted for these Jira projects
#   period_start       pushes are checked from this date
#   period_end         optional cut-off: PRs (open ones included), pushes and
#                      deployments after this date are left out; null = up to now
#   deploy_window      optional {"days": [0-6, Mon=0], "start": "HH:MM", "end": "HH:MM", "tz": "Asia/Kolkata"}
import json
from pathlib import Path

from pydantic import BaseModel

_FILE = Path(__file__).resolve().parent.parent / "data" / "github_projects.json"


class TrackedRepo(BaseModel):
    owner: str
    repo: str
    protected_branches: list[str] = []


class DeployWindow(BaseModel):
    days: list[int]
    start: str
    end: str
    tz: str = "Asia/Kolkata"


class TrackedProject(BaseModel):
    name: str
    jira_project_keys: list[str] = []
    repos: list[TrackedRepo] = []
    period_start: str = "2026-09-01T00:00:00Z"
    period_end: str | None = None
    deploy_window: DeployWindow | None = None


def load_tracked_projects() -> dict[str, TrackedProject]:
    """Read fresh each call, so edits to the JSON apply without a restart."""
    raw = json.loads(_FILE.read_text(encoding="utf-8"))
    return {pid: TrackedProject(**cfg) for pid, cfg in raw.items()}
