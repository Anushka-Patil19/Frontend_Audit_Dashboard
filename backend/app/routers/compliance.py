from fastapi import APIRouter, HTTPException

from app.models_compliance import NotificationIn, NotificationOut
from app.services.compliance_mail import invalid_addresses, send_notification

# Compliance Review Dashboard (port 8082). Phase 1: email only.
router = APIRouter(prefix="/api/compliance", tags=["compliance"])


@router.post("/notifications", response_model=NotificationOut, response_model_by_alias=True)
async def notifications(n: NotificationIn) -> NotificationOut:
    bad = invalid_addresses(n)
    if bad:
        raise HTTPException(status_code=422, detail=f"Not a valid email address: {', '.join(bad)}.")
    return await send_notification(n)
