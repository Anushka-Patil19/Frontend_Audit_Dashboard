import base64

from fastapi import APIRouter, HTTPException

from app.clients.evidence_screenshot import read_evidence_screenshot
from app.config.cp20_config import cp20_configs, resolve_cp20_project
from app.models import Cp20Gates, Cp20VerifyResponse, EvidenceScreenshotResponse, QuestionRequest
from app.services.cp20_verify import verify_cp20, verify_hash_log

router = APIRouter(prefix="/api/cp20", tags=["cp20"])


@router.post("/verify", response_model=Cp20VerifyResponse, response_model_by_alias=True)
async def verify(body: QuestionRequest) -> Cp20VerifyResponse:
    cfg = resolve_cp20_project(body.question)
    if not cfg:
        known = ", ".join(c.project_label for c in cp20_configs)
        return Cp20VerifyResponse(
            config=None,
            result=None,
            gates=Cp20Gates(protection="pending", commits="pending", history="pending", review="pending"),
            reply=f"I couldn't tell which project you mean. Known projects: {known}.",
        )
    return await verify_cp20(cfg)


@router.get("/hash-log/verify")
async def hash_log_verify() -> dict:
    """Re-checks the hash chain of evidence/cp20_hash_log.jsonl."""
    intact, entries, message = verify_hash_log()
    return {"intact": intact, "entries": entries, "message": message}


@router.get("/evidence", response_model=EvidenceScreenshotResponse, response_model_by_alias=True)
async def evidence(file_name: str) -> EvidenceScreenshotResponse:
    buffer = await read_evidence_screenshot(file_name)
    if buffer is None:
        raise HTTPException(status_code=404, detail="Evidence screenshot not found")
    return EvidenceScreenshotResponse(dataUrl=f"data:image/png;base64,{base64.b64encode(buffer).decode()}")
