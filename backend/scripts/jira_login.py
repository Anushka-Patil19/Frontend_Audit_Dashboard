"""One-time Jira web login for real Jira issue screenshots (CP6 evidence).

Run from the backend folder:  python -m scripts.jira_login

A browser window opens on Jira (JIRA_BASE_URL). Sign in with an account that
can open the CR tickets; as soon as Jira itself loads, the window closes by
itself and the login is saved to JIRA_SESSION_FILE (jira_session.json by
default, git-ignored) and the backend reuses it headlessly. Run this again
whenever the backend logs that the Jira login expired.
"""

import asyncio
import sys
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import async_playwright

from app.settings import settings


async def main() -> None:
    if not settings.jira_base_url:
        raise SystemExit("JIRA_BASE_URL is not set in .env")
    base_url = settings.jira_base_url.rstrip("/")
    jira_host = urlparse(base_url).netloc
    session = Path(settings.jira_session_file)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await context.new_page()
        await page.goto(f"{base_url}/jira")
        print("Sign in to Jira in the browser window (up to 10 minutes)...")
        # Signed in once the browser is back on the Jira site itself (not
        # id.atlassian.com's login pages) and Jira accepts its cookies for
        # /myself — that only returns 200 for a logged-in user.
        for _ in range(600):
            await page.wait_for_timeout(1_000)
            if urlparse(page.url).netloc != jira_host:
                continue
            try:
                res = await context.request.get(f"{base_url}/rest/api/3/myself")
            except Exception:
                continue
            if res.ok:
                break
        else:
            raise SystemExit("Timed out waiting for Jira sign-in.")
        await page.wait_for_timeout(5_000)  # let Jira finish setting its session cookies
        await context.storage_state(path=str(session))
        await browser.close()
    print(f"Saved Jira login to {session.resolve()}")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    asyncio.run(main())
