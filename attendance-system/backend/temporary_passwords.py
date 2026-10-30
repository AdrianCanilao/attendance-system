"""Server-only primitives for CIBO temporary password setup.

No plaintext password persistence. Account state is tracked separately by the
calling service; this module does not change Supabase users or attendance.
"""

from datetime import datetime, timedelta, timezone
import secrets
import string

TEMPORARY_PASSWORD_LENGTH = 8
TEMPORARY_PASSWORD_TTL = timedelta(hours=12)
PERMANENT_PASSWORD_MIN_LENGTH = 12

# Temporary credentials use letters only to make first-time entry easier.
# Exclude visually ambiguous letters (I, l, O, o) for readability.
_TEMP_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz"


def generate_temporary_password() -> str:
    """Generate an unpredictable, letters-only, eight-character credential."""
    return "".join(secrets.choice(_TEMP_LETTERS) for _ in range(TEMPORARY_PASSWORD_LENGTH))


def temporary_password_expires_at(now: datetime | None = None) -> datetime:
    current = now if now is not None else datetime.now(timezone.utc)
    if current.tzinfo is None or current.utcoffset() is None:
        raise ValueError("Expiration timestamps must be timezone-aware")
    return current.astimezone(timezone.utc) + TEMPORARY_PASSWORD_TTL


def temporary_password_expired(expires_at: datetime, now: datetime | None = None) -> bool:
    current = now if now is not None else datetime.now(timezone.utc)
    if any(value.tzinfo is None or value.utcoffset() is None for value in (expires_at, current)):
        raise ValueError("Expiration timestamps must be timezone-aware")
    return current >= expires_at


def validate_permanent_password(password: str) -> bool:
    return (
        len(password) >= PERMANENT_PASSWORD_MIN_LENGTH
        and any(c.isupper() for c in password)
        and any(c.islower() for c in password)
        and any(c.isdigit() for c in password)
        and any(c in string.punctuation for c in password)
    )
