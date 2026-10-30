-- Password setup state is independent of employee status and attendance.
-- No plaintext password or reset token is stored.
create table if not exists public.employee_password_setup (
  user_id uuid primary key references auth.users(id) on delete cascade,
  change_required boolean not null default false,
  temporary_password_expires_at timestamptz,
  issued_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint password_setup_pending_has_expiry check (
    not change_required or temporary_password_expires_at is not null
  ),
  constraint password_setup_expiry_after_issue check (
    issued_at is null or temporary_password_expires_at is null
    or temporary_password_expires_at > issued_at
  )
);
alter table public.employee_password_setup enable row level security;
revoke all on public.employee_password_setup from anon, authenticated;
comment on table public.employee_password_setup is
  'Server-managed temporary credential setup state. No password values. Missing rows mean legacy accounts remain active.';
