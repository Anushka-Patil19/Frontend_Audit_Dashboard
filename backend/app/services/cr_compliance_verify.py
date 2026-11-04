# Core flow: fetch the Jira ticket (status + comments) and the GitHub
# branch/PR state independently (neither blocks the other), then run
# jira_approved + pr_merged + merger_matches through the decision matrix
# below. No LLM step: identity here is a deterministic mention-vs-login
# match, same spirit as CP10's sender-email match.
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from app.clients.evidence_screenshot import capture_pull_request_screenshot
from app.clients.github_client import find_branch, find_pull_requests_for_branch, get_pull_request
from app.clients.jira_client import extract_required_merger, get_jira_issue_with_history, get_status_categories
from app.models import CrComplianceProjectConfig, CrComplianceResult, CrGateStatus, CrOutcomeId, CrVerifyResponse
from app.utils import now_iso


def _parse(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        # Jira's "+0530" offsets have no colon.
        try:
            parsed = datetime.strptime(value, "%Y-%m-%dT%H:%M:%S.%f%z")
        except ValueError:
            return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _ist(value: str | None) -> str:
    parsed = _parse(value)
    return parsed.astimezone(ZoneInfo("Asia/Kolkata")).strftime("%d %b %Y %H:%M IST") if parsed else "?"


def _status_at(issue: dict, moment: datetime, current: str) -> tuple[str, dict | None]:
    """The ticket's status at `moment`, replayed from the changelog, plus the
    status change that put it there (None if it never changed before then)."""
    changes = sorted(
        (
            (_parse(h.get("created")), h, item)
            for h in (issue.get("changelog") or {}).get("histories") or []
            for item in h.get("items") or []
            if item.get("field") == "status" and _parse(h.get("created"))
        ),
        key=lambda c: c[0],
    )
    if not changes:
        return current, None
    before = [c for c in changes if c[0] <= moment]
    if not before:
        return changes[0][2].get("fromString") or current, None
    _, history, item = before[-1]
    return item.get("toString") or current, history


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

    if result.pr_merged:
        # Two separate checks, each judged on its own facts: the Jira approval as
        # it stood when the PR was merged, and who merged the PR.
        if result.jira_approved_at_merge:
            jira_line = (
                f"Jira approval: ✓ approved by {result.jira_approved_by or 'unknown'} on "
                f"{_ist(result.jira_approved_at)}, before the merge"
            )
            if result.approval_withdrawn_after_merge:
                jira_line += f' (moved back to "{result.jira_status}" later, after the merge)'
        else:
            jira_line = f'Jira approval: ✗ not approved when the PR was merged (status was "{result.jira_status_at_merge}")'
        merged_by = result.pr_merged_by or "an unknown user"
        if result.required_merger:
            merger_check = (
                f"matches the required merger @{result.required_merger}"
                if result.merger_matches
                else f"but the ticket requires @{result.required_merger}"
            )
            pr_line = f"PR merge: {'✓' if result.merger_matches else '✗'} PR #{result.pr_number} merged by {merged_by} — {merger_check}"
        else:
            pr_line = f"PR merge: ✓ PR #{result.pr_number} merged by {merged_by} (no required merger named on the ticket)"
        return f"{header}\n{jira_line}.\n{pr_line}."

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
        issue = await get_jira_issue_with_history(ticket_key)
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

    # A merged PR is judged on Jira's state *when it was merged*, replayed from the
    # changelog — not on today's status, which may have changed since.
    status_at_merge = approved_at_merge = approved_by = approved_at = None
    withdrawn = False
    if pr_merged:
        try:
            categories = await get_status_categories(cfg.jira_project_key)
        except RuntimeError as error:
            return CrVerifyResponse(
                config=cfg, ticketKey=ticket_key, result=None, gates=gates,
                reply=f"Couldn't read the Jira workflow statuses: {error}",
            )
        status_at_merge, change = _status_at(issue, _parse(pr["merged_at"]), status_name)
        approved_at_merge = categories.get(status_at_merge.lower()) == "done"
        if approved_at_merge and change:
            approved_by = (change.get("author") or {}).get("displayName")
            approved_at = change.get("created")
        withdrawn = bool(approved_at_merge and not jira_approved)
        gates.jira = "passed" if approved_at_merge else "failed"

    # No requirement specified -> never blocks compliance. Requirement
    # specified -> the actual GitHub login must contain the mentioned name
    # (case-insensitive substring, since a Jira mention like "@rahul" is a
    # first name, not the GitHub login it maps to, e.g. "rahulnewel").
    merger_matches = not required_merger or (
        merged_by_login is not None and required_merger.lower() in merged_by_login.lower()
    )

    if pr_merged:
        outcome_id: CrOutcomeId = "CR-C" if (approved_at_merge and merger_matches) else "CR-NC"
    else:
        outcome_id = "CR-IP" if jira_approved else "CR-Pending"

    result = CrComplianceResult(
        project_id=cfg.project_id,
        jira_ticket=ticket_key,
        outcome_id=outcome_id,
        jira_status=status_name,
        jira_approved=jira_approved,
        jira_status_at_merge=status_at_merge,
        jira_approved_at_merge=approved_at_merge,
        jira_approved_by=approved_by,
        jira_approved_at=approved_at,
        approval_withdrawn_after_merge=withdrawn,
        required_merger=required_merger,
        branch_found=bool(branch),
        pr_number=pr["number"] if pr else None,
        pr_state=pr.get("state") if pr else None,
        pr_merged=pr_merged,
        pr_merged_by=merged_by_login,
        merger_matches=merger_matches,
        pr_url=pr.get("html_url") if pr else None,
        # Evidence is captured only for a Compliant result, like CP38/CP6/CP40;
        # Non-compliant / In progress / Pending results carry no screenshot.
        evidence_screenshot=(
            await capture_pull_request_screenshot(
                owner=cfg.github_owner,
                repo=cfg.github_repo,
                number=pr["number"],
                pr_url=pr["html_url"],
                updated_at=pr.get("updated_at") or "",
            )
            if outcome_id == "CR-C" and pr and pr.get("html_url")
            else None
        ),
        timestamp=timestamp,
    )
    return CrVerifyResponse(
        config=cfg, ticketKey=ticket_key, result=result, gates=gates, reply=cr_reply_text(ticket_key, cfg, result)
    )
