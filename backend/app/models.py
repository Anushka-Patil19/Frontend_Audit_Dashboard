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
    # Jira's state at the moment the PR was merged (from the changelog) — what the
    # merge is judged on. jira_status / jira_approved above are today's state.
    jira_status_at_merge: str | None = None
    jira_approved_at_merge: bool | None = None
    jira_approved_by: str | None = None
    jira_approved_at: str | None = None
    approval_withdrawn_after_merge: bool = False
    required_merger: str | None
    branch_found: bool
    pr_number: int | None
    pr_state: str | None
    pr_merged: bool
    pr_merged_by: str | None
    merger_matches: bool
    pr_url: str | None
    evidence_screenshot: str | None = None
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


# --- CP6 (change linked to an approved CR/Jira) ----------------------------

Cp6OutcomeId = Literal["CP6-C", "CP6-NC"]


class Cp6ProjectConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    project_id: str = Field(alias="projectId")
    project_label: str = Field(alias="projectLabel")
    checkpoint_id: Literal["CP6"] = Field(alias="checkpointId")
    jira_ticket: str = Field(alias="jiraTicket")
    approved_status: str = Field(alias="approvedStatus")
    ledger_id: str = Field(alias="ledgerId")


class Cp6Result(BaseModel):
    project_id: str
    jira_ticket: str
    outcome_id: Cp6OutcomeId
    jira_status: str
    jira_summary: str | None
    jira_reporter: str | None
    jira_url: str
    evidence_screenshot: str | None
    timestamp: str


class Cp6VerifyResponse(BaseModel):
    config: Cp6ProjectConfig | None
    result: Cp6Result | None
    reply: str


# --- CP20 (pull request mandatory for changes) -------------------------------

# C = compliant, CE = compliant with exception, OBS = observation (passes, review
# gap — see #21), NC = non-compliant, NE = not evidenced (couldn't read the data).
Cp20OutcomeId = Literal["CP20-C", "CP20-CE", "CP20-OBS", "CP20-NC", "CP20-NE"]
Cp20FindingLevel = Literal["nc", "not_evidenced", "observation", "exception", "info"]


class Cp20ProjectConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    project_id: str = Field(alias="projectId")
    project_label: str = Field(alias="projectLabel")
    checkpoint_id: Literal["CP20"] = Field(alias="checkpointId")
    github_owner: str = Field(alias="githubOwner")
    github_repo: str = Field(alias="githubRepo")
    # FR-1: the client's list of protected branches (main + release branches).
    protected_branches: list[str] = Field(alias="protectedBranches")
    # Start of the audit period (ISO 8601).
    audit_period_start: str = Field(alias="auditPeriodStart")
    # End of the audit period (ISO 8601). Nothing after this date is fetched or
    # counted. None = no upper limit (check up to now).
    audit_period_end: str | None = Field(default=None, alias="auditPeriodEnd")
    # FR-3: when the PR rule was first switched on. Read from the org audit log
    # when available; otherwise recorded here by the client (open question 2).
    rule_start_date: str | None = Field(default=None, alias="ruleStartDate")
    ledger_id: str = Field(alias="ledgerId")


class Cp20Finding(BaseModel):
    level: Cp20FindingLevel
    text: str


class Cp20BranchRule(BaseModel):
    branch: str
    readable: bool
    protected: bool
    pr_required: bool
    admins_enforced: bool
    force_push_blocked: bool
    deletion_blocked: bool
    source: str  # "classic protection", "ruleset <name>", "none", or why unreadable


class Cp20Commit(BaseModel):
    branch: str
    sha: str
    author: str | None
    date: str
    message: str
    pr_number: int | None = None
    pr_url: str | None = None
    pr_author: str | None = None
    merged_by: str | None = None
    merged_at: str | None = None
    reviewers: list[str] = []
    self_merged: bool = False
    direct_push: bool = False
    exception_id: str | None = None


class Cp20HistoryEvent(BaseModel):
    branch: str
    type: str  # force_push | branch_deletion | push
    actor: str | None
    time: str
    sha: str | None = None
    exception_id: str | None = None


class Cp20Exception(BaseModel):
    id: str
    branch: str = "*"
    sha: str | None = None  # a specific commit (prefix ok)…
    account: str | None = None  # …or an account, e.g. a dependency bot
    reason: str
    approver: str
    expires: str  # ISO date; the push must be on or before it


