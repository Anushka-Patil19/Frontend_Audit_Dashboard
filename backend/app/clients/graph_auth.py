# Server-only: client_id/client_secret never reach the browser — this whole
# service is server-side, callable only from the frontend's own backend calls.
from dataclasses import dataclass
from typing import Literal

import httpx

from app.settings import settings


@dataclass
class GraphTokenOk:
    access_token: str
    ok: Literal[True] = True


@dataclass
class GraphTokenError:
    error: str
    ok: Literal[False] = False


GraphTokenResult = GraphTokenOk | GraphTokenError


async def get_graph_access_token() -> GraphTokenResult:
    tenant_id = settings.ms_tenant_id
    client_id = settings.ms_client_id
    client_secret = settings.ms_client_secret

    if not tenant_id or not client_id or not client_secret:
        return GraphTokenError(
            error="Missing MS_TENANT_ID / MS_CLIENT_ID / MS_CLIENT_SECRET on the server (.env).",
        )

    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "scope": "https://graph.microsoft.com/.default",
                    "grant_type": "client_credentials",
                },
            )
        data = res.json()
        access_token = data.get("access_token")
        if res.status_code >= 400 or not access_token:
            return GraphTokenError(
                error=data.get("error_description") or f"Token request failed (HTTP {res.status_code}).",
            )
        return GraphTokenOk(access_token=access_token)
    except httpx.HTTPError as error:
        return GraphTokenError(error=f"Network error contacting Microsoft login: {error}")
