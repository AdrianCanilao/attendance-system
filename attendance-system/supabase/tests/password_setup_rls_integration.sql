-- Disposable PostgreSQL integration fixture. Never run on a live Supabase project.
\set ON_ERROR_STOP on
create schema auth;
create role authenticated nologin;
create role service_role nologin bypassrls;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create table public.employee_password_setup (
  user_id uuid primary key,
  change_required boolean not null default false
);
create table public.attendance_logs (id integer primary key, owner uuid);
create table public.employee_profiles (id integer primary key, owner uuid);
create table public.attendance_corrections (id integer primary key, owner uuid);
create table public.audit_logs (id integer primary key, owner uuid);
grant usage on schema public to authenticated;
grant usage on schema auth to authenticated;
grant select on public.employee_password_setup to authenticated;
grant select, insert, update, delete on public.attendance_logs, public.employee_profiles, public.attendance_corrections, public.audit_logs to authenticated;
alter table public.employee_password_setup enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.employee_profiles enable row level security;
alter table public.attendance_corrections enable row level security;
alter table public.audit_logs enable row level security;
create policy existing_attendance on public.attendance_logs for all to authenticated using (true) with check (true);
create policy existing_profiles on public.employee_profiles for all to authenticated using (true) with check (true);
create policy existing_corrections on public.attendance_corrections for all to authenticated using (true) with check (true);
create policy existing_audit on public.audit_logs for all to authenticated using (true) with check (true);
insert into public.employee_password_setup values
 ('00000000-0000-0000-0000-000000000001',true),
 ('00000000-0000-0000-0000-000000000002',false);
insert into public.attendance_logs values (1,null);
insert into public.employee_profiles values (1,null);
insert into public.attendance_corrections values (1,null);
insert into public.audit_logs values (1,null);
\ir ../migrations/20261030_password_setup_rls_guard.sql
-- Run assertions as the actual authenticated database role, not table owner.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$
declare t text; n int;
begin
  foreach t in array array['attendance_logs','employee_profiles','attendance_corrections','audit_logs'] loop
    execute format('select count(*) from public.%I',t) into n;
    if n <> 0 then raise exception 'Pending setup read allowed on %',t; end if;
  end loop;
end $$;
-- Existing sessions with an unchanged JWT subject must still be denied.
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$
declare t text; n int;
begin
  foreach t in array array['attendance_logs','employee_profiles','attendance_corrections','audit_logs'] loop
    execute format('select count(*) from public.%I',t) into n;
    if n <> 1 then raise exception 'Completed setup read denied on %',t; end if;
  end loop;
end $$;
-- Legacy users without a setup row remain permitted.
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $$
declare t text; n int;
begin
  foreach t in array array['attendance_logs','employee_profiles','attendance_corrections','audit_logs'] loop
    execute format('select count(*) from public.%I',t) into n;
    if n <> 1 then raise exception 'Legacy account read denied on %',t; end if;
  end loop;
end $$;
-- Unauthenticated requests must not pass the helper.
reset request.jwt.claim.sub;
do $$
begin
  if public.password_setup_complete() then raise exception 'Missing JWT accepted'; end if;
end $$;
reset role;
