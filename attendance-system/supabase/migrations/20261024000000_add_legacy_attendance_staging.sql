-- Stage legacy CIBO DTR rows separately from live attendance.
-- Rows remain pending until employee identities are verified and linked.
create table if not exists public.legacy_attendance_staging (
  id uuid primary key default gen_random_uuid(),
  source_file_name text not null,
  employee_no text not null,
  employee_name text,
  branch_code text not null,
  branch_id uuid references public.branches(id) on delete set null,
  log_date date not null,
  total_hours_worked numeric(5,2) not null default 0 check (total_hours_worked >= 0 and total_hours_worked <= 24),
  overtime_hours numeric(5,2) not null default 0 check (overtime_hours >= 0 and overtime_hours <= 24),
  attendance_code text not null,
  proposed_status text not null,
  linked_employee_id uuid references public.employee_profiles(id) on delete set null,
  review_status text not null default 'awaiting_profile'
    check (review_status in ('awaiting_profile','ready','needs_review','imported','skipped')),
  review_note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_file_name, employee_no, branch_code, log_date)
);

create index if not exists idx_legacy_attendance_staging_status
  on public.legacy_attendance_staging (review_status, log_date);
create index if not exists idx_legacy_attendance_staging_employee
  on public.legacy_attendance_staging (employee_no, branch_code);

alter table public.legacy_attendance_staging enable row level security;
