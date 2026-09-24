import base64

from fastapi import APIRouter, HTTPException

from app.clients.evidence_screenshot import read_evidence_screenshot
from app.config.cp10_config import cp10_configs, resolve_cp10_project
from app.models import Cp10GateStatus, Cp10VerifyResponse, EvidenceScreenshotResponse, QuestionRequest
from app.services.cp10_verify import verify_cp10

router = APIRouter(prefix="/api/cp10", tags=["cp10"])


@router.post("/verify", response_model=Cp10VerifyResponse, response_model_by_alias=True)
async def verify(body: QuestionRequest) -> Cp10VerifyResponse:
    cfg = resolve_cp10_project(body.question)
    if not cfg:
        known = ", ".join(c.project_label for c in cp10_configs)
        return Cp10VerifyResponse(
            config=None,
            result=None,
            gates=Cp10GateStatus(jira="pending", mail="pending", llm="pending"),
            reply=f"I couldn't tell which project you mean. Known projects: {known}.",
        )
    return await verify_cp10(cfg)


@router.get("/evidence", response_model=EvidenceScreenshotResponse, response_model_by_alias=True)
async def evidence(file_name: str) -> EvidenceScreenshotResponse:
    buffer = await read_evidence_screenshot(file_name)
    if buffer is None:
        raise HTTPException(status_code=404, detail="Evidence screenshot not found")
    return EvidenceScreenshotResponse(dataUrl=f"data:image/png;base64,{base64.b64encode(buffer).decode()}")
