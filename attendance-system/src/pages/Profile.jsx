import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import ManagerLayout from "../layouts/ManagerLayout";
import EmployeeLayout from "../layouts/EmployeeLayout";
import { FaUser } from "react-icons/fa";
import { useLocation } from "react-router-dom";
import { logAudit } from "../utils/auditlogger";
import { getStorageAccessUrl } from "../utils/storageAccess";
import MobileAttendanceCards from "../components/MobileAttendanceCards";
import AttendanceCalendar from "../components/AttendanceCalendar";
import AttendanceLocationDisplay from "../components/AttendanceLocationDisplay";

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [stats, setStats] = useState({
    timeIn: 0,
    timeOut: 0,
  });
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [attendanceMonth, setAttendanceMonth] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit" }).slice(0, 7));
  const monthlyAttendanceLogs = attendanceLogs.filter((log) => String(log.log_date || "").slice(0, 7) === attendanceMonth);
  const [calendarLeaves, setCalendarLeaves] = useState([]);
  const [branchLeaveEmployees, setBranchLeaveEmployees] = useState([]);
  const [branchLeaveRequests, setBranchLeaveRequests] = useState([]);
  const [branchLeaveDate, setBranchLeaveDate] = useState(null);
  const [branchLeaveLoading, setBranchLeaveLoading] = useState(false);
  const [branchLeaveError, setBranchLeaveError] = useState("");

  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionFile, setCorrectionFile] = useState(null);
  const [today] = useState(new Date());

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;

    if (!user) return;

    // ✅ GET USER ROLE
    setRole(localStorage.getItem("role"));

    // ✅ GET EMPLOYEE PROFILE
    const { data: emp, error } = await supabase
      .from("employee_profiles")
      .select("*, branches:branch_id(branch_name)")
      .eq("email", user.email)
      .single();


    if (error || !emp) return;

    // ✅ SAVE PROFILE
    let profileFaceUrl = null;

    if (emp?.face_url && emp.face_url !== "" && emp.face_url !== null) {
      profileFaceUrl = await getStorageAccessUrl("faces", emp.face_url);
    }

    setProfile({
      ...emp,
      avatar:
        profileFaceUrl ||
        emp?.photo_url ||
        emp?.image ||
        emp?.avatar ||
        "",
    });

    // ✅ SET IMAGE URL
    if (profileFaceUrl) {
      setImageUrl(profileFaceUrl);
    } else if (
      emp?.photo_url &&
      emp.photo_url !== "" &&
      emp.photo_url !== null
    ) {
      setImageUrl(emp.photo_url);
    } else if (
      emp?.image &&
      emp.image !== "" &&
      emp.image !== null
    ) {
      setImageUrl(emp.image);
    } else if (
      emp?.avatar &&
      emp.avatar !== "" &&
      emp.avatar !== null
    ) {
      setImageUrl(emp.avatar);
    } else {
      // fallback image
      setImageUrl(
        "https://cdn-icons-png.flaticon.com/512/149/149071.png"
      );
    }

    // ✅ FETCH ATTENDANCE STATS
    const safeName = emp.full_name
      ?.toLowerCase()
      .replace(/\s+/g, "_");

    fetchAttendanceStats(safeName);
    const { data: logs } = await supabase
  .from("attendance_logs")
  .select("*")
  .eq("employee_id", emp.id)
  .order("created_at", { ascending: false });

const { data: corrections, error: correctionsError } = await supabase
  .from("attendance_corrections")
  .select("id, attendance_log_id, status, concern, created_at, approved_at")
  .eq("employee_id", emp.id)
  .order("created_at", { ascending: false });

if (correctionsError) {
  
}

const latestCorrectionByLog = new Map();
(corrections || []).forEach((correction) => {
  if (!latestCorrectionByLog.has(correction.attendance_log_id)) {
    latestCorrectionByLog.set(correction.attendance_log_id, correction);
  }
});

