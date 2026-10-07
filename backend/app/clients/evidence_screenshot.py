# Shared by both CP10 (CAB approval) and CP38 (UAT sign-off) — both need the
# same "screenshot the verified approval email as evidence" step, just for
# a different mailbox search.
import asyncio
import html
import os
import re
import sys
import threading
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
async def _render_and_save(page_html: str, file_name: str, selector: str | None = None, width: int = 900) -> str:
    # On Windows, uvicorn --reload runs a SelectorEventLoop, which can't spawn
    # subprocesses — so Playwright gets its own Proactor loop on a worker thread.
    return await asyncio.to_thread(_render_and_save_in_own_loop, page_html, file_name, selector, width)


def _render_and_save_in_own_loop(page_html: str, file_name: str, selector: str | None, width: int) -> str:
    return _run_in_own_loop(_playwright_render_and_save(page_html, file_name, selector, width))


async def _playwright_render_and_save(page_html: str, file_name: str, selector: str | None, width: int) -> str:
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        try:
            page = await browser.new_page(viewport={"width": width, "height": 600})
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


def _outlook_session_path() -> Path:
    path = Path(settings.outlook_session_file)
    return path if path.is_absolute() else Path.cwd() / path


# Opens the message's own Outlook on the web link (Graph `webLink`) in the
# saved Outlook login and screenshots what Outlook actually shows. Returns
# None when there's no saved login or it has expired, so the caller falls
# back to rendering the email from Graph. An email already captured from
# Outlook is reused rather than opened again — the message itself can't change.
async def _capture_outlook_web(web_link: str, file_name: str) -> str | None:
    if (_evidence_dir() / file_name).exists():
        return file_name
    session = _outlook_session_path()
    if not session.exists():
        return None
    return await asyncio.to_thread(_locked_outlook_capture, web_link, file_name, session)


# CP10 and CP38 can capture at the same time, and each one writes the
# refreshed login back to the same session file — run them one at a time so
# those writes can't interleave and corrupt the file.
_outlook_session_lock = threading.Lock()


def _locked_outlook_capture(web_link: str, file_name: str, session: Path) -> str | None:
    with _outlook_session_lock:
        return _run_in_own_loop(_playwright_outlook_capture(web_link, file_name, session))


def _run_in_own_loop(coro):
    loop = asyncio.ProactorEventLoop() if sys.platform == "win32" else asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _playwright_outlook_capture(web_link: str, file_name: str, session: Path) -> str | None:
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        try:
            context = await browser.new_context(storage_state=str(session), viewport={"width": 1280, "height": 800})
            page = await context.new_page()
            await page.goto(web_link, wait_until="domcontentloaded", timeout=45_000)
            try:
                await page.wait_for_selector('[aria-label="Message body"], [role="document"]', timeout=30_000)
            except Exception:
                pass
            if "login.microsoftonline.com" in page.url or "login.live.com" in page.url:
                print("Outlook screenshot: saved login has expired — run `python -m scripts.outlook_login` again.")
                return None
            await page.wait_for_timeout(2_000)  # let fonts/images settle
            buffer = await page.screenshot()
            # Write back whatever Outlook refreshed, so the saved login keeps renewing while it's in use.
            # Written to a temp file and swapped in, so a crash mid-write never leaves a half-written session.
            tmp = session.with_suffix(session.suffix + ".tmp")
            await context.storage_state(path=str(tmp))
            os.replace(tmp, session)

            evidence_dir = _evidence_dir()
            evidence_dir.mkdir(parents=True, exist_ok=True)
            (evidence_dir / file_name).write_bytes(buffer)
            return file_name
        finally:
            await browser.close()


# A stable avatar colour per sender name, like Outlook's initials avatars.
_AVATAR_COLOURS = [("#e8c7ee", "#6b2a7a"), ("#c7e0f4", "#1f4e79"), ("#cfe8cf", "#2b6a2b"),
                   ("#fde7c4", "#8a5300"), ("#f4cfcf", "#8a2a2a"), ("#d9d2f4", "#4a3a8a")]


def _display_name(address: dict) -> str:
    return address.get("name") or address.get("address") or ""


