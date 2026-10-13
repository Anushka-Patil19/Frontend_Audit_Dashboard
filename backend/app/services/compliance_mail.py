import html
import json
import logging
import re
import threading
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

import httpx

from app.clients.graph_auth import get_graph_access_token
from app.models_compliance import NotificationIn, NotificationOut
from app.settings import settings

# Email for the Compliance Review Dashboard. The dashboard never holds credentials: it
# posts each notification here and this sends it through Microsoft Graph.
# DEMO SAFETY: while MS_TEST_MAILBOX is set, every email goes to that mailbox only.

logger = logging.getLogger(__name__)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

_LOG_LOCK = threading.Lock()


def invalid_addresses(n: NotificationIn) -> list[str]:
    return [r.email for r in [*n.to, *n.cc] if not EMAIL_RE.match(r.email.strip())]


URL_RE = re.compile(r"https?://[^\s<>\"]+")


def _linkify(escaped: str) -> str:
    """Makes http(s) links in an already-escaped line clickable (e.g. the link to the NC page)."""
    return URL_RE.sub(lambda m: f'<a href="{m.group(0)}">{m.group(0)}</a>', escaped)


# "Label: value" at the start of a line or after " · " (e.g. "Severity: High · Owner: …").
# Labels are words only, so times ("11:40") and links ("http://") never match.
LABEL_RE = re.compile(r"(^|· )([A-Za-z][A-Za-z \-]{0,48}?):(?= )")
SEVERITY_COLOUR = {"Critical": "#b91c1c", "High": "#dc2626", "Medium": "#b45309", "Low": "#6b7280"}
SEVERITY_RE = re.compile(r"(<strong>Severity:</strong> |\[)(Critical|High|Medium|Low)\b")


def _format_line(escaped: str) -> str:
    """Bold labels and a coloured severity, on an already-escaped line."""
    out = LABEL_RE.sub(r"\1<strong>\2:</strong>", escaped)
    return SEVERITY_RE.sub(lambda m: f'{m.group(1)}<strong style="color:{SEVERITY_COLOUR[m.group(2)]}">{m.group(2)}</strong>', out)


def _email_html(n: NotificationIn) -> str:
    # Body only: the subject is already the email's subject line. Line breaks inside a
    # body line (e.g. the signature) are kept.
    parts = [f"<p>{_format_line(_linkify(html.escape(line))).replace(chr(10), '<br>')}</p>" for line in n.body]
    parts.append('<hr><p style="color:#666;font-size:12px">Sent by Audit Intelligence · Compliance Review</p>')
    return "".join(parts)


def _log_attempt(n: NotificationIn, recipient_count: int, status: str, note: str) -> None:
    """Appends one line per attempt to the mail log for traceability. Never logs secrets or bodies."""
    entry = {
        "id": n.id,
        "at": n.at,
        "loggedAt": datetime.now(timezone.utc).isoformat(),
        "kind": n.kind,
        "subject": n.subject,
        "recipientCount": recipient_count,
        "status": status,
        "note": note,
    }
    path = Path(settings.compliance_mail_log_file)
    with _LOG_LOCK:
        try:
            log = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
        except (OSError, json.JSONDecodeError):
            log = []
        log.append(entry)
        try:
            path.write_text(json.dumps(log, indent=2), encoding="utf-8")
        except OSError:
            logger.exception("Could not write the compliance mail log.")


async def _graph_send(sender: str, subject: str, body_html: str, to: list[str], cc: list[str]) -> str | None:
    """Sends through Microsoft Graph. Returns a plain error sentence, or None on success."""
    token_result = await get_graph_access_token()
    if not token_result.ok:
        return f"Microsoft Graph sign-in failed: {token_result.error}"

    message = {
        "message": {
            "subject": subject,
            "body": {"contentType": "HTML", "content": body_html},
            "toRecipients": [{"emailAddress": {"address": a}} for a in to],
            "ccRecipients": [{"emailAddress": {"address": a}} for a in cc],
        },
        "saveToSentItems": True,
    }
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"https://graph.microsoft.com/v1.0/users/{quote(sender, safe='@.')}/sendMail",
                json=message,
                headers={"Authorization": f"Bearer {token_result.access_token}"},
            )
    except httpx.HTTPError:
        logger.exception("Network error sending a compliance email.")
        return "A network error occurred while contacting Microsoft Graph."

    if res.status_code >= 400:
        try:
            graph_error = (res.json() or {}).get("error") or {}
        except ValueError:
            graph_error = {}
        details = ": ".join(v for v in (graph_error.get("code"), graph_error.get("message")) if v)
        logger.warning("Graph rejected a compliance email (HTTP %s, code %s).", res.status_code, graph_error.get("code"))
        reason = f"Microsoft Graph rejected the email (HTTP {res.status_code})" + (f": {details}" if details else "") + "."
        if res.status_code in (401, 403):
            reason += " Check that Mail.Send (Application) is admin-consented for the sender mailbox."
        return reason
    return None


async def send_notification(n: NotificationIn) -> NotificationOut:
    sender = (settings.ms_shared_mailbox or settings.ms_test_mailbox or "").strip()
    test_mailbox = (settings.ms_test_mailbox or "").strip()

    # De-duplicate: the same address can appear as owner and cc.
    to = list(dict.fromkeys(r.email.strip() for r in n.to))
    cc = [a for a in dict.fromkeys(r.email.strip() for r in n.cc) if a not in to]
    intended = len(to) + len(cc)

    if not sender:
        out = NotificationOut(status="failed", note="No sender mailbox is configured on the server (MS_SHARED_MAILBOX).")
    elif not to:
        out = NotificationOut(status="failed", note="The email has no recipients.")
    else:
        if test_mailbox:
            # Redirected to the test mailbox only. The intended recipients are not written into the email.
            error = await _graph_send(sender, n.subject, _email_html(n), [test_mailbox], [])
            ok_note = f"Sent to the test mailbox {test_mailbox} (intended for {intended} recipient{'s' if intended != 1 else ''})."
        else:
            error = await _graph_send(sender, n.subject, _email_html(n), to, cc)
            ok_note = f"Sent to {intended} recipient{'s' if intended != 1 else ''}."
        out = NotificationOut(status="failed", note=error) if error else NotificationOut(status="sent", note=ok_note)

    _log_attempt(n, intended, out.status, out.note)
    return out
