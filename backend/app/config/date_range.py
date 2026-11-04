# Creation-date range for the pull-request-mandatory views (CP20 and GitHub
# tracking). Set in backend/.env, both ends optional and inclusive, as IST days:
#   PR_TICKET_DATE_FROM=2026-10-25   → nothing created before 25 Oct is shown
#   PR_TICKET_DATE_TO=2026-10-26     → nothing created after 26 Oct is shown
# Applies to PRs (GitHub created_at), their Jira tickets (Jira "created") and
# CP20 commits (commit date). Open PRs and open tickets are kept — only the
# creation date decides. Leave both empty to show everything.
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.settings import settings

_IST = ZoneInfo("Asia/Kolkata")


def _day(value: str | None) -> datetime | None:
    """"2026-10-25" → midnight IST that day; a bad value counts as not set."""
    if not value or not value.strip():
        return None
    try:
        return datetime.combine(datetime.strptime(value.strip()[:10], "%Y-%m-%d").date(), time.min, _IST)
    except ValueError:
        return None


def created_range() -> tuple[datetime | None, datetime | None]:
    """(start, end) as aware datetimes. end is exclusive: midnight after the TO day,
    so a ticket created any time on the TO day is still inside."""
    start = _day(settings.pr_ticket_date_from)
    to_day = _day(settings.pr_ticket_date_to)
    return start, (to_day + timedelta(days=1) if to_day else None)


def _parse(value: str | None) -> datetime | None:
    # GitHub sends "...Z"; Jira sends "2026-10-27T11:02:33.123+0530".
    if not value:
        return None
    v = value.replace("Z", "+00:00")
    if len(v) > 5 and v[-5] in "+-" and v[-3] != ":":
        v = v[:-2] + ":" + v[-2:]
    try:
        parsed = datetime.fromisoformat(v)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=_IST)


def in_created_range(value: str | None) -> bool:
    """True when the creation time falls inside the range (or no range is set).
    An unknown date is kept, so nothing disappears just because a field is missing."""
    start, end = created_range()
    if not start and not end:
        return True
    when = _parse(value)
    if when is None:
        return True
    return (not start or when >= start) and (not end or when < end)