def _recipients_html(recipients: list) -> str:
    return "; ".join(
        f'<span class="person" title="{html.escape((r.get("emailAddress") or {}).get("address") or "")}">'
        f'<span class="presence"></span>{html.escape(_display_name(r.get("emailAddress") or {}))}</span>'
        for r in recipients
    )


# Outlook on the web shows e.g. "Thu 01/10/2026 14:53" in the reader's timezone.
def _format_outlook_date(iso_date_time: str) -> str:
    try:
        date = datetime.fromisoformat(iso_date_time.replace("Z", "+00:00"))
    except ValueError:
        return iso_date_time
    return date.astimezone(ZoneInfo("Asia/Kolkata")).strftime("%a %d/%m/%Y %H:%M")


_TOOLBAR = [
    ("&#128465; Delete &#709;", False), ("&#128452; Archive", True), ("&#128737; Report &#709;", False),
    ("&#128193; Move to &#709;", False), ("&#8630; Reply", False), ("&#8630; Reply all", False),
    ("&#8631; Forward &#709;", False), ("&#128269; Zoom", False), ("&#9873; &#709;", False),
    ("&#128424;", False), ("&#8943;", False),
]


# Rebuilds the email in Outlook on the web's reading-pane layout from Graph
# data, so evidence looks the same whether or not a saved Outlook login is
# available — no one has to sign in for this path. The footer says it was
# rendered from Graph, so it's never passed off as a live Outlook capture.
def _outlook_style_html(
    *, subject: str, sender: dict, to: list, cc: list, received_date_time: str, body_html: str, message_id: str
) -> str:
    name = _display_name(sender)
    bg, ink = _AVATAR_COLOURS[sum(map(ord, name)) % len(_AVATAR_COLOURS)]
    cc_row = f'<div class="recips">Cc: {_recipients_html(cc)}</div>' if cc else ""
    toolbar = "".join(f'<span class="{"dim" if dim else ""}">{label}</span>' for label, dim in _TOOLBAR)
    return f"""<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  * {{ box-sizing: border-box; }}
  body {{ font-family: "Segoe UI", -apple-system, Arial, sans-serif; margin: 0; background: #faf9f8; color: #242424; }}
  .toolbar {{ margin: 8px; background: #fff; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,.12);
             padding: 7px 14px; display: flex; gap: 20px; font-size: 14px; white-space: nowrap; filter: grayscale(1); }}
  .toolbar .dim {{ color: #a19f9d; }}
  .subject {{ font-size: 20px; padding: 14px 34px 10px; }}
  .card {{ margin: 0 18px 12px; background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.14);
          padding: 16px 16px 20px; }}
  .head {{ display: flex; gap: 12px; }}
  .avatar {{ width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
            background: {bg}; color: {ink}; font-weight: 600; flex: none; }}
  .meta {{ flex: 1; min-width: 0; }}
  .from {{ font-size: 14px; font-weight: 600; }}
  .from .addr {{ font-weight: 400; color: #616161; }}
  .recips {{ font-size: 12px; color: #424242; margin-top: 3px; }}
  .presence {{ display: inline-block; width: 8px; height: 8px; border: 1px solid #8a8886; border-radius: 50%;
              margin-right: 3px; }}
  .actions {{ text-align: right; font-size: 12px; color: #424242; white-space: nowrap; }}
  .actions .links {{ color: #5c2e91; margin-bottom: 8px; }}
  .avatar, .actions .links {{ font-variant-emoji: text; }}
  .body {{ margin: 18px 0 0 52px; font-size: 15px; line-height: 1.4; overflow-wrap: anywhere; }}
  .buttons {{ margin: 16px 0 0 52px; display: flex; gap: 6px; }}
  .buttons span {{ border: 1px solid #d1d1d1; border-radius: 4px; padding: 3px 12px; font-size: 12px; }}
  .stamp {{ margin: 0 18px 18px; font-size: 11px; color: #8a8886; }}
</style>
</head>
<body>
  <div class="toolbar">{toolbar}</div>
  <div class="subject">{html.escape(subject)}</div>
  <div class="card">
    <div class="head">
      <div class="avatar">{html.escape((name[:1] or "?").upper())}</div>
      <div class="meta">
        <div class="from">{html.escape(name)} <span class="addr">&lt;{html.escape(sender.get("address") or "")}&gt;</span></div>
        <div class="recips">To: {_recipients_html(to)}</div>
        {cc_row}
      </div>
      <div class="actions">
        <div class="links">&#9786; &nbsp; &#8630; Reply &nbsp; &#8630; Reply all &nbsp; &#8631; Forward &nbsp; &#8943;</div>
        <div>{html.escape(_format_outlook_date(received_date_time))}</div>
      </div>
    </div>
    <div class="body">{body_html}</div>
    <div class="buttons"><span>&#8630; Reply</span><span>&#8631; Forward</span></div>
  </div>
  <div class="stamp">Rendered from Microsoft Graph &middot; Message-ID {html.escape(message_id)}</div>
</body>
</html>"""


