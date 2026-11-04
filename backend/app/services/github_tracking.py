# GitHub tracking — read-only view of each project's pull requests, direct
# pushes, branch rules and deployments, every change traced to its CR key.
# Built on the fly from the repos in app/data/github_projects.json; nothing here
# is demo data. Deterministic (no LLM): flags come from GitHub + Jira facts.
import asyncio
import re
import time
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

from app.clients.github_client import github_get, github_get_all
from app.clients.jira_client import (
    extract_required_merger,
    get_jira_issue_with_history,
    get_status_categories,
    jira_browse_url,
)
from app.config.date_range import in_created_range
from app.config.github_tracking_config import TrackedProject, TrackedRepo, load_tracked_projects
from app.services.cp20_verify import _read_branch_rule
from app.services.cr_compliance_verify import _parse, _status_at

# "CR-POC-4 Session timeout" / branch "POC-4" → POC-4. The "CR-" prefix describes
# the ticket type and isn't part of the Jira key.
_KEY_RE = re.compile(r"\bCR[-\s]?([A-Z][A-Z0-9]{1,9}-\d+)\b|\b([A-Z][A-Z0-9]{1,9}-\d+)\b", re.IGNORECASE)
_CACHE_TTL = 120  # seconds — the popover and the page share one fetch
_cache: dict[str, tuple[float, dict]] = {}
_locks: dict[str, asyncio.Lock] = {}


def _ist(value: str | None) -> str | None:
    parsed = _parse(value)
    return parsed.astimezone(ZoneInfo("Asia/Kolkata")).strftime("%d %b %Y, %H:%M IST") if parsed else None


def _cr_key(texts: list[str], allowed: list[str]) -> str | None:
    for text in texts:
        for m in _KEY_RE.finditer(text or ""):
            key = (m.group(1) or m.group(2)).upper()
            if key.split("-")[0] in {k.upper() for k in allowed}:
                return key
    return None


def _flag(code: str, label: str, level: str, why: str) -> dict:
    return {"code": code, "label": label, "level": level, "why": why}


def _step(key: str, label: str, state: str, title: str, detail: str | None = None, url: str | None = None) -> dict:
    # state: passed | failed | warn | pending
    return {"key": key, "label": label, "state": state, "title": title, "detail": detail, "url": url}


class _Jira:
    """Per-request Jira lookups, cached by key (one ticket can back several PRs)."""

    def __init__(self) -> None:
        self.issues: dict[str, Any] = {}
        self.categories: dict[str, dict[str, str]] = {}

    async def issue(self, key: str) -> dict | None | Exception:
        if key not in self.issues:
            try:
                self.issues[key] = await get_jira_issue_with_history(key)
            except RuntimeError as error:
                self.issues[key] = error
        return self.issues[key]

    async def category(self, project_key: str, status: str) -> str | None:
        if project_key not in self.categories:
            try:
                self.categories[project_key] = await get_status_categories(project_key)
            except RuntimeError:
                self.categories[project_key] = {}
        return self.categories[project_key].get(status.lower())


async def _tags(base: str) -> list[dict]:
    read = await github_get_all(f"{base}/tags", max_pages=1)
    return read["data"] if read["status"] == 200 else []


async def _first_tag_containing(base: str, sha: str, tags: list[dict], cache: dict) -> str | None:
    """Oldest tag (of the latest 15) whose history includes the commit."""
    for tag in reversed(tags[:15]):
        key = (sha, tag["name"])
        if key not in cache:
            cmp = await github_get(f"{base}/compare/{sha}...{tag['commit']['sha']}")
            cache[key] = cmp["status"] == 200 and (cmp["data"] or {}).get("status") in ("ahead", "identical")
        if cache[key]:
            return tag["name"]
    return None


