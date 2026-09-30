import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { supabase } from "../supabaseClient";
import ManagerLayout from "../layouts/ManagerLayout";
import { logAudit } from "../utils/auditlogger";
import { getStorageAccessUrl } from "../utils/storageAccess";

export default function ManagerDashboard() {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [present, setPresent] = useState(0);
  const [absent, setAbsent] = useState(0);
  const [hoveredImage, setHoveredImage] = useState(null);
const [showCorrectionModal, setShowCorrectionModal] = useState(false);
const [selectedCorrection, setSelectedCorrection] = useState(null);
const [correctionTimeIn, setCorrectionTimeIn] = useState("");
const [correctionTimeOut, setCorrectionTimeOut] = useState("");
const [correctionSaving, setCorrectionSaving] = useState(false);
const [selectedDate, setSelectedDate] = useState(
  new Date()
);

  useEffect(() => {
  fetchDashboardData();
}, [selectedDate]);

  const calculateHoursWorked = (timeInISO, timeOutISO) => {
    if (!timeInISO || !timeOutISO) return "-";

    const start = new Date(timeInISO);
    const end = new Date(timeOutISO);

    const diff = (end - start) / 1000 / 60;

    if (diff <= 0) return "-";

    const hours = Math.floor(diff / 60);
    const minutes = Math.floor(diff % 60);

    return `${hours}h ${minutes}m`;
  };

  const formatManilaTimeInput = (iso) => {
    if (!iso) return "";
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(iso));

    const hour = parts.find((p) => p.type === "hour")?.value || "00";
    const minute = parts.find((p) => p.type === "minute")?.value || "00";
    return `${hour}:${minute}`;
  };

  const toManilaISO = (logDate, timeValue) => {
    if (!logDate || !timeValue) return null;
    return new Date(`${logDate}T${timeValue}:00+08:00`).toISOString();
  };

  const calculateLateMinutes = (timeInISO, shiftIn) => {
    if (!timeInISO || !shiftIn) return 0;

    const actual = new Date(timeInISO);
    const shift = new Date(`${actual.toISOString().slice(0, 10)}T${shiftIn}:00+00:00`);
    const allowance = 10 * 60 * 1000;

    if (actual <= shift.getTime() + allowance) return 0;
    return Math.floor((actual.getTime() - shift.getTime() - allowance) / 60000);
  };

  const calculateOvertimeMinutes = (timeOutISO, shiftOut) => {
    if (!timeOutISO || !shiftOut) return 0;

    const actual = new Date(timeOutISO);
    const shift = new Date(`${actual.toISOString().slice(0, 10)}T${shiftOut}:00+00:00`);

    if (actual <= shift) return 0;
    return Math.floor((actual.getTime() - shift.getTime()) / 60000);
  };

  const openCorrectionModal = (log) => {
    setSelectedCorrection(log);
    setCorrectionTimeIn(formatManilaTimeInput(log.time_in_raw));
    setCorrectionTimeOut(formatManilaTimeInput(log.time_out_raw));
    setShowCorrectionModal(true);
  };

  const closeCorrectionModal = () => {
    setShowCorrectionModal(false);
    setSelectedCorrection(null);
    setCorrectionTimeIn("");
    setCorrectionTimeOut("");
  };

  const saveAttendanceCorrection = async () => {
    if (!selectedCorrection) return;

    if (!correctionTimeIn && !correctionTimeOut) {
      alert("Please enter at least a Time In or Time Out.");
      return;
    }

    setCorrectionSaving(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUser = authData?.user;

      if (!currentUser) {
        alert("Your session has expired. Please log in again.");
        return;
      }

      const logDate = selectedCorrection.log_date;
      const updatedTimeIn = correctionTimeIn
        ? toManilaISO(logDate, correctionTimeIn)
        : null;
      const updatedTimeOut = correctionTimeOut
        ? toManilaISO(logDate, correctionTimeOut)
        : null;

      const lateMinutes = calculateLateMinutes(
        updatedTimeIn,
        selectedCorrection.clock_in
      );
      const overtimeMinutes = calculateOvertimeMinutes(
        updatedTimeOut,
        selectedCorrection.clock_out
      );

      const { error: attendanceError } = await supabase
        .from("attendance_logs")
        .update({
          time_in: updatedTimeIn,
          time_out: updatedTimeOut,
          late_minutes: lateMinutes,
          overtime_minutes: overtimeMinutes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedCorrection.id);

      if (attendanceError) {
        alert("Failed to update attendance.");
        return;
      }

      const { error: correctionError } = await supabase
        .from("attendance_corrections")
        .update({
          status: "Approved",
          approved_by: currentUser.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", selectedCorrection.correction.id);

      if (correctionError) {
        alert("Attendance was updated, but the correction request status could not be updated.");
        return;
      }

      await logAudit({
        user_id: currentUser.id,
        user_name: currentUser.email || "Maintenance Specialist",
        role: "maintenance",
        action: "ATTENDANCE_CORRECTION_APPROVED",
        description: `Updated attendance for ${selectedCorrection.name} on ${logDate}. Time In: ${correctionTimeIn || "-"}, Time Out: ${correctionTimeOut || "-"}.`,
      });

      alert("Attendance correction approved and updated.");
      closeCorrectionModal();
      await fetchDashboardData();
    } catch (error) {
      alert("Something went wrong while updating attendance.");
    } finally {
      setCorrectionSaving(false);
    }
  };

  const calculateLate = (timeInISO, shiftIn) => {
  if (!timeInISO || !shiftIn) return "-";

  const actual = new Date(timeInISO);

  const [hours, minutes] = shiftIn.split(":");

  const shift = new Date(timeInISO);

  // ✅ add 10 minute allowance
  shift.setHours(parseInt(hours));
  shift.setMinutes(parseInt(minutes) + 10);
  shift.setSeconds(0);

  // ✅ not late
  if (actual <= shift) return "0m";

  const diff = Math.floor((actual - shift) / 60000);

  const hrs = Math.floor(diff / 60);
  const mins = diff % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }

  return `${mins}m`;
};

 const calculateOvertime = (timeOutISO, shiftOut) => {
  if (!timeOutISO || !shiftOut) return "-";

  const actual = new Date(timeOutISO);

  const [hours, minutes] = shiftOut.split(":");

  const shift = new Date(timeOutISO);

  shift.setHours(parseInt(hours));
  shift.setMinutes(parseInt(minutes));
  shift.setSeconds(0);

  // ✅ no overtime
  if (actual <= shift) return "0m";

  const diff = Math.floor((actual - shift) / 60000);

  const hrs = Math.floor(diff / 60);
  const mins = diff % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }

  return `${mins}m`;
};

  const fetchDashboardData = async () => {
    const today = [
      selectedDate.getFullYear(),
      String(selectedDate.getMonth() + 1).padStart(2, "0"),
      String(selectedDate.getDate()).padStart(2, "0"),
    ].join("-");
    

    // GET CURRENT USER
const { data: userData } =
  await supabase.auth.getUser();

const user = userData?.user;

// GET CURRENT USER PROFILE
const { data: currentProfile } =
  await supabase
    .from("employee_profiles")
    .select("branch_id")
    .eq("id", user.id)
    .single();

// FETCH ONLY EMPLOYEES IN SAME BRANCH
const { data: employees } =
  await supabase
    .from("employee_profiles")
    .select(`
      id,
      full_name,
      position,
      clock_in,
      clock_out,
      branch_id
    `)
    .eq(
      "branch_id",
      currentProfile?.branch_id
    );
    const { data: attendance } = await supabase
  .from("attendance_logs")
  .select("*")
  .eq(
  "log_date",
  today
);

    const { data: leaves } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("status", "Approved");
      const {
  data: corrections,
  error: correctionError,
} = await supabase
  .from("attendance_corrections")
  .select("*");

if (correctionError) {
}

    const resolvedCorrections = await Promise.all(
      (corrections || []).map(async (correction) => ({
        ...correction,
        attachment_url: await getStorageAccessUrl(
          "faces",
          correction.attachment_url
        ),
      }))
    );

    let result = [];
    let presentCount = 0;
    let absentCount = 0;

    (employees || []).forEach((emp) => {
      const attendanceToday = attendance?.find(
        (a) =>
          a.employee_id === emp.id &&
          a.log_date === today
      );

      const leaveToday = leaves?.find(
        (l) =>
          l.employee_id === emp.id &&
          today >= l.start_date &&
          today <= l.end_date
      );

      let status = "Absent";

      if (attendanceToday?.time_in) {
        status = "Present";
        presentCount++;
      } else if (leaveToday) {
        status = "On Leave";
      } else {
        absentCount++;
      }

      result.push({
        id: attendanceToday?.id || null,
        log_date: attendanceToday?.log_date || today,
        name: emp.full_name,
        position: emp.position || "-",
        clock_in: attendanceToday?.scheduled_time_in || emp.clock_in || null,
        clock_out: attendanceToday?.scheduled_time_out || emp.clock_out || null,
        scheduled_time_in: attendanceToday?.scheduled_time_in || null,
        scheduled_time_out: attendanceToday?.scheduled_time_out || null,

        time_in_raw: attendanceToday?.time_in || null,
        time_out_raw: attendanceToday?.time_out || null,

        time_in: attendanceToday?.time_in
          ? new Date(attendanceToday.time_in).toLocaleTimeString(
              "en-US",
              {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
                timeZone: "Asia/Manila",
              }
            )
          : "-",

        time_out: attendanceToday?.time_out
          ? new Date(attendanceToday.time_out).toLocaleTimeString(
              "en-US",
              {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
                timeZone: "Asia/Manila",
              }
            )
          : "-",

        // Historical attendance must use the values saved on the log.
        // Never recalculate old records from the employee's current shift.
        late: attendanceToday
          ? attendanceToday.late_minutes > 0
            ? `${Math.floor(attendanceToday.late_minutes / 60)}h ${attendanceToday.late_minutes % 60}m`
            : "0m"
          : "-",

        overtime: attendanceToday
          ? attendanceToday.overtime_minutes > 0
            ? `${Math.floor(attendanceToday.overtime_minutes / 60)}h ${attendanceToday.overtime_minutes % 60}m`
            : "0m"
          : "-",

        time_in_face_url:attendanceToday?.time_in_face_url || null,

        time_out_face_url:attendanceToday?.time_out_face_url || null,

        time_in_location: attendanceToday?.time_in_location || null,

        time_out_location: attendanceToday?.time_out_location || null,

        status,

correction:
  resolvedCorrections.find(
    (c) =>
      c.attendance_log_id === attendanceToday?.id
  ) || null,
      });
    });

    const resolvedResult = await Promise.all(
      result.map(async (log) => ({
        ...log,
        time_in_face_url: await getStorageAccessUrl(
          "faces",
          log.time_in_face_url
        ),
        time_out_face_url: await getStorageAccessUrl(
          "faces",
          log.time_out_face_url
        ),
      }))
    );

    setLogs(resolvedResult);
    setFilteredLogs(resolvedResult);
    setTotal(employees?.length || 0);
    setPresent(presentCount);
    setAbsent(absentCount);
  };

  const handleSearch = (value) => {
    setSearch(value);

    const filtered = logs.filter((log) =>
      (log.name || "")
        .toLowerCase()
        .includes(value.toLowerCase())
    );

    setFilteredLogs(filtered);
  };

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .cibo-attendance-mobile-table-card {
            margin: 0 !important;
            padding: 14px 10px 18px !important;
            border-radius: 10px !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }

          .cibo-attendance-mobile-table-card .cibo-attendance-table-header {
            margin-bottom: 14px !important;
            padding-bottom: 10px !important;
          }

          .cibo-attendance-mobile-table-wrapper {
            width: 100% !important;
            max-width: 100% !important;
            overflow-x: auto !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch;
            box-sizing: border-box !important;
          }

          .cibo-attendance-mobile-table-wrapper table {
            width: 1120px !important;
            min-width: 1120px !important;
            table-layout: fixed !important;
          }

          .cibo-attendance-mobile-table-wrapper th,
          .cibo-attendance-mobile-table-wrapper td {
            box-sizing: border-box !important;
            padding: 12px 8px !important;
            font-size: 13px !important;
            line-height: 1.35 !important;
            white-space: normal !important;
            overflow-wrap: anywhere !important;
          }

          .cibo-attendance-mobile-table-wrapper th {
            font-size: 13px !important;
            white-space: nowrap !important;
          }

          .cibo-attendance-mobile-table-wrapper th:nth-child(1),
          .cibo-attendance-mobile-table-wrapper td:nth-child(1) {
            width: 130px !important;
          }

          .cibo-attendance-mobile-table-wrapper th:nth-child(2),
          .cibo-attendance-mobile-table-wrapper td:nth-child(2) {
            width: 140px !important;
          }

          .cibo-attendance-mobile-table-wrapper th:nth-child(3),
          .cibo-attendance-mobile-table-wrapper td:nth-child(3),
          .cibo-attendance-mobile-table-wrapper th:nth-child(4),
          .cibo-attendance-mobile-table-wrapper td:nth-child(4) {
            width: 190px !important;
          }

          .cibo-attendance-mobile-table-wrapper th:nth-child(5),
          .cibo-attendance-mobile-table-wrapper td:nth-child(5),
          .cibo-attendance-mobile-table-wrapper th:nth-child(6),
          .cibo-attendance-mobile-table-wrapper td:nth-child(6),
          .cibo-attendance-mobile-table-wrapper th:nth-child(7),
          .cibo-attendance-mobile-table-wrapper td:nth-child(7),
          .cibo-attendance-mobile-table-wrapper th:nth-child(8),
          .cibo-attendance-mobile-table-wrapper td:nth-child(8) {
            width: 110px !important;
          }

          .cibo-attendance-mobile-table-wrapper th:nth-child(9),
          .cibo-attendance-mobile-table-wrapper td:nth-child(9) {
            width: 140px !important;
          }

          .cibo-attendance-mobile-table-wrapper .timeContainer {
            gap: 8px !important;
            min-height: 56px !important;
          }

          .cibo-attendance-mobile-table-wrapper .locationText {
            max-width: 120px !important;
            font-size: 11px !important;
          }
        }
      `}</style>
    <ManagerLayout>
      <div style={styles.header}>
        <h2 style={styles.pageTitle}>Attendance Tracker</h2>
      </div>

      <div style={styles.cards}>
        <div style={styles.card}>
          <p style={styles.cardLabel}>Total Employees</p>
          <h2>{total}</h2>
        </div>

        <div style={styles.card}>
          <p style={styles.cardLabel}>Present</p>
          <h2 style={{ color: "#16a34a" }}>{present}</h2>
        </div>

        <div style={styles.card}>
          <p style={styles.cardLabel}>Absent</p>
          <h2 style={{ color: "#dc2626" }}>{absent}</h2>
        </div>
      </div>

      <div className="cibo-attendance-mobile-table-card" style={styles.tableCard}>
        <div className="cibo-attendance-table-header" style={styles.tableHeader}>
          <div>
            <h3 style={styles.tableTitle}>
              Daily Attendance Report
            </h3>

            <div
  className="cibo-attendance-date-controls"
  style={{
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginTop: "6px",
  }}
>
  <p style={styles.dateText}>
    {selectedDate.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })}
  </p>

  <DatePicker
  selected={selectedDate}
  onChange={(date) => setSelectedDate(date)}
  dateFormat="MMMM d, yyyy"
  popperPlacement="bottom-start"
  className="calendar-input"
/>
</div>
          </div>

          <div className="cibo-attendance-search" style={styles.searchWrapper}>
            <svg
              style={styles.searchIcon}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              fill="none"
            >
              <circle cx="11" cy="11" r="8" />
              <line
                x1="21"
                y1="21"
                x2="16.65"
                y2="16.65"
              />
            </svg>

            <input
              type="text"
              placeholder="Search employee..."
              value={search}
              onChange={(e) =>
                handleSearch(e.target.value)
              }
              style={styles.searchInput}
            />
          </div>
        </div>

        <div className="cibo-attendance-mobile-table-wrapper" style={styles.tableWrapperScrollable}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Employee</th>
                <th style={styles.th}>Position</th>
                <th style={styles.th}>Time In</th>
                <th style={styles.th}>Time Out</th>
                <th style={styles.th}>Late</th>
                <th style={styles.th}>Overtime</th>
                <th style={styles.th}>Hours Worked</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Correction</th>
              </tr>
            </thead>

            <tbody>
              {(filteredLogs || []).map((log, i) => (
                <tr key={i} style={styles.row}>
                  <td style={styles.td}>{log.name}</td>

                  <td style={styles.td}>
                    {log.position}
                  </td>

                  <td style={styles.td}>
                    <div style={styles.timeContainer}>
                      {log.time_in_face_url && (
                        <img
                          src={log.time_in_face_url}
                          alt="Time In"
                          onMouseEnter={() => setHoveredImage(`in-${i}`)}
                          onMouseLeave={() => setHoveredImage(null)}
                          style={{
                            ...styles.timeAvatar,
                            ...(hoveredImage === `in-${i}`
                              ? styles.timeAvatarHover
                              : {}),
                          }}
                        />
                      )}

                      <div style={styles.timeDetails}>
                        <span>{log.time_in}</span>
                        <span style={styles.locationText}>
                          {log.time_in_location || "-"}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td style={styles.td}>
                    <div style={styles.timeContainer}>
                      {log.time_out_face_url && (
                        <img
                          src={log.time_out_face_url}
                          alt="Time Out"
                          onMouseEnter={() => setHoveredImage(`out-${i}`)}
                          onMouseLeave={() => setHoveredImage(null)}
                          style={{
                            ...styles.timeAvatar,
                            ...(hoveredImage === `out-${i}`
                              ? styles.timeAvatarHover
                              : {}),
                          }}
                        />
                      )}

                      <div style={styles.timeDetails}>
                        <span>{log.time_out}</span>
                        <span style={styles.locationText}>
                          {log.time_out_location || "-"}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td style={styles.td}>
                    {log.late}
                  </td>

                  <td style={styles.td}>
                    {log.overtime}
                  </td>

                  <td style={styles.td}>
                    {calculateHoursWorked(
                      log.time_in_raw,
                      log.time_out_raw
                    )}
                  </td>

                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.badge,
                        background:
                          log.status === "Present"
                            ? "#dcfce7"
                            : log.status === "On Leave"
                            ? "#fef9c3"
                            : "#fee2e2",

                        color:
                          log.status === "Present"
                            ? "#166534"
                            : log.status === "On Leave"
                            ? "#92400e"
                            : "#991b1b",
                      }}
                    >
                      {log.status}
                    </span>
                  </td>
                    <td style={styles.td}>
                      {log.correction ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "13px",
                              color: "#374151",
                              maxWidth: "220px",
                              wordBreak: "break-word",
                            }}
                          >
                            {log.correction.concern}
                          </span>

                          <span
                            style={{
                              padding: "5px 9px",
                              borderRadius: "999px",
                              background:
                                log.correction.status === "Approved"
                                  ? "#dcfce7"
                                  : "#fef3c7",
                              color:
                                log.correction.status === "Approved"
                                  ? "#166534"
                                  : "#92400e",
                              fontSize: "11px",
                              fontWeight: "700",
                            }}
                          >
                            {log.correction.status || "Pending"}
                          </span>

                          {log.correction.attachment_url && (
                            <a
                              href={log.correction.attachment_url}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                background: "#f97316",
                                color: "#fff",
                                padding: "6px 10px",
                                borderRadius: "8px",
                                textDecoration: "none",
                                fontSize: "12px",
                                fontWeight: "600",
                                width: "fit-content",
                              }}
                            >
                              View Attachment
                            </a>
                          )}

                          {log.correction.status !== "Approved" && (
                            <button
                              type="button"
                              onClick={() => openCorrectionModal(log)}
                              style={{
                                background: "#f97316",
                                color: "#fff",
                                border: "none",
                                padding: "7px 12px",
                                borderRadius: "8px",
                                fontSize: "12px",
                                fontWeight: "700",
                                cursor: "pointer",
                              }}
                            >
                              Update Attendance
                            </button>
                          )}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCorrectionModal && selectedCorrection && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "min(460px, 100%)",
              background: "#fff",
              borderRadius: "16px",
              padding: "24px",
              boxSizing: "border-box",
              boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
            }}
          >
            <h2 style={{ margin: "0 0 8px", color: "#111827" }}>
              Update Attendance
            </h2>
            <p style={{ margin: "0 0 18px", color: "#6b7280", fontSize: "14px" }}>
              {selectedCorrection.name} — {selectedCorrection.log_date}
            </p>

            <label style={{ display: "block", fontWeight: "600", marginBottom: "6px" }}>
              Time In
            </label>
            <input
              type="time"
              value={correctionTimeIn}
              onChange={(e) => setCorrectionTimeIn(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                marginBottom: "14px",
                background: "#fff",
                color: "#111827",
              }}
            />

            <label style={{ display: "block", fontWeight: "600", marginBottom: "6px" }}>
              Time Out
            </label>
            <input
              type="time"
              value={correctionTimeOut}
              onChange={(e) => setCorrectionTimeOut(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                marginBottom: "18px",
                background: "#fff",
                color: "#111827",
              }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
              }}
            >
              <button
                type="button"
                onClick={closeCorrectionModal}
                disabled={correctionSaving}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  color: "#111827",
                  fontWeight: "600",
                  cursor: correctionSaving ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveAttendanceCorrection}
                disabled={correctionSaving}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#f97316",
                  color: "#fff",
                  fontWeight: "700",
                  cursor: correctionSaving ? "not-allowed" : "pointer",
                  opacity: correctionSaving ? 0.7 : 1,
                }}
              >
                {correctionSaving ? "Updating..." : "Approve & Update"}
              </button>
            </div>
          </div>
        </div>
      )}

    </ManagerLayout>
    </>
  );
}

const styles = {
  header: { marginBottom: "20px" },

  cards: {
    display: "flex",
    gap: "20px",
    marginBottom: "25px",
  },

  card: {
    flex: 1,
    background: "#fff",
    padding: "20px",
    borderRadius: "12px",
    border: "2px solid #e5e7eb",
  },

  cardLabel: {
    fontSize: "14px",
    color: "#374151",
  },

  tableCard: {
    background: "#fff",
    borderRadius: "12px",
    padding: "22px 22px 26px",
    border: "2px solid #e5e7eb",

    minHeight: "calc(100vh - 220px)",
    display: "flex",
    flexDirection: "column",
  },

  tableHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "18px",
    paddingBottom: "12px",
    borderBottom: "2px solid #e5e7eb",
  },

  dateText: {
    fontSize: "14px",
    color: "#374151",
  },

  searchWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },

  searchIcon: {
    position: "absolute",
    left: "10px",
    width: "16px",
    height: "16px",
    color: "#111827",
  },

  searchInput: {
    padding: "8px 12px 8px 32px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#111827",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
  },

  th: {
    textAlign: "center",
    verticalAlign: "middle",
    padding: "13px 10px",
    background: "#f9fafb",
    borderBottom: "1px solid #e5e7eb",
    fontWeight: "600",
    whiteSpace: "nowrap",
  },

  td: {
    textAlign: "center",
    verticalAlign: "middle",
    padding: "15px 10px",
    borderBottom: "1px solid #f1f5f9",
    color: "#111827",
  },

  row: {
    transition: "0.2s",
  },

  badge: {
    padding: "6px 12px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "600",
  },

  tableTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "600",
    color: "#111827",
  },


  avatarWrapper: {
    position: "relative",
    display: "inline-block",
  },

    timeContainer: {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  minHeight: "56px",
  },
  timeDetails: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
  },
  locationText: {
    fontSize: "12px",
    color: "#6b7280",
    lineHeight: "1.3",
    maxWidth: "150px",
    overflowWrap: "anywhere",
  },
  timeAvatar: {
    width: "42px",
    height: "42px",
    minWidth: "42px",
    minHeight: "42px",
    maxWidth: "42px",
    maxHeight: "42px",
    aspectRatio: "1 / 1",
    flex: "0 0 42px",
    flexShrink: 0,
    borderRadius: "50%",
    objectFit: "cover",
    border: "2px solid #e5e7eb",
    cursor: "pointer",
    transition: "0.25s ease",
  },

  timeAvatarHover: {
    transform: "scale(4)",
    borderRadius: "50%",
    zIndex: 9999,
    position: "relative",
    boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
  },

  tableWrapperScrollable: {
    width: "100%",
    flex: 1,
    overflowY: "auto",
  },
  pageTitle: {
    fontSize: "25px",
    fontWeight: "650",
    color: "#111827",
    margin: "0 20px 0",
    padding: 0,
    letterSpacing: "-0.3px",
    lineHeight: "1.2",
  },
};