from fastapi import APIRouter

from app.models import DependencyMonitorResult
from app.services.dependency_monitor import check_repo_dependencies

router = APIRouter(prefix="/api/dependencies", tags=["dependencies"])


@router.get("/check", response_model=DependencyMonitorResult, response_model_by_alias=True)
async def check() -> DependencyMonitorResult:
    return await check_repo_dependencies()
