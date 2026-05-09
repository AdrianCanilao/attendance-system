import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import ManagerLayout from "../layouts/ManagerLayout";
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

  // EXPORT EXCEL
  // EXPORT EXCEL
const exportExcel = async () => {
  const { data: authData } =
    await supabase.auth.getUser();

  const currentUserId = authData.user.id;

  const { data: profile } = await supabase
    .from("employee_profiles")
    .select("branch_id")
    .eq("id", currentUserId)
    .single();

  if (!profile) return;

  const { data: attendanceData, error } =
    await supabase
      .from("attendance_logs")
      .select(`
        *,
        employee_profiles (
          full_name
        )
      `)
      .eq(
        "employee_profiles.branch_id",
        profile.branch_id
      )
      .order("log_date", {
        ascending: true,
      });

  if (error) {
    console.log(error);
    return;
  }

  // GROUP DATA BY DATE
  const groupedByDate = {};

  attendanceData.forEach((item) => {
    const date = item.log_date;

    if (!groupedByDate[date]) {
      groupedByDate[date] = {};
    }

    groupedByDate[date][
      item.employee_profiles?.full_name
    ] = {
      timeIn: item.time_in
        ? new Date(
            item.time_in
          ).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : "-",

      timeOut: item.time_out
        ? new Date(
            item.time_out
          ).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : "-",

      late: item.late_minutes
        ? `${item.late_minutes}m`
        : "-",

      overtime: item.overtime_minutes
        ? `${item.overtime_minutes}m`
        : "-",
    };
  });

  // UNIQUE EMPLOYEES
  const employeeNames = [
    ...new Set(
      attendanceData.map(
        (item) =>
          item.employee_profiles?.full_name ||
          "-"
      )
    ),
  ];

  // UNIQUE DATES
  const dates = Object.keys(groupedByDate);

  // HEADER ROW 1
  const headerRow1 = ["Name"];

  dates.forEach((date) => {
    const formattedDate =
      new Date(date).toLocaleDateString(
        "en-GB"
      );

    headerRow1.push(
      formattedDate,
      "",
      "",
      ""
    );
  });

  // HEADER ROW 2
  const headerRow2 = [""];

  dates.forEach(() => {
    headerRow2.push(
      "Time-in",
      "Time-out",
      "Late",
      "Overtime"
    );
  });

  // BODY ROWS
  const rows = employeeNames.map(
    (employee) => {
      const row = [employee];

      dates.forEach((date) => {
        const data =
          groupedByDate[date][employee];

        row.push(data?.timeIn || "-");
        row.push(data?.timeOut || "-");
        row.push(data?.late || "-");
        row.push(data?.overtime || "-");
      });

      return row;
    }
  );

  const worksheetData = [
    headerRow1,
    headerRow2,
    ...rows,
  ];

  const worksheet =
    XLSX.utils.aoa_to_sheet(
      worksheetData
    );

  // MERGE DATE HEADERS
  const merges = [];

  let col = 1;

  dates.forEach(() => {
    merges.push({
      s: { r: 0, c: col },
      e: { r: 0, c: col + 3 },
    });

    col += 4;
  });

  worksheet["!merges"] = merges;

  // COLUMN WIDTHS
  worksheet["!cols"] = [
    { wch: 28 },

    ...Array(dates.length * 4).fill({
      wch: 16,
    }),
  ];

  const workbook =
    XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "Attendance Report"
  );

  const excelBuffer = XLSX.write(
    workbook,
    {
      bookType: "xlsx",
      type: "array",
    }
  );

  const data = new Blob(
    [excelBuffer],
    {
      type:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
    }
  );

  saveAs(
    data,
    `attendance-report-${new Date()
      .toISOString()
      .split("T")[0]}.xlsx`
  );
};

  return (
    <ManagerLayout>
      <div style={styles.wrapper}>
        <h1 style={styles.pageTitle}>
          Employee List
        </h1>

        {/* SEARCH + EXPORT */}
        <div style={styles.topBar}>
          <div style={styles.searchWrapper}>
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
        <div style={styles.list}>
          {filteredEmployees.map((employee) => (
            <div
              key={employee.id}
              style={styles.card}
            >
              <div style={styles.left}>
                <div style={styles.avatar}>
                  {employee.face_url ? (
                    <img
                      src={employee.face_url}
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
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
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
                            {log.late_minutes
                              ? `${log.late_minutes}m`
                              : "-"}
                          </td>

                          <td style={styles.td}>
                            {log.overtime_minutes
                              ? `${log.overtime_minutes}m`
                              : "-"}
                          </td>

                          <td style={styles.td}>
                            {calculateHoursWorked(
                              log.time_in,
                              log.time_out
                            )}
                          </td>

                          <td style={styles.td}>
                            {log.status ||
                              "Present"}
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
    border: "none",
    background: "transparent",
    fontSize: "28px",
    cursor: "pointer",
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