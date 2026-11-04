# Minimal GitHub REST client — reads only (branches, pull requests, raw file
# contents), never writes. Auth is a PAT read from GITHUB_TOKEN, optional.
import asyncio
import base64
from typing import Any, TypedDict

import httpx

from app.settings import settings

GITHUB_API = "https://api.github.com"
# httpx's default is 5 s for everything; GitHub occasionally takes longer to accept
# a connection, which used to surface as an unhandled ConnectTimeout.
_TIMEOUT = httpx.Timeout(20.0, connect=10.0)
_ATTEMPTS = 3


async def _get(url: str, params: dict[str, str] | None = None) -> httpx.Response:
    """GET with retries on network errors (timeouts, dropped connections). Raises
    RuntimeError — which every caller already handles — once all attempts fail."""
    last: Exception | None = None
    for attempt in range(_ATTEMPTS):
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                return await client.get(url, params=params, headers=_github_headers())
        except httpx.TransportError as error:
            last = error
            if attempt < _ATTEMPTS - 1:
                await asyncio.sleep(1 + attempt)
    raise RuntimeError(
        f"GitHub didn't respond after {_ATTEMPTS} tries ({last.__class__.__name__}) — check the network and try again"
    )


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
    res = await _get(f"{GITHUB_API}/repos/{owner}/{repo}/branches/{branch_name}")
    if res.status_code == 404:
        return None
    if res.status_code >= 400:
        raise RuntimeError(f"GitHub branch lookup failed: HTTP {res.status_code}")
    return res.json()


# GitHub's pulls endpoint supports filtering by head ref directly
# (`owner:branch`), so this never needs to page through unrelated PRs.
async def find_pull_requests_for_branch(owner: str, repo: str, branch_name: str) -> list[GithubPull]:
    params = {"state": "all", "head": f"{owner}:{branch_name}", "per_page": "20"}
    res = await _get(f"{GITHUB_API}/repos/{owner}/{repo}/pulls", params)
    if res.status_code >= 400:
        raise RuntimeError(f"GitHub pull request lookup failed: HTTP {res.status_code}")
    return res.json()


# merged_by is only present on the single-PR detail endpoint, not the list
# endpoint above — fetched separately, and only once a PR is already known.
async def get_pull_request(owner: str, repo: str, number: int) -> dict[str, Any]:
    res = await _get(f"{GITHUB_API}/repos/{owner}/{repo}/pulls/{number}")
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


# --- CP20: PR-mandatory check (read-only) --------------------------------------


class GithubRead(TypedDict):
    status: int
    data: Any


async def github_get(path: str, params: dict[str, str] | None = None) -> GithubRead:
    """Single read that reports the HTTP status instead of raising, so callers can
    tell "not set" (404) from "not readable with this token" (401/403)."""
    try:
        res = await _get(f"{GITHUB_API}{path}", params)
    except RuntimeError as error:
        # Network failure → an error status, so CP20 reports "Not evidenced" instead of crashing.
        return {"status": 503, "data": {"message": str(error)}}
    try:
        data = res.json()
    except ValueError:
        data = None
    return {"status": res.status_code, "data": data}


async def github_get_all(path: str, params: dict[str, str] | None = None, max_pages: int = 10) -> GithubRead:
    """Follows page=N until a short page (or max_pages); stops at the first error."""
    items: list[Any] = []
    for page in range(1, max_pages + 1):
        read = await github_get(path, {**(params or {}), "per_page": "100", "page": str(page)})
        if read["status"] >= 400 or not isinstance(read["data"], list):
            return read if page == 1 else {"status": 200, "data": items}
        items.extend(read["data"])
        if len(read["data"]) < 100:
            break
    return {"status": 200, "data": items}
