-- Store the location associated with each attendance record.
-- Web attendance saves the employee device location.
-- Kiosk attendance saves the configured kiosk branch.
alter table if exists public.attendance_logs
  add column if not exists location text;
