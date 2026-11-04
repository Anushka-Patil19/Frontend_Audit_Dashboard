# CP40 — production deployment request is approved. Checked from the Jira
# ticket and the approval email the approver attaches to it (the mailbox is
# never scanned), per Jira_Attachment_Evidence_Check.pdf:
#   1 ticket approved   → status is the configured approved status
#   2 approver          → whoever moved it to that status is on the authorised list
#   3 attachment        → an email file (.eml/.msg/.txt) added by that same approver
#   4 read the file     → sender = approver, dated before deployment, subject names
#                         the step, and the LLM reads the content as an approval
# Steps 1-3 and the header checks are deterministic; the LLM only judges content
# (and extracts fields from a header-less .txt).
import hashlib
import re
from datetime import datetime, timezone

from app.clients.approval_classifier import read_approval_document
from app.clients.attachment_reader import READABLE_EXTENSIONS, read_approval_file
from app.clients.evidence_screenshot import _evidence_dir, capture_jira_status_screenshot
from app.clients.jira_client import (
    download_jira_attachment,
    get_jira_comment_texts,
    get_jira_issue_with_history,
    jira_browse_url,
    post_jira_comment,
)
from app.models import Cp40GateStatus, Cp40ProjectConfig, Cp40Result, Cp40VerifyResponse
from app.settings import settings
from app.utils import now_iso

_OUTCOME_LABEL = {
    "CP40-C": "Compliant",
    "CP40-Pending": "Pending",
    "CP40-NC": "Non-compliant",
    "CP40-Manual": "Manual check",
}


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _approval_transition(issue: dict, approved_status: str) -> dict | None:
    """Author of the most recent change of status to the approved status."""
    latest = None
    for history in (issue.get("changelog") or {}).get("histories") or []:
        for item in history.get("items") or []:
            if item.get("field") == "status" and _norm(item.get("toString") or "") == _norm(approved_status):
                if latest is None or (history.get("created") or "") > (latest.get("created") or ""):
                    latest = history
    return latest


def _reply(cfg: Cp40ProjectConfig, result: Cp40Result) -> str:
    head = f"CP40 - Production deployment approval ({cfg.jira_ticket}): {_OUTCOME_LABEL[result.outcome_id]}"
    if result.outcome_id == "CP40-C":
        return (
            f"{head}\n"
            f"Approved by {result.approver_name} ({result.approver_email}); approval email "
            f'"{result.attachment_name}" attached by the approver and confirmed as an approval.'
        )
    return head + "\n" + "\n".join(f"- {r}" for r in result.reasons)


async def _post_result_comment(cfg: Cp40ProjectConfig, result: Cp40Result) -> bool:
    """Posts the result on the ticket so the team sees what's missing. Skipped when
    the identical message is already there, so re-running the check doesn't spam it."""
    if not settings.jira_post_result_comments:
        return False
    text = f"[Audit agent] {_reply(cfg, result)}"
    try:
        if _norm(text) in {_norm(t) for t in await get_jira_comment_texts(cfg.jira_ticket)}:
            return False
        await post_jira_comment(cfg.jira_ticket, text)
        return True
    except RuntimeError as error:
        print(f"CP40: couldn't post the result comment on {cfg.jira_ticket}: {error}")
        return False


