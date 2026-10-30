"""Pure account-setup status rules for temporary credentials.

This module has no database side effects and does not store passwords.
The API must enforce these rules before allowing protected operations.
"""
from datetime import datetime, timezone

ACTIVE = "active"
PENDING_SETUP = "pending_setup"
EXPIRED = "expired"


def get_password_setup_status(
    change_required: bool,
    expires_at: datetime | None,
    now: datetime | None = None,
) -> str:
    """Return an account's setup state using timezone-aware UTC timestamps.

    Existing accounts without a temporary-password requirement stay active.
    A required change without an expiry is denied (fail closed).
    """
    if not change_required:
        return ACTIVE
    if expires_at is None:
        return EXPIRED
    current = now if now is not None else datetime.now(timezone.utc)
    if current.tzinfo is None or current.utcoffset() is None:
        raise ValueError("Current timestamp must be timezone-aware")
    if expires_at.tzinfo is None or expires_at.utcoffset() is None:
        raise ValueError("Expiry timestamp must be timezone-aware")
    return EXPIRED if current >= expires_at else PENDING_SETUP


def can_access_dashboard(status: str) -> bool:
    """Only completed accounts may access protected dashboards."""
    return status == ACTIVE
