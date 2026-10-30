"""Server-only primitives for CIBO temporary password setup.

No plaintext password persistence. Account state is tracked separately by the
calling service; this module does not change Supabase users or attendance.
"""

from datetime import datetime, timedelta, timezone
import secrets
import string

TEMPORARY_PASSWORD_TTL = timedelta(hours=12)
PERMANENT_PASSWORD_MIN_LENGTH = 8

# Easy to read and type; two familiar words, one @, and eight random digits.
# Passwords are generated with a cryptographic RNG, never stored in plaintext.
_TEMP_WORDS = (
    "Mango", "River", "Pizza", "Cloud", "Tiger", "Apple", "Ocean", "Happy",
    "Sunny", "Green", "Bread", "Lemon", "Cedar", "Peach", "Honey", "Maple",
    "Panda", "Coral", "Basil", "Tulip", "Robin", "Daisy", "Cocoa", "Melon",
    "Berry", "Olive", "Amber", "Pearl", "Curry", "Sugar", "Grape", "Flame",
    "Frost", "Stone", "Dream", "Music", "Smile", "Magic", "Water", "Light",
    "Fresh", "Bloom", "Brave", "Lucky", "Beach", "Earth", "Dance", "Spice",
    "Cherry", "Forest", "Garden", "Orange", "Silver", "Butter", "Carrot", "Banana",
    "Rocket", "Planet", "Rabbit", "Coffee", "Cookie", "Purple", "Yellow", "Winter",
)


def generate_temporary_password() -> str:
    """Generate a readable credential meeting uppercase/lowercase/digit/symbol rules."""
    first = secrets.choice(_TEMP_WORDS)
    second = secrets.choice(_TEMP_WORDS)
    digits = "".join(secrets.choice(string.digits) for _ in range(8))
    return f"{first}{second}@{digits}"


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
        PERMANENT_PASSWORD_MIN_LENGTH <= len(password) <= 64
        and any(c.isupper() for c in password)
        and any(c.islower() for c in password)
        and any(c.isdigit() for c in password)
        and any(c in string.punctuation for c in password)
    )
