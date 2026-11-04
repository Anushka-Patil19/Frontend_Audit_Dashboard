# Project configuration for CP40 (production deployment request is approved),
# checked from the Jira ticket and the approval email attached to it — the
# mailbox is never scanned. Ticket, approved status, step name and the
# authorised approver list are fixed, human-entered config — never inferred.
from app.models import Cp40ProjectConfig

cp40_configs: list[Cp40ProjectConfig] = [
    Cp40ProjectConfig(
        projectId="project-a",
        projectLabel="PIT Armour",
        checkpointId="CP40",
        jiraTicket="POC-8",
        approvedStatus="Approved",
        stepName="Production approval",
        authorizedApprovers=["akhil@neweltechnologies.com"],
        deploymentAt=None,
        ledgerId="cp-40",
    ),
]


def resolve_cp40_project(question: str) -> Cp40ProjectConfig | None:
    """Deterministic project resolution — the project label or its ticket key in the question."""
    q = question.lower()
    for cfg in cp40_configs:
        if cfg.project_label.lower() in q or cfg.jira_ticket.lower() in q:
            return cfg
    return None
