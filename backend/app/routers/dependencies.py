import base64

from fastapi import APIRouter, HTTPException

from app.clients.evidence_screenshot import read_evidence_screenshot
from app.models import DependencyMonitorResult, EvidenceScreenshotResponse
from app.services.dependency_monitor import check_repo_dependencies

router = APIRouter(prefix="/api/dependencies", tags=["dependencies"])


@router.get("/check", response_model=DependencyMonitorResult, response_model_by_alias=True)
async def check(capture_evidence: bool = False) -> DependencyMonitorResult:
    return await check_repo_dependencies(capture_evidence)


@router.get("/evidence", response_model=EvidenceScreenshotResponse, response_model_by_alias=True)
async def evidence(file_name: str) -> EvidenceScreenshotResponse:
    buffer = await read_evidence_screenshot(file_name)
    if buffer is None:
        raise HTTPException(status_code=404, detail="Evidence screenshot not found")
    return EvidenceScreenshotResponse(dataUrl=f"data:image/png;base64,{base64.b64encode(buffer).decode()}")
