import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import ManagerLayout from "../layouts/ManagerLayout";
import { FaSearch } from "react-icons/fa";

export default function EmployeeList() {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");

  // ATTENDANCE MODAL STATES
  const [selectedEmployee, setSelectedEmployee] =
    useState(null);

  const [attendanceLogs, setAttendanceLogs] = useState([]);

  const [showAttendanceModal, setShowAttendanceModal] =
    useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from("employee_profiles")
      .select("*")
      .order("full_name", { ascending: true });

    if (!error) {
      setEmployees(data || []);
    }
  };

  const filteredEmployees = employees.filter((employee) =>
  employee.full_name
    ?.toLowerCase()
    .includes(search.toLowerCase())
);

  // CALCULATE HOURS WORKED
  const calculateHoursWorked = (
    timeInISO,
    timeOutISO
  ) => {
    if (!timeInISO || !timeOutISO) return "-";

    const start = new Date(timeInISO);
    const end = new Date(timeOutISO);

    const diff = (end - start) / 1000 / 60;

    if (diff <= 0) return "-";

    const hours = Math.floor(diff / 60);
    const minutes = Math.floor(diff % 60);

    return `${hours}h ${minutes}m`;
  };

  // OPEN ATTENDANCE POPUP
  // OPEN ATTENDANCE POPUP
const openAttendanceModal = async (employee) => {
  setSelectedEmployee(employee);

  // ATTENDANCE LOGS
  const { data: attendanceData, error } = await supabase
    .from("attendance_logs")
    .select("*")
    .eq("employee_id", employee.id)
    .order("created_at", { ascending: false });

  // CORRECTIONS
  const { data: correctionsData } = await supabase
    .from("attendance_corrections")
    .select("*")
    .eq("employee_id", employee.id);

  if (!error) {
    // MERGE CORRECTIONS INTO ATTENDANCE LOGS
const mergedLogs = (attendanceData || []).map(
  (log) => {
    const correction = correctionsData?.find(
      (c) => c.attendance_log_id === log.id
    );

    return {
      ...log,
      correction,
    };
  }
);
    setAttendanceLogs(mergedLogs);
  }

  setShowAttendanceModal(true);
};

  return (
    <ManagerLayout>
      <div style={styles.wrapper}>
        {/* PAGE TITLE */}
        <h1 style={styles.pageTitle}>
          Employee List
        </h1>

        {/* SEARCH */}
        <div style={styles.searchWrapper}>
          <FaSearch size={14} color="#6b7280" />

          <input
            type="text"
            placeholder="Search employee..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            style={styles.searchInput}
          />
        </div>

        {/* EMPLOYEE LIST */}
        <div style={styles.list}>
          {filteredEmployees.map((employee) => (
            <div
              key={employee.id}
              style={styles.card}
            >
              {/* LEFT */}
              <div style={styles.left}>
                {/* AVATAR */}
                <div style={styles.avatar}>
                  {employee.face_url ? (
                    <img
                      src={employee.face_url}
                      alt="avatar"
                      style={styles.avatarImg}
                    />
                  ) : (
                    <span style={styles.avatarText}>
                      {employee.full_name
                        ?.charAt(0)
                        .toUpperCase()}
                    </span>
                  )}
                </div>

                {/* INFO */}
                <div>
                  <div style={styles.name}>
                    {employee.full_name}
                  </div>

                  <div style={styles.position}>
                    {employee.position ||
                      "No Position"}
                  </div>

                  <div style={styles.email}>
                    {employee.email}
                  </div>
                </div>
              </div>

              {/* BUTTON */}
              <button
                onClick={() =>
                  openAttendanceModal(employee)
                }
                style={styles.button}
              >
                View Attendance
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ATTENDANCE MODAL */}
      {showAttendanceModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            {/* HEADER */}
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                Attendance Summary
              </h2>

              <button
                onClick={() =>
                  setShowAttendanceModal(false)
                }
                style={styles.closeButton}
              >
                ✕
              </button>
            </div>

            {/* TABLE */}
            <div style={styles.attendanceContainer}>
              <table style={styles.table}>
                <thead>
                  <tr>
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
                        style={styles.th}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {attendanceLogs.length > 0 ? (
                    attendanceLogs.map((log) => (
                      <tr
                        key={log.id}
                        style={{
                          borderBottom:
                            "1px solid #f1f5f9",
                        }}
                      >
                        {/* DATE */}
                        <td style={styles.td}>
                          {log.time_in
                            ? new Date(
                                log.time_in
                              ).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  timeZone:
                                    "Asia/Manila",
                                }
                              )
                            : "-"}
                        </td>

                        {/* TIME IN */}
                        <td style={styles.td}>
                          <div
                            style={{
                              display: "flex",
                              alignItems:
                                "center",
                              justifyContent:
                                "center",
                              gap: "10px",
                            }}
                          >
                            {log.time_in_face_url && (
                              <img
                                src={
                                  log.time_in_face_url
                                }
                                alt="Time In"
                                style={{
                                  width: "42px",
                                  height: "42px",
                                  borderRadius:
                                    "50%",
                                  objectFit:
                                    "cover",
                                }}
                              />
                            )}

                            <span>
                              {log.time_in
                                ? new Date(
                                    log.time_in
                                  ).toLocaleTimeString(
                                    "en-US",
                                    {
                                      hour:
                                        "2-digit",
                                      minute:
                                        "2-digit",
                                      hour12:
                                        true,
                                      timeZone:
                                        "Asia/Manila",
                                    }
                                  )
                                : "-"}
                            </span>
                          </div>
                        </td>

                        {/* TIME OUT */}
                        <td style={styles.td}>
                          <div
                            style={{
                              display: "flex",
                              alignItems:
                                "center",
                              justifyContent:
                                "center",
                              gap: "10px",
                            }}
                          >
                            {log.time_out_face_url && (
                              <img
                                src={
                                  log.time_out_face_url
                                }
                                alt="Time Out"
                                style={{
                                  width: "42px",
                                  height: "42px",
                                  borderRadius:
                                    "50%",
                                  objectFit:
                                    "cover",
                                }}
                              />
                            )}

                            <span>
                              {log.time_out
                                ? new Date(
                                    log.time_out
                                  ).toLocaleTimeString(
                                    "en-US",
                                    {
                                      hour:
                                        "2-digit",
                                      minute:
                                        "2-digit",
                                      hour12:
                                        true,
                                      timeZone:
                                        "Asia/Manila",
                                    }
                                  )
                                : "-"}
                            </span>
                          </div>
                        </td>

                        {/* LATE */}
                        <td style={styles.td}>
                          {log.late_minutes
                            ? `${log.late_minutes}m`
                            : "-"}
                        </td>

                        {/* OVERTIME */}
                        <td style={styles.td}>
                          {log.overtime_minutes
                            ? `${log.overtime_minutes}m`
                            : "-"}
                        </td>

                        {/* HOURS WORKED */}
                        <td style={styles.td}>
                          {calculateHoursWorked(
                            log.time_in,
                            log.time_out
                          )}
                        </td>

                        {/* STATUS */}
                        <td style={styles.td}>
                          <span
                            style={{
                              padding:
                                "6px 14px",
                              borderRadius:
                                "999px",
                              fontSize: "12px",
                              fontWeight: "600",

                              background:
                                log.status ===
                                "Absent"
                                  ? "#fee2e2"
                                  : log.status ===
                                    "Late"
                                  ? "#fef3c7"
                                  : "#dcfce7",

                              color:
                                log.status ===
                                "Absent"
                                  ? "#b91c1c"
                                  : log.status ===
                                    "Late"
                                  ? "#92400e"
                                  : "#166534",
                            }}
                          >
                            {log.status ||
                              "Present"}
                          </span>
                        </td>

                        {/* CORRECTION */}
                        {/* CORRECTION */}
<td style={styles.td}>
  {log.correction ? (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        alignItems: "center",
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
        {log.correction.concern ||
 log.correction.reason ||
 log.correction.message ||
 log.correction.description ||
 "No message"}
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
          }}
        >
          View Attachment
        </a>
      )}
    </div>
  ) : (
    "-"
  )}
</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="8"
                        style={{
                          padding: "30px",
                          textAlign: "center",
                          color: "#6b7280",
                          fontSize: "16px",
                        }}
                      >
                        No attendance records found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </ManagerLayout>
  );
}

