import httpx

from app.clients.graph_auth import get_graph_access_token
from app.models import MailSyncResult
from app.settings import settings


async def sync_mail_connector() -> MailSyncResult:
    token_result = await get_graph_access_token()
    if not token_result.ok:
        return MailSyncResult(connected=False, message=token_result.error)

    # A token alone only proves the app registration's id/secret are valid —
    # it says nothing about whether Graph permissions were actually granted.
    # Call Graph itself to verify real org access.
    async with httpx.AsyncClient() as client:
        users_res = await client.get(
            "https://graph.microsoft.com/v1.0/users",
            params={"$top": "5", "$select": "userPrincipalName"},
            headers={"Authorization": f"Bearer {token_result.access_token}"},
        )
    users_data = users_res.json()
    users_value = users_data.get("value")

    if users_res.status_code >= 400 or users_value is None:
        message = (users_data.get("error") or {}).get("message") or (
            f"Token acquired, but Graph rejected the directory check (HTTP {users_res.status_code}). "
            f"Check User.Read.All / Directory.Read.All is admin-consented."
        )
        return MailSyncResult(connected=False, message=message)

    # Directory access alone doesn't prove Mail.Read is granted or that a
    # real mailbox is reachable. If a test mailbox is configured, do one more
    # call against actual mail — but only surface a timestamp, never message
    # subject/body, to the UI.
    test_mailbox = settings.ms_test_mailbox
    if test_mailbox:
        async with httpx.AsyncClient() as client:
            mail_res = await client.get(
                f"https://graph.microsoft.com/v1.0/users/{test_mailbox}/messages",
                params={"$top": "1", "$select": "receivedDateTime"},
                headers={"Authorization": f"Bearer {token_result.access_token}"},
            )
        mail_data = mail_res.json()
        mail_value = mail_data.get("value")

        if mail_res.status_code >= 400 or mail_value is None:
            message = (mail_data.get("error") or {}).get("message") or (
                f"Directory access OK, but reading mailbox {test_mailbox} failed (HTTP {mail_res.status_code}). "
                f"Check Mail.Read (Application) is admin-consented."
            )
            return MailSyncResult(connected=False, message=message)

        latest = mail_value[0].get("receivedDateTime") if mail_value else None
        message = (
            f"Connected — verified real mailbox access to {test_mailbox} (latest message received {latest})."
            if latest
            else f"Connected — verified real mailbox access to {test_mailbox} (mailbox is empty)."
        )
        return MailSyncResult(connected=True, message=message)

    # Token is intentionally not returned to the client — only the
    # connected/failed status is.
    example_user = users_value[0].get("userPrincipalName") if users_value else "n/a"
    return MailSyncResult(
        connected=True,
        message=f"Connected — verified via Microsoft Graph ({len(users_value)} org users visible, e.g. {example_user}).",
    )
