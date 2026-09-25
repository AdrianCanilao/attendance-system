# CIBO Email Notifications — Resend Setup

The repository now contains the email notification code. The actual email service is intentionally configured outside the frontend so the Resend API key is never exposed to users or committed to GitHub.

## 1. Resend

Create a Resend account and verify the sending domain/address that will be used by CIBO.

Set these Supabase Edge Function secrets:

- `RESEND_API_KEY` = your Resend API key
- `RESEND_FROM_EMAIL` = for example `CIBO Attendance <attendance@your-verified-domain.com>`

Do not put the Resend API key in Vite environment variables or frontend source code.

## 2. Supabase migration

Run the migration file:

`supabase/migrations/20260926000000_email_notification_log.sql`

in the Supabase SQL Editor, or deploy it through the Supabase CLI.

The table prevents scheduled emails from being sent repeatedly.

## 3. Deploy the Edge Function

Deploy:

`supabase/functions/notification-email/index.ts`

The function name is:

`notification-email`

The function is configured with `verify_jwt = false` because it is called by Database Webhooks and Cron. It still requires the Supabase secret API key in the `apikey` header.

## 4. Create Database Webhooks

In Supabase Dashboard → Database → Webhooks, create these POST webhooks pointing to the `notification-email` Edge Function.

For each webhook, add:

- Header: `Content-Type: application/json`
- Auth header: Supabase secret/service key

### Employee registration

Table: `employee_profiles`

Event: INSERT

This sends the registered employee a confirmation/welcome message containing the email stored on their profile.

### Attendance

Table: `attendance_logs`

Events: INSERT and UPDATE

This sends:

- Time In email when Time In is first recorded
- Time Out email when Time Out is first recorded
- Late status and late minutes when applicable
- Attendance location when available
- Kiosk and web attendance are both covered because both write to `attendance_logs`

### Leave

Table: `leave_requests`

Events: INSERT and UPDATE

This sends:

- Leave request submitted
- Leave request approved
- Leave request rejected

## 5. Create Supabase Cron jobs

Supabase Cron should invoke the same `notification-email` Edge Function using the Supabase secret API key.

### Attendance reminder

Schedule:

`*/15 * * * *`

Request body:

```json
{
  "notification_type": "attendance-reminders"
}
```

The function checks the current time in Asia/Manila, compares it with each employee's scheduled Time In plus grace period, and emails employees who still have no Time In for the current date.

A unique daily key prevents repeated reminder emails.

### Maintenance Specialist notification

Schedule:

`5 0 * * *`

This is 8:05 AM in the Philippines (UTC+8).

Request body:

```json
{
  "notification_type": "maintenance-notifications"
}
```

The email mirrors the current Maintenance Specialist payroll notification logic:

- Payroll deadline is TODAY
- Payroll deadline is TOMORROW
- Payroll deadline is in X days
- Next payroll deadline is in X days

One email per Maintenance Specialist per day is recorded.

## 6. Email address verification

The registration pages now validate that the address has a normal email structure and accept personal, school, work, or other normal domains.

Format validation alone cannot prove that a mailbox is real.

For actual ownership verification, keep Supabase Auth's Confirm Email setting enabled. Supabase Auth then sends a confirmation email after signup and prevents an unverified email from signing in. The existing registration flow already uses `supabase.auth.signUp()`.

Resend is used for the CIBO attendance/system notifications; Supabase Auth handles account email confirmation.

## 7. Testing

After deployment/configuration:

1. Register a test employee using an email inbox you can access.
2. Confirm the account email if Confirm Email is enabled.
3. Take Time In from the web.
4. Check the inbox for the Time In email.
5. Take Time Out.
6. Check the inbox for the Time Out email.
7. Test kiosk Time In/Time Out.
8. Create a leave request and check the email.
9. Approve/reject the leave and check the email.
10. Temporarily test a profile with a past scheduled Time In and no attendance, then run the attendance-reminder Cron job.
11. Test the Maintenance Specialist notification email.

Do not commit `RESEND_API_KEY` or any Supabase secret key to the repository.