const styles = {
  wrapper: {
    padding: "40px 35px",
  },

  pageTitle: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#0f172a",
    marginTop: "-10px",
    marginBottom: "35px",
    paddingLeft: "6px",
  },

  searchWrapper: {
    width: "320px",
    height: "42px",
    background: "#fff",
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    padding: "0 14px",
    gap: "10px",
    marginBottom: "28px",
  },

  searchInput: {
    border: "none",
    outline: "none",
    width: "100%",
    fontSize: "14px",
    background: "transparent",
  },

  list: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    maxWidth: "900px",
  },

  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    padding: "14px 18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  left: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },

  avatar: {
    width: "52px",
    height: "52px",
    borderRadius: "50%",
    background: "#e5e7eb",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  avatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },

  avatarText: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#6b7280",
  },

  name: {
    fontSize: "20px",
    fontWeight: "650",
    color: "#0f172a",
    marginBottom: "3px",
  },

  position: {
    fontSize: "13px",
    color: "#6b7280",
    marginBottom: "2px",
  },

  email: {
    fontSize: "12px",
    color: "#9ca3af",
  },

  button: {
    background: "#f97316",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "10px 16px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },

  // MODAL
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },

  modal: {
    width: "95%",
    maxWidth: "1500px",
    background: "#fff",
    borderRadius: "20px",
    padding: "30px",
    maxHeight: "90vh",
    overflowY: "auto",
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "25px",
  },

  modalTitle: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#0f172a",
  },

  closeButton: {
    border: "none",
    background: "transparent",
    color: "#000",
    fontSize: "28px",
    fontWeight: "700",
    cursor: "pointer",
  },

  attendanceContainer: {
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "1200px",
  },

  th: {
    background: "#f8fafc",
    padding: "16px",
    textAlign: "center",
    fontSize: "15px",
    fontWeight: "700",
    color: "#111827",
  },

  td: {
    padding: "16px",
    textAlign: "center",
    borderTop: "1px solid #e5e7eb",
    fontSize: "14px",
    color: "#374151",
  },
};