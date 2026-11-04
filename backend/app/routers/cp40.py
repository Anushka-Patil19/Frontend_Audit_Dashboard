import base64

from fastapi import APIRouter, HTTPException

from app.clients.evidence_screenshot import read_evidence_screenshot
from app.config.cp40_config import cp40_configs, resolve_cp40_project
from app.models import Cp40GateStatus, Cp40VerifyResponse, EvidenceScreenshotResponse, QuestionRequest
from app.services.cp40_verify import verify_cp40

router = APIRouter(prefix="/api/cp40", tags=["cp40"])


@router.post("/verify", response_model=Cp40VerifyResponse, response_model_by_alias=True)
async def verify(body: QuestionRequest) -> Cp40VerifyResponse:
    cfg = resolve_cp40_project(body.question)
    if not cfg:
        known = ", ".join(c.project_label for c in cp40_configs)
        return Cp40VerifyResponse(
            config=None,
            result=None,
            gates=Cp40GateStatus(ticket="pending", approver="pending", attachment="pending", content="pending"),
            reply=f"I couldn't tell which project you mean. Known projects: {known}.",
        )
    return await verify_cp40(cfg)


@router.get("/evidence", response_model=EvidenceScreenshotResponse, response_model_by_alias=True)
async def evidence(file_name: str) -> EvidenceScreenshotResponse:
    buffer = await read_evidence_screenshot(file_name)
    if buffer is None:
        raise HTTPException(status_code=404, detail="Evidence screenshot not found")
    return EvidenceScreenshotResponse(dataUrl=f"data:image/png;base64,{base64.b64encode(buffer).decode()}")
