from typing import Literal

from pydantic import BaseModel, ConfigDict

# Shapes for the Compliance Review Dashboard (port 8082). They mirror the TypeScript
# types in Compliance_Review_Dashboard/src/data/types.ts (camelCase JSON).

NotificationKind = Literal["observation-digest", "info-request", "report", "verification", "exception-approval"]


class Recipient(BaseModel):
    name: str
    email: str


class NotificationIn(BaseModel):
    """One email the dashboard hands to deliver(); to/cc are already expanded to name + email."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str
    at: str
    kind: NotificationKind
    to: list[Recipient]
    cc: list[Recipient] = []
    subject: str
    body: list[str]
    related: list[str] = []


class NotificationOut(BaseModel):
    status: Literal["sent", "failed"]
    note: str
