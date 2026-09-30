import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import ManagerLayout from "../layouts/ManagerLayout";
import { getStorageAccessUrl } from "../utils/storageAccess";
import { FaSearch } from "react-icons/fa";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export default function EmployeeList() {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");

  const [selectedEmployee, setSelectedEmployee] =
    useState(null);

  const [attendanceLogs, setAttendanceLogs] = useState([]);

  const [showAttendanceModal, setShowAttendanceModal] =
    useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    const { data: authData } =
      await supabase.auth.getUser();

    const currentUserId = authData.user.id;

    const { data: profile } = await supabase
      .from("employee_profiles")
      .select("branch_id")
      .eq("id", currentUserId)
      .single();

    if (!profile) return;

    const { data, error } = await supabase
      .from("employee_profiles")
      .select("*")
      .eq("branch_id", profile.branch_id)
      .order("full_name", {
        ascending: true,
      });

    if (!error) {
      setEmployees(data || []);
    }
  };

  const filteredEmployees = employees.filter((employee) =>
    employee.full_name
      ?.toLowerCase()
      .includes(search.toLowerCase())
  );

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

  const formatAttendanceMinutes = (minutes) => {
    const total = Number(minutes || 0);
    if (total <= 0) return "0m";

    const hours = Math.floor(total / 60);
    const mins = total % 60;

    return hours > 0
      ? `${hours}h ${mins}m`
      : `${mins}m`;
  };

  const openAttendanceModal = async (employee) => {
    setSelectedEmployee(employee);

    const { data: attendanceData, error } =
      await supabase
        .from("attendance_logs")
        .select("*")
        .eq("employee_id", employee.id)
        .order("created_at", {
          ascending: false,
        });

    const { data: correctionsData } =
      await supabase
        .from("attendance_corrections")
        .select("*")
        .eq("employee_id", employee.id);

    if (!error) {
      const mergedLogs = (
        attendanceData || []
      ).map((log) => {
        const correction =
          correctionsData?.find(
            (c) =>
              c.attendance_log_id === log.id
          );

        return {
          ...log,
          correction,
        };
      });

      setAttendanceLogs(mergedLogs);
    }

    setShowAttendanceModal(true);
  };

  // EXPORT CURRENT-BRANCH ATTENDANCE REPORT
  // Uses saved attendance values so historical shift changes do not rewrite old records.
  const exportExcel = async () => {
    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData?.user?.id;
    if (!currentUserId) return;

    const { data: profile } = await supabase
      .from("employee_profiles")
      .select("branch_id")
      .eq("id", currentUserId)
      .single();
    if (!profile?.branch_id) return;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const toManilaDate = (value) => {
      if (!value) return "";
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit"
      }).format(new Date(value));
    };

    const formatTime = (value) => value ? new Date(value).toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Manila"
    }) : "-";

    const formatMinutes = (minutes) => {
      const total = Number(minutes || 0);
      if (total <= 0) return "0m";
      const hours = Math.floor(total / 60);
      const mins = total % 60;
      return hours > 0 ? hours + "h " + mins + "m" : mins + "m";
    };

    const formatHoursWorked = (timeIn, timeOut) => {
      if (!timeIn || !timeOut) return "-";
      const diff = Math.floor((new Date(timeOut) - new Date(timeIn)) / 60000);
      if (diff <= 0) return "-";
      return Math.floor(diff / 60) + "h " + (diff % 60) + "m";
    };

    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .select("id, branch_name, branch_code")
      .eq("id", profile.branch_id)
      .single();
    if (branchError || !branch) {
      console.error("Export failed while loading branch:", branchError);
      alert("Unable to export attendance data. Please try again.");
      return;
    }

    const { data: employeeData } = await supabase
      .from("employee_profiles")
      .select("id, full_name, email, position, department, employee_id, role_id")
      .eq("branch_id", profile.branch_id)
      .order("full_name", { ascending: true });

    const branchMembers = (employeeData || []).filter(
      (employee) =>
        employee.role_id === "e4dbb928-7f0e-4da9-9eff-d7700d37b25a" ||
        employee.role_id === "b381a7a0-9595-4c69-abf1-5c15a827647a"
    );
    if (!branchMembers.length) return;

    const { data: attendanceData } = await supabase
      .from("attendance_logs")
      .select("*")
      .in("employee_id", branchMembers.map((employee) => employee.id))
      .gte("log_date", toManilaDate(monthStart))
      .lt("log_date", toManilaDate(nextMonthStart))
      .order("log_date", { ascending: true });

    const { data: leaveData } = await supabase
      .from("leave_requests")
      .select("*")
      .in("employee_id", branchMembers.map((employee) => employee.id))
      .eq("status", "Approved");

    const employeeMap = Object.fromEntries(branchMembers.map((employee) => [employee.id, employee]));
    const leaves = leaveData || [];

    const detailRows = (attendanceData || []).map((log) => {
      const employee = employeeMap[log.employee_id] || {};
      const status = log.time_in
        ? Number(log.late_minutes || 0) > 0 ? "Late" : "Present"
        : "Absent";
      return {
        Date: log.log_date || "-",
        "Employee ID": employee.employee_id || employee.id || "-",
        Employee: employee.full_name || "-",
        Position: employee.position || "-",
        Department: employee.department || "-",
        "Time In": formatTime(log.time_in),
        "Time In Location": log.time_in_location || "-",
        "Time Out": formatTime(log.time_out),
        "Time Out Location": log.time_out_location || "-",
        Late: formatMinutes(log.late_minutes),
        Overtime: formatMinutes(log.overtime_minutes),
        "Hours Worked": formatHoursWorked(log.time_in, log.time_out),
        Status: status,
      };
    });

    const summaryRows = branchMembers.map((employee) => {
      const logs = (attendanceData || []).filter((log) => log.employee_id === employee.id);
      const present = logs.filter((log) => log.time_in).length;
      const late = logs.filter((log) => Number(log.late_minutes || 0) > 0).length;
      const overtime = logs.filter((log) => Number(log.overtime_minutes || 0) > 0).length;
      const leaveDays = leaves.filter((leave) => leave.employee_id === employee.id).reduce((total, leave) => {
        const start = new Date(String(leave.start_date || "").slice(0, 10) + "T00:00:00");
        const end = new Date(String(leave.end_date || leave.start_date || "").slice(0, 10) + "T00:00:00");
        return total + Math.max(0, Math.floor((end - start) / 86400000) + 1);
      }, 0);
      const lateMinutes = logs.reduce((sum, log) => sum + Number(log.late_minutes || 0), 0);
      const overtimeMinutes = logs.reduce((sum, log) => sum + Number(log.overtime_minutes || 0), 0);
      const workedMinutes = logs.reduce((sum, log) => {
        if (!log.time_in || !log.time_out) return sum;
        const diff = Math.floor((new Date(log.time_out) - new Date(log.time_in)) / 60000);
        return sum + (diff > 0 ? diff : 0);
      }, 0);
      return {
        "Employee ID": employee.employee_id || employee.id || "-",
        Employee: employee.full_name || "-",
        Position: employee.position || "-",
        Role: employee.role_id === "b381a7a0-9595-4c69-abf1-5c15a827647a" ? "Maintenance Specialist" : "Employee",
        Department: employee.department || "-",
        Present: present,
        Late: late,
        "Late Minutes": formatMinutes(lateMinutes),
        Overtime: overtime,
        "Overtime Minutes": formatMinutes(overtimeMinutes),
        "Leave Days": leaveDays,
        "Hours Worked": formatMinutes(workedMinutes),
      };
    });

    const reportInfo = [
      ["CIBO ATTENDANCE REPORT"],
      ["Branch", branch.branch_name || "-"],
      ["Branch Code", branch.branch_code || "-"],
      ["Report Period", monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })],
      ["Generated", now.toLocaleString("en-US", { timeZone: "Asia/Manila" })],
      [],
      ["Branch Personnel", branchMembers.length],
      ["Present Records", detailRows.filter((row) => row.Status === "Present").length],
      ["Late Records", detailRows.filter((row) => row.Status === "Late").length],
      ["Absent Records", detailRows.filter((row) => row.Status === "Absent").length],
      ["Approved Leave Records", leaves.length],
      ["Overtime Records", detailRows.filter((row) => row.Overtime !== "0m").length],
    ];

    const workbook = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.aoa_to_sheet(reportInfo);
    summarySheet["!cols"] = [{ wch: 26 }, { wch: 42 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Report Summary");

    const employeeSheet = XLSX.utils.json_to_sheet(summaryRows);
    employeeSheet["!cols"] = [
      { wch: 18 }, { wch: 28 }, { wch: 24 }, { wch: 22 }, { wch: 24 }, { wch: 12 },
      { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(workbook, employeeSheet, "Personnel Summary");

    const detailSheet = XLSX.utils.json_to_sheet(detailRows);
    detailSheet["!cols"] = [
      { wch: 14 }, { wch: 18 }, { wch: 28 }, { wch: 24 }, { wch: 24 },
      { wch: 14 }, { wch: 34 }, { wch: 14 }, { wch: 34 }, { wch: 12 },
      { wch: 14 }, { wch: 16 }, { wch: 14 }
    ];
    XLSX.utils.book_append_sheet(workbook, detailSheet, "Attendance Details");

    const leaveSheet = XLSX.utils.json_to_sheet(leaves.map((leave) => {
      const employee = employeeMap[leave.employee_id] || {};
      return {
        Employee: employee.full_name || "-",
        "Employee ID": employee.employee_id || employee.id || "-",
        "Leave Type": leave.leave_type || leave.type || "-",
        "Start Date": leave.start_date || "-",
        "End Date": leave.end_date || leave.start_date || "-",
        Status: leave.status || "-",
        Reason: leave.reason || "-",
      };
    }));
    leaveSheet["!cols"] = [
      { wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 42 }
    ];
    XLSX.utils.book_append_sheet(workbook, leaveSheet, "Approved Leave");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
      }),
      "cibo-attendance-report-" + toManilaDate(now) + ".xlsx"
    );
  };

  const [avatarUrls, setAvatarUrls] = useState({});

  useEffect(() => {
    let active = true;

    Promise.all(
      filteredEmployees.map(async (employee) => [
        employee.id,
        await getStorageAccessUrl("faces", employee.face_url),
      ])
    ).then((entries) => {
      if (active) {
        setAvatarUrls(Object.fromEntries(entries));
      }
    });

    return () => {
      active = false;
    };
  }, [filteredEmployees]);

  return (
    <ManagerLayout>
      <div className="cibo-employee-list-page" style={styles.wrapper}>
        <h1 style={styles.pageTitle}>
          Employee List
        </h1>

        {/* SEARCH + EXPORT */}
        <div className="cibo-employee-list-topbar" style={styles.topBar}>
          <div className="cibo-employee-list-search" style={styles.searchWrapper}>
            <FaSearch
              size={14}
              color="#6b7280"
            />

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

          <button
            onClick={exportExcel}
            style={styles.exportButton}
          >
            Export Data
          </button>
        </div>

        {/* EMPLOYEE LIST */}
        <div className="cibo-employee-list-cards" style={styles.list}>
          {filteredEmployees.map((employee) => (
            <div
              key={employee.id}
              className="cibo-employee-list-card"
              style={styles.card}
            >
              <div style={styles.left}>
                <div style={styles.avatar}>
                  {employee.face_url ? (
                    <img
                      src={avatarUrls[employee.id] || ""}
                      alt="avatar"
                      style={styles.avatarImg}
                    />
                  ) : (
                    <span
                      style={styles.avatarText}
                    >
                      {employee.full_name
                        ?.charAt(0)
                        .toUpperCase()}
                    </span>
                  )}
                </div>

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

      {/* MODAL */}
      {showAttendanceModal && (
        <div className="cibo-employee-list-overlay" style={styles.modalOverlay}>
          <div className="cibo-employee-list-modal" style={styles.modal}>
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
                  {attendanceLogs.length >
                  0 ? (
                    attendanceLogs.map(
                      (log) => (
                        <tr key={log.id}>
                          <td style={styles.td}>
                            {log.time_in
                              ? new Date(
                                  log.time_in
                                ).toLocaleDateString()
                              : "-"}
                          </td>

                          <td style={styles.td}>
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
                                  }
                                )
                              : "-"}
                          </td>

                          <td style={styles.td}>
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
                                  }
                                )
                              : "-"}
                          </td>

                          <td style={styles.td}>
                            {formatAttendanceMinutes(
                              log.late_minutes
                            )}
                          </td>

                          <td style={styles.td}>
                            {formatAttendanceMinutes(
                              log.overtime_minutes
                            )}
                          </td>

                          <td style={styles.td}>
                            {calculateHoursWorked(
                              log.time_in,
                              log.time_out
                            )}
                          </td>

                          <td style={styles.td}>
                            {log.time_in
                              ? Number(log.late_minutes || 0) > 0
                                ? "Late"
                                : "Present"
                              : "Absent"}
                          </td>

                          <td style={styles.td}>
                            {log.correction
                              ?.concern || "-"}
                          </td>
                        </tr>
                      )
                    )
                  ) : (
                    <tr>
                      <td
                        colSpan="8"
                        style={{
                          padding: "30px",
                          textAlign:
                            "center",
                        }}
                      >
                        No attendance records
                        found
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
    marginBottom: "35px",
  },

  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "28px",
    maxWidth: "900px",
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
  },

  searchInput: {
    border: "none",
    outline: "none",
    width: "100%",
    fontSize: "14px",
    background: "transparent",
  },

  exportButton: {
    background: "#f97316",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "10px 18px",
    fontWeight: "600",
    cursor: "pointer",
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
    overflow: "hidden",
  },

  avatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },

  avatarText: {
    fontSize: "18px",
    fontWeight: "600",
  },

  name: {
    fontSize: "20px",
    fontWeight: "650",
  },

  position: {
    fontSize: "13px",
    color: "#6b7280",
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
    fontWeight: "600",
    cursor: "pointer",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
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
  position: "relative",
},

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "20px",
  },

  modalTitle: {
    fontSize: "28px",
    fontWeight: "700",
  },

closeButton: {
  position: "absolute",
  top: "18px",
  right: "20px",
  border: "none",
  background: "#f97316",
  color: "#fff",
  width: "36px",
  height: "36px",
  borderRadius: "8px",
  fontSize: "20px",
  fontWeight: "700",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
},

  attendanceContainer: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  th: {
    background: "#f8fafc",
    padding: "14px",
    textAlign: "center",
  },

  td: {
    padding: "14px",
    textAlign: "center",
    borderTop: "1px solid #e5e7eb",
  },
};