async def _pull_request(repo: TrackedRepo, project: TrackedProject, pr: dict, jira: _Jira, tags: list[dict],
                        deployments: list[dict], compare_cache: dict) -> dict:
    base = f"/repos/{repo.owner}/{repo.repo}"
    number = pr["number"]
    detail = (await github_get(f"{base}/pulls/{number}"))["data"] or {}
    reviews = (await github_get_all(f"{base}/pulls/{number}/reviews"))["data"] or []

    author = (pr.get("user") or {}).get("login")
    merged_at = pr.get("merged_at")
    merged = bool(merged_at)
    merged_by = (detail.get("merged_by") or {}).get("login")
    head_sha = (pr.get("head") or {}).get("sha")
    merge_sha = detail.get("merge_commit_sha") if merged else None

    # Latest review per reviewer decides; an approval of an older commit is stale.
    latest: dict[str, dict] = {}
    for r in sorted(reviews, key=lambda r: r.get("submitted_at") or ""):
        login = (r.get("user") or {}).get("login")
        if login and r.get("state") in ("APPROVED", "CHANGES_REQUESTED", "DISMISSED"):
            latest[login] = r
    approvals = [r for r in latest.values() if r.get("state") == "APPROVED"]
    approvers = sorted((r["user"]["login"] for r in approvals))
    stale = [r["user"]["login"] for r in approvals if head_sha and r.get("commit_id") and r["commit_id"] != head_sha]

    flags: list[dict] = []
    steps: list[dict] = []

    # 1 · CR key
    key = _cr_key([pr.get("title") or "", (pr.get("head") or {}).get("ref") or ""], project.jira_project_keys)
    if key:
        steps.append(_step("cr", "CR key", "passed", key, "found in the PR title or branch", jira_browse_url(key)))
    else:
        steps.append(_step("cr", "CR key", "failed", "No CR key", "no Jira key in the PR title or branch name"))
        flags.append(_flag("no_cr_key", "No CR key", "fail", "The PR can't be traced to a change request."))

    # 2 · Jira approval — judged at merge time for a merged PR, today for an open one
    required_merger = None
    jira_state = {"status_now": None, "status_at_merge": None, "approved": None}
    if key:
        issue = await jira.issue(key)
        if isinstance(issue, Exception):
            steps.append(_step("jira", "Jira approval", "pending", "Jira not readable", str(issue)))
        elif issue is None:
            steps.append(_step("jira", "Jira approval", "failed", f"{key} not found", "the CR key doesn't exist in Jira"))
            flags.append(_flag("cr_not_found", "CR not in Jira", "fail", f"{key} doesn't exist in Jira."))
        else:
            required_merger = extract_required_merger(issue)
            status_now = ((issue.get("fields") or {}).get("status") or {}).get("name") or "Unknown"
            moment = _parse(merged_at) if merged else datetime.now(timezone.utc)
            status_then, change = _status_at(issue, moment, status_now)
            approved = await jira.category(key.split("-")[0], status_then) == "done"
            jira_state = {"status_now": status_now, "status_at_merge": status_then if merged else None, "approved": approved}
            when = "at merge" if merged else "now"
            if approved:
                by = (change or {}).get("author", {}).get("displayName")
                detail_text = f"{status_then} {when}" + (f" · by {by} on {_ist(change.get('created'))}" if change and by else "")
                if merged and status_now != status_then:
                    detail_text += f" · now {status_now}"
                steps.append(_step("jira", "Jira approval", "passed", f"Approved{' by ' + by if by else ''}", detail_text, jira_browse_url(key)))
            else:
                steps.append(_step("jira", "Jira approval", "failed" if merged else "warn", f"{status_then} {when}",
                                   "the CR wasn't approved when the PR was merged" if merged else "the CR isn't approved yet",
                                   jira_browse_url(key)))
                flags.append(_flag("cr_not_approved", "CR not approved" if not merged else "Merged before CR approval",
                                   "fail" if merged else "warn",
                                   f"Jira {key} was \"{status_then}\" {when}."))

    # 3 · Review
    if author in approvers:
        flags.append(_flag("self_approved", "Self-approved", "fail", f"{author} approved their own PR."))
    if approvers:
        others = [a for a in approvers if a != author]
        state = "failed" if not others else ("warn" if stale else "passed")
        detail_text = f"approved by {', '.join(approvers)}"
        if stale:
            detail_text += f" · stale: new commits after {', '.join(stale)} approved"
            flags.append(_flag("stale_approval", "Approval is stale", "warn",
                               f"Commits were added after {', '.join(stale)} approved."))
        steps.append(_step("review", "Reviewed", state, ", ".join(approvers), detail_text))
    else:
        steps.append(_step("review", "Reviewed", "failed" if merged else "pending", "No approval",
                           "merged without an approving review" if merged else "waiting for a reviewer"))
        if merged:
            flags.append(_flag("no_approval", "Merged without approval", "fail", "No reviewer approved this PR."))

    # 4 · Merge
    if merged:
        merge_state = "passed"
        detail_text = f"into {(pr.get('base') or {}).get('ref')} on {_ist(merged_at)}"
        if required_merger:
            if merged_by and required_merger.lower() in merged_by.lower():
                detail_text += f" · matches required @{required_merger}"
            else:
                merge_state = "failed"
                detail_text += f" · ticket requires @{required_merger}"
                flags.append(_flag("merged_by_other", "Merged by someone else", "fail",
                                   f"{key} requires @{required_merger}; merged by {merged_by}."))
        if merged_by and merged_by == author:
            merge_state = "warn" if merge_state == "passed" else merge_state
            flags.append(_flag("self_merged", "Merged by its author", "warn", "No second person merged it (see #21)."))
        steps.append(_step("merge", "Merged", merge_state, merged_by or "unknown", detail_text, pr.get("html_url")))
    else:
        steps.append(_step("merge", "Merged", "pending", "Open" if pr.get("state") == "open" else "Closed, not merged",
                           f"opened {_ist(pr.get('created_at'))}", pr.get("html_url")))

    # 5 · Deploy — a deployment or release tag whose history includes the merge commit
    release = None
    deployed = None
    if merge_sha:
        for d in deployments:
            if d["sha"] == merge_sha:
                deployed = d
                break
        release = await _first_tag_containing(base, merge_sha, tags, compare_cache)
    if deployed:
        steps.append(_step("deploy", "Deployed", "passed", deployed["environment"],
                           f"by {deployed['creator']} on {_ist(deployed['created_at'])}" + (f" · {release}" if release else "")))
    elif release:
        steps.append(_step("deploy", "Released", "passed", release, "the release tag includes this merge"))
    else:
        steps.append(_step("deploy", "Deployed", "pending", "Not deployed" if merged else "—",
                           "no deployment or release tag includes this merge yet" if merged else None))

    worst = "fail" if any(f["level"] == "fail" for f in flags) else "warn" if flags else "clean"
    return {
        "repo": f"{repo.owner}/{repo.repo}",
        "number": number,
        "title": pr.get("title"),
        "url": pr.get("html_url"),
        "state": "merged" if merged else pr.get("state"),
        "author": author,
        "approvers": approvers,
        "merged_by": merged_by,
        "merged_at": merged_at,
        "created_at": pr.get("created_at"),
        "base": (pr.get("base") or {}).get("ref"),
        "head": (pr.get("head") or {}).get("ref"),
        "cr_key": key,
        "jira": jira_state,
        "required_merger": required_merger,
        "release": release,
        "flags": flags,
        "result": worst,
        "trace": steps,
    }


