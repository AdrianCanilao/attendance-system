import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend";

type WebhookPayload = {
  type?: "INSERT" | "UPDATE" | "DELETE";
  table?: string;
  schema?: string;
  record?: Record<string, unknown> | null;
  old_record?: Record<string, unknown> | null;
  notification_type?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SECRET_KEYS = JSON.parse(
  Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"
);
const SUPABASE_SECRET_KEY =
  SECRET_KEYS.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL");

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error("Missing Supabase server configuration.");
}

if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
  throw new Error("Missing RESEND_API_KEY or RESEND_FROM_EMAIL.");
}

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SECRET_KEY
);

const resend = new Resend(RESEND_API_KEY);

const EMPLOYEE_ROLE_ID =
  "e4dbb928-7f0e-4da9-9eff-d7700d37b25a";

const MAINTENANCE_ROLE_ID =
  "b381a7a0-9595-4c69-abf1-5c15a827647a";

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatTime = (value: unknown) => {
  if (!value) return "-";

  const text = String(value);
  const [hours, minutes] = text.split(":");
  const hourNumber = Number(hours);

  if (Number.isNaN(hourNumber)) return text;

  const hour = hourNumber % 12 || 12;
  const suffix = hourNumber >= 12 ? "PM" : "AM";

  return `${hour}:${minutes || "00"} ${suffix}`;
};

const getManilaDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const getManilaTimeParts = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value || 0);

  return {
    hours: get("hour"),
    minutes: get("minute"),
    seconds: get("second"),
  };
};

const minutesFromTime = (value: unknown) => {
  if (!value) return null;

  const [hours, minutes] = String(value)
    .split(":")
    .map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
};

const claimNotification = async (key: string, email: string) => {
  const { error } = await supabaseAdmin
    .from("email_notification_log")
    .insert({
      notification_key: key,
      recipient_email: email.toLowerCase(),
    });

  if (!error) return true;

  // PostgreSQL unique-constraint violation means another invocation
  // already claimed this notification.
  if (error.code === "23505") return false;

  console.error("Could not claim email notification:", error);
  return false;
};

const sendEmail = async ({
  to,
  subject,
  html,
  idempotencyKey,
}: {
  to: string;
  subject: string;
  html: string;
  idempotencyKey: string;
}) => {
  const claimed = await claimNotification(
    idempotencyKey,
    to
  );

  if (!claimed) {
    return {
      sent: false,
      skipped: true,
    };
  }

  const { data, error } = await resend.emails.send(
    {
      from: RESEND_FROM_EMAIL,
      to: [to],
      subject,
      html,
    },
    {
      idempotencyKey,
    }
  );

  if (error) {
    console.error("Resend email failed:", error);
    return {
      sent: false,
      skipped: false,
      error,
    };
  }

  return {
    sent: true,
    skipped: false,
    data,
  };
};

const baseEmail = (title: string, body: string) => `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;color:#111827;">
    <div style="max-width:620px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border-radius:14px;padding:28px;border:1px solid #e5e7eb;">
        <div style="font-size:20px;font-weight:700;color:#f97316;margin-bottom:20px;">
          CIBO Attendance Monitoring System
        </div>
        <h2 style="margin:0 0 16px;color:#111827;">${escapeHtml(title)}</h2>
        <div style="font-size:15px;line-height:1.7;">${body}</div>
        <p style="margin-top:24px;font-size:12px;color:#6b7280;">
          This is an automated notification. Please do not reply to this email.
        </p>
      </div>
    </div>
  </body>
</html>
`;

const handleEmployeeProfile = async (
  record: Record<string, unknown>
) => {
  const email = String(record.email || "").trim();
  const fullName = String(record.full_name || "Employee").trim();

  if (!email) return;

  await sendEmail({
    to: email,
    subject: "CIBO account registered",
    idempotencyKey: `employee-registration#${String(record.id)}`,
    html: baseEmail(
      "Your CIBO account has been registered",
      `
        <p>Hello <strong>${escapeHtml(fullName)}</strong>,</p>
        <p>Your account has been registered in the CIBO Attendance Monitoring System.</p>
        <p>
          Registered email: <strong>${escapeHtml(email)}</strong><br>
          Position: <strong>${escapeHtml(record.position || "-")}</strong>
        </p>
        <p>
          You will receive attendance and system notifications at this email address.
        </p>
      `
    ),
  });
};