def _pr_evidence_file_name(owner: str, repo: str, number: int, updated_at: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9_-]", "_", f"{owner}-{repo}-pr{number}-{updated_at}")
    return f"cr-{safe}.png"


# Screenshots the pull request's own GitHub page as evidence. Public repos
# need no login; for a private one GitHub serves its 404 page, which is
# detected and treated as "no screenshot". The file name carries the PR's
# updated_at, so a PR that hasn't changed since is reused rather than reopened.
async def capture_pull_request_screenshot(
    *, owner: str, repo: str, number: int, pr_url: str, updated_at: str
) -> str | None:
    file_name = _pr_evidence_file_name(owner, repo, number, updated_at)
    if (_evidence_dir() / file_name).exists():
        return file_name
    try:
        return await asyncio.to_thread(_run_in_own_loop, _playwright_pr_capture(pr_url, file_name))
    except Exception as error:
        print(f"CR pull request screenshot failed: {error}")
        return None


async def _playwright_pr_capture(pr_url: str, file_name: str) -> str | None:
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        try:
            page = await browser.new_page(viewport={"width": 1360, "height": 900})
            res = await page.goto(pr_url, wait_until="domcontentloaded", timeout=45_000)
            if res is None or res.status >= 400:
                print(f"CR pull request screenshot: GitHub returned {res.status if res else 'no response'} "
                      f"for {pr_url} (private repo?)")
                return None
            await page.wait_for_timeout(2_000)  # let avatars/fonts settle
            buffer = await page.screenshot()

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
    file_name = _mail_evidence_file_name(checkpoint, project_id, message_id)
    try:
        async with httpx.AsyncClient() as client:
            body_res = await client.get(
                f"https://graph.microsoft.com/v1.0/users/{mailbox}/messages/{message_id}",
                params={"$select": "body,webLink,from,toRecipients,ccRecipients,internetMessageId"},
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Prefer": 'outlook.body-content-type="html"',
                },
            )
        body_data = body_res.json()

        # Prefer a real screenshot of the email as Outlook shows it.
        web_link = body_data.get("webLink")
        if web_link:
            try:
                real = await _capture_outlook_web(web_link, file_name.removesuffix(".png") + "-outlook.png")
                if real:
                    return real
            except Exception as error:
                print(f"{checkpoint.upper()} Outlook screenshot failed, falling back to rendered email: {error}")

        content = (body_data.get("body") or {}).get("content")
        if body_res.status_code >= 400 or not content:
            print(
                f"{checkpoint.upper()} screenshot: couldn't fetch HTML body for message {message_id}: "
                f"{(body_data.get('error') or {}).get('message') or f'HTTP {body_res.status_code}'}"
            )
            return None

        page_html = _outlook_style_html(
            subject=subject,
            sender=(body_data.get("from") or {}).get("emailAddress") or {"address": from_},
            to=body_data.get("toRecipients") or [],
            cc=body_data.get("ccRecipients") or [],
            received_date_time=received_date_time,
            body_html=content,
            message_id=body_data.get("internetMessageId") or message_id,
        )
        return await _render_and_save(page_html, file_name, width=1280)
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
