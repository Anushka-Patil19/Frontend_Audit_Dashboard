# Shared LLM classification step, reused by CP38 (UAT sign-off) and CP10
# (CAB approval) — both need the exact same narrow judgment: does this email
# body contain EXPLICIT approval language, or not. Never used for identity —
# callers must already have deterministically verified the sender first.
import json
import re
from dataclasses import dataclass
from typing import Literal

import httpx

from app.settings import settings


@dataclass
class ApprovalClassification:
    explicit: bool
    confidence: int


@dataclass
class ClassifyOk:
    value: ApprovalClassification
    ok: Literal[True] = True


@dataclass
class ClassifyError:
    error: str
    ok: Literal[False] = False


ClassifyResult = ClassifyOk | ClassifyError

_JSON_OBJECT_RE = re.compile(r"\{[^{}]*\}")


async def classify_approval_language(
    body: str, subject_for_context: str, *, subject_counts: bool = False
) -> ClassifyResult:
    # Uses Groq's free-tier hosting of OpenAI's open-weight gpt-oss model via
    # an OpenAI-compatible chat completions API — no paid API required.
    # subject_counts=True (CP38): the sign-off may be stated in the subject line OR the
    # body, so both are classified. Otherwise (CP10) the subject is context only.
    api_key = settings.groq_api_key
    if not api_key:
        return ClassifyError(error="Missing GROQ_API_KEY on the server (.env). Get a free key at console.groq.com.")

    if subject_counts:
        scope = (
            "You classify a single email (subject line and body) for explicit approval/sign-off evidence. "
            "The confirmation may be stated in EITHER the subject line OR the body; one of them is enough. "
            'A subject that only names or requests a sign-off (e.g. "UAT sign-off request", "Sign-off needed?") '
            "is not a confirmation on its own. "
            "Words like \"signed off\" appearing in the email do NOT make it a sign-off by themselves: judge what the email actually says. "
            '"explicit" is false when the sign-off words appear only in a question, a status enquiry, or a statement '
            "that approval is still pending, for example: "
            '"What is the status of UAT signed off?", "Is UAT signed off yet?", "UAT signed off? still getting approval", '
            '"Still awaiting approval", "Not yet signed off", "Sign-off pending from business", '
            '"Will sign off once the fixes are in". '
            "If the email both mentions a sign-off and says approval is still pending or awaited, it is NOT a sign-off. "
            "Judge only the sender's own new text: ignore quoted earlier messages in a reply/forward thread "
            '(text below "From:", "On ... wrote:", or "-----Original Message-----"). '
        )
        user_content = f"Subject: {subject_for_context or '(no subject)'}\n\nBody:\n{body[:6000] or '(empty email body)'}"
    else:
        scope = f'You classify a single email body (subject: "{subject_for_context}") for explicit approval/sign-off evidence. '
        user_content = body[:6000] or "(empty email body)"

    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"content-type": "application/json", "authorization": f"Bearer {api_key}"},
                json={
                    "model": "openai/gpt-oss-20b",
                    "temperature": 0,
                    "max_tokens": 200,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                scope
                                + 'Reply with EXACTLY one line of strict JSON, no other text: {"explicit": boolean, "confidence": number} '
                                "where confidence is 0-100. "
                                '"explicit" is true only if the email clearly and unconditionally confirms approval/sign-off '
                                '(e.g. "approved for implementation", "UAT passed, approved for go-live", "I sign off on this release", '
                                '"UAT signed off"). '
                                '"explicit" is false for anything vague, conditional, a question, a partial approval, or unrelated content.'
                            ),
                        },
                        {"role": "user", "content": user_content},
                    ],
                },
            )
        data = res.json()

        if res.status_code >= 400:
            error = data.get("error", {}).get("message") or f"Groq API error (HTTP {res.status_code})."
            return ClassifyError(error=error)

        text = (data.get("choices") or [{}])[0].get("message", {}).get("content", "").strip()
        match = _JSON_OBJECT_RE.search(text)
        if not match:
            # Parse failure is treated as "couldn't confirm explicit language" —
            # the safe default, never silently promoted to Compliant.
            return ClassifyOk(value=ApprovalClassification(explicit=False, confidence=0))

        parsed = json.loads(match.group(0))
        confidence = parsed.get("confidence")
        return ClassifyOk(
            value=ApprovalClassification(
                explicit=parsed.get("explicit") is True,
                confidence=round(confidence) if isinstance(confidence, (int, float)) else 0,
            )
        )
    except (httpx.HTTPError, json.JSONDecodeError, KeyError, TypeError) as error:
        return ClassifyError(error=f"Failed to classify approval language: {error}")