const handleAttendance = async (
  payload: WebhookPayload
) => {
  const record = payload.record;
  const oldRecord = payload.old_record;

  if (!record) return;

  const employeeId = String(record.employee_id || "");
  if (!employeeId) return;

  const timeIn = record.time_in;
  const oldTimeIn = oldRecord?.time_in;
  const timeOut = record.time_out;
  const oldTimeOut = oldRecord?.time_out;

  const isNewTimeIn =
    Boolean(timeIn) && !Boolean(oldTimeIn);

  const isNewTimeOut =
    Boolean(timeOut) && !Boolean(oldTimeOut);

  if (!isNewTimeIn && !isNewTimeOut) return;

  const { data: profile, error } = await supabaseAdmin
    .from("employee_profiles")
    .select("id, full_name, email")
    .eq("id", employeeId)
    .maybeSingle();

  if (error || !profile?.email) {
    console.error("Attendance email profile lookup failed:", error);
    return;
  }

  const attendanceDate = String(
    record.log_date || getManilaDate()
  );

  if (isNewTimeIn) {
    const status = String(record.status || "Present");
    const lateMinutes = Number(record.late_minutes || 0);

    await sendEmail({
      to: profile.email,
      subject: `Attendance Time In recorded - ${status}`,
      idempotencyKey: `attendance-time-in#${String(record.id)}#${String(timeIn)}`,
      html: baseEmail(
        "Attendance Time In recorded",
        `
          <p>Hello <strong>${escapeHtml(profile.full_name)}</strong>,</p>
          <p>Your Time In has been successfully recorded.</p>
          <p>
            Date: <strong>${escapeHtml(attendanceDate)}</strong><br>
            Time In: <strong>${escapeHtml(new Date(String(timeIn)).toLocaleTimeString("en-PH", {
              timeZone: "Asia/Manila",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            }))}</strong><br>
            Status: <strong>${escapeHtml(status)}</strong>
            ${lateMinutes > 0
              ? `<br>Late: <strong>${lateMinutes} minute(s)</strong>`
              : ""}
            ${record.location
              ? `<br>Location: <strong>${escapeHtml(record.location)}</strong>`
              : ""}
          </p>
        `
      ),
    });
  }

  if (isNewTimeOut) {
    const overtimeMinutes = Number(
      record.overtime_minutes || 0
    );

    await sendEmail({
      to: profile.email,
      subject: "Attendance Time Out recorded",
      idempotencyKey: `attendance-time-out#${String(record.id)}#${String(timeOut)}`,
      html: baseEmail(
        "Attendance Time Out recorded",
        `
          <p>Hello <strong>${escapeHtml(profile.full_name)}</strong>,</p>
          <p>Your Time Out has been successfully recorded.</p>
          <p>
            Date: <strong>${escapeHtml(attendanceDate)}</strong><br>
            Time Out: <strong>${escapeHtml(new Date(String(timeOut)).toLocaleTimeString("en-PH", {
              timeZone: "Asia/Manila",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            }))}</strong>
            ${overtimeMinutes > 0
              ? `<br>Overtime: <strong>${overtimeMinutes} minute(s)</strong>`
              : ""}
          </p>
        `
      ),
    });
  }
};

const handleLeaveRequest = async (
  payload: WebhookPayload
) => {
  const record = payload.record;
  const oldRecord = payload.old_record;

  if (!record) return;

  const employeeId = String(record.employee_id || "");
  if (!employeeId) return;

  const status = String(record.status || "Pending");
  const oldStatus = String(oldRecord?.status || "");

  const shouldNotify =
    payload.type === "INSERT" ||
    (payload.type === "UPDATE" && status !== oldStatus);

  if (!shouldNotify) return;

  const { data: profile, error } = await supabaseAdmin
    .from("employee_profiles")
    .select("id, full_name, email")
    .eq("id", employeeId)
    .maybeSingle();

  if (error || !profile?.email) return;

  const title =
    status === "Approved"
      ? "Leave request approved"
      : status === "Rejected"
      ? "Leave request rejected"
      : "Leave request submitted";

  const subject =
    status === "Approved"
      ? "CIBO leave request approved"
      : status === "Rejected"
      ? "CIBO leave request rejected"
      : "CIBO leave request submitted";

  await sendEmail({
    to: profile.email,
    subject,
    idempotencyKey: `leave-status#${String(record.id)}#${status}`,
    html: baseEmail(
      title,
      `
        <p>Hello <strong>${escapeHtml(profile.full_name)}</strong>,</p>
        <p>Your leave request has been <strong>${escapeHtml(status)}</strong>.</p>
        <p>
          Leave Type: <strong>${escapeHtml(record.leave_type || "-")}</strong><br>
          Start Date: <strong>${escapeHtml(record.start_date || "-")}</strong><br>
          End Date: <strong>${escapeHtml(record.end_date || "-")}</strong>
        </p>
      `
    ),
  });
};