def _in_window(when: str, window) -> bool | None:
    if not window:
        return None
    t = _parse(when)
    if not t:
        return None
    local = t.astimezone(ZoneInfo(window.tz))
    hm = local.strftime("%H:%M")
    inside = (window.start <= hm < window.end) if window.start <= window.end else (hm >= window.start or hm < window.end)
    return local.weekday() in window.days and inside


def _before_end(when: str | None, end: datetime | None) -> bool:
    """True when `when` falls on or before the period end (or no end is set)."""
    if not end:
        return True
    t = _parse(when)
    return t is None or t <= end


async def _ticket_in_range(key: str | None, jira: _Jira) -> bool:
    """Is the PR's Jira ticket created inside the .env date range? Cached lookup —
    _pull_request already fetched the issue."""
    if not key:
        return True
    issue = await jira.issue(key)
    if not isinstance(issue, dict):
        return True
    return in_created_range((issue.get("fields") or {}).get("created"))


async def _repo(repo: TrackedRepo, project: TrackedProject, jira: _Jira) -> dict:
    base = f"/repos/{repo.owner}/{repo.repo}"
    meta = await github_get(base)
    if meta["status"] >= 400:
        return {"repo": f"{repo.owner}/{repo.repo}", "error": f"Repository not readable (HTTP {meta['status']})"}
    default_branch = (meta["data"] or {}).get("default_branch") or "main"
    end = _parse(project.period_end)  # None = no end date, everything up to now
    branches = list(dict.fromkeys(repo.protected_branches or [default_branch]))

    tags = await _tags(base)
    tag_by_sha = {t["commit"]["sha"]: t["name"] for t in tags}

    # Deployments recorded in GitHub (environments), with their latest status.
    deployments: list[dict] = []
    dep_read = await github_get_all(f"{base}/deployments", max_pages=1)
    for d in (dep_read["data"] or [])[:30] if dep_read["status"] == 200 else []:
        if not _before_end(d.get("created_at"), end):
            continue  # deployed after the end date — out of range
        statuses = (await github_get(f"{base}/deployments/{d['id']}/statuses"))["data"] or []
        in_window = _in_window(d.get("created_at"), project.deploy_window)
        deployments.append({
            "id": d["id"], "environment": d.get("environment"), "sha": d.get("sha"), "ref": d.get("ref"),
            "creator": (d.get("creator") or {}).get("login"), "created_at": d.get("created_at"),
            "status": statuses[0].get("state") if statuses else None,
            "tag": tag_by_sha.get(d.get("sha")), "in_window": in_window,
        })

    # state=all: open, closed and merged PRs are all taken — an open PR (and its
    # Jira ticket, approved or not) is still listed.
    pulls_read = await github_get_all(f"{base}/pulls", {"state": "all", "sort": "updated", "direction": "desc"}, max_pages=2)
    pulls = pulls_read["data"] if pulls_read["status"] == 200 else []
    # Date range (PR_TICKET_DATE_FROM / _TO in .env): keep only PRs created inside
    # the range, whatever their state — an open PR is kept like a merged one.
    pulls = [p for p in pulls if _before_end(p.get("created_at"), end) and in_created_range(p.get("created_at"))]
    compare_cache: dict = {}
    prs = [await _pull_request(repo, project, p, jira, tags, deployments, compare_cache) for p in pulls]
    # Same range on the Jira ticket: a PR whose CR ticket was created outside it is
    # left out. Open / unapproved tickets still count. A PR with no CR key, or a
    # ticket Jira can't return, is kept so it isn't silently hidden.
    prs = [x for x in prs if await _ticket_in_range(x["cr_key"], jira)]

    # Direct pushes: commits on a protected branch with no merged PR into it.
    pushes: list[dict] = []
    rules: list[dict] = []
    for branch in branches:
        rule, _ = await _read_branch_rule(base, branch)
        gaps = [] if not rule.readable else [label for ok, label in (
            (rule.pr_required, "PRs not required"),
            (rule.admins_enforced, "admins can bypass"),
            (rule.force_push_blocked, "force pushes allowed"),
            (rule.deletion_blocked, "deletion allowed"),
        ) if not ok]
        rules.append({"repo": f"{repo.owner}/{repo.repo}", **rule.model_dump(), "gaps": gaps})
        params = {"sha": branch, "since": project.period_start}
        if project.period_end:
            params["until"] = project.period_end  # GitHub-side cut-off at the end date
        commits = await github_get_all(f"{base}/commits", params, max_pages=3)
        for c in commits["data"] or [] if commits["status"] == 200 else []:
            # .env date range: a direct push made outside it is left out.
            if not in_created_range(((c.get("commit") or {}).get("committer") or {}).get("date")):
                continue
            linked =(await github_get(f"{base}/commits/{c['sha']}/pulls"))["data"] or []
            if any(p.get("merged_at") and (p.get("base") or {}).get("ref") == branch for p in linked):
                continue
            pushes.append({
                "repo": f"{repo.owner}/{repo.repo}", "branch": branch, "sha": c["sha"],
                "url": c.get("html_url"),
                "author": (c.get("author") or {}).get("login") or ((c.get("commit") or {}).get("author") or {}).get("name"),
                "date": ((c.get("commit") or {}).get("committer") or {}).get("date"),
                "message": ((c.get("commit") or {}).get("message") or "").splitlines()[0][:120],
                "kind": "direct push",
            })
        activity = await github_get_all(f"{base}/activity", {"ref": f"refs/heads/{branch}"}, max_pages=1)
        for a in activity["data"] or [] if activity["status"] == 200 else []:
            if (a.get("activity_type") in ("force_push", "branch_deletion")
                    and (a.get("timestamp") or "") >= project.period_start
                    and _before_end(a.get("timestamp"), end)
                    and in_created_range(a.get("timestamp"))):
                pushes.append({
                    "repo": f"{repo.owner}/{repo.repo}", "branch": branch, "sha": a.get("after"), "url": None,
                    "author": (a.get("actor") or {}).get("login"), "date": a.get("timestamp"),
                    "message": "", "kind": a["activity_type"].replace("_", " "),
                })

    return {"repo": f"{repo.owner}/{repo.repo}", "url": (meta["data"] or {}).get("html_url"),
            "default_branch": default_branch, "prs": prs, "pushes": pushes, "rules": rules, "deployments": deployments}


