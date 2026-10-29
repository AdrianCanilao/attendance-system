import { useMemo, useState } from "react";

const colors = { Present: "#15803d", Absent: "#b91c1c", "On Leave": "#a16207", "Incomplete Attendance": "#64748b" };
const localDate = (value) => value ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)) : null;
const dateKey = (year, month, day) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const timeLabel = (value) => value ? new Date(value).toLocaleTimeString("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }) : "—";

export default function AttendanceCalendar({ attendance = [], leaves = [], employees = [], overview = false, onSelectDate }) {
  const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [selected, setSelected] = useState(null);
  const [errorNotice] = useState("");
  const year = month.getFullYear(), monthIndex = month.getMonth();
  const today = localDate(new Date());
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const offset = new Date(year, monthIndex, 1).getDay();
  const records = useMemo(() => {
    const byDate = new Map();
    const add = (date, record) => { if (!byDate.has(date)) byDate.set(date, []); byDate.get(date).push(record); };
    attendance.forEach((log) => {
      const date = log.log_date || localDate(log.time_in);
      if (date) add(date, { ...log, type: "attendance" });
    });
    leaves.filter((leave) => String(leave.status).toLowerCase() === "approved").forEach((leave) => {
      if (!leave.start_date || !leave.end_date) return;
      for (let day = 1; day <= days; day++) {
        const date = dateKey(year, monthIndex, day);
        if (date >= leave.start_date && date <= leave.end_date) add(date, { ...leave, type: "leave" });
      }
    });
    return byDate;
  }, [attendance, leaves, days, year, monthIndex]);
  const statusFor = (date, employeeId) => {
    const items = (records.get(date) || []).filter((item) => !employeeId || item.employee_id === employeeId);
    const logs = items.filter((item) => item.type === "attendance");
    if (logs.some((item) => item.status === "On Leave") || items.some((item) => item.type === "leave")) return "On Leave";
    // An attendance row with a missing punch is incomplete, not present.
    // Do not classify dates with no attendance row as incomplete or absent.
    if (logs.some((item) => /absent/i.test(item.status || ""))) return "Absent";
    if (logs.some((item) => !item.time_in || !item.time_out)) return "Incomplete Attendance";
    if (logs.some((item) => item.time_in && item.time_out)) return "Present";
    return null; // No record is not evidence of absence.
  };
  const current = selected && selected.startsWith(`${year}-${String(monthIndex + 1).padStart(2, "0")}`) ? selected : null;
  const selectedItems = current ? records.get(current) || [] : [];
  const counts = overview && current ? employees.reduce((acc, employee) => {
    const status = statusFor(current, employee.id) || "No record";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {}) : null;
  const changeMonth = (direction) => { setMonth(new Date(year, monthIndex + direction, 1)); setSelected(null); };
  return (
    <section aria-label="Attendance and leave calendar" style={{ padding: 12, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, color: "#1f2937" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <button type="button" aria-label="Previous month" onClick={() => changeMonth(-1)} style={navStyle}>‹</button>
        <strong>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong>
        <button type="button" aria-label="Next month" onClick={() => changeMonth(1)} style={navStyle}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 3 }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((name) => <span key={name} style={{ textAlign: "center", fontSize: 11, color: "#64748b" }}>{name}</span>)}
        {Array.from({ length: offset }, (_, i) => <span key={`empty-${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const date = dateKey(year, monthIndex, i + 1);
          const status = overview ? null : statusFor(date);
          const dailyStatuses = overview ? employees.map((emp) => statusFor(date, emp.id)).filter(Boolean) : [];
          const indicator = overview ? [...new Set(dailyStatuses)] : status ? [status] : [];
          return <button key={date} type="button" onClick={() => { setSelected(date); onSelectDate?.(date); }} aria-label={`${date}: ${status || (overview ? "view employees" : "no recorded status")}`} aria-pressed={current === date}
            style={{ border: current === date ? "2px solid #f97316" : date === today ? "1px solid #f97316" : "1px solid transparent", background: status ? colors[status] : "#f8fafc", color: status ? "#fff" : "#334155", borderRadius: 6, minHeight: 37, cursor: "pointer", fontWeight: date === today ? 700 : 400, padding: 2 }}>
            <span>{i + 1}</span>
            {overview && <span style={{ display: "flex", justifyContent: "center", gap: 2, marginTop: 3 }}>{indicator.map((s) => <span key={s} title={s} style={{ width: 5, height: 5, borderRadius: "50%", background: colors[s] }} />)}</span>}
          </button>;
        })}
      </div>
      <div aria-label="Calendar legend" style={{ display: "flex", flexWrap: "nowrap", justifyContent: "space-between", gap: 4, marginTop: 12, fontSize: "clamp(8px, 2.1vw, 11px)", whiteSpace: "nowrap", overflowX: "auto" }}>
        {Object.entries(colors).map(([label, color]) => <span key={label} title={label} aria-label={label} style={{ flexShrink: 0 }}><span style={{ display: "inline-block", width: 9, height: 9, background: color, borderRadius: 2, marginRight: 3 }} />{label === "Incomplete Attendance" ? "Incomplete" : label}</span>)}
        <span style={{ flexShrink: 0 }}><span style={{ display: "inline-block", width: 9, height: 9, background: "#f8fafc", border: "1px solid #cbd5e1", marginRight: 4 }} />No record</span>
      </div>
      {errorNotice && <p role="alert">{errorNotice}</p>}
      {current && <div style={{ borderTop: "1px solid #e5e7eb", marginTop: 12, paddingTop: 10, fontSize: 12 }}>
        <strong>{new Date(`${current}T12:00:00+08:00`).toLocaleDateString("en-US", { dateStyle: "full", timeZone: "Asia/Manila" })}</strong>
        {overview && <p style={{ margin: "8px 0" }}>Present: {counts.Present || 0} · Absent: {counts.Absent || 0} · On Leave: {counts["On Leave"] || 0} · Incomplete Attendance: {counts["Incomplete Attendance"] || 0} · No record: {counts["No record"] || 0}</p>}
        {overview ? <div style={{ maxHeight: 190, overflowY: "auto" }}>{employees.map((emp) => {
          const status = statusFor(current, emp.id) || "No record";
          const log = selectedItems.find((item) => item.type === "attendance" && item.employee_id === emp.id);
          const leave = selectedItems.find((item) => item.type === "leave" && item.employee_id === emp.id);
          return <div key={emp.id} style={{ padding: "5px 0", borderBottom: "1px solid #f1f5f9" }}><strong>{emp.full_name}</strong> — {status}{log && <> · In: {timeLabel(log.time_in)} · Out: {timeLabel(log.time_out)}</>}{leave && <> · {leave.leave_type}</>}</div>;
        })}</div> : <>
          <p style={{ margin: "8px 0" }}>Status: <strong>{statusFor(current) || "No recorded status"}</strong></p>
          {selectedItems.map((item, index) => <p key={item.id || index} style={{ margin: "5px 0" }}>{item.type === "leave" ? `Approved ${item.leave_type || "leave"} (${item.start_date} to ${item.end_date})` : `Time in: ${timeLabel(item.time_in)} · Time out: ${timeLabel(item.time_out)} · ${item.status || "Attendance recorded"}`}</p>)}
          {!selectedItems.length && <p>No attendance or approved leave recorded for this date. This does not automatically mean absent.</p>}
        </>}
      </div>}
    </section>
  );
}
const navStyle = { border: "1px solid #e5e7eb", borderRadius: 6, background: "#fff", color: "#334155", padding: "2px 10px", cursor: "pointer", fontSize: 20 };
