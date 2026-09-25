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
# `selector`, when given, crops the screenshot to that element instead of
# the full page.
async def _render_and_save(page_html: str, file_name: str, selector: str | None = None) -> str:
    # On Windows, uvicorn --reload runs a SelectorEventLoop, which can't spawn
    # subprocesses — so Playwright gets its own Proactor loop on a worker thread.
    return await asyncio.to_thread(_render_and_save_in_own_loop, page_html, file_name, selector)


def _render_and_save_in_own_loop(page_html: str, file_name: str, selector: str | None) -> str:
    loop = asyncio.ProactorEventLoop() if sys.platform == "win32" else asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_playwright_render_and_save(page_html, file_name, selector))
    finally:
        loop.close()


async def _playwright_render_and_save(page_html: str, file_name: str, selector: str | None) -> str:
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        try:
            page = await browser.new_page(viewport={"width": 900, "height": 600})
            await page.set_content(page_html, wait_until="networkidle")
            if selector:
                buffer = await page.locator(selector).screenshot()
            else:
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


# CP16 dependency monitoring evidence — rendered from the live PyPI check
# results (not a static image), so the screenshot always reflects what
# requirements.txt looked like at the moment the check ran. Same "log and
# swallow" failure policy as the email capture above.
async def capture_dependency_alerts_screenshot(results: list, checked_at: datetime) -> str | None:
    try:
        flagged = [r for r in results if r.status == "UPDATE_AVAILABLE" or r.deprecated]
        rows: list[str] = []
        for r in flagged:
            if r.deprecated:
                source = (
                    "PyPI official classifier (Development Status :: 7 - Inactive)"
                    if r.deprecation_source == "official-classifier"
                    else "maintainer's own package description"
                )
                replacement = f" — use {html.escape(r.replacement_package)} instead" if r.replacement_package else ""
                rows.append(
                    f"""<div class="row">
  <div class="line"><span class="pkg">{html.escape(r.package)}</span>
    <span class="ver">→ {html.escape(r.replacement_package or "see notice")}</span>
    <span class="tag dep">deprecated</span></div>
  <div class="note">You're using {html.escape(r.package)} ({html.escape(r.current_version)}), but it's deprecated{replacement}.
    <div class="src">Source: {source}</div></div>
</div>"""
                )
            else:
                rows.append(
                    f"""<div class="row"><div class="line"><span class="pkg">{html.escape(r.package)}</span>
    <span class="ver">{html.escape(r.current_version)} → {html.escape(r.latest_version or "?")}</span>
    <span class="tag upd">update</span></div></div>"""
                )

        updates = sum(1 for r in flagged if not r.deprecated)
        deprecated = len(flagged) - updates
        body = "".join(rows) or '<div class="empty">Everything is up to date.</div>'
        captured = checked_at.astimezone(ZoneInfo("Asia/Kolkata")).strftime("%d %b %Y, %I:%M:%S %p IST")

        page_html = f"""<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {{ font-family: -apple-system, "Segoe UI", Arial, sans-serif; margin: 0; padding: 16px; background: #fff; }}
  .card {{ width: 400px; background: #fff; border: 1px solid #dfe1e6; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,.08); }}
  .head {{ padding: 12px 14px; border-bottom: 1px solid #ebecf0; }}
  .title {{ font-size: 14px; font-weight: 600; color: #172b4d; }}
  .meta {{ font-size: 11px; color: #6b778c; margin-top: 3px; }}
  .list {{ padding: 8px; }}
  .row {{ padding: 7px 8px; font-size: 13px; }}
  .line {{ display: flex; justify-content: space-between; gap: 8px; align-items: center; }}
  .pkg {{ font-family: Consolas, monospace; color: #172b4d; }}
  .ver {{ font-family: Consolas, monospace; color: #97a0af; flex: 1; text-align: center; }}
  .tag {{ font-weight: 600; }}
  .upd {{ color: #b7791f; }}
  .dep {{ color: #c9372c; }}
  .note {{ margin-top: 5px; padding: 5px 7px; border: 1px solid #f5c2bd; background: #fdecea; border-radius: 4px; color: #c9372c; font-size: 12px; }}
  .src {{ font-size: 10px; opacity: .75; margin-top: 3px; }}
  .empty {{ padding: 10px 8px; font-size: 12px; color: #6b778c; }}
</style>
</head>
<body>
  <div class="card">
    <div class="head">
      <div class="title">Dependency alerts</div>
      <div class="meta">requirements.txt · {len(results)} tracked · {updates} update, {deprecated} deprecated · captured {html.escape(captured)}</div>
    </div>
    <div class="list">{body}</div>
  </div>
</body>
</html>"""

        file_name = f"cp16-dependencies-{checked_at.strftime('%Y%m%d%H%M%S%f')}.png"
        return await _render_and_save(page_html, file_name, selector=".card")
    except Exception as error:
        print(f"CP16 dependency screenshot capture failed: {error}")
        return None


async def read_evidence_screenshot(file_name: str) -> bytes | None:
    if not _SAFE_FILENAME.match(file_name):
        return None
    try:
        return (_evidence_dir() / file_name).read_bytes()
    except OSError:
        return None
