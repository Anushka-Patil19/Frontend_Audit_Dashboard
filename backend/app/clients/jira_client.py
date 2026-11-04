# Minimal Jira Cloud REST client, Basic auth (account email + API token).
# Used by both CP10 (CAB approval status) and CR-compliance (Jira approval
# status) — CP10 no longer goes through Atlassian's Rovo MCP/OAuth flow.
import functools
import re
from typing import Any

import httpx

from app.settings import settings

# Longer than httpx's 5 s default, and connection failures are retried twice.
_TIMEOUT = httpx.Timeout(30.0, connect=10.0)


def _client(**kwargs: Any) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        auth=_jira_auth(), timeout=_TIMEOUT, transport=httpx.AsyncHTTPTransport(retries=2), **kwargs
    )


def _network_errors_as_runtime(fn):
    """Callers handle RuntimeError; a network failure used to escape as an httpx
    error and crash the request (the browser then only saw "Failed to fetch")."""

    @functools.wraps(fn)
    async def wrapper(*args: Any, **kwargs: Any) -> Any:
        try:
            return await fn(*args, **kwargs)
        except httpx.TransportError as error:
            raise RuntimeError(f"Jira didn't respond ({error.__class__.__name__}) — check the network and try again") from error

    return wrapper


def _jira_auth() -> httpx.BasicAuth:
    email = settings.jira_email
    token = settings.jira_api_token
    if not email or not token:
        raise RuntimeError("JIRA_EMAIL / JIRA_API_TOKEN are not configured (set them in .env)")
    return httpx.BasicAuth(email, token)


def _jira_base_url() -> str:
    base_url = settings.jira_base_url
    if not base_url:
        raise RuntimeError("JIRA_BASE_URL is not configured (set it in .env)")
    return base_url.rstrip("/")


def jira_browse_url(issue_key: str) -> str:
    return f"{_jira_base_url()}/browse/{issue_key}"


@_network_errors_as_runtime
async def get_jira_issue(issue_key: str, fields: str = "summary,status,comment,reporter") -> dict[str, Any] | None:
    async with _client() as client:
        res = await client.get(
            f"{_jira_base_url()}/rest/api/3/issue/{issue_key}",
            params={"fields": fields},
            headers={"Accept": "application/json"},
        )
    if res.status_code == 404:
        return None
    if res.status_code >= 400:
        raise RuntimeError(f"Jira issue lookup failed: HTTP {res.status_code}")
    return res.json()


@_network_errors_as_runtime
async def get_jira_issue_with_history(issue_key: str) -> dict[str, Any] | None:
    """Issue + attachments + comments + changelog (who changed the status, when)."""
    async with _client() as client:
        res = await client.get(
            f"{_jira_base_url()}/rest/api/3/issue/{issue_key}",
            # "created" is used by the PR/ticket date range filter.
            params={"fields": "summary,status,attachment,comment,reporter,created,updated", "expand": "changelog"},
            headers={"Accept": "application/json"},
        )
    if res.status_code == 404:
        return None
    if res.status_code >= 400:
        raise RuntimeError(f"Jira issue lookup failed: HTTP {res.status_code}")
    return res.json()


@_network_errors_as_runtime
async def download_jira_attachment(content_url: str) -> bytes:
    async with _client(follow_redirects=True) as client:
        res = await client.get(content_url)
    if res.status_code >= 400:
        raise RuntimeError(f"Jira attachment download failed: HTTP {res.status_code}")
    return res.content


@_network_errors_as_runtime
async def get_jira_comment_texts(issue_key: str) -> list[str]:
    async with _client() as client:
        res = await client.get(
            f"{_jira_base_url()}/rest/api/3/issue/{issue_key}/comment",
            params={"maxResults": "100", "orderBy": "-created"},
            headers={"Accept": "application/json"},
        )
    if res.status_code >= 400:
        raise RuntimeError(f"Jira comment lookup failed: HTTP {res.status_code}")
    return [_adf_plain_text(c.get("body") or {}) for c in res.json().get("comments") or []]


@_network_errors_as_runtime
async def post_jira_comment(issue_key: str, text: str) -> None:
    """Plain-text comment, one paragraph per line."""
    body = {
        "type": "doc",
        "version": 1,
        "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": line}]} for line in text.split("\n") if line
        ],
    }
    async with _client() as client:
        res = await client.post(
            f"{_jira_base_url()}/rest/api/3/issue/{issue_key}/comment",
            json={"body": body},
            headers={"Accept": "application/json"},
        )
    if res.status_code >= 400:
        raise RuntimeError(f"Jira comment post failed: HTTP {res.status_code}")


def _adf_plain_text(node: dict[str, Any]) -> str:
    if node.get("type") == "text":
        return node.get("text") or ""
    if node.get("type") == "mention":
        return (node.get("attrs") or {}).get("text") or ""
    return "".join(_adf_plain_text(child) for child in node.get("content") or [])


def _first_mention(node: dict[str, Any]) -> str | None:
    if node.get("type") == "mention":
        return (node.get("attrs") or {}).get("text")
    for child in node.get("content") or []:
        found = _first_mention(child)
        if found:
            return found
    return None


# "merged by @Anushka" typed as plain text rather than picked as a Jira mention.
_TYPED_MERGER_RE = re.compile(r"merged\s+by\s+@([\w.\-]+)", re.IGNORECASE)


def extract_required_merger(issue: dict[str, Any]) -> str | None:
    """Looks for a comment like "The PR should be merged by @rahul" and
    returns the mentioned name ("rahul", "@" stripped) — a real Jira mention,
    or an "@name" typed as plain text. Deterministic text match — never
    LLM-guessed. The latest such comment wins."""
    comments = (issue.get("fields") or {}).get("comment", {}).get("comments") or []
    for comment in sorted(comments, key=lambda c: c.get("created") or "", reverse=True):
        body = comment.get("body") or {}
        text = _adf_plain_text(body)
        if "merged by" not in text.lower():
            continue
        mention = _first_mention(body)
        if mention:
            return mention.lstrip("@")
        typed = _TYPED_MERGER_RE.search(text)
        if typed:
            return typed.group(1)
    return None


@_network_errors_as_runtime
async def get_status_categories(project_key: str) -> dict[str, str]:
    """Status name (lower-case) → Jira status category key ("new" | "indeterminate"
    | "done") for a project, so a past status from the changelog can be classified."""
    async with _client() as client:
        res = await client.get(
            f"{_jira_base_url()}/rest/api/3/project/{project_key}/statuses", headers={"Accept": "application/json"}
        )
    if res.status_code >= 400:
        raise RuntimeError(f"Jira status lookup failed: HTTP {res.status_code}")
    categories: dict[str, str] = {}
    for issue_type in res.json():
        for status in issue_type.get("statuses") or []:
            categories[(status.get("name") or "").lower()] = (status.get("statusCategory") or {}).get("key") or ""
    return categories
