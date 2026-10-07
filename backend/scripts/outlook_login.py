"""One-time Outlook on the web login for real email evidence screenshots.

Run from the backend folder:  python -m scripts.outlook_login

A browser window opens on Outlook. Sign in with an account that can open the
sign-off mailbox (MS_SHARED_MAILBOX); as soon as your inbox shows, the window
closes by itself and the login is saved to OUTLOOK_SESSION_FILE
(outlook_session.json by default, git-ignored) and the backend reuses it
headlessly. Run this again whenever the backend logs that the login expired.
"""

import asyncio
import sys
from pathlib import Path

from playwright.async_api import async_playwright

from app.settings import settings


async def main() -> None:
    session = Path(settings.outlook_session_file)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await context.new_page()
        await page.goto("https://outlook.office.com/mail/")
        print("Sign in to Outlook in the browser window (up to 10 minutes)...")
        # Sign-in is done once Microsoft has issued its sign-in cookie and the
        # browser is back on Outlook's mail app. Checking the URL alone isn't
        # enough: the page starts on that same URL before redirecting to login.
        for _ in range(600):
            await page.wait_for_timeout(1_000)
            signed_in = any(c["name"].startswith("ESTSAUTH") for c in await context.cookies())
            on_mail = page.url.startswith(("https://outlook.office.com/mail", "https://outlook.office365.com/mail"))
            if signed_in and on_mail:
                break
        else:
            raise SystemExit("Timed out waiting for Outlook sign-in.")
        await page.wait_for_timeout(5_000)  # let Outlook finish setting its session cookies
        await context.storage_state(path=str(session))
        await browser.close()
    print(f"Saved Outlook login to {session.resolve()}")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    asyncio.run(main())
