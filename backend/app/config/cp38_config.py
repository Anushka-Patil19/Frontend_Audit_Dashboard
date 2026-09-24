# Project configuration for CP38, stored once per project.
# Per the PRD: required_role / authorized_name / authorized_email are never
# inferred or guessed by the AI — they're fixed, human-entered config.
from app.models import Cp38ProjectConfig

cp38_configs: list[Cp38ProjectConfig] = [
    Cp38ProjectConfig(
        projectId="project-a",
        projectLabel="PIT Armour",
        checkpointId="CP38",
        requiredRole="Business",
        authorizedName="Anushka Patil",
        authorizedEmail="Anushka.p@neweltechnologies.com",
        subjectMatch="PIT Armour UAT Sign-off",
        ledgerId="cp-38",
    ),
]


def resolve_cp38_project(question: str) -> Cp38ProjectConfig | None:
    """Deterministic project resolution from a free-text copilot question —
    substring match on the configured project label, never LLM-guessed."""
    q = question.lower()
    for cfg in cp38_configs:
        if cfg.project_label.lower() in q:
            return cfg
    return None
