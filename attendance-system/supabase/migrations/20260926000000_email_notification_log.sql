create table if not exists public.email_notification_log (
  id uuid primary key default gen_random_uuid(),
  notification_key text not null,
  recipient_email text not null,
  created_at timestamptz not null default now(),
  constraint email_notification_log_unique
    unique (notification_key, recipient_email)
);

alter table public.email_notification_log enable row level security;

comment on table public.email_notification_log is
  'Tracks email notification delivery attempts so scheduled notifications are not sent repeatedly.';

comment on column public.email_notification_log.notification_key is
  'Stable key identifying one logical email notification.';

comment on column public.email_notification_log.recipient_email is
  'Email address that received or claimed the notification.';

alter table public.email_notification_log
  add column if not exists status text not null default 'sending';

alter table public.email_notification_log
  add column if not exists sent_at timestamptz;

alter table public.email_notification_log
  add column if not exists resend_email_id text;
