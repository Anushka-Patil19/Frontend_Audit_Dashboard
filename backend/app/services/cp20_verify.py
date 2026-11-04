# CP20 — pull request is mandatory for changes (PRD_Pull_Request_Mandatory.pdf).
# Read-only and fully deterministic (no LLM):
#   FR-1/2  read each protected branch's rule: PR required, admins enforced,
#           force pushes and deletions blocked
#   FR-3    rule start date (config / ruleset creation), else "Not evidenced"
#   FR-4/5  every commit on the branch since the start has a merged PR into it
#   FR-6    PR author and merger recorded separately (squash merges included)
#   FR-7    direct pushes checked against the exception register
#   FR-8    force pushes, deletions and direct pushes from the repo activity log —
#           this also catches a direct push that was later reverted
#   FR-9    PR merged by its own author → observation, linked to #21
#   FR-10   worst result across branches and commits, with counts and reasons
#   FR-11   evidence stored as JSON with a hash (+ a summary image)
import hashlib
import html
import json
import re
from datetime import datetime, timedelta, timezone

from app.clients.evidence_screenshot import _evidence_dir, _render_and_save
from app.clients.github_client import github_get, github_get_all
from app.config.cp20_config import load_pr_exceptions
from app.config.date_range import created_range
from app.models import (
    Cp20BranchRule,
    Cp20Commit,
    Cp20Exception,
    Cp20Finding,
    Cp20Gates,
    Cp20HistoryEvent,
    Cp20ProjectConfig,
    Cp20Result,
    Cp20VerifyResponse,
)
from app.utils import now_iso

# Worst first. Observation outranks an exception: both pass, but a review gap matters more.
_RANK = {"nc": 4, "not_evidenced": 3, "observation": 2, "exception": 1}
_OUTCOME = {4: "CP20-NC", 3: "CP20-NE", 2: "CP20-OBS", 1: "CP20-CE", 0: "CP20-C"}
_LABEL = {
    "CP20-C": "Compliant",
    "CP20-CE": "Compliant with exception",
    "CP20-OBS": "Observation",
    "CP20-NC": "Non-compliant",
    "CP20-NE": "Not evidenced",
}


