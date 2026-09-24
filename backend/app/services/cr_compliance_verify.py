# Core flow: fetch the Jira ticket (status + comments) and the GitHub
# branch/PR state independently (neither blocks the other), then run
# jira_approved + pr_merged + merger_matches through the decision matrix
# below. No LLM step: identity here is a deterministic mention-vs-login
# match, same spirit as CP10's sender-email match.
from app.clients.github_client import find_branch, find_pull_requests_for_branch, get_pull_request
from app.clients.jira_client import extract_required_merger, get_jira_issue
from app.models import CrComplianceProjectConfig, CrComplianceResult, CrGateStatus, CrOutcomeId, CrVerifyResponse
from app.utils import now_iso


def _initial_gates() -> CrGateStatus:
    return CrGateStatus(jira="pending", branch="pending", pr="pending")


def _outcome_label(outcome_id: CrOutcomeId) -> str:
    return {
        "CR-C": "Compliant",
        "CR-NC": "Non-Compliant",
        "CR-IP": "In Progress",
        "CR-Pending": "Pending",
    }[outcome_id]


def cr_reply_text(ticket_key: str, cfg: CrComplianceProjectConfig, result: CrComplianceResult) -> str:
    header = f"CR Compliance — {ticket_key}: {_outcome_label(result.outcome_id)}"
    approved = "approved" if result.jira_approved else "not yet approved"
    jira_phrase = f'Jira status "{result.jira_status}" ({approved})'

    if not result.branch_found:
        return (
            f'{header}\n{jira_phrase}. No branch named "{ticket_key}" has been found in '
            f"{cfg.github_owner}/{cfg.github_repo} yet."
        )
    if result.pr_number is None:
        return (
            f'{header}\n{jira_phrase}. Branch "{ticket_key}" exists in {cfg.github_owner}/{cfg.github_repo}, '
            f"but no pull request has been opened from it yet."
        )
    if not result.pr_merged:
        merger_note = f' (must be merged by "{result.required_merger}")' if result.required_merger else ""
        return f"{header}\n{jira_phrase}. PR #{result.pr_number} is {result.pr_state}, not yet merged{merger_note}."

    merged_by_phrase = f"merged by {result.pr_merged_by}" if result.pr_merged_by else "merged, but by an unknown user"
    if result.required_merger:
        merger_note = (
            f' — matches the required merger "{result.required_merger}"'
            if result.merger_matches
            else f' — but the ticket requires it to be merged by "{result.required_merger}"'
        )
    else:
        merger_note = ""
    return f"{header}\n{jira_phrase}. PR #{result.pr_number} is {merged_by_phrase}{merger_note}."


async def verify_cr_compliance(ticket_key: str, cfg: CrComplianceProjectConfig) -> CrVerifyResponse:
    timestamp = now_iso()
    gates = _initial_gates()

    # Jira side — direct REST (Basic auth), no interactive OAuth login.
    try:
        issue = await get_jira_issue(ticket_key)
    except RuntimeError as error:
        return CrVerifyResponse(
            config=cfg, ticketKey=ticket_key, result=None, gates=gates, reply=f"Copilot couldn't reach Jira: {error}"
        )
    if not issue:
        return CrVerifyResponse(
            config=cfg,
            ticketKey=ticket_key,
            result=None,
            gates=gates,
            reply=f"Copilot couldn't find {ticket_key} in Jira.",
        )

    fields = issue.get("fields") or {}
    status = fields.get("status") or {}
    status_name: str = status.get("name") or "Unknown"
    # statusCategory.key is Jira's own normalized bucket ("new" | "indeterminate"
    # | "done") — checked instead of matching on statusName so this doesn't
    # break if the workflow's status labels ever change.
    status_category_key: str = (status.get("statusCategory") or {}).get("key") or ""
    jira_approved = status_category_key == "done"
    gates.jira = "passed" if jira_approved else "failed"
    required_merger = extract_required_merger(issue)

    # GitHub side — always checked, regardless of the Jira outcome above,
    # since a merge without approval (or by the wrong person) is itself a
    # result this checkpoint needs to surface (CR-NC), not something to skip.
    try:
        branch = await find_branch(cfg.github_owner, cfg.github_repo, ticket_key)
    except RuntimeError as error:
        return CrVerifyResponse(
            config=cfg, ticketKey=ticket_key, result=None, gates=gates, reply=f"GitHub couldn't be reached: {error}"
        )
    gates.branch = "passed" if branch else "failed"

    pr = None
    merged_by_login = None
    if branch:
        try:
            pulls = await find_pull_requests_for_branch(cfg.github_owner, cfg.github_repo, ticket_key)
        except RuntimeError as error:
            return CrVerifyResponse(
                config=cfg,
                ticketKey=ticket_key,
                result=None,
                gates=gates,
                reply=f"Branch found, but the pull request lookup failed: {error}",
            )
        # Most recent PR from that branch, if more than one was ever opened.
        pulls.sort(key=lambda p: p["number"], reverse=True)
        pr = pulls[0] if pulls else None

        # merged_by isn't on the list response above — only fetched once we
        # know which PR, and only when it's actually merged.
        if pr and pr.get("merged_at"):
            try:
                detail = await get_pull_request(cfg.github_owner, cfg.github_repo, pr["number"])
                merged_by_login = (detail.get("merged_by") or {}).get("login")
            except RuntimeError as error:
                return CrVerifyResponse(
                    config=cfg,
                    ticketKey=ticket_key,
                    result=None,
                    gates=gates,
                    reply=f"PR found, but fetching who merged it failed: {error}",
                )
    pr_merged = bool(pr and pr.get("merged_at"))
    gates.pr = "passed" if pr_merged else "failed"

    # No requirement specified -> never blocks compliance. Requirement
    # specified -> the actual GitHub login must contain the mentioned name
    # (case-insensitive substring, since a Jira mention like "@rahul" is a
    # first name, not the GitHub login it maps to, e.g. "rahulnewel").
    merger_matches = not required_merger or (
        merged_by_login is not None and required_merger.lower() in merged_by_login.lower()
    )

    if pr_merged:
        outcome_id: CrOutcomeId = "CR-C" if (jira_approved and merger_matches) else "CR-NC"
    else:
        outcome_id = "CR-IP" if jira_approved else "CR-Pending"

    result = CrComplianceResult(
        project_id=cfg.project_id,
        jira_ticket=ticket_key,
        outcome_id=outcome_id,
        jira_status=status_name,
        jira_approved=jira_approved,
        required_merger=required_merger,
        branch_found=bool(branch),
        pr_number=pr["number"] if pr else None,
        pr_state=pr.get("state") if pr else None,
        pr_merged=pr_merged,
        pr_merged_by=merged_by_login,
        merger_matches=merger_matches,
        pr_url=pr.get("html_url") if pr else None,
        timestamp=timestamp,
    )
    return CrVerifyResponse(
        config=cfg, ticketKey=ticket_key, result=result, gates=gates, reply=cr_reply_text(ticket_key, cfg, result)
    )
