# Core flow, framework-agnostic — mirrors src/lib/cp38-verify.ts's verifyCp38.
import httpx

from app.clients.approval_classifier import classify_approval_language
from app.clients.evidence_screenshot import capture_approval_email_screenshot
from app.clients.graph_auth import get_graph_access_token
from app.models import Cp38ProjectConfig, Cp38Result, Cp38VerifyResponse
from app.settings import settings
from app.utils import now_iso


def copilot_reply_text(cfg: Cp38ProjectConfig, result: Cp38Result) -> str:
    if result.outcome_id == "CP38-C":
        return (
            f"CP38 - Business UAT Sign-off: Compliant\n"
            f"Signed off by {cfg.authorized_name} ({cfg.authorized_email}), confidence {result.confidence}%."
        )
    if result.pending_reason == "no_email":
        return (
            f"CP38 - Business UAT Sign-off: Pending\n"
            f"No sign-off email has been received yet for {cfg.project_label}."
        )
    if result.pending_reason == "wrong_sender":
        return (
            f"CP38 - Business UAT Sign-off: Pending\n"
            f"An email was received, but from {result.wrong_sender_email} - this is not\n"
            f"the authorized signer for {cfg.project_label} (expected {cfg.authorized_email}).\n"
            f"Still awaiting sign-off from the correct owner."
        )
    # ambiguous_language
    return (
        f"CP38 - Business UAT Sign-off: Pending\n"
        f"An email was received from the authorized signer ({cfg.authorized_email}), but the "
        f"sign-off language was not explicit enough to confirm. Awaiting clearer confirmation."
    )


async def verify_cp38(cfg: Cp38ProjectConfig) -> Cp38VerifyResponse:
    timestamp = now_iso()

    token_result = await get_graph_access_token()
    if not token_result.ok:
        return Cp38VerifyResponse(
            config=cfg, result=None, reply=f"Copilot couldn't reach the mailbox: {token_result.error}"
        )

    shared_mailbox = settings.ms_shared_mailbox or settings.ms_test_mailbox
    if not shared_mailbox:
        return Cp38VerifyResponse(
            config=cfg,
            result=None,
            reply="No shared mailbox configured (set MS_SHARED_MAILBOX or MS_TEST_MAILBOX in .env).",
        )

    # Step 3: targeted subject search — never a full inbox scan.
    message = None
    try:
        params = {
            "$search": f'"subject:{cfg.subject_match}"',
            "$top": "10",
            "$select": "id,from,body,subject,receivedDateTime",
        }
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
            return Cp38VerifyResponse(config=cfg, result=None, reply=f"Copilot couldn't search the mailbox: {error}")

        needle = cfg.subject_match.lower()
        raw = search_data.get("value") or []
        candidates = [m for m in raw if needle in (m.get("subject") or "").lower()]
        candidates.sort(key=lambda m: m.get("receivedDateTime") or "", reverse=True)
        message = candidates[0] if candidates else None
    except httpx.HTTPError as error:
        return Cp38VerifyResponse(config=cfg, result=None, reply=f"Mailbox search failed: {error}")

    # Step 4 / Case 2 — no matching email at all.
    if not message:
        result = Cp38Result(
            project_id=cfg.project_id,
            outcome_id="CP38-Pending",
            pending_reason="no_email",
            wrong_sender_email=None,
            confidence=None,
            evidence_ref=None,
            evidence_screenshot=None,
            approver_actor=None,
            timestamp=timestamp,
        )
        return Cp38VerifyResponse(config=cfg, result=result, reply=copilot_reply_text(cfg, result))

    sender = (message.get("from") or {}).get("emailAddress", {}).get("address") or ""

    # Evidence of the email that was actually found — captured as soon as
    # any message exists, regardless of sender/language outcome.
    message_id = message.get("id")
    screenshot_file_name = None
    if message_id:
        screenshot_file_name = await capture_approval_email_screenshot(
            checkpoint="cp38",
            project_id=cfg.project_id,
            message_id=message_id,
            mailbox=shared_mailbox,
            access_token=token_result.access_token,
            subject=message.get("subject") or "",
            from_=sender,
            received_date_time=message.get("receivedDateTime") or "",
        )

    # Step 5/6 / Case 3 — deterministic sender check runs BEFORE any LLM call.
    if sender.lower() != cfg.authorized_email.lower():
        result = Cp38Result(
            project_id=cfg.project_id,
            outcome_id="CP38-Pending",
            pending_reason="wrong_sender",
            wrong_sender_email=sender,
            confidence=None,
            evidence_ref=message_id,
            evidence_screenshot=screenshot_file_name,
            approver_actor=None,
            timestamp=timestamp,
        )
        return Cp38VerifyResponse(config=cfg, result=result, reply=copilot_reply_text(cfg, result))

    # Step 7/8 — sender matches, so now (and only now) the LLM classifies the body's language.
    classification = await classify_approval_language(
        (message.get("body") or {}).get("content") or "", message.get("subject") or ""
    )
    if not classification.ok:
        return Cp38VerifyResponse(
            config=cfg,
            result=None,
            reply=f"Sender verified, but the sign-off language check failed: {classification.error}",
        )

    if classification.value.explicit:
        result = Cp38Result(
            project_id=cfg.project_id,
            outcome_id="CP38-C",
            pending_reason=None,
            wrong_sender_email=None,
            confidence=classification.value.confidence,
            evidence_ref=message_id,
            evidence_screenshot=screenshot_file_name,
            approver_actor=cfg.authorized_email,
            timestamp=timestamp,
        )
    else:
        result = Cp38Result(
            project_id=cfg.project_id,
            outcome_id="CP38-Pending",
            pending_reason="ambiguous_language",
            wrong_sender_email=None,
            confidence=classification.value.confidence,
            evidence_ref=message_id,
            evidence_screenshot=screenshot_file_name,
            approver_actor=cfg.authorized_email,
            timestamp=timestamp,
        )

    return Cp38VerifyResponse(config=cfg, result=result, reply=copilot_reply_text(cfg, result))