async def _build(pid: str, project: TrackedProject) -> dict:
    jira = _Jira()
    repos = [await _repo(r, project, jira) for r in project.repos]
    ok = [r for r in repos if "error" not in r]
    prs = [p for r in ok for p in r["prs"]]
    pushes = [p for r in ok for p in r["pushes"]]
    rules = [x for r in ok for x in r["rules"]]
    deployments = [{**d, "repo": r["repo"]} for r in ok for d in r["deployments"]]
    flagged = [p for p in prs if p["result"] != "clean"]
    deploys_to_check = [d for d in deployments if d["in_window"] is False or not d["tag"]]
    return {
        "project_id": pid,
        "name": project.name,
        "connected": bool(project.repos),
        "repos": [{"repo": r["repo"], "url": r.get("url"), "error": r.get("error")} for r in repos],
        "kpis": {
            "open_prs": sum(1 for p in prs if p["state"] == "open"),
            "flagged_prs": len(flagged),
            "bypassed_pushes": len(pushes),
            "rule_gaps": sum(len(x["gaps"]) for x in rules),
            "deploys_to_check": len(deploys_to_check),
            "deploys_outside_window": sum(1 for d in deployments if d["in_window"] is False),
            "deploys_without_tag": sum(1 for d in deployments if not d["tag"]),
        },
        "prs": prs,
        "pushes": pushes,
        "rules": rules,
        "deployments": deployments,
        "fetched_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


async def project_tracking(pid: str, refresh: bool = False) -> dict | None:
    projects = load_tracked_projects()
    if pid not in projects:
        return None
    lock = _locks.setdefault(pid, asyncio.Lock())
    async with lock:
        cached = _cache.get(pid)
        if cached and not refresh and time.time() - cached[0] < _CACHE_TTL:
            return cached[1]
        data = await _build(pid, projects[pid])
        _cache[pid] = (time.time(), data)
        return data


async def tracking_summary(refresh: bool = False) -> list[dict]:
    """Per-project counts for the header popover."""
    out = []
    for pid in load_tracked_projects():
        data = await project_tracking(pid, refresh)
        out.append({
            "project_id": pid, "name": data["name"], "connected": data["connected"],
            "repos": [r["repo"] for r in data["repos"]], "kpis": data["kpis"],
            "flagged": data["kpis"]["flagged_prs"] + data["kpis"]["bypassed_pushes"] + data["kpis"]["rule_gaps"],
            "top": [
                {"kind": "pr", "text": f"#{p['number']} {p['title']}", "label": p["flags"][0]["label"], "level": p["flags"][0]["level"]}
                for p in data["prs"] if p["flags"]
            ][:3] + [
                {"kind": "push", "text": f"{x['kind']} {(x['sha'] or '')[:7]} to {x['branch']}", "label": "Bypassed PR rule", "level": "fail"}
                for x in data["pushes"]
            ][:2],
        })
    return out
