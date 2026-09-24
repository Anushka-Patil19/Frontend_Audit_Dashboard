# Shared by both CP10 (CAB approval) and CP38 (UAT sign-off) — both need the
# same "screenshot the verified approval email as evidence" step, just for
# a different mailbox search.
import asyncio
import html
import re
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
from playwright.async_api import async_playwright

from app.settings import settings

_SAFE_FILENAME = re.compile(r"^[A-Za-z0-9_-]+\.png$")


def _evidence_dir() -> Path:
    path = Path(settings.evidence_dir)
    return path if path.is_absolute() else Path.cwd() / path


# Graph returns receivedDateTime in UTC (e.g. "2026-09-17T11:52:10Z") — the
# approver and auditors reading this screenshot are on IST, so render it in
# their timezone rather than as a raw UTC ISO string.
def _format_ist(iso_date_time: str) -> str:
    try:
        date = datetime.fromisoformat(iso_date_time.replace("Z", "+00:00"))
    except ValueError:
        return iso_date_time
    ist = date.astimezone(ZoneInfo("Asia/Kolkata"))
    return ist.strftime("%d %b %Y, %I:%M:%S %p IST")


def _mail_evidence_file_name(checkpoint: str, project_id: str, message_id: str) -> str:
    safe_message_id = re.sub(r"[^A-Za-z0-9_-]", "_", message_id)
    return f"{checkpoint}-{project_id}-{safe_message_id}.png"


# Shared by both capture functions below: launch headless Chromium, render
# the given HTML, screenshot it, and save under evidence/<fileName>.
async def _render_and_save(page_html: str, file_name: str) -> str:
    # On Windows, uvicorn --reload runs a SelectorEventLoop, which can't spawn
    # subprocesses — so Playwright gets its own Proactor loop on a worker thread.
    return await asyncio.to_thread(_render_and_save_in_own_loop, page_html, file_name)


def _render_and_save_in_own_loop(page_html: str, file_name: str) -> str:
    loop = asyncio.ProactorEventLoop() if sys.platform == "win32" else asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_playwright_render_and_save(page_html, file_name))
    finally:
        loop.close()


async def _playwright_render_and_save(page_html: str, file_name: str) -> str:
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        try:
            page = await browser.new_page(viewport={"width": 900, "height": 600})
            await page.set_content(page_html, wait_until="networkidle")
            buffer = await page.screenshot(full_page=True)

            evidence_dir = _evidence_dir()
            evidence_dir.mkdir(parents=True, exist_ok=True)
            (evidence_dir / file_name).write_bytes(buffer)
            return file_name
        finally:
            await browser.close()


# Called only once the checkpoint's mail gate and LLM gate have both
# passed (i.e. only for a Compliant outcome) — this never runs off
# unverified mail. A failure here is logged and swallowed: the screenshot
# is an evidence nicety, not part of the compliance decision itself.
async def capture_approval_email_screenshot(
    *,
    checkpoint: str,
    project_id: str,
    message_id: str,
    mailbox: str,
    access_token: str,
    subject: str,
    from_: str,
    received_date_time: str,
) -> str | None:
    try:
        async with httpx.AsyncClient() as client:
            body_res = await client.get(
                f"https://graph.microsoft.com/v1.0/users/{mailbox}/messages/{message_id}",
                params={"$select": "body"},
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Prefer": 'outlook.body-content-type="html"',
                },
            )
        body_data = body_res.json()
        content = (body_data.get("body") or {}).get("content")
        if body_res.status_code >= 400 or not content:
            print(
                f"{checkpoint.upper()} screenshot: couldn't fetch HTML body for message {message_id}: "
                f"{(body_data.get('error') or {}).get('message') or f'HTTP {body_res.status_code}'}"
            )
            return None

        page_html = f"""<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {{ font-family: -apple-system, "Segoe UI", Arial, sans-serif; margin: 0; background: #fff; }}
  .email-header {{ border-bottom: 1px solid #ddd; padding: 16px 20px; background: #f7f7f8; }}
  .email-header .subject {{ font-size: 16px; font-weight: 600; color: #111; margin-bottom: 6px; }}
  .email-header div {{ margin: 2px 0; font-size: 13px; color: #444; }}
  .email-body {{ padding: 20px; font-size: 14px; color: #111; }}
</style>
</head>
<body>
  <div class="email-header">
    <div class="subject">{html.escape(subject)}</div>
    <div>From: {html.escape(from_)}</div>
    <div>Received: {html.escape(_format_ist(received_date_time))}</div>
  </div>
  <div class="email-body">{content}</div>
</body>
</html>"""

        return await _render_and_save(page_html, _mail_evidence_file_name(checkpoint, project_id, message_id))
    except Exception as error:
        print(f"{checkpoint.upper()} screenshot capture failed: {error}")
        return None


async def read_evidence_screenshot(file_name: str) -> bytes | None:
    if not _SAFE_FILENAME.match(file_name):
        return None
    try:
        return (_evidence_dir() / file_name).read_bytes()
    except OSError:
        return None