class Cp20Gates(BaseModel):
    protection: GateState
    commits: GateState
    history: GateState
    review: GateState


class Cp20Result(BaseModel):
    project_id: str
    repo: str
    repo_url: str
    outcome_id: Cp20OutcomeId
    findings: list[Cp20Finding]
    counts: dict[str, int]
    branches: list[Cp20BranchRule]
    rule_start_date: str | None
    rule_start_source: str
    period_start: str
    # Upper bound of the checked range; None when no end date is configured.
    period_end: str | None = None
    commits: list[Cp20Commit]
    commits_before_rule_start: int
    history_events: list[Cp20HistoryEvent]
    exceptions_used: list[Cp20Exception]
    evidence_file: str | None = None
    evidence_hash: str | None = None
    evidence_screenshot: str | None = None
    # Append-only run log (one JSON line per check, hash-chained to the previous line).
    hash_log_file: str | None = None
    hash_log_entry: int | None = None
    hash_log_entry_hash: str | None = None
    timestamp: str


class Cp20VerifyResponse(BaseModel):
    config: Cp20ProjectConfig | None
    result: Cp20Result | None
    reply: str
    gates: Cp20Gates


# --- CP40 (production deployment approval, Jira ticket + attached email) ---

Cp40OutcomeId = Literal["CP40-C", "CP40-Pending", "CP40-NC", "CP40-Manual"]


class Cp40ProjectConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    project_id: str = Field(alias="projectId")
    project_label: str = Field(alias="projectLabel")
    checkpoint_id: Literal["CP40"] = Field(alias="checkpointId")
    jira_ticket: str = Field(alias="jiraTicket")
    approved_status: str = Field(alias="approvedStatus")
    # The step the email's subject must name, e.g. "Production approval".
    step_name: str = Field(alias="stepName")
    authorized_approvers: list[str] = Field(alias="authorizedApprovers")
    # Planned production deployment time (ISO 8601). The email must be dated
    # before it; when unset, the email just can't be dated in the future.
    deployment_at: str | None = Field(default=None, alias="deploymentAt")
    ledger_id: str = Field(alias="ledgerId")


class Cp40GateStatus(BaseModel):
    ticket: GateState
    approver: GateState
    attachment: GateState
    content: GateState


class Cp40Result(BaseModel):
    project_id: str
    jira_ticket: str
    jira_url: str
    outcome_id: Cp40OutcomeId
    # Every rule that failed / what is missing, in plain words.
    reasons: list[str]
    jira_status: str
    approver_name: str | None = None
    approver_email: str | None = None
    attachment_name: str | None = None
    attachment_author: str | None = None
    attachment_sha256: str | None = None
    email_from: str | None = None
    email_date: str | None = None
    email_subject: str | None = None
    email_excerpt: str | None = None
    llm_approved: bool | None = None
    llm_confidence: int | None = None
    llm_reason: str | None = None
    evidence_file: str | None = None
    evidence_screenshot: str | None = None
    comment_posted: bool = False
    timestamp: str


class Cp40VerifyResponse(BaseModel):
    config: Cp40ProjectConfig | None
    result: Cp40Result | None
    reply: str
    gates: Cp40GateStatus


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
    model_config = ConfigDict(populate_by_name=True)

    ok: Literal[True] = True
    results: list[DependencyResult]
    checked_at: str | None = Field(default=None, alias="checkedAt")
    evidence_screenshot: str | None = Field(default=None, alias="evidenceScreenshot")


class DependencyMonitorError(BaseModel):
    ok: Literal[False] = False
    error: str


DependencyMonitorResult = DependencyMonitorOk | DependencyMonitorError


# --- Developer invites ---------------------------------------------------


class CreateInviteRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    email: str
    project_id: str = Field(alias="projectId")
    project_name: str = Field(alias="projectName")
    invited_by: str | None = Field(default=None, alias="invitedBy")


class Invite(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    token: str
    email: str
    project_id: str = Field(alias="projectId")
    project_name: str = Field(alias="projectName")
    role: Literal["developer"] = "developer"
    invited_by: str | None = Field(default=None, alias="invitedBy")
    created_at: str = Field(alias="createdAt")


class CreateInviteResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    invite: Invite
    link: str
    email_sent: bool = Field(alias="emailSent")
    email_error: str | None = Field(default=None, alias="emailError")
