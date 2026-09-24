from datetime import datetime, timezone


def now_iso() -> str:
    """Matches JS's `new Date().toISOString()` format exactly (millisecond
    precision, trailing "Z"), since the TS services this app mirrors used
    that format for every `timestamp` field."""
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"
