"""Central attendance verification lock helper.

The database table/functions used by this module are intentionally kept
separate from the existing recognition and attendance logic.
"""

from datetime import datetime, timezone


LOCK_MINUTES = 5
MAX_FAILED_ATTEMPTS = 5


def lock_state_is_active(lock_row):
    if not lock_row:
        return False

    locked_until = lock_row.get("locked_until")

    if not locked_until:
        return False

    if isinstance(locked_until, str):
        value = locked_until.replace("Z", "+00:00")
        locked_until = datetime.fromisoformat(value)

    if locked_until.tzinfo is None:
        locked_until = locked_until.replace(tzinfo=timezone.utc)

    return locked_until > datetime.now(timezone.utc)
