# Core flow, framework-agnostic. Mirrors CP38's structure deliberately: a
# cheap deterministic gate (Jira status) runs before an expensive one (mail
# search), sender identity is a deterministic string match, and the LLM
# only ever classifies language — never identity or eligibility — and only
# once both gates ahead of it have already passed.
#
# Jira access is direct REST + Basic auth (app/clients/jira_client.py), same
# as CR-compliance — the TS version's Atlassian Rovo MCP/OAuth flow was
# dropped in the Python port; no interactive login step required here.
import httpx

from app.clients.approval_classifier import classify_approval_language
from app.clients.evidence_screenshot import capture_approval_email_screenshot
from app.clients.graph_auth import get_graph_access_token
from app.clients.jira_client import get_jira_issue
from app.models import Cp10GateStatus, Cp10ProjectConfig, Cp10Result, Cp10VerifyResponse
from app.settings import settings
from app.utils import now_iso


def _initial_gates() -> Cp10GateStatus:
    return Cp10GateStatus(jira="pending", mail="pending", llm="pending")


def cp10_reply_text(
    cfg: Cp10ProjectConfig,
    result: Cp10Result,
    approver_name: str | None,
    actual_status: str | None = None,
    wrong_sender_email: str | None = None,
) -> str:
    if result.outcome_id == "CP10-C":
        approver = approver_name or result.approver_actor
        return (
            f"CP10 — CAB Approval: Compliant\n"
            f"{cfg.jira_ticket} was approved by {approver}, the authorized CAB approver for "
            f"{cfg.project_label}. Confidence: {result.confidence}%."
        )
    if result.pending_reason == "not_ready":
        status_note = f" (current status: {actual_status})" if actual_status else ""
        return f"CP10 — CAB Approval: Pending\n{cfg.jira_ticket} has not yet reached CAB approval stage{status_note}."
    if result.pending_reason == "wrong_sender":
        if wrong_sender_email:
            return (
                f"CP10 — CAB Approval: Pending\n"
                f"An email was received, but from {wrong_sender_email} — this is not the authorized "
                f"CAB approver for {cfg.project_label}."
            )
        return f"CP10 — CAB Approval: Pending\nNo CAB approval email has been received yet for {cfg.jira_ticket}."
    # ambiguous
    return (
        f"CP10 — CAB Approval: Pending\n"
        f"An email was received from the authorized CAB approver, but the approval language was not "
        f"explicit enough to confirm."
    )


