from fastapi import APIRouter

from app.models import MailSyncResult
from app.services.mail_connector import sync_mail_connector

router = APIRouter(prefix="/api/mail-connector", tags=["mail-connector"])


@router.post("/sync", response_model=MailSyncResult)
async def sync() -> MailSyncResult:
    return await sync_mail_connector()
