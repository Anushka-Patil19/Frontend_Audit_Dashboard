import re

from fastapi import APIRouter, HTTPException

from app.models import CreateInviteRequest, CreateInviteResponse, Invite
from app.services.invites import create_invite, get_invite

router = APIRouter(prefix="/api/invites", tags=["invites"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@router.post("", response_model=CreateInviteResponse, response_model_by_alias=True)
async def create(req: CreateInviteRequest) -> CreateInviteResponse:
    if not EMAIL_RE.match(req.email.strip()):
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    return await create_invite(req)


@router.get("/{token}", response_model=Invite, response_model_by_alias=True)
async def get(token: str) -> Invite:
    invite = get_invite(token)
    if invite is None:
        raise HTTPException(status_code=404, detail="This invite link is invalid or has been revoked.")
    return invite
