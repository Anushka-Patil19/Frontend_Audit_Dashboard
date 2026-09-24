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


async def classify_approval_language(body: str, subject_for_context: str) -> ClassifyResult:
    # Uses Groq's free-tier hosting of OpenAI's open-weight gpt-oss model via
    # an OpenAI-compatible chat completions API — no paid API required.
    api_key = settings.groq_api_key
    if not api_key:
        return ClassifyError(error="Missing GROQ_API_KEY on the server (.env). Get a free key at console.groq.com.")

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
                                f'You classify a single email body (subject: "{subject_for_context}") for explicit approval/sign-off evidence. '
                                'Reply with EXACTLY one line of strict JSON, no other text: {"explicit": boolean, "confidence": number} '
                                "where confidence is 0-100. "
                                '"explicit" is true only if the email clearly and unconditionally confirms approval/sign-off '
                                '(e.g. "approved for implementation", "UAT passed, approved for go-live", "I sign off on this release"). '
                                '"explicit" is false for anything vague, conditional, a question, a partial approval, or unrelated content.'
                            ),
                        },
                        {"role": "user", "content": body[:6000] or "(empty email body)"},
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
