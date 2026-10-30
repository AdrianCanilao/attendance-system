"""Offline, zero-cost security regression tests. No Supabase connection needed.

Run from attendance-system/: python -m unittest backend.test_password_setup_security
"""
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from fastapi import HTTPException

from . import password_setup_api as api
from .password_setup_status import ACTIVE, EXPIRED, PENDING_SETUP, get_password_setup_status


class PasswordSetupSecurityTests(unittest.TestCase):
    def test_legacy_accounts_remain_active(self):
        self.assertEqual(get_password_setup_status(False, None), ACTIVE)

    def test_pending_and_expired_boundaries(self):
        now = datetime(2026, 10, 30, tzinfo=timezone.utc)
        self.assertEqual(get_password_setup_status(True, now + timedelta(seconds=1), now), PENDING_SETUP)
        self.assertEqual(get_password_setup_status(True, now, now), EXPIRED)
        self.assertEqual(get_password_setup_status(True, None, now), EXPIRED)

    def test_pending_and_expired_sessions_cannot_use_privileged_actions(self):
        for status in (PENDING_SETUP, EXPIRED):
            with self.subTest(status=status), patch.object(api, "_status", return_value=(status, None)):
                with self.assertRaises(HTTPException) as raised:
                    api._require_active("test-user")
                self.assertEqual(raised.exception.status_code, 403)

    def test_active_sessions_can_use_privileged_actions(self):
        with patch.object(api, "_status", return_value=(ACTIVE, None)):
            self.assertIsNone(api._require_active("test-user"))

    def test_status_lookup_failure_denies_access(self):
        with patch.object(api, "_status", side_effect=RuntimeError("offline")):
            with self.assertRaises(HTTPException) as raised:
                api._require_active("test-user")
            self.assertEqual(raised.exception.status_code, 503)

    def test_issue_denies_pending_supervisor_before_touching_accounts(self):
        with patch.object(api, "_user") as user, patch.object(api, "_status", return_value=(PENDING_SETUP, None)), patch.object(api, "_profile") as profile:
            user.return_value.id = "supervisor"
            with self.assertRaises(HTTPException) as raised:
                api.issue_temporary_password(api.ResetTemporaryPasswordRequest(target_user_id="target"), "Bearer dummy")
            self.assertEqual(raised.exception.status_code, 403)
            profile.assert_not_called()

    def test_completion_rejects_expired_password_before_auth_update(self):
        with patch.object(api, "_user") as user, patch.object(api, "_status", return_value=(EXPIRED, None)), patch.object(api, "_client") as client:
            user.return_value.id = "test-user"
            with self.assertRaises(HTTPException) as raised:
                api.complete_password_setup(api.CompletePasswordSetupRequest(password="ValidPassword123!"), "Bearer dummy")
            self.assertEqual(raised.exception.status_code, 403)
            client.return_value.auth.admin.update_user_by_id.assert_not_called()


if __name__ == "__main__":
    unittest.main()
