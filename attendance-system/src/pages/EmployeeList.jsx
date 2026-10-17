import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import ManagerLayout from "../layouts/ManagerLayout";
import { getStorageAccessUrl } from "../utils/storageAccess";
import { FaSearch } from "react-icons/fa";
import * as XLSX from "xlsx-js-style";
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
  const getManilaToday = () => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date());
    return {
      year: Number(parts.find((p) => p.type === "year")?.value),
      month: Number(parts.find((p) => p.type === "month")?.value),
      day: Number(parts.find((p) => p.type === "day")?.value),
    };
  };
  const makeCutoffValue = (year, month, half) =>
    year + "-" + String(month).padStart(2, "0") + "-" + (half === 1 ? "01" : "16");
  const initialToday = getManilaToday();
  const [selectedCutoff, setSelectedCutoff] = useState(
    makeCutoffValue(initialToday.year, initialToday.month, initialToday.day <= 15 ? 1 : 2)
  );
  const cutoffOptions = [];
  for (let offset = 0; offset < 24; offset++) {
    // List cutoffs newest first, then the other half of that month, then prior months.
    const actualMonthOffset = Math.floor(offset / 2);
    const actualMonth = new Date(initialToday.year, initialToday.month - 1 - actualMonthOffset, 1, 12);
    const actualHalf = offset % 2 === 0
      ? (initialToday.day <= 15 ? 1 : 2)
      : (initialToday.day <= 15 ? 2 : 1);
    const start = makeCutoffValue(actualMonth.getFullYear(), actualMonth.getMonth() + 1, actualHalf);
    const endDay = actualHalf === 1 ? 15 : new Date(actualMonth.getFullYear(), actualMonth.getMonth() + 1, 0).getDate();
    cutoffOptions.push({
      value: start,
      label: new Date(actualMonth.getFullYear(), actualMonth.getMonth(), 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })
        + " " + (actualHalf === 1 ? "1–15" : "16–" + endDay),
    });
  }
  const selectedCutoffStart = selectedCutoff;
  const selectedCutoffDate = new Date(selectedCutoffStart + "T12:00:00");
  const cutoffStartDate = selectedCutoffDate.getFullYear() + "-" + String(selectedCutoffDate.getMonth() + 1).padStart(2, "0") + "-" + String(selectedCutoffDate.getDate()).padStart(2, "0");
  const cutoffEndDay = selectedCutoffDate.getDate() === 1
    ? 15
    : new Date(selectedCutoffDate.getFullYear(), selectedCutoffDate.getMonth() + 1, 0).getDate();
  const cutoffEndDate = selectedCutoffDate.getFullYear() + "-" + String(selectedCutoffDate.getMonth() + 1).padStart(2, "0") + "-" + String(cutoffEndDay).padStart(2, "0");

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
  // Export one row per employee per date, with daily hours instead of paired clock-time columns.
  const exportCSV = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id;
      if (authError || !currentUserId) throw new Error("No authenticated user found.");

      const { data: profile, error: profileError } = await supabase
        .from("employee_profiles")
        .select("branch_id")
        .eq("id", currentUserId)
        .single();
      if (profileError || !profile?.branch_id) throw new Error("Your profile has no branch assigned.");

      const monthStart = cutoffStartDate;
      const todayKey = cutoffEndDate;
      const nextMonthStart = cutoffEndDate;

      const { data: branch, error: branchError } = await supabase
        .from("branches").select("id,branch_name,branch_code").eq("id", profile.branch_id).single();
      if (branchError || !branch) throw new Error("Unable to load branch information.");

      const { data: employeeData, error: employeeError } = await supabase
        .from("employee_profiles")
        .select("id,employee_no,full_name,email")
        .eq("branch_id", profile.branch_id)
        .order("full_name", { ascending: true });
      if (employeeError) throw new Error(employeeError.message);

      const employees = employeeData || [];
      if (!employees.length) throw new Error("No personnel were found in your branch.");
      const employeeIds = employees.map((employee) => employee.id);

      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance_logs")
        .select("*")
        .in("employee_id", employeeIds)
        .gte("log_date", monthStart)
        .lte("log_date", todayKey)
        .order("log_date", { ascending: true });
      if (attendanceError) throw new Error(attendanceError.message);

      const { data: leaveData, error: leaveError } = await supabase
        .from("leave_requests")
        .select("*")
        .in("employee_id", employeeIds)
        .eq("status", "Approved");
      if (leaveError) throw new Error(leaveError.message);

      const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
      const records = [];
      const seen = new Set();

      const hoursForLog = (log) => {
        if (log.total_hours_worked !== null && log.total_hours_worked !== undefined && log.total_hours_worked !== "") {
          const importedHours = Number(log.total_hours_worked);
          return Number.isFinite(importedHours) ? importedHours.toFixed(2) : "";
        }
        if (!log.time_in || !log.time_out) return "";
        const minutes = (new Date(log.time_out).getTime() - new Date(log.time_in).getTime()) / 60000;
        if (!Number.isFinite(minutes) || minutes < 0) return "";
        return (Math.round((minutes / 60) * 100) / 100).toFixed(2);
      };

      const addRecord = (employee, date, values = {}) => {
        const key = employee.id + "|" + date;
        if (seen.has(key)) return;
        seen.add(key);
        records.push({
          employee_no: employee.employee_no || "",
          employee_name: employee.full_name || "",
          email: employee.email || "",
          branch_code: branch.branch_code || "",
          branch_name: branch.branch_name || "",
          date,
          total_hours_worked: values.total_hours_worked ?? "",
          attendance_code: values.attendance_code || "",
          late_minutes: values.late_minutes ?? 0,
          overtime_minutes: values.overtime_minutes ?? 0,
          overtime_hours: values.overtime_hours ?? 0,
          source: values.source || "",
        });
      };

      (attendanceData || []).forEach((log) => {
        const employee = employeeById.get(log.employee_id);
        if (!employee) return;
        const date = String(log.attendance_date || log.log_date || "").slice(0, 10);
        if (!date || date < monthStart || date > todayKey) return;
        const status = log.status || "Present";
        const hours = hoursForLog(log);
        addRecord(employee, date, {
          total_hours_worked: hours,
          attendance_code: log.attendance_code || status,
          late_minutes: Number(log.late_minutes || 0),
          overtime_minutes: Number(log.overtime_minutes || 0),
          overtime_hours: Number(log.overtime_hours ?? (Number(log.overtime_minutes || 0) / 60)),
          source: log.source || "web",
        });
      });

      (leaveData || []).forEach((leave) => {
        const employee = employeeById.get(leave.employee_id);
        if (!employee) return;
        const startDate = String(leave.start_date || "").slice(0, 10);
        const endDate = String(leave.end_date || leave.start_date || "").slice(0, 10);
        if (!startDate || !endDate) return;
        const start = startDate < monthStart ? monthStart : startDate;
        const end = endDate > todayKey ? todayKey : endDate;
        if (start > end) return;
        const cursor = new Date(start + "T12:00:00+08:00");
        const endDateObj = new Date(end + "T12:00:00+08:00");
        while (cursor <= endDateObj) {
          const date = [
            cursor.getFullYear(),
            String(cursor.getMonth() + 1).padStart(2, "0"),
            String(cursor.getDate()).padStart(2, "0"),
          ].join("-");
          addRecord(employee, date, {
            total_hours_worked: "0.00",
            attendance_code: leave.leave_type || "Approved Leave",
            late_minutes: 0,
            overtime_minutes: 0,
            overtime_hours: 0,
            source: "leave",
          });
          cursor.setDate(cursor.getDate() + 1);
        }
      });

      if (!records.length) console.warn("No attendance or approved leave records were found for this cutoff; exporting employee rows anyway.");

      // Build the selected cutoff's daily columns and include every branch employee.
      const dateColumns = [];
      const dateCursor = new Date(monthStart + "T12:00:00");
      const lastDate = new Date(todayKey + "T12:00:00");
      while (dateCursor <= lastDate) {
        dateColumns.push([
          dateCursor.getFullYear(),
          String(dateCursor.getMonth() + 1).padStart(2, "0"),
          String(dateCursor.getDate()).padStart(2, "0"),
        ].join("-"));
        dateCursor.setDate(dateCursor.getDate() + 1);
      }

      const dailyByEmployee = new Map();
      employees.forEach((employee) => {
        dailyByEmployee.set(employee.id, {
          id: employee.id,
          employee_no: employee.employee_no || "",
          employee_name: employee.full_name || "",
          branch_code: branch.branch_code || "",
          branch_name: branch.branch_name || "",
          daily: new Map(),
          overtime: new Map(),
        });
      });
      records.forEach((record) => {
        const employee = employees.find((item) =>
          String(item.employee_no || "") === String(record.employee_no || "") &&
          String(item.full_name || "") === String(record.employee_name || "")
        );
        if (!employee) return;
        const employeeRecord = dailyByEmployee.get(employee.id);
        const hours = Number(record.total_hours_worked);
        const hasHours = record.total_hours_worked !== "" && Number.isFinite(hours) && hours > 0;
        employeeRecord.daily.set(record.date, {
          value: hasHours ? Number(hours.toFixed(2)).toString() : (record.attendance_code || ""),
          hours: hasHours ? hours : 0,
        });
        const overtimeHours = Number(record.overtime_hours || 0);
        if (Number.isFinite(overtimeHours) && overtimeHours > 0) {
          employeeRecord.overtime.set(record.date, Number(overtimeHours.toFixed(2)));
        }
      });

      const startLabel = new Date(monthStart + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" });
      const endLabel = new Date(todayKey + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      const shortDate = (date) => {
        const d = new Date(date + "T12:00:00");
        return d.toLocaleDateString("en-US", { day: "numeric" });
      };
      const dayName = (date) => new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
      const dateHeaders = dateColumns.map((date) => shortDate(date));
      const weekdayHeaders = dateColumns.map((date) => dayName(date));

      // CIBO-style daily attendance block followed by a separate OT Regular block.
      const baseEndCol = 3 + dateColumns.length + 4;
      const overtimeStartCol = baseEndCol;
      const overtimeEndCol = overtimeStartCol + dateColumns.length;
      const rows = [
        ["", "", (branch.branch_name || branch.branch_code || "CIBO").toUpperCase() + " ATTENDANCE DTR SUMMARY"],
        ["", "", "For the cut-off period of " + startLabel + "–" + endLabel],
        [],
        ["STORE", "Employee Code", "NAME OF EMPLOYEE", ...dateHeaders, "TOTAL HOURS", "NO. OF DAYS", "TARDY HRS", "TARDY MIN",
          "OT REGULAR", ...Array(dateColumns.length - 1).fill(""), "OT TOTAL HOURS"],
        ["", "", "", ...weekdayHeaders, "", "", "", "", ...weekdayHeaders, ""],
      ];
      const dataRows = [...dailyByEmployee.values()]
        .sort((a, b) => a.employee_name.localeCompare(b.employee_name))
        .map((employee) => {
          let totalHours = 0;
          let daysOfWork = 0;
          let totalOvertime = 0;
          const dailyValues = dateColumns.map((date) => {
            const daily = employee.daily.get(date);
            if (!daily) return "";
            totalHours += daily.hours;
            if (daily.hours > 0) daysOfWork += 1;
            return daily.value;
          });
          const overtimeValues = dateColumns.map((date) => {
            const hours = employee.overtime.get(date) || 0;
            totalOvertime += hours;
            return hours > 0 ? Number(hours.toFixed(2)) : "";
          });
          return [
            employee.branch_code || employee.branch_name || "",
            employee.employee_no,
            employee.employee_name,
            ...dailyValues,
            Number(totalHours.toFixed(2)),
            daysOfWork,
            "", "",
            ...overtimeValues,
            Number(totalOvertime.toFixed(2)),
          ];
        });
      const worksheet = XLSX.utils.aoa_to_sheet([...rows, ...dataRows]);
      const lastCol = overtimeEndCol;
      worksheet["!merges"] = [
        { s: { r: 0, c: 2 }, e: { r: 0, c: Math.min(lastCol, 10) } },
        { s: { r: 1, c: 2 }, e: { r: 1, c: Math.min(lastCol, 10) } },
        { s: { r: 3, c: overtimeStartCol }, e: { r: 3, c: overtimeEndCol - 1 } },
      ];
      worksheet["!cols"] = [
        { wch: 12 }, { wch: 16 }, { wch: 32 },
        ...dateColumns.map(() => ({ wch: 8 })),
        { wch: 13 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
        ...dateColumns.map(() => ({ wch: 8 })),
        { wch: 14 },
      ];
      worksheet["!freeze"] = { xSplit: 3, ySplit: 5 };
      const range = XLSX.utils.decode_range(worksheet["!ref"]);
      for (let row = 0; row <= range.e.r; row++) {
        for (let col = 0; col <= range.e.c; col++) {
          const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
          if (!worksheet[cellRef]) continue;
          const cell = worksheet[cellRef];
          cell.s = {
            font: { name: "Arial", sz: row < 5 ? 10 : 9, bold: row < 5 || col === 0 },
            alignment: { vertical: "center", horizontal: col < 3 ? (col === 2 ? "left" : "center") : "center", wrapText: true },
            border: {
              top: { style: "thin", color: { rgb: "000000" } },
              bottom: { style: "thin", color: { rgb: "000000" } },
              left: { style: "thin", color: { rgb: "000000" } },
              right: { style: "thin", color: { rgb: "000000" } },
            },
          };
          if (row === 0) cell.s = { ...cell.s, font: { name: "Arial", sz: 14, bold: true }, alignment: { vertical: "center", horizontal: "left" } };
          if (row === 1) cell.s = { ...cell.s, fill: { fgColor: { rgb: "FFFF00" } }, font: { name: "Arial", sz: 10, bold: true } };
          if (row === 3 || row === 4) {
            cell.s = { ...cell.s, fill: { fgColor: { rgb: col === 2 ? "FF0000" : "FFFF00" } }, font: { name: "Arial", sz: 9, bold: true, color: { rgb: col === 2 ? "FFFFFF" : "000000" } } };
          }
          if (row >= 5 && col >= 3 && col < 3 + dateColumns.length && typeof cell.v === "number") {
            cell.z = "0.0#";
          }
        }
      }
      worksheet["!rows"] = [{ hpt: 22 }, { hpt: 20 }, { hpt: 8 }, { hpt: 24 }, { hpt: 18 }];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "DTR TEMPLATE");
      const workbookArray = XLSX.write(workbook, { bookType: "xlsx", type: "array", cellStyles: true });
      const blob = new Blob([workbookArray], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "cibo-dtr-summary-" + monthStart + "-to-" + todayKey + ".xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Attendance CSV export failed:", error);
      alert(error.message || "Unable to export attendance data. Please try again.");
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
      <div className="cibo-page-root cibo-employee-list-page" style={styles.wrapper}>
        <h1 className="cibo-page-title" style={styles.pageTitle}>
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

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <select
              aria-label="Payroll cutoff period"
              value={selectedCutoff}
              onChange={(e) => setSelectedCutoff(e.target.value)}
              style={styles.cutoffSelect}
            >
              {cutoffOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          <button
            type="button"
            onClick={exportCSV}
            disabled={isExporting}
            style={{
              ...styles.exportButton,
              opacity: isExporting ? 0.7 : 1,
              cursor: isExporting ? "wait" : "pointer",
            }}
          >
            {isExporting ? "Exporting..." : "Export DTR"}
          </button>
          </div>
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

  cutoffSelect: {
    minWidth: "220px",
    height: "40px",
    padding: "0 12px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    background: "#fff",
    color: "#111827",
    fontSize: "13px",
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