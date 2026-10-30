import unittest
from datetime import datetime, timedelta, timezone

from temporary_passwords import (
    generate_temporary_password,
    temporary_password_expires_at,
    temporary_password_expired,
    validate_permanent_password,
)


class TemporaryPasswordTests(unittest.TestCase):
    def test_generation(self):
        values = [generate_temporary_password() for _ in range(100)]
        self.assertEqual(len(set(values)), 100)
        for password in values:
            self.assertEqual(len(password), 8)
            self.assertTrue(any(c.isupper() for c in password))
            self.assertTrue(any(c.islower() for c in password))
            self.assertTrue(any(c.isdigit() for c in password))
            self.assertTrue(any(not c.isalnum() for c in password))

    def test_twelve_hour_expiry(self):
        start = datetime(2026, 10, 30, tzinfo=timezone.utc)
        expiry = temporary_password_expires_at(start)
        self.assertEqual(expiry, start + timedelta(hours=12))
        self.assertFalse(temporary_password_expired(expiry, expiry - timedelta(microseconds=1)))
        self.assertTrue(temporary_password_expired(expiry, expiry))

    def test_permanent_password_policy(self):
        self.assertFalse(validate_permanent_password("Abcdef1!"))
        self.assertTrue(validate_permanent_password("LongPassword1!"))

    def test_reject_naive_datetimes(self):
        with self.assertRaises(ValueError):
            temporary_password_expires_at(datetime(2026, 10, 30))


if __name__ == "__main__":
    unittest.main()
