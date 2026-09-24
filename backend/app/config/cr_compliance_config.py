# Project configuration for CR Compliance — unlike CP10/CP38 (one fixed
# Jira ticket per project), this checkpoint answers ad hoc questions about
# *any* change-request ticket, so the ticket key comes from the question
# text and only the GitHub repo it maps to is fixed config.
import re

from app.models import CrComplianceProjectConfig

cr_compliance_configs: list[CrComplianceProjectConfig] = [
    CrComplianceProjectConfig(
        projectId="project-a",
        projectLabel="PIT Armour",
        checkpointId="CR",
        jiraProjectKey="POC",
        githubOwner="Anushka34567",
        githubRepo="Github_integration",
        # cp-18 in the ledger ("Git commits are traceable to approved CRs") is
        # exactly this control — reused rather than adding a duplicate line
        # item for the same requirement.
        ledgerId="cp-18",
    ),
]

# Jira issue keys are PROJECTKEY-NUMBER. Users naturally write "CR-POC-4" or
# "CR POC-4" to mean "change request POC-4" — the CR- is describing the
# ticket type, not part of the real key — so it's stripped when present,
# but a bare "POC-4" resolves the same way.
_TICKET_KEY_RE = re.compile(r"\bcr[-\s]?([a-z][a-z0-9]{1,9}-\d+)\b|\b([a-z][a-z0-9]{1,9}-\d+)\b", re.IGNORECASE)


def extract_ticket_key(question: str) -> str | None:
    m = _TICKET_KEY_RE.search(question)
    if not m:
        return None
    key = m.group(1) or m.group(2)
    return key.upper() if key else None


def resolve_cr_compliance_project(ticket_key: str) -> CrComplianceProjectConfig | None:
    prefix = ticket_key.split("-")[0].upper() if ticket_key else None
    for cfg in cr_compliance_configs:
        if cfg.jira_project_key.upper() == prefix:
            return cfg
    return None