async def verify_cp40(cfg: Cp40ProjectConfig) -> Cp40VerifyResponse:
    timestamp = now_iso()
    gates = Cp40GateStatus(ticket="pending", approver="pending", attachment="pending", content="pending")

    try:
        issue = await get_jira_issue_with_history(cfg.jira_ticket)
    except RuntimeError as error:
        return Cp40VerifyResponse(config=cfg, result=None, gates=gates, reply=f"Copilot couldn't reach Jira: {error}")
    if issue is None:
        return Cp40VerifyResponse(
            config=cfg, result=None, gates=gates, reply=f"Jira ticket {cfg.jira_ticket} was not found."
        )

    fields = issue.get("fields") or {}
    status = (fields.get("status") or {}).get("name") or "Unknown"
    result = Cp40Result(
        project_id=cfg.project_id,
        jira_ticket=cfg.jira_ticket,
        jira_url=jira_browse_url(cfg.jira_ticket),
        outcome_id="CP40-Pending",
        reasons=[],
        jira_status=status,
        timestamp=timestamp,
    )

    async def finish(outcome: str, reasons: list[str]) -> Cp40VerifyResponse:
        result.outcome_id = outcome  # type: ignore[assignment]
        result.reasons = reasons
        result.comment_posted = await _post_result_comment(cfg, result)
        return Cp40VerifyResponse(config=cfg, result=result, gates=gates, reply=_reply(cfg, result))

    # 1 · Ticket approved
    if _norm(status) != _norm(cfg.approved_status):
        gates.ticket = "failed"
        return await finish(
            "CP40-Pending", [f"{cfg.jira_ticket} is {status} in Jira — it must be {cfg.approved_status} first."]
        )
    gates.ticket = "passed"

    # 2 · Approver — the person who set the approved status, on the authorised list
    transition = _approval_transition(issue, cfg.approved_status)
    author = (transition or {}).get("author") or {}
    approver_email = (author.get("emailAddress") or "").strip()
    result.approver_name = author.get("displayName")
    result.approver_email = approver_email or None
    if not approver_email:
        gates.approver = "failed"
        return await finish(
            "CP40-Manual",
            ["Couldn't tell from Jira who approved the ticket (no status change found, or the email is hidden)."],
        )
    if approver_email.lower() not in {a.lower() for a in cfg.authorized_approvers}:
        gates.approver = "failed"
        return await finish(
            "CP40-NC",
            [f"Approved by {result.approver_name} ({approver_email}), who is not on the authorised approver list."],
        )
    gates.approver = "passed"

    # 3 · Attachment — an email file added by that same approver
    attachments = fields.get("attachment") or []
    if not attachments:
        gates.attachment = "failed"
        return await finish(
            "CP40-Pending",
            [
                f"Approved, but no approval email is attached. Add a comment on {cfg.jira_ticket} and attach the "
                f'approval email (.eml, .msg or .txt) with the subject "{cfg.step_name} – {cfg.jira_ticket}".'
            ],
        )
    by_approver = sorted(
        (a for a in attachments if ((a.get("author") or {}).get("emailAddress") or "").lower() == approver_email.lower()),
        key=lambda a: a.get("created") or "",
        reverse=True,
    )
    if not by_approver:
        others = ", ".join(sorted({(a.get("author") or {}).get("displayName") or "someone" for a in attachments}))
        gates.attachment = "failed"
        return await finish(
            "CP40-NC", [f"The attached file(s) were added by {others}, not by the approver {result.approver_name}."]
        )
    readable = [a for a in by_approver if (a.get("filename") or "").lower().strip().endswith(READABLE_EXTENSIONS)]
    chosen = (readable or by_approver)[0]
    result.attachment_name = chosen.get("filename")
    result.attachment_author = (chosen.get("author") or {}).get("displayName")
    gates.attachment = "passed"

    try:
        data = await download_jira_attachment(chosen["content"])
    except (RuntimeError, KeyError) as error:
        return Cp40VerifyResponse(
            config=cfg, result=None, gates=gates, reply=f"Couldn't download {result.attachment_name}: {error}"
        )
    result.attachment_sha256 = hashlib.sha256(data).hexdigest()

    # 4 · Read the file
    parsed = read_approval_file(result.attachment_name or "", data)
    if parsed.manual_reason:
        return await finish(
            "CP40-Manual", [f"{result.attachment_name}: {parsed.manual_reason} — sent to a person to check."]
        )

    reading = await read_approval_document(
        step_name=cfg.step_name, ticket_key=cfg.jira_ticket, subject=parsed.subject, body=parsed.body
    )
    if not reading.ok:
        return Cp40VerifyResponse(
            config=cfg, result=None, gates=gates, reply=f"Attachment found, but reading it failed: {reading.error}"
        )
    doc = reading.value

    # Headers parsed from the file win; the LLM's reading only fills gaps (header-less .txt).
    sender = parsed.sender_email or doc.sender_email
    sent_at = parsed.sent_at or _parse_iso(doc.sent_date)
    if sent_at and not sent_at.tzinfo:
        sent_at = sent_at.replace(tzinfo=timezone.utc)
    subject = parsed.subject or doc.subject
    result.email_from = sender
    result.email_date = sent_at.isoformat() if sent_at else None
    result.email_subject = subject.strip() if subject else None
    result.email_excerpt = parsed.body[:400] or None
    result.llm_approved = doc.approved
    result.llm_confidence = doc.confidence
    result.llm_reason = doc.reason or None

    reasons: list[str] = []
    if not sender:
        reasons.append("The email's sender couldn't be found in the file.")
    elif sender.lower() != approver_email.lower():
        reasons.append(f"The email was sent by {sender}, not the approver ({approver_email}).")

    deployment_at = _parse_iso(cfg.deployment_at)
    if not sent_at:
        reasons.append("The email's date couldn't be found in the file.")
    elif deployment_at and sent_at > deployment_at:
        reasons.append(f"The email is dated {sent_at:%d %b %Y %H:%M} UTC, after the deployment ({deployment_at:%d %b %Y %H:%M} UTC).")
    elif not deployment_at and sent_at > datetime.now(timezone.utc):
        reasons.append(f"The email is dated in the future ({sent_at:%d %b %Y %H:%M} UTC).")

    if not subject or _norm(cfg.step_name) not in _norm(subject):
        reasons.append(
            f'The subject "{(subject or "").strip() or "(none)"}" doesn\'t name the step "{cfg.step_name}" '
            f'(use e.g. "{cfg.step_name} – {cfg.jira_ticket}").'
        )

    if not doc.approved:
        reasons.append(f"The email doesn't clearly approve the deployment: {doc.reason or 'no approval found'}.")

    if reasons:
        gates.content = "failed"
        return await finish("CP40-NC", reasons)
    gates.content = "passed"

    # Compliant — store the file and its hash, and screenshot the ticket for the auditor.
    extension = "." + (result.attachment_name or "file").rsplit(".", 1)[-1].strip().lower()
    safe_key = re.sub(r"[^A-Za-z0-9_-]", "_", cfg.jira_ticket)
    evidence_dir = _evidence_dir()
    evidence_dir.mkdir(parents=True, exist_ok=True)
    evidence_file = f"cp40-{safe_key}-{result.attachment_sha256[:12]}{extension}"
    (evidence_dir / evidence_file).write_bytes(data)
    result.evidence_file = evidence_file
    result.evidence_screenshot = await capture_jira_status_screenshot(
        issue_key=cfg.jira_ticket,
        summary=fields.get("summary") or "",
        status=status,
        reporter=(fields.get("reporter") or {}).get("displayName"),
        updated=fields.get("updated") or timestamp,
        url=result.jira_url,
        checkpoint="cp40",
    )
    return await finish("CP40-C", [])