async def verify_cp10(cfg: Cp10ProjectConfig) -> Cp10VerifyResponse:
    timestamp = now_iso()
    gates = _initial_gates()

    # Step 3 — fetch the Jira ticket via direct REST.
    try:
        issue = await get_jira_issue(cfg.jira_ticket)
    except RuntimeError as error:
        return Cp10VerifyResponse(config=cfg, result=None, gates=gates, reply=f"Copilot couldn't reach Jira: {error}")
    if not issue:
        return Cp10VerifyResponse(
            config=cfg, result=None, gates=gates, reply=f"Copilot couldn't find {cfg.jira_ticket} in Jira."
        )

    fields = issue.get("fields") or {}
    status_name: str = (fields.get("status") or {}).get("name") or "Unknown"
    reporter = fields.get("reporter") or {}
    reporter_email: str | None = reporter.get("emailAddress")
    reporter_name: str | None = reporter.get("displayName")

    # Step 4 — Jira gate. Fails → stop here, mail is never even searched.
    if status_name != "Pending CAB Approval":
        gates.jira = "failed"
        result = Cp10Result(
            project_id=cfg.project_id,
            jira_ticket=cfg.jira_ticket,
            outcome_id="CP10-Pending",
            pending_reason="not_ready",
            approver_actor=None,
            confidence=None,
            evidence_ref=None,
            evidence_screenshot=None,
            timestamp=timestamp,
        )
        return Cp10VerifyResponse(
            config=cfg, result=result, gates=gates, reply=cp10_reply_text(cfg, result, reporter_name, status_name)
        )
    gates.jira = "passed"

    if not reporter_email:
        return Cp10VerifyResponse(
            config=cfg,
            result=None,
            gates=gates,
            reply=f"Jira gate passed, but {cfg.jira_ticket} has no reporter email to authorize against.",
        )

    # Step 5 — mail gate: search only runs because the Jira gate passed.
    token_result = await get_graph_access_token()
    if not token_result.ok:
        return Cp10VerifyResponse(
            config=cfg,
            result=None,
            gates=gates,
            reply=f"Jira gate passed, but the mailbox couldn't be reached: {token_result.error}",
        )
    shared_mailbox = settings.ms_shared_mailbox or settings.ms_test_mailbox
    if not shared_mailbox:
        return Cp10VerifyResponse(
            config=cfg,
            result=None,
            gates=gates,
            reply="No shared mailbox configured (set MS_SHARED_MAILBOX or MS_TEST_MAILBOX in .env).",
        )

    message = None
    try:
        or_query = " OR ".join(f"subject:{s}" for s in cfg.subject_matches)
        params = {"$search": f'"{or_query}"', "$top": "10", "$select": "id,from,body,subject,receivedDateTime"}
        async with httpx.AsyncClient() as client:
            search_res = await client.get(
                f"https://graph.microsoft.com/v1.0/users/{shared_mailbox}/messages",
                params=params,
                headers={
                    "Authorization": f"Bearer {token_result.access_token}",
                    "Prefer": 'outlook.body-content-type="text"',
                    "ConsistencyLevel": "eventual",
                },
            )
        search_data = search_res.json()
        if search_res.status_code >= 400:
            error = (search_data.get("error") or {}).get("message") or f"HTTP {search_res.status_code}"
            return Cp10VerifyResponse(
                config=cfg, result=None, gates=gates, reply=f"Copilot couldn't search the mailbox: {error}"
            )
        needles = [s.lower() for s in cfg.subject_matches]
        candidates = [
            m for m in (search_data.get("value") or []) if any(n in (m.get("subject") or "").lower() for n in needles)
        ]
        candidates.sort(key=lambda m: m.get("receivedDateTime") or "", reverse=True)
        message = candidates[0] if candidates else None
    except httpx.HTTPError as error:
        return Cp10VerifyResponse(config=cfg, result=None, gates=gates, reply=f"Mailbox search failed: {error}")

    # Step 6 — deterministic sender check. The PRD's pending_reason enum
    # (not_ready | wrong_sender | ambiguous) has no separate "no email"
    # value, so both "nothing found" and "found but wrong sender" map to
    # wrong_sender.
    if not message:
        gates.mail = "failed"
        result = Cp10Result(
            project_id=cfg.project_id,
            jira_ticket=cfg.jira_ticket,
            outcome_id="CP10-Pending",
            pending_reason="wrong_sender",
            approver_actor=None,
            confidence=None,
            evidence_ref=None,
            evidence_screenshot=None,
            timestamp=timestamp,
        )
        return Cp10VerifyResponse(
            config=cfg,
            result=result,
            gates=gates,
            reply=cp10_reply_text(cfg, result, reporter_name, status_name, None),
        )

    sender = (message.get("from") or {}).get("emailAddress", {}).get("address") or ""
    message_id = message.get("id")

    # Evidence of the email that was actually found — captured as soon as
    # any message exists, regardless of sender/language outcome.
    screenshot_file_name = None
    if message_id:
        screenshot_file_name = await capture_approval_email_screenshot(
            checkpoint="cp10",
            project_id=cfg.project_id,
            message_id=message_id,
            mailbox=shared_mailbox,
            access_token=token_result.access_token,
            subject=message.get("subject") or "",
            from_=sender,
            received_date_time=message.get("receivedDateTime") or "",
        )

    if sender.lower() != reporter_email.lower():
        gates.mail = "failed"
        result = Cp10Result(
            project_id=cfg.project_id,
            jira_ticket=cfg.jira_ticket,
            outcome_id="CP10-Pending",
            pending_reason="wrong_sender",
            approver_actor=None,
            confidence=None,
            evidence_ref=message_id,
            evidence_screenshot=screenshot_file_name,
            timestamp=timestamp,
        )
        return Cp10VerifyResponse(
            config=cfg,
            result=result,
            gates=gates,
            reply=cp10_reply_text(cfg, result, reporter_name, status_name, sender),
        )
    gates.mail = "passed"

    # Step 7 — LLM checks approval language, only now that sender matched.
    classification = await classify_approval_language(
        (message.get("body") or {}).get("content") or "", message.get("subject") or ""
    )
    if not classification.ok:
        return Cp10VerifyResponse(
            config=cfg,
            result=None,
            gates=gates,
            reply=f"Sender verified, but the approval-language check failed: {classification.error}",
        )
    gates.llm = "passed" if classification.value.explicit else "failed"

    if classification.value.explicit:
        result = Cp10Result(
            project_id=cfg.project_id,
            jira_ticket=cfg.jira_ticket,
            outcome_id="CP10-C",
            pending_reason=None,
            approver_actor=reporter_email,
            confidence=classification.value.confidence,
            evidence_ref=message_id,
            evidence_screenshot=screenshot_file_name,
            timestamp=timestamp,
        )
    else:
        result = Cp10Result(
            project_id=cfg.project_id,
            jira_ticket=cfg.jira_ticket,
            outcome_id="CP10-Pending",
            pending_reason="ambiguous",
            approver_actor=reporter_email,
            confidence=classification.value.confidence,
            evidence_ref=message_id,
            evidence_screenshot=screenshot_file_name,
            timestamp=timestamp,
        )

    return Cp10VerifyResponse(
        config=cfg, result=result, gates=gates, reply=cp10_reply_text(cfg, result, reporter_name, status_name)
    )
