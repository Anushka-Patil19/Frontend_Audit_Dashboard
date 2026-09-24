from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class QuestionRequest(BaseModel):
    question: str


# --- CP38 --------------------------------------------------------------

Cp38PendingReason = Literal["no_email", "wrong_sender", "ambiguous_language"]
Cp38OutcomeId = Literal["CP38-C", "CP38-Pending"]


class Cp38ProjectConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    project_id: str = Field(alias="projectId")
    project_label: str = Field(alias="projectLabel")
    checkpoint_id: Literal["CP38"] = Field(alias="checkpointId")
    required_role: str = Field(alias="requiredRole")
    authorized_name: str = Field(alias="authorizedName")
    authorized_email: str = Field(alias="authorizedEmail")
    subject_match: str = Field(alias="subjectMatch")
    ledger_id: str = Field(alias="ledgerId")


class Cp38Result(BaseModel):
    project_id: str
    outcome_id: Cp38OutcomeId
    pending_reason: Cp38PendingReason | None
    wrong_sender_email: str | None
    confidence: int | None
    evidence_ref: str | None
    evidence_screenshot: str | None
    approver_actor: str | None
    timestamp: str


class Cp38VerifyResponse(BaseModel):
    config: Cp38ProjectConfig | None
    result: Cp38Result | None
    reply: str


class EvidenceScreenshotResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data_url: str = Field(alias="dataUrl")


# --- CP10 ----------------------------------------------------------------

Cp10PendingReason = Literal["not_ready", "wrong_sender", "ambiguous"]
Cp10OutcomeId = Literal["CP10-C", "CP10-Pending"]
GateState = Literal["pending", "passed", "failed"]


class Cp10ProjectConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    project_id: str = Field(alias="projectId")
    project_label: str = Field(alias="projectLabel")
    checkpoint_id: Literal["CP10"] = Field(alias="checkpointId")
    jira_ticket: str = Field(alias="jiraTicket")
    subject_matches: list[str] = Field(alias="subjectMatches")
    ledger_id: str = Field(alias="ledgerId")


class Cp10Result(BaseModel):
    project_id: str
    jira_ticket: str
    outcome_id: Cp10OutcomeId
    pending_reason: Cp10PendingReason | None
    approver_actor: str | None
    confidence: int | None
    evidence_ref: str | None
    evidence_screenshot: str | None
    timestamp: str


class Cp10GateStatus(BaseModel):
    jira: GateState
    mail: GateState
    llm: GateState


class Cp10VerifyResponse(BaseModel):
    config: Cp10ProjectConfig | None
    result: Cp10Result | None
    reply: str
    gates: Cp10GateStatus


# --- CR compliance ---------------------------------------------------------

CrOutcomeId = Literal["CR-C", "CR-NC", "CR-IP", "CR-Pending"]


class CrComplianceProjectConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    project_id: str = Field(alias="projectId")
    project_label: str = Field(alias="projectLabel")
    checkpoint_id: Literal["CR"] = Field(alias="checkpointId")
    jira_project_key: str = Field(alias="jiraProjectKey")
    github_owner: str = Field(alias="githubOwner")
    github_repo: str = Field(alias="githubRepo")
    ledger_id: str = Field(alias="ledgerId")


class CrComplianceResult(BaseModel):
    project_id: str
    jira_ticket: str
    outcome_id: CrOutcomeId
    jira_status: str | None
    jira_approved: bool
    required_merger: str | None
    branch_found: bool
    pr_number: int | None
    pr_state: str | None
    pr_merged: bool
    pr_merged_by: str | None
    merger_matches: bool
    pr_url: str | None
    timestamp: str


class CrGateStatus(BaseModel):
    jira: GateState
    branch: GateState
    pr: GateState


class CrVerifyResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    config: CrComplianceProjectConfig | None
    ticket_key: str | None = Field(alias="ticketKey")
    result: CrComplianceResult | None
    reply: str
    gates: CrGateStatus


# --- Mail connector ----------------------------------------------------

class MailSyncResult(BaseModel):
    connected: bool
    message: str


# --- Dependency monitor -----------------------------------------------

DependencyStatus = Literal["UP_TO_DATE", "UPDATE_AVAILABLE", "CHECK_FAILED"]
DeprecationSource = Literal["official-classifier", "maintainer-text"] | None


class DependencyResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    package: str
    current_version: str = Field(alias="currentVersion")
    latest_version: str | None = Field(alias="latestVersion")
    status: DependencyStatus
    message: str | None = None
    deprecated: bool
    deprecation_note: str | None = Field(alias="deprecationNote")
    deprecation_source: DeprecationSource = Field(alias="deprecationSource")
    replacement_package: str | None = Field(alias="replacementPackage")


class DependencyMonitorOk(BaseModel):
    ok: Literal[True] = True
    results: list[DependencyResult]


class DependencyMonitorError(BaseModel):
    ok: Literal[False] = False
    error: str


DependencyMonitorResult = DependencyMonitorOk | DependencyMonitorError
