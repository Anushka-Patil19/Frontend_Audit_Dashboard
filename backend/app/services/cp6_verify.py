# CP6 — every change is linked to an approved CR/Jira. Deterministic: reads the
# configured CR ticket's status from Jira; only the exact approved status passes.
from app.clients.evidence_screenshot import capture_jira_status_screenshot
from app.clients.jira_client import get_jira_issue, jira_browse_url
from app.models import Cp6ProjectConfig, Cp6Result, Cp6VerifyResponse
from app.utils import now_iso


async def verify_cp6(cfg: Cp6ProjectConfig) -> Cp6VerifyResponse:
    timestamp = now_iso()
    try:
        issue = await get_jira_issue(cfg.jira_ticket, fields="summary,status,reporter,updated")
    except RuntimeError as error:
        return Cp6VerifyResponse(config=cfg, result=None, reply=f"Copilot couldn't reach Jira: {error}")
    if issue is None:
        return Cp6VerifyResponse(
            config=cfg, result=None, reply=f"Jira ticket {cfg.jira_ticket} was not found."
        )

    fields = issue.get("fields") or {}
    status = (fields.get("status") or {}).get("name") or "Unknown"
    summary = fields.get("summary")
    reporter = (fields.get("reporter") or {}).get("displayName")
    url = jira_browse_url(cfg.jira_ticket)
    approved = status.lower() == cfg.approved_status.lower()

    # Evidence is captured only for an approved ticket; a non-approved one carries none.
    screenshot = None
    if approved:
        screenshot = await capture_jira_status_screenshot(
            issue_key=cfg.jira_ticket,
            summary=summary or "",
            status=status,
            reporter=reporter,
            updated=fields.get("updated") or timestamp,
            url=url,
        )

    result = Cp6Result(
        project_id=cfg.project_id,
        jira_ticket=cfg.jira_ticket,
        outcome_id="CP6-C" if approved else "CP6-NC",
        jira_status=status,
        jira_summary=summary,
        jira_reporter=reporter,
        jira_url=url,
        evidence_screenshot=screenshot,
        timestamp=timestamp,
    )
    if approved:
        reply = (
            f"CP6 - Change linked to an approved CR: Compliant\n"
            f"{cfg.jira_ticket} is {status} in Jira."
        )
    else:
        reply = (
            f"CP6 - Change linked to an approved CR: Non-compliant\n"
            f"{cfg.jira_ticket} is {status} in Jira - it must be {cfg.approved_status} before the change ships."
        )
    return Cp6VerifyResponse(config=cfg, result=result, reply=reply)