# --- CP40: read an approval email attached to a Jira ticket -------------------


@dataclass
class ApprovalDocument:
    approved: bool
    confidence: int
    reason: str
    # Only filled when the file had no parseable headers (plain .txt): the LLM's
    # reading of who sent it, when, and the subject line.
    sender_email: str | None
    sent_date: str | None
    subject: str | None


@dataclass
class DocumentOk:
    value: ApprovalDocument
    ok: Literal[True] = True


DocumentResult = DocumentOk | ClassifyError


async def read_approval_document(*, step_name: str, ticket_key: str, subject: str | None, body: str) -> DocumentResult:
    """Decides whether an attached email/text explicitly approves the step, and
    (for a header-less .txt) extracts sender, date and subject from the text."""
    api_key = settings.groq_api_key
    if not api_key:
        return ClassifyError(error="Missing GROQ_API_KEY on the server (.env). Get a free key at console.groq.com.")

    system = (
        f'You read ONE approval document attached to Jira ticket {ticket_key} for the step "{step_name}". '
        "It is usually an email (headers may be missing). Reply with EXACTLY one line of strict JSON, no other text: "
        '{"approved": boolean, "confidence": number, "reason": string, '
        '"sender_email": string|null, "sent_date": string|null, "subject": string|null}. '
        '"approved" is true only if the author clearly and unconditionally approves this step '
        '(e.g. "Approved for production", "I approve it", "Go ahead with the production deployment"); '
        "informal or ungrammatical wording still counts if the meaning is a clear approval. "
        '"approved" is false for a request for approval, a question, a conditional or partial approval, '
        "a rejection, or unrelated content. Judge only the author's own new text, not quoted earlier messages. "
        '"reason" is one short sentence. "confidence" is 0-100. '
        'sender_email / sent_date (ISO 8601, e.g. "2026-10-21T09:13:33Z") / subject: take them from the text '
        "when it shows them (e.g. From:/Date:/Subject: lines), otherwise null — never guess."
    )
    user = f"Subject: {subject or '(none)'}\n\n{body[:6000] or '(empty)'}"

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            res = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"content-type": "application/json", "authorization": f"Bearer {api_key}"},
                json={
                    "model": "openai/gpt-oss-20b",
                    "temperature": 0,
                    "max_tokens": 800,
                    "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                },
            )
        data = res.json()
        if res.status_code >= 400:
            error = data.get("error", {}).get("message") or f"Groq API error (HTTP {res.status_code})."
            return ClassifyError(error=error)

        text = (data.get("choices") or [{}])[0].get("message", {}).get("content", "").strip()
        match = _JSON_OBJECT_RE.search(text)
        if not match:
            # Same safe default as above: unreadable output is never promoted to approved.
            return DocumentOk(
                value=ApprovalDocument(False, 0, "The model's answer couldn't be read.", None, None, None)
            )
        parsed = json.loads(match.group(0))
        confidence = parsed.get("confidence")

        def _str(key: str) -> str | None:
            value = parsed.get(key)
            return value.strip() if isinstance(value, str) and value.strip() else None

        return DocumentOk(
            value=ApprovalDocument(
                approved=parsed.get("approved") is True,
                confidence=round(confidence) if isinstance(confidence, (int, float)) else 0,
                reason=_str("reason") or "",
                sender_email=_str("sender_email"),
                sent_date=_str("sent_date"),
                subject=_str("subject"),
            )
        )
    except (httpx.HTTPError, json.JSONDecodeError, KeyError, TypeError) as error:
        return ClassifyError(error=f"Failed to read the approval document: {error}")
