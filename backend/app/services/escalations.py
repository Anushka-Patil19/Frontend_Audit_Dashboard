import html
import json
import logging
import math
import os
import re
import secrets
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

import httpx
from fastapi import HTTPException

from app.clients.graph_auth import get_graph_access_token
from app.models_escalations import (
    ApprovalRecord,
    ItemActionResponse,
    Level,
    LimitsPatch,
    Notification,
    OpenItem,
    People,
    Person,
    Policy,
    ProjectConfig,
    ProjectId,
    RunSummary,
)
from app.settings import settings

logger = logging.getLogger(__name__)
_LOCK = threading.Lock()
_ORG_DEFAULT_LIMIT_DAYS = 2
_DEFAULT_DEVELOPERS = {
    "project-a": "Rahul Verma",
    "project-b": "Vivek Pillai",
    "project-c": "Karan Mehta",
}
_DEFAULT_EMAILS = {
    "developer": "Anushka.p@neweltechnologies.com",
    "manager": "Akhil@neweltechnologies.com",
    "cto": "Sanket@neweltechnologies.com",
}
_LEGACY_DEVELOPER_EMAILS = {"anushka19pa@gmail.com"}
_PROJECT_NAMES = {"project-a": "PIT Armour", "project-b": "SAATHI", "project-c": "MPS"}
_SEED_ROWS = (
    ("project-a", "cp-15", "Rahul Verma", 4, None),
    ("project-a", "cp-21", "Rahul Verma", 4, None),
    ("project-a", "cp-8", "Rahul Verma", 2, None),
    ("project-a", "cp-19", "Rahul Verma", 1, None),
    ("project-a", "cp-6", "Rahul Verma", 6, 3),
    ("project-b", "cp-25", "Vivek Pillai", 5, None),
    ("project-b", "cp-60", "Sneha Kapoor", 2, None),
    ("project-c", "cp-28", "Karan Mehta", 3, None),
    ("project-c", "cp-71", "Manoj Kumar", 5, 2),
)
_CATALOG_PATH = Path(__file__).resolve().parents[1] / "data" / "checkpoints.json"


