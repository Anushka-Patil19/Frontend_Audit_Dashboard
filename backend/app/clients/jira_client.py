# Minimal Jira Cloud REST client, Basic auth (account email + API token).
# Used by both CP10 (CAB approval status) and CR-compliance (Jira approval
# status) — CP10 no longer goes through Atlassian's Rovo MCP/OAuth flow.
from typing import Any

import httpx

from app.settings import settings


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


async def get_jira_issue(issue_key: str) -> dict[str, Any] | None:
    async with httpx.AsyncClient(auth=_jira_auth()) as client:
        res = await client.get(
            f"{_jira_base_url()}/rest/api/3/issue/{issue_key}",
            params={"fields": "summary,status,comment,reporter"},
            headers={"Accept": "application/json"},
        )
    if res.status_code == 404:
        return None
    if res.status_code >= 400:
        raise RuntimeError(f"Jira issue lookup failed: HTTP {res.status_code}")
    return res.json()


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


def extract_required_merger(issue: dict[str, Any]) -> str | None:
    """Looks for a comment like "The PR should be merged by @rahul" and
    returns the mentioned name ("rahul", "@" stripped). Deterministic text +
    mention match — never LLM-guessed."""
    comments = (issue.get("fields") or {}).get("comment", {}).get("comments") or []
    for comment in comments:
        body = comment.get("body") or {}
        text = _adf_plain_text(body).lower()
        if "merged by" not in text:
            continue
        mention = _first_mention(body)
        if mention:
            return mention.lstrip("@")
    return None