def _parse(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _day(value: str | None) -> str:
    parsed = _parse(value)
    return parsed.strftime("%d %b %Y %H:%M UTC") if parsed else (value or "?")


async def _read_branch_rule(base: str, branch: str) -> tuple[Cp20BranchRule, str | None]:
    """FR-2. Returns the branch's effective rule and the earliest active ruleset creation time."""
    detail = await github_get(f"{base}/branches/{branch}")
    if detail["status"] == 404:
        return Cp20BranchRule(branch=branch, readable=True, protected=False, pr_required=False, admins_enforced=False,
                              force_push_blocked=False, deletion_blocked=False, source="branch does not exist"), None
    if detail["status"] >= 400:
        return Cp20BranchRule(branch=branch, readable=False, protected=False, pr_required=False, admins_enforced=False,
                              force_push_blocked=False, deletion_blocked=False,
                              source=f"branch not readable (HTTP {detail['status']})"), None
    classic_protected = bool((detail["data"] or {}).get("protected"))

    pr_required = admins_enforced = force_blocked = deletion_blocked = False
    sources: list[str] = []
    readable = True
    ruleset_start: str | None = None

    # Rulesets (readable with pull access): the effective rules on this branch.
    rules = await github_get(f"{base}/rules/branches/{branch}")
    if rules["status"] >= 400:
        readable = False
        sources.append(f"rulesets not readable (HTTP {rules['status']})")
    else:
        ruleset_ids: set[int] = set()
        for rule in rules["data"] or []:
            kind = rule.get("type")
            if kind == "pull_request":
                pr_required = True
                ruleset_ids.add(rule.get("ruleset_id"))
            elif kind == "non_fast_forward":
                force_blocked = True
            elif kind == "deletion":
                deletion_blocked = True
        for ruleset_id in ruleset_ids:
            rs = await github_get(f"{base}/rulesets/{ruleset_id}")
            if rs["status"] >= 400:
                readable = False
                sources.append(f"ruleset {ruleset_id} not readable (HTTP {rs['status']})")
                continue
            data = rs["data"] or {}
            sources.append(f"ruleset \"{data.get('name')}\"")
            # No bypass actors → the rule applies to admins too.
            if data.get("enforcement") == "active" and not data.get("bypass_actors"):
                admins_enforced = True
            created = data.get("created_at")
            if created and (ruleset_start is None or created < ruleset_start):
                ruleset_start = created

    # Classic branch protection. Reading its settings needs admin rights on the repo.
    if classic_protected:
        prot = await github_get(f"{base}/branches/{branch}/protection")
        if prot["status"] == 200:
            data = prot["data"] or {}
            sources.append("classic protection")
            pr_required = pr_required or bool(data.get("required_pull_request_reviews"))
            admins_enforced = admins_enforced or bool((data.get("enforce_admins") or {}).get("enabled"))
            force_blocked = force_blocked or not (data.get("allow_force_pushes") or {}).get("enabled", False)
            deletion_blocked = deletion_blocked or not (data.get("allow_deletions") or {}).get("enabled", False)
        elif not pr_required:
            # Protected, but the settings can't be read and no ruleset proves the PR rule.
            readable = False
            sources.append(f"classic protection on, settings not readable with this token (HTTP {prot['status']})")

    protected = classic_protected or pr_required or force_blocked or deletion_blocked
    return Cp20BranchRule(branch=branch, readable=readable, protected=protected, pr_required=pr_required,
                          admins_enforced=admins_enforced, force_push_blocked=force_blocked,
                          deletion_blocked=deletion_blocked, source=", ".join(sources) or "none"), ruleset_start


def _find_exception(exceptions: list[Cp20Exception], branch: str, sha: str | None, actor: str | None,
                    when: str) -> Cp20Exception | None:
    """FR-7: a valid exception names the commit (or the account), covers the branch,
    has an approver, and hadn't expired when the push happened."""
    pushed = _parse(when)
    for ex in exceptions:
        if ex.branch not in ("*", branch) or not ex.approver.strip():
            continue
        matches = (ex.sha and sha and sha.lower().startswith(ex.sha.lower())) or (
            ex.account and actor and ex.account.lower() == actor.lower()
        )
        expires = _parse(ex.expires if "T" in ex.expires else ex.expires + "T23:59:59Z")
        if matches and pushed and expires and pushed <= expires:
            return ex
    return None


HASH_LOG_FILE = "cp20_hash_log.jsonl"
_GENESIS = "0" * 64


def append_hash_log(result: Cp20Result) -> tuple[int, str]:
    """Appends one line per check to evidence/cp20_hash_log.jsonl — never rewrites it.
    Each line carries the previous line's entry_hash, and its own entry_hash covers
    the line's content plus that link, so editing or deleting an earlier line
    breaks the chain (see verify_hash_log)."""
    path = _evidence_dir() / HASH_LOG_FILE
    previous, count = _GENESIS, 0
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                previous = json.loads(line)["entry_hash"]
                count += 1
    entry = {
        "entry": count + 1,
        "checked_at": result.timestamp,
        "checkpoint": "CP20",
        "repo": result.repo,
        "outcome": result.outcome_id,
        "evidence_file": result.evidence_file,
        "evidence_sha256": result.evidence_hash,
        "commits": [
            {
                "branch": c.branch,
                "sha": c.sha,
                "author": c.author,
                "date": c.date,
                "pr": c.pr_number,
                "direct_push": c.direct_push,
                "exception": c.exception_id,
            }
            for c in result.commits
        ],
        "history_events": [{"type": e.type, "sha": e.sha, "actor": e.actor, "time": e.time} for e in result.history_events],
        "prev_entry_hash": previous,
    }
    entry["entry_hash"] = hashlib.sha256(json.dumps(entry, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    with path.open("a", encoding="utf-8") as log:
        log.write(json.dumps(entry, separators=(",", ":")) + "\n")
    return entry["entry"], entry["entry_hash"]


def verify_hash_log() -> tuple[bool, int, str]:
    """Re-computes the chain. Returns (intact, entries checked, message)."""
    path = _evidence_dir() / HASH_LOG_FILE
    if not path.exists():
        return True, 0, "No log yet."
    previous, count = _GENESIS, 0
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        entry = json.loads(line)
        stored = entry.pop("entry_hash")
        if entry.get("prev_entry_hash") != previous:
            return False, count, f"Line {number}: link to the previous entry is broken (a line was removed or reordered)."
        if hashlib.sha256(json.dumps(entry, sort_keys=True, separators=(",", ":")).encode()).hexdigest() != stored:
            return False, count, f"Line {number}: content doesn't match its hash (the line was edited)."
        previous, count = stored, count + 1
    return True, count, f"All {count} entries intact."


def _reply(cfg: Cp20ProjectConfig, result: Cp20Result) -> str:
    head = f"CP20 - Pull request mandatory ({result.repo}): {_LABEL[result.outcome_id]}"
    shown = [f for f in result.findings if f.level != "info"] or result.findings
    return head + "\n" + "\n".join(f"- {f.text}" for f in shown[:8])


def _summary_html(result: Cp20Result) -> str:
    tone = {"CP20-C": "#087a5b", "CP20-CE": "#087a5b", "CP20-OBS": "#b7791f", "CP20-NC": "#c9372c", "CP20-NE": "#6b778c"}
    rows = "".join(
        f"<tr><td>{html.escape(b.branch)}</td><td>{'yes' if b.pr_required else 'no'}</td>"
        f"<td>{'yes' if b.admins_enforced else 'no'}</td><td>{'yes' if b.force_push_blocked else 'no'}</td>"
        f"<td>{'yes' if b.deletion_blocked else 'no'}</td><td>{html.escape(b.source)}</td></tr>"
        for b in result.branches
    )
    commits = "".join(
        f"<tr><td><code>{c.sha[:7]}</code></td><td>{html.escape(c.author or '?')}</td><td>{html.escape(_day(c.date))}</td>"
        f"<td>{('PR #' + str(c.pr_number) + ' · ' + html.escape(c.pr_author or '?') + ' → ' + html.escape(c.merged_by or '?')) if c.pr_number else ('<b>direct push</b>' + (' · ' + c.exception_id if c.exception_id else ''))}</td></tr>"
        for c in result.commits[:25]
    )
    findings = "".join(f"<li class='{f.level}'>{html.escape(f.text)}</li>" for f in result.findings)
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
body {{ margin:0; padding:16px; background:#fff; font:13px -apple-system,"Segoe UI",Arial,sans-serif; color:#172b4d; }}
.card {{ width:860px; border:1px solid #dfe1e6; border-radius:10px; padding:18px 22px; }}
h1 {{ font-size:17px; margin:0 0 4px; }} .meta {{ color:#6b778c; font-size:11px; }}
.verdict {{ display:inline-block; margin:10px 0; padding:4px 10px; border-radius:4px; color:#fff; font-weight:600; background:{tone[result.outcome_id]}; }}
table {{ border-collapse:collapse; width:100%; margin:8px 0 12px; }} td,th {{ border-bottom:1px solid #ebecf0; padding:4px 6px; text-align:left; font-size:12px; }}
th {{ color:#6b778c; font-weight:500; }} li {{ margin:2px 0; }} li.nc {{ color:#c9372c; }} li.observation {{ color:#b7791f; }}
li.not_evidenced {{ color:#6b778c; }} li.exception {{ color:#087a5b; }} li.info {{ color:#6b778c; }}
</style></head><body><div class="card">
<h1>Pull request mandatory — {html.escape(result.repo)}</h1>
<div class="meta">Period from {html.escape(_day(result.period_start))}{(' to ' + html.escape(_day(result.period_end))) if result.period_end else ''} · rule start {html.escape(_day(result.rule_start_date) if result.rule_start_date else 'not evidenced')} ({html.escape(result.rule_start_source)}) · checked {html.escape(_day(result.timestamp))}</div>
<div class="verdict">{_LABEL[result.outcome_id]}</div>
<ul>{findings}</ul>
<table><tr><th>Branch</th><th>PR required</th><th>Admins enforced</th><th>Force push blocked</th><th>Deletion blocked</th><th>Source</th></tr>{rows}</table>
<table><tr><th>Commit</th><th>Author</th><th>Time</th><th>How it reached the branch</th></tr>{commits}</table>
<div class="meta">Evidence hash (SHA-256): {html.escape(result.evidence_hash or '')}</div>
</div></body></html>"""


async def verify_cp20(cfg: Cp20ProjectConfig) -> Cp20VerifyResponse:
    timestamp = now_iso()
    gates = Cp20Gates(protection="pending", commits="pending", history="pending", review="pending")
    base = f"/repos/{cfg.github_owner}/{cfg.github_repo}"
    findings: list[Cp20Finding] = []

    repo = await github_get(base)
    if repo["status"] >= 400:
        return Cp20VerifyResponse(config=cfg, result=None, gates=gates,
                                  reply=f"CP20 - Not evidenced: the repository can't be read (HTTP {repo['status']}).")
    repo_url = (repo["data"] or {}).get("html_url") or f"https://github.com/{cfg.github_owner}/{cfg.github_repo}"

    # FR-1: the client's list, plus anything GitHub itself reports as protected.
    listed = await github_get_all(f"{base}/branches", {"protected": "true"})
    branches = list(dict.fromkeys(cfg.protected_branches + [b["name"] for b in (listed["data"] or []) if listed["status"] == 200]))

    # FR-2
    rules: list[Cp20BranchRule] = []
    ruleset_starts: list[str] = []
    for branch in branches:
        rule, ruleset_start = await _read_branch_rule(base, branch)
        rules.append(rule)
        if ruleset_start:
            ruleset_starts.append(ruleset_start)
        if not rule.readable:
            findings.append(Cp20Finding(level="not_evidenced", text=f"{branch}: the protection rule can't be read — {rule.source}."))
            continue
        missing = [label for ok, label in (
            (rule.pr_required, "pull requests are not required"),
            (rule.admins_enforced, "admins can bypass the rule"),
            (rule.force_push_blocked, "force pushes are not blocked"),
            (rule.deletion_blocked, "branch deletion is not blocked"),
        ) if not ok]
        if not rule.protected:
            findings.append(Cp20Finding(level="nc", text=f"{branch}: no protection rule — anyone with write access can push straight to it."))
        elif missing:
            findings.append(Cp20Finding(level="nc", text=f"{branch}: rule not enforced — {', '.join(missing)}."))
    gates.protection = "failed" if any(f.level in ("nc", "not_evidenced") for f in findings) else "passed"

    # FR-3: rule start date.
    if cfg.rule_start_date:
        rule_start, rule_source = cfg.rule_start_date, "recorded in config"
    elif ruleset_starts:
        rule_start, rule_source = min(ruleset_starts), "ruleset creation time"
    else:
        rule_start, rule_source = None, "not evidenced"
        findings.append(Cp20Finding(
            level="not_evidenced",
            text="Rule start date not evidenced: the repository has no organisation audit log and no ruleset date — "
                 "counting every commit from the audit period start.",
        ))
    period = _parse(cfg.audit_period_start)
    # Date range from .env (PR_TICKET_DATE_FROM / _TO, IST days): narrows the
    # checked commits further. The FROM day moves the start forward; the TO day
    # replaces the configured audit_period_end.
    range_start, range_end = created_range()
    start = max(filter(None, [period, _parse(rule_start), range_start]))
    since = start.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    # Date range upper bound: anything after it is left out. created_range() gives
    # an exclusive end (midnight after the TO day), so step back 1 second.
    end = (range_end - timedelta(seconds=1)) if range_end else _parse(cfg.audit_period_end)
    until = end.astimezone(timezone.utc).isoformat().replace("+00:00", "Z") if end else None
    after_end = 0

    exceptions = load_pr_exceptions()
    used: dict[str, Cp20Exception] = {}
    commits: list[Cp20Commit] = []
    history: list[Cp20HistoryEvent] = []
    before_rule = 0
    pr_cache: dict[int, dict] = {}
    review_cache: dict[int, list[str]] = {}
    unreadable = False

    for branch in branches:
        # FR-4
        # GitHub's "until" limits the listing to the end of the range.
        params = {"sha": branch, "since": cfg.audit_period_start}
        if until:
            params["until"] = until
        listing = await github_get_all(f"{base}/commits", params)
        if listing["status"] == 404 or listing["status"] == 409:
            continue  # branch missing / empty repository
        if listing["status"] >= 400:
            unreadable = True
            findings.append(Cp20Finding(level="not_evidenced", text=f"{branch}: commits can't be read (HTTP {listing['status']})."))
            continue
        for item in listing["data"] or []:
            sha = item["sha"]
            when = ((item.get("commit") or {}).get("committer") or {}).get("date") or ((item.get("commit") or {}).get("author") or {}).get("date") or ""
            if _parse(when) and _parse(when) < start:
                before_rule += 1
                continue
            # Safety net in case GitHub returns a commit past the end date.
            if end and _parse(when) and _parse(when) > end:
                after_end += 1
                continue
            commit = Cp20Commit(
                branch=branch, sha=sha, date=when,
                author=(item.get("author") or {}).get("login") or ((item.get("commit") or {}).get("author") or {}).get("name"),
                message=((item.get("commit") or {}).get("message") or "").splitlines()[0][:120] if (item.get("commit") or {}).get("message") else "",
            )
            # FR-5
            pulls = await github_get(f"{base}/commits/{sha}/pulls")
            if pulls["status"] >= 400:
                unreadable = True
                findings.append(Cp20Finding(level="not_evidenced", text=f"{branch} {sha[:7]}: its pull request can't be looked up (HTTP {pulls['status']})."))
                commits.append(commit)
                continue
            merged = [p for p in pulls["data"] or [] if p.get("merged_at") and (p.get("base") or {}).get("ref") == branch]
            if merged:
                pr = merged[0]
                number = pr["number"]
                # FR-6: merged_by is only on the PR detail.
                if number not in pr_cache:
                    pr_cache[number] = (await github_get(f"{base}/pulls/{number}"))["data"] or {}
                    reviews = await github_get_all(f"{base}/pulls/{number}/reviews")
                    review_cache[number] = sorted({(r.get("user") or {}).get("login") for r in reviews["data"] or []
                                                   if r.get("state") == "APPROVED" and r.get("user")} - {None})
                detail = pr_cache[number]
                commit.pr_number = number
                commit.pr_url = pr.get("html_url")
                commit.pr_author = (pr.get("user") or {}).get("login")
                commit.merged_by = (detail.get("merged_by") or {}).get("login")
                commit.merged_at = pr.get("merged_at")
                commit.reviewers = review_cache[number]
                commit.self_merged = bool(commit.pr_author and commit.pr_author == commit.merged_by)
            else:
                commit.direct_push = True
                ex = _find_exception(exceptions, branch, sha, commit.author, when)
                if ex:
                    commit.exception_id = ex.id
                    used[ex.id] = ex
                    findings.append(Cp20Finding(level="exception", text=f"Direct push {sha[:7]} to {branch} by {commit.author} on {_day(when)} — covered by exception {ex.id}, approved by {ex.approver}, expires {ex.expires}."))
                else:
                    findings.append(Cp20Finding(level="nc", text=f"Direct push {sha[:7]} to {branch} by {commit.author or 'unknown'} on {_day(when)} — no pull request and no exception."))
            commits.append(commit)

        # FR-8: force pushes, deletions and direct pushes from the activity log.
        activity = await github_get_all(f"{base}/activity", {"ref": f"refs/heads/{branch}"})
        if activity["status"] >= 400:
            unreadable = True
            findings.append(Cp20Finding(level="not_evidenced", text=f"{branch}: force pushes and deletions can't be checked — activity log not readable (HTTP {activity['status']})."))
            continue
        on_branch = {c.sha for c in commits if c.branch == branch}
        for event in activity["data"] or []:
            when = event.get("timestamp") or ""
            if not _parse(when) or _parse(when) < start:
                continue
            # Force pushes / deletions after the end date are out of range.
            if end and _parse(when) > end:
                continue
            kind = event.get("activity_type")
            actor = (event.get("actor") or {}).get("login")
            after = event.get("after")
            if kind in ("force_push", "branch_deletion"):
                ex = _find_exception(exceptions, branch, after, actor, when)
                history.append(Cp20HistoryEvent(branch=branch, type=kind, actor=actor, time=when, sha=after, exception_id=ex.id if ex else None))
                what = "Force push" if kind == "force_push" else "Branch deletion"
                if ex:
                    used[ex.id] = ex
                    findings.append(Cp20Finding(level="exception", text=f"{what} on {branch} by {actor} on {_day(when)} — covered by exception {ex.id}."))
                else:
                    findings.append(Cp20Finding(level="nc", text=f"{what} on {branch} by {actor or 'unknown'} on {_day(when)} — history may have been rewritten."))
            elif kind == "push" and after and after not in on_branch:
                # A direct push whose commit is no longer on the branch (reverted or rewritten).
                ex = _find_exception(exceptions, branch, after, actor, when)
                history.append(Cp20HistoryEvent(branch=branch, type="push", actor=actor, time=when, sha=after, exception_id=ex.id if ex else None))
                if ex:
                    used[ex.id] = ex
                else:
                    findings.append(Cp20Finding(level="nc", text=f"Direct push {after[:7]} to {branch} by {actor or 'unknown'} on {_day(when)} — no longer on the branch (reverted or overwritten), no exception."))

    # FR-9
    for number in sorted({c.pr_number for c in commits if c.self_merged and c.pr_number}):
        c = next(x for x in commits if x.pr_number == number)
        others = [r for r in c.reviewers if r != c.pr_author]
        findings.append(Cp20Finding(level="observation", text=f"PR #{number} was merged by its own author ({c.pr_author})"
                                    + ("" if others else ", with no second reviewer") + " — review gap, see #21."))

    if before_rule:
        findings.append(Cp20Finding(level="info", text=f"{before_rule} commit(s) before the period / rule start are not counted."))
    if after_end:
        findings.append(Cp20Finding(level="info", text=f"{after_end} commit(s) after the period end {_day(until)} are not counted."))
    with_pr = sum(1 for c in commits if c.pr_number)
    direct = [c for c in commits if c.direct_push]
    span = f"from {_day(since)} to {_day(until)}" if until else f"since {_day(since)}"
    findings.append(Cp20Finding(level="info", text=f"{len(commits)} commit(s) checked {span}: {with_pr} through a merged PR, {len(direct)} direct push(es)."))

    gates.commits = "failed" if any(c.direct_push and not c.exception_id for c in commits) or unreadable else "passed"
    gates.history = "failed" if any(e.exception_id is None for e in history) else "passed"
    gates.review = "failed" if any(c.self_merged for c in commits) else "passed"

    # FR-10: worst result, with counts.
    worst = max((_RANK.get(f.level, 0) for f in findings), default=0)
    counts = {level: sum(1 for f in findings if f.level == level) for level in ("nc", "not_evidenced", "observation", "exception")}
    order = {"nc": 0, "not_evidenced": 1, "observation": 2, "exception": 3, "info": 4}
    findings.sort(key=lambda f: order[f.level])

    result = Cp20Result(
        project_id=cfg.project_id, repo=f"{cfg.github_owner}/{cfg.github_repo}", repo_url=repo_url,
        outcome_id=_OUTCOME[worst], findings=findings, counts=counts, branches=rules,
        rule_start_date=rule_start, rule_start_source=rule_source, period_start=since, period_end=until, commits=commits,
        commits_before_rule_start=before_rule, history_events=history, exceptions_used=list(used.values()),
        timestamp=timestamp,
    )

    # FR-11/12: evidence. The hash covers the data only (not the check time), so a
    # re-run over unchanged source data gives the same hash.
    data = result.model_dump(
        exclude={
            "timestamp",
            "evidence_file",
            "evidence_hash",
            "evidence_screenshot",
            "hash_log_file",
            "hash_log_entry",
            "hash_log_entry_hash",
        }
    )
    canonical = json.dumps(data, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical.encode()).hexdigest()
    result.evidence_hash = digest
    safe_repo = re.sub(r"[^A-Za-z0-9_-]", "_", cfg.github_repo)
    evidence_dir = _evidence_dir()
    evidence_dir.mkdir(parents=True, exist_ok=True)
    result.evidence_file = f"cp20-{safe_repo}-{digest[:12]}.json"
    (evidence_dir / result.evidence_file).write_text(
        json.dumps({**data, "checked_at": timestamp, "sha256": digest}, indent=2), encoding="utf-8"
    )
    shot = f"cp20-{safe_repo}-{digest[:12]}.png"
    if (evidence_dir / shot).exists():
        result.evidence_screenshot = shot
    else:
        try:
            result.evidence_screenshot = await _render_and_save(_summary_html(result), shot, selector=".card", width=920)
        except Exception as error:
            print(f"CP20 evidence image failed: {error}")

    result.hash_log_file = HASH_LOG_FILE
    result.hash_log_entry, result.hash_log_entry_hash = append_hash_log(result)

    return Cp20VerifyResponse(config=cfg, result=result, gates=gates, reply=_reply(cfg, result))
