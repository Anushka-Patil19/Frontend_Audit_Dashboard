from fastapi import APIRouter, HTTPException

from app.services.github_tracking import project_tracking, tracking_summary

router = APIRouter(prefix="/api/github-tracking", tags=["github-tracking"])


@router.get("/summary")
async def summary(refresh: bool = False) -> list[dict]:
    return await tracking_summary(refresh)


@router.get("/{project_id}")
async def project(project_id: str, refresh: bool = False) -> dict:
    data = await project_tracking(project_id, refresh)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Unknown project {project_id}")
    return data