const handleAttendanceReminders = async () => {
  const today = getManilaDate();
  const { hours, minutes } = getManilaTimeParts();
  const currentMinutes = hours * 60 + minutes;

  const { data: employees, error: employeeError } =
    await supabaseAdmin
      .from("employee_profiles")
      .select(
        "id, full_name, email, clock_in, grace_minutes, role_id"
      )
      .in("role_id", [
        EMPLOYEE_ROLE_ID,
        MAINTENANCE_ROLE_ID,
      ])
      .not("email", "is", null)
      .not("clock_in", "is", null);

  if (employeeError) {
    console.error(
      "Attendance reminder employee lookup failed:",
      employeeError
    );
    return;
  }

  const { data: attendanceRows, error: attendanceError } =
    await supabaseAdmin
      .from("attendance_logs")
      .select("employee_id, time_in, time_out")
      .eq("log_date", today);

  if (attendanceError) {
    console.error(
      "Attendance reminder log lookup failed:",
      attendanceError
    );
    return;
  }

  const attendanceByEmployee = new Map(
    (attendanceRows || []).map((row) => [
      row.employee_id,
      row,
    ])
  );

  for (const employee of employees || []) {
    const scheduledMinutes =
      minutesFromTime(employee.clock_in);

    if (scheduledMinutes === null) continue;

    const graceMinutes = Number(
      employee.grace_minutes ?? 10
    );

    if (
      currentMinutes <
      scheduledMinutes + graceMinutes
    ) {
      continue;
    }

    const attendance =
      attendanceByEmployee.get(employee.id);

    if (attendance?.time_in) continue;

    const email = String(employee.email || "").trim();
    if (!email) continue;

    await sendEmail({
      to: email,
      subject: "CIBO attendance reminder",
      idempotencyKey: `attendance-missing#${employee.id}#${today}`,
      html: baseEmail(
        "Attendance reminder",
        `
          <p>Hello <strong>${escapeHtml(employee.full_name)}</strong>,</p>
          <p>
            Our system has not detected your Time In for today's scheduled shift.
          </p>
          <p>
            Date: <strong>${escapeHtml(today)}</strong><br>
            Scheduled Time In: <strong>${escapeHtml(formatTime(employee.clock_in))}</strong>
          </p>
          <p>
            Please record your attendance as soon as possible.
          </p>
        `
      ),
    });
  }
};

const getPayrollNotification = (date: Date) => {
  const manilaParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(date);

  const get = (type: string) =>
    Number(
      manilaParts.find((part) => part.type === type)?.value || 0
    );

  const currentDay = get("day");
  const year = get("year");
  const month = get("month");

  const lastDayOfMonth = new Date(
    Date.UTC(year, month, 0)
  ).getUTCDate();

  const nextPayrollDay =
    currentDay <= 15
      ? 15
      : lastDayOfMonth;

  const daysRemaining =
    nextPayrollDay - currentDay;

  if (daysRemaining === 0) {
    return {
      message: "🔥 Payroll deadline is TODAY.",
      level: "critical",
    };
  }

  if (daysRemaining === 1) {
    return {
      message: "🚨 Payroll deadline is TOMORROW.",
      level: "urgent",
    };
  }

  if (daysRemaining <= 5) {
    return {
      message: `⚠ Payroll deadline is in ${daysRemaining} days.`,
      level: "warning",
    };
  }

  return {
    message: `Next payroll deadline is in ${daysRemaining} days.`,
    level: "normal",
  };
};

const handleMaintenanceNotifications = async () => {
  const today = getManilaDate();
  const payroll = getPayrollNotification(new Date());

  const { data: maintenanceUsers, error } =
    await supabaseAdmin
      .from("employee_profiles")
      .select("id, full_name, email")
      .eq("role_id", MAINTENANCE_ROLE_ID)
      .not("email", "is", null);

  if (error) {
    console.error(
      "Maintenance notification lookup failed:",
      error
    );
    return;
  }

  for (const user of maintenanceUsers || []) {
    const email = String(user.email || "").trim();
    if (!email) continue;

    await sendEmail({
      to: email,
      subject: "CIBO system notification",
      idempotencyKey: `maintenance-notification#${user.id}#${today}`,
      html: baseEmail(
        "Maintenance Specialist notification",
        `
          <p>Hello <strong>${escapeHtml(user.full_name)}</strong>,</p>
          <p>${escapeHtml(payroll.message)}</p>
          ${payroll.level !== "normal"
            ? "<p>Please review the relevant attendance and payroll information in the CIBO system.</p>"
            : ""}
        `
      ),
    });
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const payload = (await req.json()) as WebhookPayload;

    if (
      payload.notification_type ===
      "attendance-reminders"
    ) {
      await handleAttendanceReminders();

      return Response.json(
        { ok: true },
        { headers: corsHeaders }
      );
    }

    if (
      payload.notification_type ===
      "maintenance-notifications"
    ) {
      await handleMaintenanceNotifications();

      return Response.json(
        { ok: true },
        { headers: corsHeaders }
      );
    }

    if (
      payload.schema !== "public" ||
      !payload.table
    ) {
      return Response.json(
        { ok: true, ignored: true },
        { headers: corsHeaders }
      );
    }

    if (
      payload.table === "employee_profiles" &&
      payload.type === "INSERT" &&
      payload.record
    ) {
      await handleEmployeeProfile(payload.record);
    }

    if (
      payload.table === "attendance_logs" &&
      (payload.type === "INSERT" ||
        payload.type === "UPDATE")
    ) {
      await handleAttendance(payload);
    }

    if (
      payload.table === "leave_requests" &&
      (payload.type === "INSERT" ||
        payload.type === "UPDATE")
    ) {
      await handleLeaveRequest(payload);
    }

    return Response.json(
      { ok: true },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Notification email function failed:", error);

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
});
