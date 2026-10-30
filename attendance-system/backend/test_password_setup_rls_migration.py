"""Offline checks for the staged Supabase password-setup RLS migration.

These checks do not connect to Supabase or modify production data.
They are structural guards, NOT a substitute for a real database integration test.
"""
from pathlib import Path
import re
import unittest


SQL = (Path(__file__).resolve().parents[1] / "supabase" / "migrations" /
       "20261030_password_setup_rls_guard.sql").read_text(encoding="utf-8")


class PasswordSetupRlsMigrationTests(unittest.TestCase):
    def test_migration_is_transactional(self):
        self.assertRegex(SQL.lower(), r"(?m)^begin;")
        self.assertRegex(SQL.lower(), r"(?m)^commit;")

    def test_helper_is_security_definer_and_restricts_execute(self):
        self.assertIn("security definer", SQL.lower())
        self.assertIn("set search_path = ''", SQL.lower())
        self.assertIn("revoke all on function public.password_setup_complete() from public;", SQL.lower())
        self.assertIn("grant execute on function public.password_setup_complete() to authenticated;", SQL.lower())

    def test_helper_blocks_pending_setup_for_authenticated_user(self):
        normalized = re.sub(r"\s+", " ", SQL.lower())
        self.assertIn("auth.uid() is not null", normalized)
        self.assertIn("from public.employee_password_setup s", normalized)
        self.assertIn("s.user_id = (select auth.uid())", normalized)
        self.assertIn("s.change_required is true", normalized)

    def test_restrictive_policies_cover_read_and_write(self):
        for table in ("attendance_logs", "employee_profiles", "attendance_corrections", "audit_logs"):
            with self.subTest(table=table):
                self.assertRegex(SQL.lower(), rf"on public\.{table}\s+as restrictive for all to authenticated")
        self.assertEqual(SQL.lower().count("using ((select public.password_setup_complete()))"), 4)
        self.assertEqual(SQL.lower().count("with check ((select public.password_setup_complete()))"), 4)

    def test_no_destructive_statements(self):
        self.assertNotRegex(SQL.lower(), r"\b(drop table|truncate|delete from|update public\.)\b")


if __name__ == "__main__":
    unittest.main()
