import unittest
from datetime import datetime, timedelta, timezone

from password_setup_status import (
    ACTIVE, EXPIRED, PENDING_SETUP, can_access_dashboard, get_password_setup_status,
)


class PasswordSetupStatusTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 10, 30, tzinfo=timezone.utc)

    def test_existing_accounts_remain_active(self):
        self.assertEqual(get_password_setup_status(False, None, self.now), ACTIVE)
        self.assertTrue(can_access_dashboard(ACTIVE))

    def test_pending_setup_blocks_dashboard(self):
        expiry = self.now + timedelta(hours=12)
        self.assertEqual(get_password_setup_status(True, expiry, self.now), PENDING_SETUP)
        self.assertFalse(can_access_dashboard(PENDING_SETUP))

    def test_expired_at_boundary(self):
        self.assertEqual(get_password_setup_status(True, self.now, self.now), EXPIRED)
        self.assertFalse(can_access_dashboard(EXPIRED))

    def test_missing_expiration_fails_closed(self):
        self.assertEqual(get_password_setup_status(True, None, self.now), EXPIRED)

    def test_naive_timestamp_rejected(self):
        with self.assertRaises(ValueError):
            get_password_setup_status(True, datetime(2026, 10, 31), self.now)


if __name__ == "__main__":
    unittest.main()
