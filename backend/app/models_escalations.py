from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

ProjectId = Literal["project-a", "project-b", "project-c"]
Level = Literal["developer", "manager", "cto"]
ItemStatus = Literal["open", "pending-approval", "compliant"]
NotificationKind = Literal["escalation", "approval-stalled", "nudge", "fixed"]
NonNegativeInt = Annotated[int, Field(ge=0)]


class Person(BaseModel):
    name: str
    email: str = ""


class People(BaseModel):
    developer: Person
    manager: Person
    cto: Person


class Policy(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    reminder_before_days: NonNegativeInt = Field(alias="reminderBeforeDays")
    manager_after_days: NonNegativeInt = Field(alias="managerAfterDays")
    cto_after_days: NonNegativeInt = Field(alias="ctoAfterDays")
    approval_limit_days: Annotated[int, Field(ge=1)] = Field(alias="approvalLimitDays")
    people: People


class ProjectConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    default_limit_days: NonNegativeInt | None = Field(default=None, alias="defaultLimitDays")
    category_limits: dict[str, NonNegativeInt] = Field(
        default_factory=dict,
        alias="categoryLimits",
    )
    checkpoint_limits: dict[str, NonNegativeInt] = Field(
        default_factory=dict,
        alias="checkpointLimits",
    )
    policy: Policy


class LimitsPatch(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    default_limit_days: NonNegativeInt | None = Field(default=None, alias="defaultLimitDays")
    category_limits: dict[str, NonNegativeInt | None] = Field(
        default_factory=dict,
        alias="categoryLimits",
    )
    checkpoint_limits: dict[str, NonNegativeInt | None] = Field(
        default_factory=dict,
        alias="checkpointLimits",
    )


class HistoryEvent(BaseModel):
    at: str
    text: str


class ApprovalRecord(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    checkpoint_ref: str = Field(alias="checkpointRef")
    checkpoint_name: str = Field(alias="checkpointName")
    checkpoint_category: str = Field(default="Uncategorized", alias="checkpointCategory")
    project_name: str = Field(alias="projectName")
    fixed_by: str = Field(alias="fixedBy")
    fixed_at: str = Field(alias="fixedAt")
    overdue_days_at_fix: int = Field(alias="overdueDaysAtFix")
    nudges: int
    approved_by: str = Field(alias="approvedBy")
    approved_at: str = Field(alias="approvedAt")
    evidence_file: str | None = Field(default=None, alias="evidenceFile")


class OpenItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    project_id: ProjectId = Field(alias="projectId")
    checkpoint_id: str = Field(alias="checkpointId")
    owner: str
    opened_at: str = Field(alias="openedAt")
    status: ItemStatus
    fixed_at: str | None = Field(default=None, alias="fixedAt")
    fixed_by: str | None = Field(default=None, alias="fixedBy")
    overdue_days_at_fix: int | None = Field(default=None, alias="overdueDaysAtFix")
    approved_at: str | None = Field(default=None, alias="approvedAt")
    approved_by: str | None = Field(default=None, alias="approvedBy")
    reject_reason: str | None = Field(default=None, alias="rejectReason")
    nudges: list[str] = Field(default_factory=list)
    approval: ApprovalRecord | None = None
    history: list[HistoryEvent] = Field(default_factory=list)


class Notification(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    run_at: str = Field(alias="runAt")
    project_id: ProjectId = Field(alias="projectId")
    item_id: str = Field(alias="itemId")
    recipient: Level
    kind: NotificationKind
    title: str
    detail: str


class RunSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    run_at: str = Field(alias="runAt")
    project_id: ProjectId = Field(alias="projectId")
    counts: dict[Level, int]
    notifications: list[Notification]
    email_note: str = Field(alias="emailNote")


class ItemActionResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    item: OpenItem
    notifications: list[Notification] = Field(default_factory=list)
    email_note: str | None = Field(default=None, alias="emailNote")


class ApproveRequest(BaseModel):
    by: str


class RejectRequest(BaseModel):
    by: str
    reason: str