const resolvedLogs = await Promise.all(
  (logs || []).map(async (log) => ({
    ...log,
    correction: latestCorrectionByLog.get(log.id) || null,
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

setAttendanceLogs(resolvedLogs);
    const { data: approvedLeaves } = await supabase.from("leave_requests").select("id, employee_id, leave_type, start_date, end_date, status").eq("employee_id", emp.id).eq("status", "Approved");
    setCalendarLeaves(approvedLeaves || []);
    // Branch Supervisor access: only current active employees in the supervisor's branch.
    // This is read-only and follows the branch filtering used in ManagerLeave.
    if (window.location.pathname.startsWith("/manager") || window.location.pathname.startsWith("/maintenance")) {
      setBranchLeaveLoading(true);
      setBranchLeaveError("");
      if (!emp.branch_id) {
        setBranchLeaveError("Your profile has no assigned branch.");
      } else {
        const { data: branchEmployees, error: employeesError } = await supabase
          .from("employee_profiles")
          .select("id, full_name")
          .eq("branch_id", emp.branch_id)
          .eq("is_active", true);
        if (employeesError) {
          setBranchLeaveError("Unable to load branch employees.");
        } else {
          const ids = (branchEmployees || []).map((employee) => employee.id);
          setBranchLeaveEmployees(branchEmployees || []);
          if (ids.length) {
            const { data: branchLeaves, error: leavesError } = await supabase
              .from("leave_requests")
              .select("id, employee_id, leave_type, start_date, end_date, status")
              .in("employee_id", ids)
              .eq("status", "Approved");
            if (leavesError) setBranchLeaveError("Unable to load approved branch leaves.");
            else setBranchLeaveRequests(branchLeaves || []);
          } else setBranchLeaveRequests([]);
        }
      }
      setBranchLeaveLoading(false);
    }

  };

  const fetchAttendanceStats = async (safeName) => {
    const { data: timeInFiles } = await supabase.storage
      .from("faces")
      .list(`attendance/${safeName}/time_in`);

    const { data: timeOutFiles } = await supabase.storage
      .from("faces")
      .list(`attendance/${safeName}/time_out`);

    setStats({
      timeIn: timeInFiles?.length || 0,
      timeOut: timeOutFiles?.length || 0,
    });
  };
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

const calculateLate = (timeInISO, shiftIn) => {
  if (!timeInISO || !shiftIn) return "-";

  const actual = new Date(timeInISO);

  const [hours, minutes] = shiftIn.split(":");

  const shift = new Date(timeInISO);

  // ✅ 10 minute grace period
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

  const location = useLocation();

  const Layout =
  location.pathname.startsWith("/manager") ||
  location.pathname.startsWith("/maintenance")
    ? ManagerLayout
    : EmployeeLayout;

  return (
    <Layout>
      <div className="cibo-page-root cibo-profile-page" style={styles.container}>
        <h1 className="cibo-page-title" style={styles.pageTitle}>Profile</h1>

        <div className="cibo-profile-grid" style={styles.grid}>
          {/* PROFILE CARD */}
          <div className="cibo-profile-card" style={styles.card}>
            <div className="cibo-profile-content" style={styles.newProfileContent}>
              <div className="cibo-profile-avatar-wrapper" style={styles.newAvatarWrapper}>
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="avatar"
                    style={styles.newAvatar}
                  />
                ) : (
                  <div style={styles.avatarFallback}>
                    <FaUser size={60} />
                  </div>
                )}
              </div>

              <div className="cibo-profile-info" style={styles.newProfileInfoContainer}>
                <div className="cibo-profile-header-row" style={styles.headerRow}>
                  <h1 style={styles.profileName}>
                    {profile?.full_name || "Employee Name"}
                  </h1>
                </div>

                <div style={styles.infoBody}>
                  <div className="cibo-profile-role-position" style={styles.infoTwoColumnRow}>
                    <div style={styles.infoItem}>
                      <span style={styles.label}>Role: </span>

                      <span style={styles.value}>
                        {role || "Staff"}
                      </span>
                    </div>

                    <div style={styles.infoItem}>
                      <span style={styles.label}>
                        Position:
                      </span>

                      <span style={styles.value}>
                        {profile?.position ||
                          "Position TBD"}
                      </span>
                    </div>
                  </div>

                  <div style={styles.infoItem}>
                    <span style={styles.label}>
                      E-mail:
                    </span>

                    <span style={styles.value}>
                      {profile?.email ||
                        "email@example.com"}
                    </span>
                  </div>

                  <div style={styles.infoItem}>
                    <span style={styles.label}>
                      Phone:
                    </span>

                    <span style={styles.value}>
                      {profile?.contact_number ||
                        "N/A"}
                    </span>
                  </div>

                  <div style={styles.infoItem}>
                    <span style={styles.label}>
                      Branch:
                    </span>

                    <span style={styles.value}>
                      {profile?.branches?.branch_name ||
                        "Not assigned"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="cibo-profile-calendar">
            <AttendanceCalendar attendance={attendanceLogs} leaves={calendarLeaves}
              showDetails={false}
              onSelectDate={(date) => { if (location.pathname.startsWith("/manager") || location.pathname.startsWith("/maintenance")) setBranchLeaveDate(date); }} />
          </div>
          {branchLeaveDate && (location.pathname.startsWith("/manager") || location.pathname.startsWith("/maintenance")) && (
            <div onClick={() => setBranchLeaveDate(null)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, boxSizing: "border-box" }}>
              <section role="dialog" aria-modal="true" aria-label="Branch employees on leave" onClick={(event) => event.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 16, width: "100%", maxWidth: 440, maxHeight: "80vh", minWidth: 0, boxSizing: "border-box", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <button type="button" onClick={() => setBranchLeaveDate(null)} aria-label="Close leave details" style={{ alignSelf: "flex-end", border: 0, background: "#f1f5f9", borderRadius: 6, padding: "5px 10px", cursor: "pointer" }}>Close</button><h3 style={{ fontSize: 15, margin: "0 0 8px" }}>Employees on Leave — Your Branch</h3>
                {!branchLeaveDate ? <p style={{ fontSize: 13 }}>Select a calendar date to view approved leaves for your branch.</p> :
                  <>
                    <p style={{ fontSize: 13, margin: "0 0 8px" }}>Selected date: {branchLeaveDate}</p>
                    {branchLeaveLoading ? <p>Loading branch leaves…</p> :
                      branchLeaveError ? <p role="alert">{branchLeaveError}</p> :
                        (() => {
                          const names = new Map(branchLeaveEmployees.map((employee) => [employee.id, employee.full_name]));
                          const matching = branchLeaveRequests.filter((leave) => leave.start_date <= branchLeaveDate && leave.end_date >= branchLeaveDate && names.has(leave.employee_id));
                          return matching.length ? (
                            <ul aria-label="Employees on approved leave" tabIndex={0} style={{ padding: "4px 8px 4px 20px", margin: 0, fontSize: 13, maxHeight: "50vh", overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}>
                              {matching.map((leave) => <li key={leave.id} style={{ marginBottom: 8 }}>
                                <strong>{names.get(leave.employee_id)}</strong> — {leave.leave_type || "Approved Leave"}
                                <div style={{ color: "#64748b" }}>{leave.start_date} to {leave.end_date} · Approved</div>
                              </li>)}
                            </ul>
                          ) : <p style={{ fontSize: 13, margin: 0 }}>No approved employee leaves for this date in your branch.</p>;
                        })()}
                  </>
                }
              </section>

            </div>
          )}
        </div>

        <div className="cibo-profile-attendance" style={{
    ...styles.statCard,
    minHeight: "calc(100vh - 420px)",
    display: "flex",
    flexDirection: "column",
  }}
>
          <h2
            style={{
              fontSize: "20px",
              fontWeight: "700",
              marginBottom: "16px",
              color: "#111827",
            }}
          >
            Attendance Summary
          </h2>

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap", fontSize: 14 }}>
            View month
            <input type="month" value={attendanceMonth} onChange={(event) => setAttendanceMonth(event.target.value)} aria-label="Attendance summary month" style={{ padding: "7px 10px", border: "1px solid #cbd5e1", borderRadius: 6, maxWidth: "100%" }} />
          </label>
          <div style={{ maxHeight: 620, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
          <MobileAttendanceCards logs={monthlyAttendanceLogs} onCorrect={(log) => {
            if (log.correction?.status === "Pending") return;
            setSelectedLog(log);
            setCorrectionReason("");
            setCorrectionFile(null);
            setShowCorrectionModal(true);
          }} />
          <div className="cibo-desktop-attendance-table" style={{ overflowX: "auto" }}>
  <table
    style={{
      width: "100%",
      borderCollapse: "collapse",
      tableLayout: "fixed",
    }}
  >
    <thead>
      <tr
        style={{
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        {[
          "Date",
  "Time In",
  "Time Out",
  "Late",
  "Overtime",
  "Hours Worked",
  "Status",
  "Correction",
        ].map((header) => (
          <th
            key={header}
            style={{
              padding: "14px",
              textAlign: "center",
              fontWeight: "700",
              fontSize: "16px",
              color: "#111827",
            }}
          >
            {header}
          </th>
        ))}
      </tr>
    </thead>

    <tbody>
      {monthlyAttendanceLogs.map((log, index) => (
        <tr
          key={index}
          style={{
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          {/* DATE */}
<td
  style={{
    padding: "16px",
    textAlign: "center",
    verticalAlign: "middle",
  }}
>
  {log.log_date
    ? new Date(`${log.log_date}T12:00:00+08:00`).toLocaleDateString(
        "en-US",
        {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "Asia/Manila",
        }
      )
    : log.time_in
      ? new Date(log.time_in).toLocaleDateString("en-US", {
          month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila",
        })
      : "-"}
</td>
          {/* TIME IN */}
          <td
            style={{
              padding: "16px",
              textAlign: "center",
              verticalAlign: "middle",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
              }}
            >
              {log.time_in_face_url && (
                <img
                  src={log.time_in_face_url}
                  alt="Time In"
                  style={{
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
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform =
                      "scale(2.8)";
                    e.currentTarget.style.zIndex = "999";
                    e.currentTarget.style.position =
                      "relative";
                    e.currentTarget.style.boxShadow =
                      "0 8px 20px rgba(0,0,0,0.25)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform =
                      "scale(1)";
                    e.currentTarget.style.zIndex = "1";
                    e.currentTarget.style.boxShadow =
                      "none";
                  }}
                />
              )}

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span>
                    {log.time_in
                      ? new Date(
                          log.time_in
                        ).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                          timeZone: "Asia/Manila",
                        })
                      : "-"}
                  </span>
                </div>
                <AttendanceLocationDisplay location={log.time_in_location} />
              </div>
            </div>
          </td>

          {/* TIME OUT */}
          <td
            style={{
              padding: "16px",
              textAlign: "center",
              verticalAlign: "middle",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
              }}
            >
              {log.time_out_face_url && (
                <img
                  src={log.time_out_face_url}
                  alt="Time Out"
                  style={{
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
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform =
                      "scale(2.8)";
                    e.currentTarget.style.zIndex = "999";
                    e.currentTarget.style.position =
                      "relative";
                    e.currentTarget.style.boxShadow =
                      "0 8px 20px rgba(0,0,0,0.25)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform =
                      "scale(1)";
                    e.currentTarget.style.zIndex = "1";
                    e.currentTarget.style.boxShadow =
                      "none";
                  }}
                />
              )}

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                  <span>
                    {log.time_out
                      ? new Date(
                          log.time_out
                        ).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                          timeZone: "Asia/Manila",
                        })
                      : "-"}
                  </span>
                  {log.time_out && log.log_date && new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(log.time_out)) !== log.log_date && (
                    <span style={{ fontSize: "12px", color: "#6b7280", lineHeight: "1.3" }}>
                      {new Date(log.time_out).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila",
                      })}
                    </span>
                  )}
                </div>
                <AttendanceLocationDisplay location={log.time_out_location} />
              </div>
            </div>
          </td>

          {/* LATE */}
          <td
            style={{
              padding: "16px",
              textAlign: "center",
            }}
          >
            {log.late_minutes > 0
              ? `${Math.floor(log.late_minutes / 60)}h ${log.late_minutes % 60}m`
              : "0m"}
          </td>

          {/* OVERTIME */}
          <td
            style={{
              padding: "16px",
              textAlign: "center",
            }}
          >
            {log.overtime_minutes > 0
              ? `${Math.floor(log.overtime_minutes / 60)}h ${log.overtime_minutes % 60}m`
              : "0m"}
          </td>

          {/* HOURS WORKED */}
          <td
            style={{
              padding: "16px",
              textAlign: "center",
            }}
          >
            {calculateHoursWorked(
              log.time_in,
              log.time_out
            )}
          </td>

          {/* STATUS */}
          <td
            style={{
              padding: "16px",
              textAlign: "center",
            }}
          >
            <span
              style={{
                padding: "6px 14px",
                borderRadius: "999px",
                fontSize: "12px",
                fontWeight: "600",
                background:
                  log.status === "Absent"
                    ? "#fee2e2"
                    : log.status === "Late"
                    ? "#fef3c7"
                    : "#dcfce7",

                color:
                  log.status === "Absent"
                    ? "#b91c1c"
                    : log.status === "Late"
                    ? "#92400e"
                    : "#166534",
              }}
            >
              {log.status || "Present"}
            </span>
          </td>
          {/* CORRECTION */}
<td
  style={{
    padding: "16px",
    textAlign: "center",
  }}
>
  <button
    disabled={log.correction?.status === "Pending"}
    onClick={() => {
      if (log.correction?.status === "Pending") return;
      setSelectedLog(log);
      setCorrectionReason("");
      setCorrectionFile(null);
      setShowCorrectionModal(true);
    }}
    style={{
      background: log.correction?.status === "Pending" ? "#9ca3af" : "#f97316",
      color: "#fff",
      border: "none",
      padding: "10px 14px",
      borderRadius: "8px",
      cursor: log.correction?.status === "Pending" ? "not-allowed" : "pointer",
      fontWeight: "600",
      fontSize: "13px",
    }}
  >
    {log.correction?.status === "Pending"
      ? "Correction Pending"
      : log.correction?.status === "Approved"
      ? "Request Again"
      : log.correction?.status === "Rejected"
      ? "Request Again"
      : "Request to Correct"}
  </button>
</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
          </div>
        </div>
      </div>
      {showCorrectionModal && (
  <div
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 9999,
    }}
  >
    <div
      style={{
        background: "#fff",
        width: "500px",
        borderRadius: "16px",
        padding: "24px",
      }}
    >
      <h2
        style={{
          marginBottom: "16px",
          fontSize: "22px",
          fontWeight: "700",
        }}
      >
        Attendance Correction
      </h2>

      <textarea
        placeholder="Enter your concern..."
        value={correctionReason}
        onChange={(e) =>
          setCorrectionReason(e.target.value)
        }
        style={{
  width: "100%",
  height: "140px",
  padding: "18px",
  marginTop: "10px",
  borderRadius: "12px",
  border: "1px solid #d1d5db",
  resize: "none",
  fontSize: "15px",
  outline: "none",
  background: "#ffffff",
  color: "#000000",
  boxSizing: "border-box",
  lineHeight: "1.5",
}}
      />

      <input
        type="file"
        className="customFileInput"
        onChange={(e) =>
          setCorrectionFile(e.target.files[0])
        }
        style={{
  marginTop: "18px",
  color: "#000",
  background: "#fff",
  padding: "8px",
  borderRadius: "8px",
}}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "10px",
          marginTop: "20px",
        }}
      >
        <button
  onClick={() => setShowCorrectionModal(false)}
  style={{
    padding: "10px 24px",
    borderRadius: "10px",
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#000",
    fontWeight: "600",
    cursor: "pointer",
  }}
        >
          Cancel
        </button>

        <button
          onClick={async () => {
  try {
    if (!selectedLog?.id) {
      alert("Please select an attendance record to correct.");
      return;
    }

    if (!correctionReason.trim()) {
      alert("Please enter the reason for the correction.");
      return;
    }

    if (selectedLog.correction?.status === "Pending") {
      alert("A correction request for this attendance record is already pending.");
      return;
    }

    let uploadedFileUrl = null;

    // ✅ upload attachment if exists
    if (correctionFile) {
      const fileExt = correctionFile.name.split(".").pop();

      const fileName = `${Date.now()}.${fileExt}`;

      const filePath = `corrections/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("faces")
        .upload(filePath, correctionFile);

      if (uploadError) {
        alert("Failed to upload attachment");
        return;
      }

      uploadedFileUrl = filePath;
    }

    // ✅ save correction request to database
    const { error } = await supabase
      .from("attendance_corrections")
      .insert([
        {
          employee_id: profile.id,
          concern: correctionReason,
          attachment_url: uploadedFileUrl,
          attendance_log_id: selectedLog?.id,
        },
      ]);

    if (error) {
      alert("Failed to submit correction");
      return;
    }

    await logAudit({
      user_id: profile.id,
      user_name: profile.full_name,
      role: "employee",
      action: "ATTENDANCE_CORRECTION_REQUEST",
      description: `Requested attendance correction: ${correctionReason}`,
    });

    alert("Correction request submitted");

    setShowCorrectionModal(false);
    setCorrectionReason("");
    setCorrectionFile(null);
  } catch (err) {
    alert("Something went wrong");
  }
}}
          style={{
            padding: "10px 16px",
            borderRadius: "8px",
            border: "none",
            background: "#f97316",
            color: "#fff",
            cursor: "pointer",
            fontWeight: "600",
          }}
        >
          Submit Request
        </button>
      </div>
    </div>
  </div>
)}
    </Layout>
  );
}

const styles = {
  container: {
    padding: "16px 24px",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1.8fr 1fr",
    gap: "20px",
    alignItems: "stretch",
    marginBottom: "16px",
  },

  card: {
    background: "#ffffff",
    padding: "16px 24px",
    borderRadius: "12px",
    border: "2px solid #e5e7eb",
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
    display: "flex",
    alignItems: "center",
  },

  newProfileContent: {
    display: "flex",
    gap: "30px",
    alignItems: "center",
    flex: 1,
  },

  newAvatarWrapper: {
    width: "180px",
    height: "180px",
    flexShrink: 0,
  },

  newAvatar: {
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    objectFit: "cover", 
  },

  avatarFallback: {
    width: "180px",
    height: "180px",
    borderRadius: "50%",
    background: "#f3f4f6",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#9ca3af",
  },

  newProfileInfoContainer: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    gap: "8px",
  },

  headerRow: {
    display: "flex",
    alignItems: "center",
    marginBottom: "4px",
  },

  profileName: {
    margin: 0,
    fontSize: "24px",
    fontWeight: "700",
    color: "#111827",
  },

  infoBody: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },

  infoTwoColumnRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
  },

  infoItem: {
    fontSize: "14px",
  },

  label: {
    color: "#6b7280",
    marginRight: "4px",
  },

  value: {
    color: "#374151",
    fontWeight: "600",
  },

  calendarCard: {
    background: "#fff",
    padding: "12px 16px",
    borderRadius: "12px",
    border: "2px solid #e5e7eb",
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },

  calendarTitle: {
    margin: "0 0 8px 0",
    fontSize: "14px",
    textAlign: "center",
    fontWeight: "600",
  },

  calendarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: "2px",
    textAlign: "center",
  },

  dayHeader: {
    fontWeight: "600",
    fontSize: "11px",
    color: "#9ca3af",
    paddingBottom: "4px",
  },

  day: {
    padding: "4px",
    fontSize: "11px",
    borderRadius: "4px",
  },

  today: {
    background: "#f97316",
    color: "#fff",
    fontWeight: "bold",
  },

  statsContainer: {
    display: "flex",
    gap: "20px",
  },

  statCard: {
    flex: 1,
    background: "#fff",
    padding: "16px",
    borderRadius: "12px",
    border: "2px solid #e5e7eb",
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
    textAlign: "center",
  },

  statVal: {
    fontSize: "24px",
    margin: "0 0 4px 0",
    fontWeight: "700",
  },

  statLabel: {
    fontSize: "14px",
    margin: 0,
    color: "#6b7280",
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