import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import ManagerLayout from "../layouts/ManagerLayout";
import StaffMobileAttendanceCards from "../components/StaffMobileAttendanceCards";
import { getStorageAccessUrl } from "../utils/storageAccess";
import { FaSearch } from "react-icons/fa";
import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";

export default function EmployeeList() {
  const [employees, setEmployees] = useState([]);
  const [passwordStatuses, setPasswordStatuses] = useState({});
  const [issuedPassword, setIssuedPassword] = useState(null);
  const [resetConfirmation, setResetConfirmation] = useState(null);
  const [resetError, setResetError] = useState("");
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [resettingUserId, setResettingUserId] = useState(null);
  const resetEmployeePassword = async (employee) => {
    if (!window.confirm("Issue a new temporary password for " + employee.full_name + "? Their previous password will stop working.")) return;
    setResettingUserId(employee.id);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) throw new Error("Session expired. Please sign in again.");
      const api = (import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "https://cibo-attendance-api.onrender.com" : "http://127.0.0.1:8000")).replace(new RegExp("/+$"), "");
      const response = await fetch(api + "/auth/password-setup/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + data.session.access_token },
        body: JSON.stringify({ target_user_id: employee.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Unable to issue password.");
      setResetConfirmation(null);
      setResetError("");
      setPasswordCopied(false);
      setIssuedPassword({ name: employee.full_name, password: result.temporary_password, expires: result.expires_at });
      setPasswordStatuses((prev) => ({ ...prev, [employee.id]: "pending_setup" }));
    } catch (error) {
      setResetError(error.message || "Password reset failed. Please try again.");
    } finally {
      setResettingUserId(null);
    }
  };
  const [search, setSearch] = useState("");
  const [employeePage, setEmployeePage] = useState(1);
  const [attendancePage, setAttendancePage] = useState(1);
  const PAGE_SIZE = 10;

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
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const api = (import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "https://cibo-attendance-api.onrender.com" : "http://127.0.0.1:8000")).replace(new RegExp("/+$"), "");
      const response = await fetch(api + "/auth/password-setup/employees", {
        headers: { Authorization: "Bearer " + sessionData.session.access_token },
      });
      if (response.ok) setPasswordStatuses((await response.json()).statuses || {});
    } catch {
      // Account status is supplementary; keep the employee list usable.
    }
  };

  const filteredEmployees = employees.filter((employee) =>
    employee.full_name
      ?.toLowerCase()
      .includes(search.toLowerCase())
  );

  const employeePageCount = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const visibleEmployees = useMemo(() => filteredEmployees.slice((employeePage - 1) * PAGE_SIZE, employeePage * PAGE_SIZE), [employees, search, employeePage]);
  const attendancePageCount = Math.max(1, Math.ceil(attendanceLogs.length / PAGE_SIZE));
  const visibleAttendanceLogs = useMemo(() => attendanceLogs.slice((attendancePage - 1) * PAGE_SIZE, attendancePage * PAGE_SIZE), [attendanceLogs, attendancePage]);

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
    setAttendancePage(1);
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

      const withPhotos = await Promise.all(mergedLogs.map(async (log) => ({
        ...log,
        time_in_face_url: await getStorageAccessUrl("faces", log.time_in_face_url),
        time_out_face_url: await getStorageAccessUrl("faces", log.time_out_face_url),
      })));
      setAttendanceLogs(withPhotos);
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
      visibleEmployees.map(async (employee) => [
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
  }, [visibleEmployees]);

  return (
    <ManagerLayout>
      <style>{`.cibo-list-pagination{display:flex;flex-direction:column;align-items:center;gap:12px;margin-top:14px;padding:12px 0;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px}.cibo-list-pagination-count{align-self:flex-start}.cibo-list-pagination-controls{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px;width:100%}.cibo-list-pagination-controls button{border:1px solid #d1d5db;border-radius:7px;background:#fff;color:#374151;padding:8px 9px;min-height:34px;font:inherit;cursor:pointer}.cibo-list-pagination-controls button:disabled{opacity:.45;cursor:not-allowed;background:#f9fafb}.cibo-list-pagination-controls button:focus-visible{outline:2px solid #f97316}.cibo-list-pagination-page{color:#374151;white-space:nowrap;padding:0 3px} .cibo-employee-list-page{width:100%;max-width:100%;box-sizing:border-box;min-width:0}.cibo-employee-list-page .cibo-employee-list-topbar{width:100%;max-width:none;gap:16px;box-sizing:border-box}.cibo-employee-list-page .cibo-employee-list-search{flex:1 1 320px;max-width:520px;min-width:0;box-sizing:border-box}.cibo-employee-list-page .cibo-employee-list-filters{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap}.cibo-employee-list-page .cibo-employee-list-cards{width:100%;max-width:none;box-sizing:border-box}.cibo-employee-list-page .cibo-employee-list-card{width:100%;min-height:96px;box-sizing:border-box;gap:16px}.cibo-employee-list-page .cibo-employee-list-card-info{min-width:0;flex:1}.cibo-employee-list-page .cibo-employee-list-card-info>div{overflow-wrap:anywhere}.cibo-employee-list-page .cibo-employee-list-card>button{flex-shrink:0}.cibo-employee-list-page>.cibo-list-pagination{width:100%;box-sizing:border-box} @media (max-width: 768px) { .cibo-employee-list-page .cibo-employee-list-topbar{align-items:stretch;gap:10px}.cibo-employee-list-page .cibo-employee-list-search{max-width:none;flex:1 1 100%}.cibo-employee-list-page .cibo-employee-list-filters{justify-content:flex-start;width:100%}.cibo-employee-list-page .cibo-employee-list-card{min-height:0}.cibo-employee-list-modal .cibo-staff-desktop-table { display: none !important; } .cibo-employee-list-modal { max-height: 90dvh; overflow-y: auto; padding: 16px !important; box-sizing: border-box; } }`}</style>
      <style>{`
        .cibo-password-modal-overlay{padding:16px;box-sizing:border-box;z-index:1200!important}
        .cibo-password-modal{position:relative;width:min(100%,440px);max-height:90dvh;overflow-y:auto;box-sizing:border-box;background:#fff;border-radius:18px;padding:32px 24px 24px;box-shadow:0 22px 65px rgba(15,23,42,.22);text-align:center;color:#1e293b}
        .cibo-password-modal-x{position:absolute;top:12px;right:16px;border:0;background:transparent;color:#64748b;font-size:26px;cursor:pointer}
        .cibo-password-modal-icon{width:64px;height:64px;display:flex;align-items:center;justify-content:center;border-radius:50%;margin:0 auto 16px;background:#fff0e3;color:#f97316;font-size:36px;font-weight:700}
        .cibo-password-modal h2{font-size:21px;line-height:1.3;margin:0 0 14px;font-weight:750;color:#111827}
        .cibo-password-modal p{font-size:14px;line-height:1.6;color:#475569;margin:10px 0}
        .cibo-password-modal-credential{margin:18px 0 12px;padding:14px 12px;border:1px solid #fed7aa;border-radius:10px;background:#fff7ed;display:flex;flex-direction:column;gap:9px}
        .cibo-password-modal-credential span{font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;color:#c2410c}
        .cibo-password-modal-credential strong{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:18px;letter-spacing:.025em;overflow-wrap:anywhere;user-select:all}
        .cibo-password-modal .cibo-password-modal-expiry{font-size:12px;text-align:left}
        .cibo-password-modal-actions{display:flex;gap:9px;margin-top:24px}
        .cibo-password-modal-actions button{flex:1;min-height:43px;border-radius:8px;font-weight:650;font-size:13px;cursor:pointer;padding:10px}
        .cibo-password-modal-actions button:disabled{opacity:.65;cursor:wait}
        .cibo-password-modal-secondary{border:1px solid #e2e8f0;background:#f1f5f9;color:#334155}
        .cibo-password-modal-primary{border:1px solid #f97316;background:#f97316;color:#fff}
        .cibo-password-modal .cibo-password-modal-error{background:#fef2f2;color:#b91c1c;border-radius:8px;padding:9px;font-size:12px}
        @media(max-width:390px){.cibo-password-modal{padding:28px 16px 18px}.cibo-password-modal-actions{flex-direction:column-reverse}}
      `}</style>
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
              onChange={(e) => { setSearch(e.target.value); setEmployeePage(1); }}
              style={styles.searchInput}
            />
          </div>

          <div className="cibo-employee-list-filters" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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

        <style>{`
          .cibo-employee-list-card-info { min-width: 0; overflow-wrap: anywhere; }
          .cibo-employee-list-card-actions { display: flex; gap: 8px; flex-shrink: 0; }
          @media (max-width: 640px) {
            .cibo-employee-list-card { flex-wrap: wrap; gap: 12px; padding: 14px !important; min-width: 0; }
            .cibo-employee-list-card > div:first-child { min-width: 0; width: 100%; }
            .cibo-employee-list-card-info { flex: 1; }
            .cibo-employee-list-card-actions { width: 100%; flex-wrap: wrap; }
            .cibo-employee-list-card-actions button { flex: 1 1 100%; min-width: 0; }
          }
        `}</style>
        {/* EMPLOYEE LIST */}
        <div className="cibo-employee-list-cards" style={{ ...styles.list, maxHeight: "min(62vh, 650px)", overflowY: "auto", overscrollBehavior: "contain", paddingRight: 4 }}>
          {visibleEmployees.map((employee) => (
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

                <div className="cibo-employee-list-card-info">
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
                  <div style={{ fontSize: 12, marginTop: 4, color: passwordStatuses[employee.id] === "expired" ? "#b42318" : "#667085" }}>
                    Account: {passwordStatuses[employee.id] === "pending_setup" ? "Pending setup" : passwordStatuses[employee.id] === "expired" ? "Expired" : passwordStatuses[employee.id] === "active" ? "Active" : "Status unavailable"}
                  </div>
                </div>
              </div>

              <div className="cibo-employee-list-card-actions">
                <button
                  type="button"
                  disabled={resettingUserId === employee.id}
                  onClick={() => { setResetError(""); setResetConfirmation(employee); }}
                  style={{ ...styles.button, background: "#fff7ed", color: "#c2410c" }}
                >
                  {resettingUserId === employee.id ? "Issuing…" : "Reset Password"}
                </button>
                <button
                  onClick={() => openAttendanceModal(employee)}
                  style={styles.button}
                >
                  View Attendance
                </button>
              </div>
            </div>
          ))}
        </div>
        <nav className="cibo-list-pagination" aria-label="Employee list pagination"><span className="cibo-list-pagination-count">{filteredEmployees.length === 0 ? "No records found" : `Showing ${(employeePage - 1) * PAGE_SIZE + 1}–${Math.min(employeePage * PAGE_SIZE, filteredEmployees.length)} of ${filteredEmployees.length} records`}</span><div className="cibo-list-pagination-controls"><button type="button" disabled={employeePage <= 1} onClick={() => setEmployeePage(1)} aria-label="First page">«</button><button type="button" disabled={employeePage <= 1} onClick={() => setEmployeePage((p) => Math.max(1,p-1))}>Previous</button><span className="cibo-list-pagination-page">Page {employeePage} of {employeePageCount}</span><button type="button" disabled={employeePage >= employeePageCount} onClick={() => setEmployeePage((p) => Math.min(employeePageCount,p+1))}>Next</button><button type="button" disabled={employeePage >= employeePageCount} onClick={() => setEmployeePage(employeePageCount)} aria-label="Last page">»</button></div></nav>
      </div>

      {(resetConfirmation || issuedPassword) && (
        <div className="cibo-password-modal-overlay" style={styles.modalOverlay} role="presentation">
          <section className="cibo-password-modal" role="dialog" aria-modal="true" aria-labelledby="cibo-password-modal-title">
            <button type="button" className="cibo-password-modal-x" aria-label="Close" disabled={Boolean(resettingUserId)} onClick={() => { setResetConfirmation(null); setIssuedPassword(null); setResetError(""); }}>×</button>
            <div className="cibo-password-modal-icon" aria-hidden="true">{issuedPassword ? "✓" : "⚿"}</div>
            {resetConfirmation ? (
              <>
                <h2 id="cibo-password-modal-title">Reset employee password?</h2>
                <p>Issue a new temporary password for <strong>{resetConfirmation.full_name}</strong>?</p>
                <p>Their current password will stop working, and they must set a new permanent password at their next login.</p>
                {resetError && <p className="cibo-password-modal-error" role="alert">{resetError}</p>}
                <div className="cibo-password-modal-actions">
                  <button type="button" className="cibo-password-modal-secondary" disabled={Boolean(resettingUserId)} onClick={() => { setResetConfirmation(null); setResetError(""); }}>Cancel</button>
                  <button type="button" className="cibo-password-modal-primary" disabled={Boolean(resettingUserId)} onClick={() => resetEmployeePassword(resetConfirmation)}>{resettingUserId ? "Issuing…" : "Issue temporary password"}</button>
                </div>
              </>
            ) : (
              <>
                <h2 id="cibo-password-modal-title">Temporary password issued!</h2>
                <p>A new temporary password has been generated for <strong>{issuedPassword.name}</strong>. Copy it now—it will only be shown once.</p>
                <div className="cibo-password-modal-credential">
                  <span>Temporary password</span>
                  <strong>{issuedPassword.password}</strong>
                </div>
                <p className="cibo-password-modal-expiry">Valid until {new Date(issuedPassword.expires).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })} (12 hours from issuance).</p>
                <div className="cibo-password-modal-actions">
                  <button type="button" className="cibo-password-modal-secondary" onClick={() => setIssuedPassword(null)}>Done</button>
                  <button type="button" className="cibo-password-modal-primary" onClick={async () => { try { await navigator.clipboard.writeText(issuedPassword.password); setPasswordCopied(true); } catch { setResetError("Unable to copy automatically. Please select and copy the password."); } }}>{passwordCopied ? "Copied!" : "Copy password"}</button>
                </div>
                {resetError && <p className="cibo-password-modal-error" role="alert">{resetError}</p>}
              </>
            )}
          </section>
        </div>
      )}
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

            <div style={{ maxHeight: "min(65dvh, 650px)", overflowY: "auto", overscrollBehavior: "contain", paddingRight: 4 }}>
            <StaffMobileAttendanceCards logs={visibleAttendanceLogs.map((log) => ({
              ...log,
              name: selectedEmployee?.full_name,
              position: selectedEmployee?.position,
              time_in: log.time_in ? new Date(log.time_in).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Manila" }) : "—",
              time_out: log.time_out ? new Date(log.time_out).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Manila" }) : "—",
              late: formatAttendanceMinutes(log.late_minutes),
              overtime: formatAttendanceMinutes(log.overtime_minutes),
            }))} hoursWorked={(log) => calculateHoursWorked(log.time_in_raw || attendanceLogs.find((item) => item.id === log.id)?.time_in, log.time_out_raw || attendanceLogs.find((item) => item.id === log.id)?.time_out)} />
            <div className="cibo-staff-desktop-table" style={styles.attendanceContainer}>
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
                  {visibleAttendanceLogs.length >
                  0 ? (
                    visibleAttendanceLogs.map(
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
            <nav className="cibo-list-pagination" aria-label="Attendance history pagination"><span className="cibo-list-pagination-count">{attendanceLogs.length === 0 ? "No records found" : `Showing ${(attendancePage - 1) * PAGE_SIZE + 1}–${Math.min(attendancePage * PAGE_SIZE, attendanceLogs.length)} of ${attendanceLogs.length} records`}</span><div className="cibo-list-pagination-controls"><button type="button" disabled={attendancePage <= 1} onClick={() => setAttendancePage(1)} aria-label="First page">«</button><button type="button" disabled={attendancePage <= 1} onClick={() => setAttendancePage((p) => Math.max(1,p-1))}>Previous</button><span className="cibo-list-pagination-page">Page {attendancePage} of {attendancePageCount}</span><button type="button" disabled={attendancePage >= attendancePageCount} onClick={() => setAttendancePage((p) => Math.min(attendancePageCount,p+1))}>Next</button><button type="button" disabled={attendancePage >= attendancePageCount} onClick={() => setAttendancePage(attendancePageCount)} aria-label="Last page">»</button></div></nav>
          </div>
        </div>
      )}
    </ManagerLayout>
  );
}

const styles = {
  wrapper: {
    padding: "32px 30px",
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
  },

  pageTitle: {
    fontSize: "28px",
    fontWeight: "700",
    marginBottom: "24px",
  },

  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "28px",
    width: "100%",
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
    width: "100%",
  },

  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    padding: "14px 18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: "96px",
    boxSizing: "border-box",
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