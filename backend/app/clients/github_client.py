# Minimal GitHub REST client — reads only (branches, pull requests, raw file
# contents), never writes. Auth is a PAT read from GITHUB_TOKEN, optional.
import base64
from typing import Any, TypedDict

import httpx

from app.settings import settings

GITHUB_API = "https://api.github.com"


def _github_headers() -> dict[str, str]:
    token = settings.github_token
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


class GithubBranch(TypedDict):
    name: str
    commit: dict[str, Any]


class GithubPull(TypedDict):
    number: int
    state: str
    merged_at: str | None
    html_url: str
    title: str
    head: dict[str, Any]
    base: dict[str, Any]


# Direct lookup by name — the branches/{branch} endpoint 404s cleanly when
# there's no match, so no need to page through the full branch list.
async def find_branch(owner: str, repo: str, branch_name: str) -> GithubBranch | None:
    async with httpx.AsyncClient() as client:
        res = await client.get(f"{GITHUB_API}/repos/{owner}/{repo}/branches/{branch_name}", headers=_github_headers())
    if res.status_code == 404:
        return None
    if res.status_code >= 400:
        raise RuntimeError(f"GitHub branch lookup failed: HTTP {res.status_code}")
    return res.json()


# GitHub's pulls endpoint supports filtering by head ref directly
# (`owner:branch`), so this never needs to page through unrelated PRs.
async def find_pull_requests_for_branch(owner: str, repo: str, branch_name: str) -> list[GithubPull]:
    params = {"state": "all", "head": f"{owner}:{branch_name}", "per_page": "20"}
    async with httpx.AsyncClient() as client:
        res = await client.get(f"{GITHUB_API}/repos/{owner}/{repo}/pulls", params=params, headers=_github_headers())
    if res.status_code >= 400:
        raise RuntimeError(f"GitHub pull request lookup failed: HTTP {res.status_code}")
    return res.json()


# merged_by is only present on the single-PR detail endpoint, not the list
# endpoint above — fetched separately, and only once a PR is already known.
async def get_pull_request(owner: str, repo: str, number: int) -> dict[str, Any]:
    async with httpx.AsyncClient() as client:
        res = await client.get(f"{GITHUB_API}/repos/{owner}/{repo}/pulls/{number}", headers=_github_headers())
    if res.status_code >= 400:
        raise RuntimeError(f"GitHub pull request detail lookup failed: HTTP {res.status_code}")
    return res.json()


class GithubFileOk(TypedDict):
    ok: bool
    content: str


class GithubFileError(TypedDict):
    ok: bool
    error: str


# Fetches a single file's raw content via the REST v3 Contents API.
# GITHUB_TOKEN is optional — public repos can be read unauthenticated, just
# at a much lower rate limit (60/hr vs 5000/hr).
async def fetch_repo_file(owner: str, repo: str, path: str, branch: str) -> GithubFileOk | GithubFileError:
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}",
                params={"ref": branch},
                headers=_github_headers(),
            )

        if res.status_code == 404:
            return {"ok": False, "error": f"{path} not found in {owner}/{repo} (branch: {branch})."}
        if res.status_code == 401:
            return {"ok": False, "error": "Unable to authenticate with GitHub API. Check GITHUB_TOKEN."}
        if res.status_code >= 400:
            return {"ok": False, "error": f"GitHub API error (HTTP {res.status_code})."}

        data = res.json()
        content = data.get("content")
        encoding = data.get("encoding")
        if not content or encoding != "base64":
            return {"ok": False, "error": f"Unexpected response shape fetching {path}."}
        return {"ok": True, "content": base64.b64decode(content).decode("utf-8")}
    except httpx.HTTPError as error:
        return {"ok": False, "error": f"Network error contacting GitHub API: {error}"}
