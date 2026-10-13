import base64

from fastapi import APIRouter, HTTPException, Query

from app.clients.evidence_screenshot import capture_escalation_approval_screenshot, read_evidence_screenshot
from app.models_escalations import (
    ApproveRequest,
    ItemActionResponse,
    Level,
    LimitsPatch,
    Notification,
    OpenItem,
    Policy,
    ProjectConfig,
    ProjectId,
    RejectRequest,
    RunSummary,
)
from app.models import EvidenceScreenshotResponse
from app.services.escalations import (
    attach_approval_evidence,
    approve,
    get_config,
    latest_runs,
    list_items,
    list_notifications,
    mark_fixed,
    nudge,
    put_limits,
    put_policy,
    reject,
    reset_config,
    reset_demo,
    run_escalation,
    send_action_email,
    send_run_emails,
    update_last_run,
    withdraw_fix,
)

router = APIRouter(prefix="/api/escalations", tags=["escalations"])

_PROJECT_IDS: dict[str, ProjectId] = {
    "project-a": "project-a",
    "project-b": "project-b",
    "project-c": "project-c",
}


def _project_id(value: str) -> ProjectId:
    project_id = _PROJECT_IDS.get(value)
    if project_id is None:
        raise HTTPException(status_code=404, detail="This project does not exist.")
    return project_id


@router.get(
    "/config/{project_id}",
    response_model=ProjectConfig,
    response_model_by_alias=True,
    response_model_exclude_none=True,
)
async def read_config(project_id: str) -> ProjectConfig:
    return get_config(_project_id(project_id))


@router.put(
    "/policy/{project_id}",
    response_model=ProjectConfig,
    response_model_by_alias=True,
    response_model_exclude_none=True,
)
async def update_policy(project_id: str, policy: Policy) -> ProjectConfig:
    return put_policy(_project_id(project_id), policy)


@router.put(
    "/limits/{project_id}",
    response_model=ProjectConfig,
    response_model_by_alias=True,
    response_model_exclude_none=True,
)
async def update_limits(project_id: str, patch: LimitsPatch) -> ProjectConfig:
    return put_limits(_project_id(project_id), patch)


@router.delete(
    "/config/{project_id}",
    response_model=ProjectConfig,
    response_model_by_alias=True,
    response_model_exclude_none=True,
)
async def delete_config(project_id: str) -> ProjectConfig:
    return reset_config(_project_id(project_id))


@router.get("/items", response_model=list[OpenItem], response_model_by_alias=True, response_model_exclude_none=True)
async def read_items(project_id: str | None = Query(default=None, alias="projectId")) -> list[OpenItem]:
    return list_items(_project_id(project_id) if project_id is not None else None)


@router.get("/runs/latest", response_model_by_alias=True, response_model_exclude_none=True)
async def read_latest_runs() -> dict[ProjectId, RunSummary]:
    return latest_runs()


@router.get(
    "/notifications",
    response_model=list[Notification],
    response_model_by_alias=True,
)
async def read_notifications(
    role: Level | None = None,
    project_id: str | None = Query(default=None, alias="projectId"),
    since: str | None = None,
) -> list[Notification]:
    try:
        return list_notifications(
            role=role,
            project_id=_project_id(project_id) if project_id is not None else None,
            since=since,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=422,
            detail="The since timestamp must be a valid ISO 8601 value.",
        ) from error


@router.post(
    "/run/{project_id}",
    response_model=RunSummary,
    response_model_by_alias=True,
    response_model_exclude_none=True,
)
async def run_project(project_id: str) -> RunSummary:
    summary = run_escalation(_project_id(project_id))
    summary.email_note = await send_run_emails(summary)
    update_last_run(summary)
    return summary


async def _action_response(result: ItemActionResponse) -> ItemActionResponse:
    result.email_note = await send_action_email(result)
    return result


@router.post(
    "/items/{item_id}/fixed",
    response_model=ItemActionResponse,
    response_model_by_alias=True,
    response_model_exclude_none=True,
)
async def fixed_item(item_id: str) -> ItemActionResponse:
    return await _action_response(mark_fixed(item_id))


@router.post(
    "/items/{item_id}/undo",
    response_model=ItemActionResponse,
    response_model_by_alias=True,
    response_model_exclude_none=True,
)
async def undo_fixed_item(item_id: str) -> ItemActionResponse:
    return await _action_response(withdraw_fix(item_id))


@router.post(
    "/items/{item_id}/nudge",
    response_model=ItemActionResponse,
    response_model_by_alias=True,
    response_model_exclude_none=True,
)
async def nudge_item(item_id: str) -> ItemActionResponse:
    return await _action_response(nudge(item_id))


@router.post(
    "/items/{item_id}/approve",
    response_model=ItemActionResponse,
    response_model_by_alias=True,
    response_model_exclude_none=True,
)
async def approve_item(item_id: str, request: ApproveRequest) -> ItemActionResponse:
    result = approve(item_id, request.by)
    if result.item.approval:
        record = result.item.approval.model_dump(mode="json", by_alias=True, exclude_none=True)
        file_name = await capture_escalation_approval_screenshot(
            result.item.project_id,
            result.item.id,
            record,
        )
        if file_name:
            result.item = attach_approval_evidence(result.item.id, file_name)
    return await _action_response(result)


@router.get("/evidence", response_model=EvidenceScreenshotResponse, response_model_by_alias=True)
async def approval_evidence(file_name: str) -> EvidenceScreenshotResponse:
    buffer = await read_evidence_screenshot(file_name)
    if buffer is None:
        raise HTTPException(status_code=404, detail="Evidence screenshot not found")
    return EvidenceScreenshotResponse(dataUrl=f"data:image/png;base64,{base64.b64encode(buffer).decode()}")


@router.post(
    "/items/{item_id}/reject",
    response_model=ItemActionResponse,
    response_model_by_alias=True,
    response_model_exclude_none=True,
)
async def reject_item(item_id: str, request: RejectRequest) -> ItemActionResponse:
    return await _action_response(reject(item_id, request.by, request.reason))


@router.post("/demo/reset")
async def reset_escalation_demo() -> dict[str, bool]:
    return reset_demo()
