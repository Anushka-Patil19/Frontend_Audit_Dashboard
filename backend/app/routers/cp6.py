import base64

from fastapi import APIRouter, HTTPException

from app.clients.evidence_screenshot import read_evidence_screenshot
from app.config.cp6_config import cp6_configs, resolve_cp6_project
from app.models import Cp6VerifyResponse, EvidenceScreenshotResponse, QuestionRequest
from app.services.cp6_verify import verify_cp6

router = APIRouter(prefix="/api/cp6", tags=["cp6"])


@router.post("/verify", response_model=Cp6VerifyResponse, response_model_by_alias=True)
async def verify(body: QuestionRequest) -> Cp6VerifyResponse:
    cfg = resolve_cp6_project(body.question)
    if not cfg:
        known = ", ".join(c.project_label for c in cp6_configs)
        return Cp6VerifyResponse(
            config=None, result=None, reply=f"I couldn't tell which project you mean. Known projects: {known}."
        )
    return await verify_cp6(cfg)


@router.get("/evidence", response_model=EvidenceScreenshotResponse, response_model_by_alias=True)
async def evidence(file_name: str) -> EvidenceScreenshotResponse:
    buffer = await read_evidence_screenshot(file_name)
    if buffer is None:
        raise HTTPException(status_code=404, detail="Evidence screenshot not found")
    return EvidenceScreenshotResponse(dataUrl=f"data:image/png;base64,{base64.b64encode(buffer).decode()}")
