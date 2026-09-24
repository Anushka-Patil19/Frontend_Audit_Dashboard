# Project configuration for CP10 (CAB Approval Verification).
# Simplification vs. the PRD's literal "CAB Approver custom field": that
# field doesn't exist on the real ticket, so the ticket's existing Reporter
# is used as the authorized-approver identity instead.
from app.models import Cp10ProjectConfig

cp10_configs: list[Cp10ProjectConfig] = [
    Cp10ProjectConfig(
        projectId="project-a",
        projectLabel="PIT Armour",
        checkpointId="CP10",
        jiraTicket="POC-3",
        subjectMatches=["POC-3", "PIT-Arnour CAB Approval"],
        ledgerId="cp-10",
    ),
]


def resolve_cp10_project(question: str) -> Cp10ProjectConfig | None:
    """Deterministic project resolution from free text — substring match on
    the configured project label, same approach as CP38."""
    q = question.lower()
    for cfg in cp10_configs:
        if cfg.project_label.lower() in q:
            return cfg
    return None
