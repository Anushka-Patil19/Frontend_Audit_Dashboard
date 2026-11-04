# Reads an approval email attached to a Jira ticket (CP40) into sender, date,
# subject and body. .eml and .msg headers are parsed deterministically; a .txt
# is parsed as an email when it has headers, otherwise its fields are left for
# the LLM to extract. Anything that can't be read reliably (images, encrypted
# or nested emails, unknown formats) is flagged for a manual check instead.
import email
import io
import re
from dataclasses import dataclass
from datetime import datetime
from email import policy
from email.utils import parseaddr, parsedate_to_datetime

READABLE_EXTENSIONS = (".eml", ".msg", ".txt")
_IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tif", ".tiff", ".webp", ".heic")
_HEADER_RE = re.compile(r"^(from|subject|date|to)\s*:", re.IGNORECASE | re.MULTILINE)
_TAG_RE = re.compile(r"<[^>]+>")


@dataclass
class ParsedApprovalFile:
    kind: str  # "eml" | "msg" | "txt"
    sender_email: str | None
    sent_at: datetime | None
    subject: str | None
    body: str
    manual_reason: str | None = None  # set → can't be checked automatically


def _manual(kind: str, reason: str) -> ParsedApprovalFile:
    return ParsedApprovalFile(kind=kind, sender_email=None, sent_at=None, subject=None, body="", manual_reason=reason)


def _html_to_text(html: str) -> str:
    return re.sub(r"\s+\n", "\n", _TAG_RE.sub(" ", html)).strip()


def _parse_rfc822(data: bytes, kind: str) -> ParsedApprovalFile:
    msg = email.message_from_bytes(data, policy=policy.default)
    content_type = msg.get_content_type()
    if content_type in ("application/pkcs7-mime", "multipart/encrypted") or "smime" in content_type:
        return _manual(kind, "encrypted email")
    if any(part.get_content_type() == "message/rfc822" for part in msg.walk() if part is not msg):
        return _manual(kind, "nested (forwarded-as-attachment) email")

    body_part = msg.get_body(preferencelist=("plain", "html"))
    if body_part is None:
        return _manual(kind, "email has no readable text body (image-only?)")
    body = body_part.get_content()
    if body_part.get_content_type() == "text/html":
        body = _html_to_text(body)

    sent_at = None
    if msg["Date"]:
        try:
            sent_at = parsedate_to_datetime(str(msg["Date"]))
        except (TypeError, ValueError):
            sent_at = None
    sender = parseaddr(str(msg["From"] or ""))[1] or None
    return ParsedApprovalFile(
        kind=kind, sender_email=sender, sent_at=sent_at, subject=str(msg["Subject"] or "") or None, body=body.strip()
    )


def _parse_msg(data: bytes) -> ParsedApprovalFile:
    import extract_msg

    try:
        msg = extract_msg.openMsg(io.BytesIO(data))
    except Exception as error:
        return _manual("msg", f"unreadable .msg file ({error.__class__.__name__})")
    try:
        if getattr(msg, "isEncrypted", False):
            return _manual("msg", "encrypted email")
        if any(getattr(a, "type", None) and "msg" in str(getattr(a, "type", "")).lower() for a in msg.attachments):
            return _manual("msg", "nested (forwarded-as-attachment) email")
        body = msg.body or ""
        if not body.strip() and msg.htmlBody:
            body = _html_to_text(msg.htmlBody.decode("utf-8", "replace"))
        if not body.strip():
            return _manual("msg", "email has no readable text body (image-only?)")
        sender = parseaddr(msg.sender or "")[1] or None
        sent_at = msg.date if isinstance(msg.date, datetime) else None
        return ParsedApprovalFile(kind="msg", sender_email=sender, sent_at=sent_at, subject=msg.subject, body=body.strip())
    finally:
        msg.close()


def read_approval_file(file_name: str, data: bytes) -> ParsedApprovalFile:
    name = file_name.lower().strip()
    if name.endswith(_IMAGE_EXTENSIONS):
        return _manual("image", "image-only attachment — can't be read automatically")
    if name.endswith(".eml"):
        return _parse_rfc822(data, "eml")
    if name.endswith(".msg"):
        return _parse_msg(data)
    if name.endswith(".txt"):
        text = data.decode("utf-8-sig", "replace")
        # A .txt saved from a mail client usually keeps the headers — parse those deterministically.
        if len(_HEADER_RE.findall(text[:3000])) >= 2:
            parsed = _parse_rfc822(data, "txt")
            if parsed.manual_reason is None:
                return parsed
        return ParsedApprovalFile(kind="txt", sender_email=None, sent_at=None, subject=None, body=text.strip())
    return _manual("other", f"unsupported file type ({file_name.rsplit('.', 1)[-1] if '.' in file_name else 'none'})")
