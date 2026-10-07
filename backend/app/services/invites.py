import html
import json
import secrets
from datetime import datetime, timezone
from pathlib import Path

import httpx

from app.clients.graph_auth import get_graph_access_token
from app.models import CreateInviteRequest, CreateInviteResponse, Invite
from app.settings import settings

# POC invite store: one JSON file keyed by token. An invite grants a read-only,
# developer-only view of a single project — the token in the link is the only
# credential, so it is long and random and never listed back to the browser.


def _store_path() -> Path:
    return Path(settings.invites_file)


def _load() -> dict[str, dict]:
    path = _store_path()
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def _save(invites: dict[str, dict]) -> None:
    _store_path().write_text(json.dumps(invites, indent=2), encoding="utf-8")


def get_invite(token: str) -> Invite | None:
    raw = _load().get(token)
    return Invite.model_validate(raw) if raw else None


def _email_html(invite: Invite, link: str) -> str:
    project = html.escape(invite.project_name)
    inviter = html.escape(invite.invited_by or "Your manager")
    href = html.escape(link, quote=True)
    return (
        f"<p>{inviter} has invited you to view <b>{project}</b> on Audit Intelligence as a developer.</p>"
        f'<p><a href="{href}">Open your developer view</a></p>'
        f"<p>This link is for {html.escape(invite.email)} only and shows the developer view of {project}.</p>"
    )


async def _send_invite_email(invite: Invite, link: str) -> str | None:
    """Sends the invite via Microsoft Graph. Returns an error message, or None on success."""
    sender = settings.ms_shared_mailbox or settings.ms_test_mailbox
    if not sender:
        return "No sender mailbox configured (MS_SHARED_MAILBOX / MS_TEST_MAILBOX)."

    token_result = await get_graph_access_token()
    if not token_result.ok:
        return token_result.error

    message = {
        "message": {
            "subject": f"You're invited to view {invite.project_name} (developer view)",
            "body": {"contentType": "HTML", "content": _email_html(invite, link)},
            "toRecipients": [{"emailAddress": {"address": invite.email}}],
        },
        "saveToSentItems": True,
    }
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"https://graph.microsoft.com/v1.0/users/{sender}/sendMail",
                json=message,
                headers={"Authorization": f"Bearer {token_result.access_token}"},
            )
    except httpx.HTTPError as error:
        return f"Network error contacting Microsoft Graph: {error}"

    if res.status_code >= 400:
        try:
            detail = (res.json().get("error") or {}).get("message")
        except ValueError:
            detail = None
        return detail or (
            f"Graph rejected sendMail (HTTP {res.status_code}). Check Mail.Send (Application) is admin-consented."
        )
    return None


async def create_invite(req: CreateInviteRequest) -> CreateInviteResponse:
    invite = Invite(
        token=secrets.token_urlsafe(24),
        email=req.email.strip().lower(),
        project_id=req.project_id,
        project_name=req.project_name,
        invited_by=req.invited_by,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    invites = _load()
    invites[invite.token] = invite.model_dump(by_alias=True)
    _save(invites)

    link = f"{settings.frontend_origin.rstrip('/')}/invite/{invite.token}"
    email_error = await _send_invite_email(invite, link)
    return CreateInviteResponse(invite=invite, link=link, email_sent=email_error is None, email_error=email_error)
