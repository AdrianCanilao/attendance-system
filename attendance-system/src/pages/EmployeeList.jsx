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

  const [isExporting, setIsExporting] = useState(false);

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
    if (isExporting) return;

    setIsExporting(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      const currentUserId = authData?.user?.id;
      if (authError || !currentUserId) {
        throw new Error("No authenticated user found.");
      }

      const { data: profile, error: profileError } =
        await supabase
          .from("employee_profiles")
          .select("branch_id")
          .eq("id", currentUserId)
          .single();

      if (profileError || !profile?.branch_id) {
        throw new Error("Your profile has no branch assigned.");
      }

      const now = new Date();
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(now);

      const year = Number(
        parts.find((p) => p.type === "year")?.value
      );
      const month = Number(
        parts.find((p) => p.type === "month")?.value
      );
      const todayDay = Number(
        parts.find((p) => p.type === "day")?.value
      );

      const monthStart = new Date(year, month - 1, 1);
      const nextMonthStart = new Date(year, month, 1);
      const daysInMonth = new Date(year, month, 0).getDate();

      const toManilaDate = (value) =>
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Manila",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(value));

      const formatTime = (value) =>
        value
          ? new Date(value).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
              timeZone: "Asia/Manila",
            })
          : "";

      const formatMinutes = (minutes) => {
        const total = Number(minutes || 0);
        const hours = Math.floor(total / 60);
        const mins = total % 60;
        return hours > 0
          ? hours + "h " + mins + "m"
          : mins + "m";
      };

      const { data: branch, error: branchError } =
        await supabase
          .from("branches")
          .select("id, branch_name, branch_code")
          .eq("id", profile.branch_id)
          .single();

      if (branchError || !branch) {
        throw new Error("Unable to load branch information.");
      }

      const { data: branchMembers, error: employeeError } =
        await supabase
          .from("employee_profiles")
          .select("id, full_name")
          .eq("branch_id", profile.branch_id)
          .order("full_name", { ascending: true });

      if (employeeError) {
        throw new Error(employeeError.message);
      }

      if (!branchMembers?.length) {
        throw new Error("No personnel were found in your branch.");
      }

      const { data: attendanceData, error: attendanceError } =
        await supabase
          .from("attendance_logs")
          .select("*")
          .in(
            "employee_id",
            branchMembers.map((employee) => employee.id)
          )
          .gte("log_date", toManilaDate(monthStart))
          .lt("log_date", toManilaDate(nextMonthStart))
          .order("log_date", { ascending: true });

      if (attendanceError) {
        throw new Error(attendanceError.message);
      }

      const { data: leaves, error: leaveError } =
        await supabase
          .from("leave_requests")
          .select("*")
          .in(
            "employee_id",
            branchMembers.map((employee) => employee.id)
          )
          .eq("status", "Approved");

      if (leaveError) {
        throw new Error(leaveError.message);
      }

      const logs = attendanceData || [];
      const approvedLeaves = leaves || [];

      const escapeXml = (value) =>
        String(value ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&apos;");

      const getLog = (employeeId, dateKey) =>
        logs.find(
          (log) =>
            log.employee_id === employeeId &&
            String(log.log_date || "").slice(0, 10) ===
              dateKey
        );

      const getLeave = (employeeId, dateKey) =>
        approvedLeaves.find((leave) => {
          if (leave.employee_id !== employeeId) return false;

          const start = String(
            leave.start_date || ""
          ).slice(0, 10);
          const end = String(
            leave.end_date || leave.start_date || ""
          ).slice(0, 10);

          return dateKey >= start && dateKey <= end;
        });

      const dayInfo = Array.from(
        { length: daysInMonth },
        (_, index) => {
          const day = index + 1;
          const date = new Date(year, month - 1, day);

          return {
            day,
            dateKey:
              year +
              "-" +
              String(month).padStart(2, "0") +
              "-" +
              String(day).padStart(2, "0"),
            weekday: date.toLocaleDateString("en-US", {
              weekday: "long",
            }),
            future: day >= todayDay,
          };
        }
      );

      // Simple Excel colors:
      // green = present, orange = late, red = absent,
      // yellow = overtime, white = OL / future "-" / normal.
      const styleXml = `
        <Styles>
          <Style ss:ID="Default" ss:Name="Normal">
            <Font ss:FontName="Arial" ss:Size="10"/>
            <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
            <Borders>
              <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>
              <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>
              <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>
              <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>
            </Borders>
          </Style>
          <Style ss:ID="Header">
            <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/>
            <Interior ss:Color="#E5E7EB" ss:Pattern="Solid"/>
            <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
          </Style>
          <Style ss:ID="Title">
            <Font ss:FontName="Arial" ss:Size="14" ss:Bold="1"/>
          </Style>
          <Style ss:ID="Info">
            <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/>
          </Style>
          <Style ss:ID="Name">
            <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
          </Style>
          <Style ss:ID="Green">
            <Interior ss:Color="#C6EFCE" ss:Pattern="Solid"/>
            <Font ss:Color="#006100"/>
          </Style>
          <Style ss:ID="Orange">
            <Interior ss:Color="#FCE4D6" ss:Pattern="Solid"/>
            <Font ss:Color="#9C0006"/>
          </Style>
          <Style ss:ID="Red">
            <Interior ss:Color="#FFC7CE" ss:Pattern="Solid"/>
            <Font ss:Color="#9C0006"/>
          </Style>
          <Style ss:ID="Yellow">
            <Interior ss:Color="#FFEB9C" ss:Pattern="Solid"/>
            <Font ss:Color="#9C6500"/>
          </Style>
        </Styles>
      `;

      const cell = (value, style = "Default", mergeAcross = null) => `
        <Cell ss:StyleID="${style}"${mergeAcross !== null ? ` ss:MergeAcross="${mergeAcross}"` : ""}>
          <Data ss:Type="String">${escapeXml(value)}</Data>
        </Cell>`;

      let rows = `
        <Row>
          ${cell("CIBO ATTENDANCE REPORT", "Title", 1 + daysInMonth * 2 + 3)}
        </Row>
        <Row>
          ${cell("Branch", "Info")}
          ${cell(branch.branch_name || "-")}
        </Row>
        <Row>
          ${cell("Branch Code", "Info")}
          ${cell(branch.branch_code || "-")}
        </Row>
        <Row>
          ${cell("Report Period", "Info")}
          ${cell(
            monthStart.toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            })
          )}
        </Row>
        <Row>
          ${cell("Generated", "Info")}
          ${cell(
            now.toLocaleString("en-US", {
              timeZone: "Asia/Manila",
            })
          )}
        </Row>
        <Row></Row>
        <Row>
          ${cell("No.", "Header")}
          ${cell("Name", "Header")}
      `;

      dayInfo.forEach((day) => {
        rows += cell(day.day, "Header", 1);
      });

      rows += `
          ${cell("Total Late Hours", "Header")}
          ${cell("Total Overtime Hours", "Header")}
          ${cell("Leaves", "Header")}
          ${cell("Total Hours Worked", "Header")}
        </Row>
        <Row>
          ${cell("", "Header")}
          ${cell("", "Header")}
      `;

      dayInfo.forEach((day) => {
        rows += cell(day.weekday, "Header", 1);
      });

      rows += `
          ${cell("", "Header")}
          ${cell("", "Header")}
          ${cell("", "Header")}
          ${cell("", "Header")}
        </Row>
        <Row>
          ${cell("", "Header")}
          ${cell("", "Header")}
      `;

      dayInfo.forEach(() => {
        rows += cell("Time-In", "Header");
        rows += cell("Time-Out", "Header");
      });

      rows += `
          ${cell("", "Header")}
          ${cell("", "Header")}
          ${cell("", "Header")}
          ${cell("", "Header")}
        </Row>
      `;

      branchMembers.forEach((employee, index) => {
        const employeeLogs = logs.filter(
          (log) => log.employee_id === employee.id
        );

        const lateMinutes = employeeLogs.reduce(
          (sum, log) =>
            sum + Number(log.late_minutes || 0),
          0
        );

        const overtimeMinutes = employeeLogs.reduce(
          (sum, log) =>
            sum + Number(log.overtime_minutes || 0),
          0
        );

        const workedMinutes = employeeLogs.reduce(
          (sum, log) => {
            if (!log.time_in || !log.time_out) return sum;

            const diff = Math.floor(
              (new Date(log.time_out) -
                new Date(log.time_in)) /
                60000
            );

            return sum + (diff > 0 ? diff : 0);
          },
          0
        );

        const employeeLeaves = approvedLeaves.filter(
          (leave) => leave.employee_id === employee.id
        );

        const leaveDays = employeeLeaves.reduce(
          (total, leave) => {
            const start = new Date(
              String(leave.start_date || "").slice(0, 10) +
                "T00:00:00"
            );
            const end = new Date(
              String(
                leave.end_date ||
                  leave.start_date ||
                  ""
              ).slice(0, 10) + "T00:00:00"
            );

            return (
              total +
              Math.max(
                0,
                Math.floor(
                  (end - start) / 86400000
                ) + 1
              )
            );
          },
          0
        );

        rows += `
          <Row>
            ${cell(index + 1)}
            ${cell(employee.full_name || "-", "Name")}
        `;

        dayInfo.forEach((day) => {
          const leave = getLeave(
            employee.id,
            day.dateKey
          );
          const log = getLog(
            employee.id,
            day.dateKey
          );

          if (leave) {
            rows += cell("OL");
            rows += cell("OL");
            return;
          }

          if (day.future) {
            rows += cell("-");
            rows += cell("-");
            return;
          }

          if (!log || !log.time_in) {
            rows += cell("Absent", "Red");
            rows += cell("Absent", "Red");
            return;
          }

          const late =
            Number(log.late_minutes || 0) > 0;
          const overtime =
            Number(log.overtime_minutes || 0) > 0;

          rows += cell(
            formatTime(log.time_in),
            late ? "Orange" : "Green"
          );

          rows += cell(
            formatTime(log.time_out) || "-",
            overtime
              ? "Yellow"
              : log.time_out
                ? "Green"
                : "Default"
          );
        });

        rows += `
            ${cell(formatMinutes(lateMinutes))}
            ${cell(formatMinutes(overtimeMinutes))}
            ${cell(leaveDays)}
            ${cell(formatMinutes(workedMinutes))}
          </Row>
        `;
      });

      const columnWidths = [
        40,
        170,
        ...dayInfo.flatMap(() => [75, 75]),
        110,
        120,
        55,
        110,
      ];

      const columns = columnWidths
        .map(
          (width) =>
            `<Column ss:AutoFitWidth="0" ss:Width="${width}"/>`
        )
        .join("");

      const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  ${styleXml}
  <Worksheet ss:Name="Attendance">
    <Table>
      ${columns}
      ${rows}
    </Table>
  </Worksheet>
</Workbook>`;

      const blob = new Blob(
        [xml],
        { type: "application/xml;charset=utf-8" }
      );

      saveAs(
        blob,
        "cibo-attendance-report-" +
          toManilaDate(now) +
          ".xml"
      );
    } catch (error) {
      console.error("Attendance export failed:", error);
      alert(
        "Unable to export attendance data. Please try again."
      );
    } finally {
      setIsExporting(false);
    }
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
            type="button"
            onClick={exportExcel}
            disabled={isExporting}
            style={{
              ...styles.exportButton,
              opacity: isExporting ? 0.7 : 1,
              cursor: isExporting ? "wait" : "pointer",
            }}
          >
            {isExporting ? "Exporting..." : "Export Data"}
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