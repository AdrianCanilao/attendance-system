-- Staged security migration. Apply only after testing against a disposable Supabase clone.
-- Prevent authenticated users with pending/expired temporary setup from using
-- direct PostgREST access, including with pre-existing browser sessions.
-- No existing records are modified.
begin;

create or replace function private.password_setup_complete()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and not exists (
      select 1
      from public.employee_password_setup s
      where s.user_id = auth.uid()
        and s.change_required is true
    );
$$;

revoke all on function private.password_setup_complete() from public;
grant execute on function private.password_setup_complete() to authenticated;

-- Restrictive policies AND together with existing permissive role/branch policies.
-- Keep service_role access unchanged; existing accounts without setup rows remain active.
create policy "Require completed setup for attendance access"
on public.attendance_logs as restrictive for all to authenticated
using ((select private.password_setup_complete()))
with check ((select private.password_setup_complete()));

create policy "Require completed setup for profile access"
on public.employee_profiles as restrictive for all to authenticated
using ((select private.password_setup_complete()))
with check ((select private.password_setup_complete()));

create policy "Require completed setup for corrections access"
on public.attendance_corrections as restrictive for all to authenticated
using ((select private.password_setup_complete()))
with check ((select private.password_setup_complete()));

create policy "Require completed setup for audit access"
on public.audit_logs as restrictive for all to authenticated
using ((select private.password_setup_complete()))
with check ((select private.password_setup_complete()));

commit;