def _checkpoint_catalog() -> dict[str, dict[str, str]]:
    try:
        checkpoints = json.loads(_CATALOG_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError("The escalation checkpoint catalog could not be loaded.") from error
    return {checkpoint["id"]: checkpoint for checkpoint in checkpoints}


_CHECKPOINTS = _checkpoint_catalog()


def _store_path() -> Path:
    return Path(settings.escalations_file)


def _empty_state() -> dict[str, Any]:
    return {"configs": {}, "items": [], "notifications": [], "lastRun": {}}


def _load_unlocked() -> dict[str, Any]:
    path = _store_path()
    if not path.exists():
        return _empty_state()
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError("Could not read escalation configuration storage.") from error
    if not isinstance(state, dict):
        raise RuntimeError("Escalation configuration storage has an invalid format.")
    return {**_empty_state(), **state}


def _save_unlocked(state: dict[str, Any]) -> None:
    path = _store_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_suffix(f"{path.suffix}.tmp")
    try:
        temporary_path.write_text(json.dumps(state, indent=2), encoding="utf-8")
        os.replace(temporary_path, path)
    except OSError as error:
        raise RuntimeError("Could not save escalation configuration storage.") from error


def load_state() -> dict[str, Any]:
    with _LOCK:
        return _load_unlocked()


def save_state(state: dict[str, Any]) -> None:
    with _LOCK:
        _save_unlocked(state)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(at: datetime) -> str:
    return at.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _parse_iso(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def days_since(iso: str, now: datetime) -> int:
    return max(0, math.floor((now.astimezone(timezone.utc) - _parse_iso(iso)).total_seconds() / 86400))


def default_config(project_id: ProjectId) -> ProjectConfig:
    return ProjectConfig(
        policy=Policy(
            reminderBeforeDays=1,
            managerAfterDays=0,
            ctoAfterDays=2,
            approvalLimitDays=2,
            people=People(
                developer=Person(
                    name=_DEFAULT_DEVELOPERS[project_id],
                    email=_DEFAULT_EMAILS["developer"],
                ),
                manager=Person(name="Neha Gupta", email=_DEFAULT_EMAILS["manager"]),
                cto=Person(name="CTO", email=_DEFAULT_EMAILS["cto"]),
            ),
        )
    )


def _config_for(state: dict[str, Any], project_id: ProjectId) -> ProjectConfig:
    raw = state["configs"].get(project_id)
    config = ProjectConfig.model_validate(raw) if raw is not None else default_config(project_id)
    people = config.policy.people
    updates: dict[str, Person] = {}
    for role, person in (
        ("developer", people.developer),
        ("manager", people.manager),
        ("cto", people.cto),
    ):
        email = person.email.strip()
        old_addresses = _LEGACY_DEVELOPER_EMAILS if role == "developer" else set()
        if not email or email.casefold() == _DEFAULT_EMAILS[role].casefold() or email.casefold() in {
            old.casefold() for old in old_addresses
        }:
            updates[role] = person.model_copy(update={"email": _DEFAULT_EMAILS[role]})
        else:
            updates[role] = person
    if updates != {
        "developer": people.developer,
        "manager": people.manager,
        "cto": people.cto,
    }:
        config = config.model_copy(
            update={
                "policy": config.policy.model_copy(
                    update={"people": People(**updates)},
                )
            }
        )
    return config


def _seed_items(now: datetime) -> list[dict[str, Any]]:
    rows = []
    for project_id, checkpoint_id, owner, opened_days, fixed_days in _SEED_ROWS:
        opened_at = now - timedelta(days=opened_days)
        item: dict[str, Any] = {
            "id": f"esc-{checkpoint_id}",
            "projectId": project_id,
            "checkpointId": checkpoint_id,
            "owner": owner,
            "openedAt": _iso(opened_at),
            "status": "pending-approval" if fixed_days is not None else "open",
            "nudges": [],
            "history": [{"at": _iso(opened_at), "text": "Opened (demo seed)"}],
        }
        if fixed_days is not None:
            fixed_at = now - timedelta(days=fixed_days)
            item.update(
                {
                    "fixedAt": _iso(fixed_at),
                    "fixedBy": owner,
                    "overdueDaysAtFix": max(0, opened_days - fixed_days - _ORG_DEFAULT_LIMIT_DAYS),
                }
            )
            item["history"].append(
                {"at": _iso(fixed_at), "text": f"Marked fixed by {owner}"},
            )
        rows.append(item)
    return rows


def _ensure_seeded(state: dict[str, Any]) -> bool:
    if state["items"]:
        return False
    state["items"] = _seed_items(_now())
    return True


def _config_for_locked(state: dict[str, Any], project_id: ProjectId) -> ProjectConfig:
    config = _config_for(state, project_id)
    state["configs"][project_id] = config.model_dump(
        mode="json",
        by_alias=True,
        exclude_none=True,
    )
    return config


def get_config(project_id: ProjectId) -> ProjectConfig:
    with _LOCK:
        state = _load_unlocked()
        config = _config_for_locked(state, project_id)
        _save_unlocked(state)
        return config


def put_policy(project_id: ProjectId, policy: Policy) -> ProjectConfig:
    with _LOCK:
        state = _load_unlocked()
        config = _config_for_locked(state, project_id).model_copy(update={"policy": policy})
        state["configs"][project_id] = config.model_dump(
            mode="json",
            by_alias=True,
            exclude_none=True,
        )
        _save_unlocked(state)
        return config


def put_limits(project_id: ProjectId, patch: LimitsPatch) -> ProjectConfig:
    with _LOCK:
        state = _load_unlocked()
        config = _config_for_locked(state, project_id)
        changes = patch.model_dump(by_alias=True, exclude_unset=True)

        if "defaultLimitDays" in changes:
            config.default_limit_days = changes["defaultLimitDays"]
        for field, target in (
            ("categoryLimits", config.category_limits),
            ("checkpointLimits", config.checkpoint_limits),
        ):
            for key, value in changes.get(field, {}).items():
                if value is None:
                    target.pop(key, None)
                else:
                    target[key] = value

        state["configs"][project_id] = config.model_dump(
            mode="json",
            by_alias=True,
            exclude_none=True,
        )
        _save_unlocked(state)
        return config


def reset_config(project_id: ProjectId) -> ProjectConfig:
    with _LOCK:
        state = _load_unlocked()
        state["configs"].pop(project_id, None)
        _save_unlocked(state)
        return default_config(project_id)


def resolve_limit(config: ProjectConfig, checkpoint_id: str, category: str) -> int:
    if checkpoint_id in config.checkpoint_limits:
        return config.checkpoint_limits[checkpoint_id]
    if category in config.category_limits:
        return config.category_limits[category]
    if config.default_limit_days is not None:
        return config.default_limit_days
    return _ORG_DEFAULT_LIMIT_DAYS


def age_item(
    item: OpenItem,
    config: ProjectConfig,
    category: str,
    now: datetime,
) -> tuple[int, int, int, Level | None]:
    open_days = days_since(item.opened_at, now)
    limit = resolve_limit(config, item.checkpoint_id, category)
    overdue = open_days - limit
    policy = config.policy
    if overdue >= policy.cto_after_days:
        level: Level | None = "cto"
    elif overdue >= policy.manager_after_days:
        level = "manager"
    elif -overdue <= policy.reminder_before_days:
        level = "developer"
    else:
        level = None
    return open_days, limit, overdue, level


def age_label(open_days: int, limit: int, overdue: int) -> str:
    day_label = lambda value: f"{value} {'day' if value == 1 else 'days'}"
    if overdue > 0:
        remaining = f"{day_label(overdue)} overdue"
    elif overdue == 0:
        remaining = "due today"
    else:
        remaining = f"{day_label(-overdue)} left"
    return f"Open {day_label(open_days)} · limit {day_label(limit)} · {remaining}"


def _item_from_state(state: dict[str, Any], item_id: str) -> OpenItem:
    for raw in state["items"]:
        if raw["id"] == item_id:
            return OpenItem.model_validate(raw)
    raise HTTPException(status_code=404, detail="This escalation item does not exist.")


def _checkpoint(checkpoint_id: str) -> dict[str, str]:
    checkpoint = _CHECKPOINTS.get(checkpoint_id)
    if checkpoint is None:
        raise RuntimeError(f"Checkpoint {checkpoint_id} is missing from the catalog.")
    return checkpoint


def list_items(project_id: ProjectId | None = None) -> list[OpenItem]:
    with _LOCK:
        state = _load_unlocked()
        seeded = _ensure_seeded(state)
        if seeded:
            _save_unlocked(state)
        return [
            OpenItem.model_validate(item)
            for item in state["items"]
            if project_id is None or item["projectId"] == project_id
        ]


def list_notifications(
    role: Level | None = None,
    project_id: ProjectId | None = None,
    since: str | None = None,
) -> list[Notification]:
    with _LOCK:
        notifications = _load_unlocked()["notifications"]
    if since is not None:
        since_at = _parse_iso(since)
    else:
        since_at = None
    filtered = [
        notification
        for notification in notifications
        if (role is None or notification["recipient"] == role)
        and (project_id is None or notification["projectId"] == project_id)
        and (since_at is None or _parse_iso(notification["runAt"]) >= since_at)
    ]
    filtered.sort(key=lambda notification: notification["runAt"], reverse=True)
    return [Notification.model_validate(item) for item in filtered]


def latest_runs() -> dict[ProjectId, RunSummary]:
    with _LOCK:
        runs = _load_unlocked()["lastRun"]
    return {project_id: RunSummary.model_validate(run) for project_id, run in runs.items()}


def _notification(
    item: OpenItem,
    recipient: Level,
    kind: str,
    detail: str,
    at: str,
) -> Notification:
    checkpoint = _checkpoint(item.checkpoint_id)
    return Notification(
        id=f"n-{secrets.token_urlsafe(8)}",
        runAt=at,
        projectId=item.project_id,
        itemId=item.id,
        recipient=recipient,
        kind=kind,
        title=f"{checkpoint['ref']} {checkpoint['name']}",
        detail=detail,
    )


def _store_notifications(state: dict[str, Any], notifications: list[Notification]) -> None:
    state["notifications"] = [
        notification.model_dump(mode="json", by_alias=True)
        for notification in notifications
    ] + state["notifications"]
    state["notifications"] = state["notifications"][:300]


def run_escalation(project_id: ProjectId) -> RunSummary:
    now = _now()
    run_at = _iso(now)
    with _LOCK:
        state = _load_unlocked()
        _ensure_seeded(state)
        config = _config_for_locked(state, project_id)
        notifications: list[Notification] = []
        for raw in state["items"]:
            if raw["projectId"] != project_id:
                continue
            item = OpenItem.model_validate(raw)
            checkpoint = _checkpoint(item.checkpoint_id)
            if item.status == "open":
                open_days, limit, overdue, level = age_item(
                    item,
                    config,
                    checkpoint["category"],
                    now,
                )
                if level is None:
                    continue
                detail = age_label(open_days, limit, overdue)
                notifications.append(_notification(item, "developer", "escalation", detail, run_at))
                if level in ("manager", "cto"):
                    notifications.append(
                        _notification(
                            item,
                            "manager",
                            "escalation",
                            f"{detail} · owner {item.owner}",
                            run_at,
                        )
                    )
                if level == "cto":
                    notifications.append(
                        _notification(
                            item,
                            "cto",
                            "escalation",
                            f"{detail} · owner {item.owner} · Manager {config.policy.people.manager.name}",
                            run_at,
                        )
                    )
                history_text = (
                    "Reminder sent to the developer (Simulate run)"
                    if level == "developer"
                    else f"Escalated to {level.title()} (Simulate run)"
                )
                raw["history"].append({"at": run_at, "text": history_text})
            elif item.status == "pending-approval" and item.fixed_at:
                waiting = days_since(item.fixed_at, now)
                if waiting >= config.policy.approval_limit_days:
                    notifications.append(
                        _notification(
                            item,
                            "cto",
                            "approval-stalled",
                            f"Fix waiting {waiting} days for {config.policy.people.manager.name}'s approval (limit {config.policy.approval_limit_days} days)",
                            run_at,
                        )
                    )
                    raw["history"].append(
                        {
                            "at": run_at,
                            "text": f"Approval stalled {waiting} days, CTO notified (Simulate run)",
                        }
                    )

        counts: dict[Level, int] = {"developer": 0, "manager": 0, "cto": 0}
        for notification in notifications:
            counts[notification.recipient] += 1
        has_email = any(
            person.email.strip()
            for person in (
                config.policy.people.developer,
                config.policy.people.manager,
                config.policy.people.cto,
            )
        )
        summary = RunSummary(
            runAt=run_at,
            projectId=project_id,
            counts=counts,
            notifications=notifications,
            emailNote=(
                "Email not sent: the mail service is not connected to this dashboard yet. Notifications are on each dashboard."
                if has_email
                else "Email off: no recipient emails set in the Escalations tab. Notifications are on each dashboard."
            ),
        )
        _store_notifications(state, notifications)
        state["lastRun"][project_id] = summary.model_dump(mode="json", by_alias=True)
        _save_unlocked(state)
        return summary


def update_last_run(summary: RunSummary) -> None:
    with _LOCK:
        state = _load_unlocked()
        state["lastRun"][summary.project_id] = summary.model_dump(mode="json", by_alias=True)
        _save_unlocked(state)


def _action(
    item_id: str,
    action: str,
    by: str | None = None,
    reason: str | None = None,
) -> ItemActionResponse:
    now = _now()
    at = _iso(now)
    with _LOCK:
        state = _load_unlocked()
        _ensure_seeded(state)
        item = _item_from_state(state, item_id)
        raw = next(row for row in state["items"] if row["id"] == item_id)
        config = _config_for_locked(state, item.project_id)
        notification: Notification | None = None

        if action == "fixed":
            if item.status != "open":
                raise HTTPException(status_code=409, detail="This item is not open.")
            _, _, overdue, _ = age_item(
                item,
                config,
                _checkpoint(item.checkpoint_id)["category"],
                now,
            )
            raw.update(
                {
                    "status": "pending-approval",
                    "fixedAt": at,
                    "fixedBy": item.owner,
                    "overdueDaysAtFix": max(0, overdue),
                    "nudges": [],
                }
            )
            raw.pop("rejectReason", None)
            history = f"Marked fixed by {item.owner}, waiting for {config.policy.people.manager.name}"
            notification = _notification(
                item,
                "manager",
                "fixed",
                f"{item.owner} marked this fixed and needs your approval",
                at,
            )
        elif action == "undo":
            if item.status != "pending-approval":
                raise HTTPException(status_code=409, detail="This item is not waiting for approval.")
            raw.update({"status": "open", "nudges": []})
            for key in ("fixedAt", "fixedBy", "overdueDaysAtFix"):
                raw.pop(key, None)
            history = f"Fix withdrawn by {item.owner}"
        elif action == "nudge":
            if item.status != "pending-approval":
                raise HTTPException(status_code=409, detail="This item is not waiting for approval.")
            if item.nudges and now - _parse_iso(item.nudges[-1]) < timedelta(days=1):
                raise HTTPException(status_code=429, detail="You can nudge the Manager once every 24 hours.")
            nudges = [*item.nudges, at]
            raw["nudges"] = nudges
            history = f"{item.owner} nudged the Manager"
            notification = _notification(
                item,
                "manager",
                "nudge",
                f"{item.owner} is waiting on your approval (nudge {len(nudges)})",
                at,
            )
        elif action == "approve":
            if item.status != "pending-approval":
                raise HTTPException(status_code=409, detail="This item is not waiting for approval.")
            approver = (by or "").strip()
            if not approver:
                raise HTTPException(status_code=422, detail="An approver name is required.")
            checkpoint = _checkpoint(item.checkpoint_id)
            record = ApprovalRecord(
                checkpointRef=checkpoint["ref"],
                checkpointName=checkpoint["name"],
                checkpointCategory=checkpoint["category"],
                projectName=_PROJECT_NAMES[item.project_id],
                fixedBy=item.fixed_by or item.owner,
                fixedAt=item.fixed_at or at,
                overdueDaysAtFix=item.overdue_days_at_fix or 0,
                nudges=len(item.nudges),
                approvedBy=approver,
                approvedAt=at,
            )
            raw.update(
                {
                    "status": "compliant",
                    "approvedAt": at,
                    "approvedBy": approver,
                    "approval": record.model_dump(mode="json", by_alias=True, exclude_none=True),
                }
            )
            history = f"Approved by {approver}, now compliant"
            notification = _notification(
                item,
                "developer",
                "fixed",
                f"{approver} approved your fix. It is now compliant.",
                at,
            )
        elif action == "reject":
            if item.status != "pending-approval":
                raise HTTPException(status_code=409, detail="This item is not waiting for approval.")
            approver = (by or "").strip()
            rejection = (reason or "").strip()
            if not approver:
                raise HTTPException(status_code=422, detail="An approver name is required.")
            if not rejection:
                raise HTTPException(status_code=422, detail="A reason is required to reject a fix.")
            raw.update(
                {
                    "status": "open",
                    "openedAt": at,
                    "rejectReason": rejection,
                    "nudges": [],
                }
            )
            for key in ("fixedAt", "fixedBy", "overdueDaysAtFix", "approvedAt", "approvedBy", "approval"):
                raw.pop(key, None)
            history = f"Rejected by {approver}: {rejection}. Clock restarted"
            notification = _notification(
                item,
                "developer",
                "escalation",
                f"{approver} rejected your fix: {rejection}",
                at,
            )
        else:
            raise ValueError(f"Unsupported escalation action: {action}")

        raw["history"].append({"at": at, "text": history})
        notifications = [notification] if notification is not None else []
        _store_notifications(state, notifications)
        updated_item = OpenItem.model_validate(raw)
        _save_unlocked(state)
        return ItemActionResponse(item=updated_item, notifications=notifications)


def mark_fixed(item_id: str) -> ItemActionResponse:
    return _action(item_id, "fixed")


def withdraw_fix(item_id: str) -> ItemActionResponse:
    return _action(item_id, "undo")


def nudge(item_id: str) -> ItemActionResponse:
    return _action(item_id, "nudge")


def approve(item_id: str, by: str) -> ItemActionResponse:
    return _action(item_id, "approve", by=by)


def attach_approval_evidence(item_id: str, file_name: str) -> OpenItem:
    with _LOCK:
        state = _load_unlocked()
        item = _item_from_state(state, item_id)
        raw = next(row for row in state["items"] if row["id"] == item_id)
        if item.status != "compliant" or not item.approval:
            raise HTTPException(status_code=409, detail="This item has no approved fix to attach evidence to.")
        raw["approval"]["evidenceFile"] = file_name
        _save_unlocked(state)
        return OpenItem.model_validate(raw)


def reject(item_id: str, by: str, reason: str) -> ItemActionResponse:
    return _action(item_id, "reject", by=by, reason=reason)


def reset_demo() -> dict[str, bool]:
    with _LOCK:
        state = _load_unlocked()
        state["items"] = _seed_items(_now())
        state["notifications"] = []
        state["lastRun"] = {}
        _save_unlocked(state)
    return {"ok": True}


async def _send_email(
    recipient: str,
    subject: str,
    body_html: str,
    *,
    sender: str | None = None,
) -> str | None:
    if not settings.escalation_email_live:
        return "Email not sent: ESCALATION_EMAIL_LIVE is disabled."
    sender_address = sender if sender is not None else (
        settings.ms_shared_mailbox or settings.ms_test_mailbox
    )
    if not sender_address or not sender_address.strip():
        return "Email not sent: no Graph sender mailbox is configured."
    if not recipient.strip():
        return "Email not sent: the Manager email is not configured."

    token_result = await get_graph_access_token()
    if not token_result.ok:
        logger.warning("Escalation email could not get a Microsoft Graph token: %s", token_result.error)
        return f"Email not sent: Microsoft Graph authentication failed: {token_result.error}"

    message = {
        "message": {
            "subject": subject,
            "body": {"contentType": "HTML", "content": body_html},
            "toRecipients": [{"emailAddress": {"address": recipient.strip()}}],
        },
        "saveToSentItems": True,
    }
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://graph.microsoft.com/v1.0/users/{quote(sender_address.strip(), safe='@.')}/sendMail",
                json=message,
                headers={"Authorization": f"Bearer {token_result.access_token}"},
            )
    except httpx.HTTPError:
        logger.exception("Network error sending an escalation email.")
        return "Email not sent: a network error occurred while contacting Microsoft Graph."

    if response.status_code >= 400:
        try:
            error_payload = response.json()
        except ValueError:
            error_payload = {}
        graph_error = error_payload.get("error", {}) if isinstance(error_payload, dict) else {}
        error_code = graph_error.get("code") if isinstance(graph_error, dict) else None
        error_message = graph_error.get("message") if isinstance(graph_error, dict) else None
        details = ": ".join(value for value in (error_code, error_message) if value)
        logger.warning(
            "Microsoft Graph rejected an escalation email (HTTP %s, code %s).",
            response.status_code,
            error_code or "unknown",
        )
        suffix = f": {details}" if details else ""
        if response.status_code in (401, 403):
            suffix += " Check Mail.Send application permission, admin consent, and sender mailbox access."
        return f"Email not sent: Microsoft Graph rejected the message (HTTP {response.status_code}){suffix}"
    return None


async def send_action_email(response: ItemActionResponse) -> str:
    notification = response.notifications[0] if response.notifications else None
    if notification is None or notification.kind not in ("fixed", "nudge"):
        return "No Manager email was needed for this action."

    item = response.item
    people = _config_for(load_state(), item.project_id).policy.people
    manager = people.manager
    developer = people.developer
    checkpoint = _checkpoint(item.checkpoint_id)
    title = f"{checkpoint['ref']} {checkpoint['name']}"
    action = "marked this checkpoint as fixed" if notification.kind == "fixed" else "nudged you for approval"
    html_body = (
        f"<p>{html.escape(item.owner)} {action}: "
        f"<b>{html.escape(title)}</b>.</p>"
        f"<p>{html.escape(notification.detail)}</p>"
        f"<p>Project: {html.escape(_PROJECT_NAMES[item.project_id])}</p>"
        "<p>Open Audit Intelligence to review this item.</p>"
    )
    error = await _send_email(
        manager.email,
        f"[Audit Intelligence] [Action Required] {title} — {notification.kind}",
        html_body,
        sender=developer.email,
    )
    if error:
        logger.warning("Could not send the Manager %s email: %s", notification.kind, error)
        return error
    return f"Email sent to the configured Manager for {notification.kind}."


def _developer_run_email_body(name: str, notifications: list[Notification]) -> str:
    greeting_name = name.split(maxsplit=1)[0] if name.strip() else "there"
    rows: list[str] = []
    overdue_items: list[tuple[int, str]] = []
    for notification in notifications:
        detail = notification.detail
        overdue_match = re.search(r"(\d+)\s+days?\s+overdue", detail)
        if overdue_match:
            overdue_days = int(overdue_match.group(1))
            marker = "🔴" if overdue_days >= 2 else "🟠"
            overdue_items.append((overdue_days, notification.title.split(" ", 1)[0]))
            status = f"{overdue_days} {'day' if overdue_days == 1 else 'days'} overdue"
        elif "due today" in detail:
            marker = "🟠"
            status = "due today"
        else:
            left_match = re.search(r"(\d+)\s+days?\s+left", detail)
            days_left = int(left_match.group(1)) if left_match else 0
            marker = "🟡"
            status = f"{days_left} {'day' if days_left == 1 else 'days'} left"

        rows.append(
            f"<li>{marker} {html.escape(notification.title.split(' ', 1)[0])} – "
            f"<b>{html.escape(notification.title.split(' ', 1)[1])}</b> "
            f"({html.escape(status)})</li>"
        )

    if overdue_items:
        most_overdue_ref = max(overdue_items, key=lambda entry: entry[0])[1]
        action = f"Please close {html.escape(most_overdue_ref)} today."
    else:
        action = "Please review the items above today."

    return (
        f"<p>Hi {html.escape(greeting_name)},</p>"
        "<p>The following audit items need your attention:</p>"
        f"<ul>{''.join(rows)}</ul>"
        f"<p>{action} If anything is blocked, reply with a revised completion date.</p>"
        "<p>Priya and Anushka are copied for visibility.</p>"
        "<p>Thanks,<br>Audit Intelligence<br>Newel</p>"
    )


async def send_run_emails(summary: RunSummary) -> str:
    if not summary.notifications:
        return "Email off: no notifications were generated by this run."
    if not settings.escalation_email_live:
        return "Email not sent: ESCALATION_EMAIL_LIVE is disabled."

    config = get_config(summary.project_id)
    people = config.policy.people
    grouped: dict[Level, list[Notification]] = {"developer": [], "manager": [], "cto": []}
    for notification in summary.notifications:
        grouped[notification.recipient].append(notification)

    sent = 0
    failed = 0
    for role, notifications in grouped.items():
        if not notifications:
            continue
        person = getattr(people, role)
        rows = "".join(
            f"<li><b>{html.escape(note.title)}</b><br>{html.escape(note.detail)}</li>"
            for note in notifications
        )
        body = (
            _developer_run_email_body(person.name, notifications)
            if role == "developer"
            else f"<p>Hello {html.escape(person.name)},</p><ul>{rows}</ul>"
        )
        error = await _send_email(
            person.email,
            f"[Audit Intelligence] {len(notifications)} escalation notification(s)",
            body,
        )
        if error:
            failed += 1
            logger.warning("Could not send a %s escalation-run email: %s", role, error)
        else:
            sent += 1

    if failed:
        return f"Email sent to {sent} role(s); {failed} role email(s) failed."
    return f"Email sent to {sent} role(s)."
