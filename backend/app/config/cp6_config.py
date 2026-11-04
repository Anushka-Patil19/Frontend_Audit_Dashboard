# Project configuration for CP6 (every change is linked to an approved CR/Jira).
# The change's CR ticket and the Jira status that counts as "approved" are
# fixed, human-entered config — never inferred.
from app.models import Cp6ProjectConfig

cp6_configs: list[Cp6ProjectConfig] = [
    Cp6ProjectConfig(
        projectId="project-a",
        projectLabel="PIT Armour",
        checkpointId="CP6",
        jiraTicket="POC-7",
        approvedStatus="Approved",
        ledgerId="cp-6",
    ),
]


def resolve_cp6_project(question: str) -> Cp6ProjectConfig | None:
    """Deterministic project resolution from free text — the configured project
    label or its Jira ticket key appearing in the question, same approach as CP10."""
    q = question.lower()
    for cfg in cp6_configs:
        if cfg.project_label.lower() in q or cfg.jira_ticket.lower() in q:
            return cfg
    return None
