import { useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import HRLayout from "../layouts/HRLayout";
import * as XLSX from "xlsx-js-style";

const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

const DATASET_OPTIONS = [
  {
    value: "attendance",
    label: "Attendance History (Clock Times)",
    required: ["email", "date", "time_in", "time_out", "status"],
    example: "email,date,time_in,time_out,status,late_minutes,overtime_minutes",
  },
  {
    value: "cibo_dtr_summary",
    label: "CIBO DTR Summary (Daily Hours)",
    required: ["employee_no", "branch_code", "date", "total_hours_worked", "attendance_code"],
    example: "employee_no,branch_code,date,total_hours_worked,attendance_code",
  },
  {
    value: "leave",
    label: "Leave History",
    required: ["email", "leave_type", "start_date", "end_date", "status"],
    example: "email,leave_type,start_date,end_date,status,reason",
  },
  {
    value: "employees",
    label: "Employee Data",
    required: ["email", "full_name", "contact", "position", "branch_code"],
    example: "email,full_name,contact,position,branch_code,shift_name,employee_no",
  },
];

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (quoted && next === '"') {
        cell += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((value) => String(value).trim() !== "")) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }

  if (cell !== "" || row.length) {
    row.push(cell);
    if (row.some((value) => String(value).trim() !== "")) rows.push(row);
  }

  if (!rows.length) return { headers: [], records: [] };

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const records = rows.slice(1).map((values) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = String(values[index] ?? "").trim();
    });
    return record;
  });

  return { headers, records };
}

export default function DataMigration() {
  const [dataset, setDataset] = useState("attendance");
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [matchReport, setMatchReport] = useState(null);

  const selected = DATASET_OPTIONS.find((item) => item.value === dataset);

  const previewRows = useMemo(
    () => (parsed?.records || []).slice(0, 8),
    [parsed]
  );

  const handleFile = async (event) => {
    const nextFile = event.target.files?.[0];
    setFile(nextFile || null);
    setParsed(null);
    setValidation(null);
    setResult(null);
    setMatchReport(null);
    if (!nextFile) return;

    try {
      const isExcel = /\.xlsx?$/i.test(nextFile.name);
      const activeDataset = isExcel ? "cibo_dtr_summary" : dataset;
      if (isExcel && dataset !== "cibo_dtr_summary") {
        setDataset("cibo_dtr_summary");
      }

      let data;
      let uploadFile = nextFile;
      if (isExcel) {
        const buffer = await nextFile.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
        const sheetName = workbook.SheetNames.find((name) => /dtr template/i.test(name)) || workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) throw new Error("No worksheet was found in the Excel workbook.");
        const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
        const cellText = (value) => String(value ?? "").trim().toLowerCase();
        // CIBO's original template uses three header rows: employee "Code" and
        // "NAME OF EMPLOYEE" on the weekday row, with numeric dates above them.
        // The system-generated workbook uses a single column-header row.
        const headerIndex = matrix.findIndex((row, rowIndex) =>
          row.some((value) => cellText(value).includes("name of employee")) &&
          (row.some((value) => cellText(value) === "employee code") ||
            cellText(row[row.findIndex((value) => cellText(value).includes("name of employee")) - 1]) === "code")
        );
        if (headerIndex < 0) throw new Error("Could not find the DTR header row. Use the original CIBO DTR template or the system's exported DTR workbook.");

        const headerRow = matrix[headerIndex];
        const nameCol = headerRow.findIndex((value) => cellText(value).includes("name of employee"));
        const isOriginalCibo = !headerRow.some((value) => cellText(value) === "employee code");
        const employeeCol = isOriginalCibo
          ? headerRow.findIndex((value) => cellText(value) === "code")
          : headerRow.findIndex((value) => cellText(value) === "employee code");
        const storeCol = headerRow.findIndex((value) => cellText(value) === "store");
        const dateRow = isOriginalCibo ? (matrix[headerIndex - 1] || []) : headerRow;
        const regularTotalCol = isOriginalCibo
          ? dateRow.findIndex((value, col) => col > nameCol && cellText(value).includes("total"))
          : headerRow.findIndex((value) => cellText(value).includes("total hours"));
        if (nameCol < 0 || employeeCol < 0 || regularTotalCol < 0) throw new Error("The DTR is missing Employee Code, Name of Employee, or Total Hours columns.");

        const regularDateCols = [];
        for (let col = nameCol + 1; col < regularTotalCol; col++) {
          const value = dateRow[col];
          const day = typeof value === "number" ? value : /^\d{1,2}$/.test(String(value).trim()) ? Number(value) : NaN;
          if (Number.isInteger(day) && day >= 1 && day <= 31) regularDateCols.push({ col, day });
        }
        if (!regularDateCols.length) throw new Error("No daily date columns were found in the DTR header.");

        const titleText = matrix.flat().map((value) => String(value ?? "")).find((value) => /cut.?off period/i.test(value)) || "";
        const cutoffMatch = titleText.match(/([A-Za-z]+)\s+(\d{1,2})\s*[–-]\s*([A-Za-z]+)?\s*(\d{1,2}),?\s*(\d{4})/i)
          || titleText.match(/([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})/i);
        let cutoffStart;
        let cutoffEnd;
        if (cutoffMatch && cutoffMatch.length >= 6) {
          const monthNames = ["january","february","march","april","may","june","july","august","september","october","november","december"];
          const month = monthNames.indexOf(cutoffMatch[1].toLowerCase()) + 1;
          const startDay = Number(cutoffMatch[2]);
          const endDay = Number(cutoffMatch[4]);
          const year = Number(cutoffMatch[5]);
          cutoffStart = new Date(year, month - 1, startDay, 12);
          cutoffEnd = new Date(year, month - 1, endDay, 12);
        } else {
          throw new Error("Could not read the payroll cutoff from the worksheet heading. Make sure it says 'For the cut-off period of October 1–October 15, 2026'.");
        }
        // Ignore template columns outside the stated cutoff (some legacy templates
        // retain a day-31 column even for 30-day months).
        const cutoffLastDay = cutoffEnd.getDate();
        const filteredDateCols = regularDateCols.filter(({ day }) =>
          day >= cutoffStart.getDate() && day <= cutoffLastDay
        );
        regularDateCols.splice(0, regularDateCols.length, ...filteredDateCols);
        const dateForDay = (day) => new Date(cutoffStart.getFullYear(), cutoffStart.getMonth(), day, 12);
        const dateHeaders = regularDateCols.map(({ day }) => {
          const date = dateForDay(day);
          if (date < cutoffStart || date > cutoffEnd) throw new Error("A daily header falls outside the cutoff period.");
          return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
        });

        const otGroupRowIndex = matrix.findIndex((row) =>
          row.some((value) => cellText(value).includes("ot regular"))
        );
        const otStartCol = otGroupRowIndex >= 0
          ? matrix[otGroupRowIndex].findIndex((value) => cellText(value).includes("ot regular"))
          : -1;
        const overtimeCols = regularDateCols.map((item, index) => ({
          col: otStartCol >= 0 ? otStartCol + index : -1,
          date: dateHeaders[index],
        }));
        const normalizedRecords = [];
        const previewSourceRows = [];
        for (let rowIndex = headerIndex + 1; rowIndex < matrix.length; rowIndex++) {
          const row = matrix[rowIndex] || [];
          const employeeNo = String(row[employeeCol] ?? "").trim();
          const employeeName = String(row[nameCol] ?? "").trim();
          if (!employeeNo && !employeeName) continue;
          if (!employeeNo || !employeeName) {
            previewSourceRows.push({ _row: rowIndex + 1, _error: "Employee Code and Name of Employee are both required." });
            continue;
          }
          const branchCode = String(row[storeCol >= 0 ? storeCol : 1] ?? "").trim();
          regularDateCols.forEach(({ col }, index) => {
            const rawValue = row[col];
            const value = String(rawValue ?? "").trim();
            const otRaw = overtimeCols[index]?.col >= 0 ? row[overtimeCols[index].col] : "";
            const otValue = Number(otRaw);
            const hasOvertime = String(otRaw ?? "").trim() !== "" && Number.isFinite(otValue) && otValue > 0;
            if (!value && !hasOvertime) return;
            const numericHours = value !== "" && Number.isFinite(Number(value)) ? Number(value) : 0;
            const record = {
              employee_no: employeeNo,
              employee_name: employeeName,
              branch_code: branchCode,
              date: dateHeaders[index],
              total_hours_worked: numericHours,
              attendance_code: value || "Present",
              overtime_hours: hasOvertime ? otValue : 0,
            };
            normalizedRecords.push(record);
          });
        }
        if (!normalizedRecords.length) throw new Error("No daily attendance or overtime values were found under the DTR date columns.");
        const headers = ["employee_no", "employee_name", "branch_code", "date", "total_hours_worked", "attendance_code", "overtime_hours"];
        const csv = [headers.join(","), ...normalizedRecords.map((record) => headers.map((header) => {
          const value = String(record[header] ?? "");
          return /[",\r\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
        }).join(","))].join("\r\n");
        uploadFile = new File(["\uFEFF", csv], nextFile.name.replace(/\.xlsx?$/i, ".csv"), { type: "text/csv;charset=utf-8" });
        data = { headers, records: normalizedRecords, source: "xlsx", sourceRows: previewSourceRows };
      } else {
        if (!nextFile.name.toLowerCase().endsWith(".csv")) throw new Error("Please select a CSV file or a CIBO DTR .xlsx workbook.");
        data = parseCSV(await nextFile.text());
      }

      if (!data.headers.length) throw new Error("The selected file is empty.");
      const activeOptions = DATASET_OPTIONS.find((item) => item.value === activeDataset) || selected;
      const missing = activeOptions.required.filter((column) => !data.headers.includes(column));
      setFile(uploadFile);
      setParsed(data);
      setValidation({
        ok: missing.length === 0 && (data.sourceRows || []).length === 0,
        message: missing.length || (data.sourceRows || []).length
          ? (missing.length ? "Missing required column(s): " + missing.join(", ") : "") +
            ((data.sourceRows || []).length ? " Some DTR rows have missing employee identifiers; correct the workbook before importing." : "")
          : `${data.records.length} daily record(s) detected. Required fields are present.`,
      });
    } catch (error) {
      setFile(nextFile);
      setValidation({ ok: false, message: error.message || "Unable to read the selected file." });
    }
  };

  const checkEmployeeMatches = async () => {
    if (dataset !== "cibo_dtr_summary" || !parsed?.records?.length) return;
    try {
      setLoading(true);
      setMatchReport(null);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        throw new Error("Your session has expired. Please log in again.");
      }

      const [{ data: profiles, error: profileError }, { data: branches, error: branchError }] = await Promise.all([
        supabase.from("employee_profiles").select("id,employee_no,full_name,branch_id"),
        supabase.from("branches").select("id,branch_code,branch_name"),
      ]);
      if (profileError) throw profileError;
      if (branchError) throw branchError;

      const profileRows = profiles || [];
      const branchRows = branches || [];
      const profileByCode = new Map();
      profileRows.filter((p) => String(p.employee_no || "").trim()).forEach((p) => {
        const key = String(p.employee_no).trim().toLowerCase();
        profileByCode.set(key, [...(profileByCode.get(key) || []), p]);
      });
      const branchByCode = new Map(branchRows.map((b) => [String(b.branch_code || "").trim().toLowerCase(), b]));
      const grouped = new Map();

      parsed.records.forEach((record) => {
        const employeeNo = String(record.employee_no || "").trim();
        const branchCode = String(record.branch_code || "").trim();
        if (!employeeNo) return;
        const key = employeeNo.toLowerCase() + "::" + branchCode.toLowerCase();
        const existing = grouped.get(key) || {
          employee_no: employeeNo,
          employee_name: String(record.employee_name || "").trim(),
          branch_code: branchCode,
          record_count: 0,
          dates: new Set(),
          names: new Set(),
        };
        existing.record_count += 1;
        if (record.date) existing.dates.add(record.date);
        if (record.employee_name) existing.names.add(String(record.employee_name).trim());
        if (!existing.employee_name && record.employee_name) existing.employee_name = String(record.employee_name).trim();
        grouped.set(key, existing);
      });

      const report = Array.from(grouped.values()).map((item) => {
        const candidates = profileByCode.get(item.employee_no.toLowerCase()) || [];
        const branch = branchByCode.get(item.branch_code.toLowerCase());
        let match_status = "No matching employee code";
        let matched_profile = null;
        if (candidates.length > 1) {
          match_status = "Duplicate employee codes in system";
        } else if (candidates.length === 1) {
          matched_profile = candidates[0];
          if (!branch) match_status = "Branch code not found";
          else if (String(matched_profile.branch_id || "") !== String(branch.id)) match_status = "Branch mismatch";
          else match_status = "Matched";
        } else if (!branch) {
          match_status = "Branch code not found";
        }
        return {
          ...item,
          dates: item.dates.size,
          names: Array.from(item.names),
          branch_name: branch?.branch_name || "",
          matched_name: matched_profile?.full_name || "",
          match_status,
        };
      }).sort((a, b) => a.employee_no.localeCompare(b.employee_no, undefined, { numeric: true }));

      setMatchReport({
        totalEmployees: report.length,
        matched: report.filter((row) => row.match_status === "Matched").length,
        needsReview: report.filter((row) => row.match_status !== "Matched").length,
        employees: report,
      });
    } catch (error) {
      setMatchReport({ error: error.message || "Unable to check employee matches." });
    } finally {
      setLoading(false);
    }
  };

  const downloadDtrTemplate = () => {
    const template = [
      "employee_no,employee_name,branch_code,date,total_hours_worked,attendance_code",
      "11423,\"SAMPLE EMPLOYEE A\",MAIN,2026-09-16,8,8",
      "11423,\"SAMPLE EMPLOYEE A\",MAIN,2026-09-17,0,OFF",
      "11259,\"SAMPLE EMPLOYEE B\",MAIN,2026-09-16,7.5,7.5",
      "11259,\"SAMPLE EMPLOYEE B\",MAIN,2026-09-17,0,SL",
    ].join("\n");
    const blob = new Blob(["\uFEFF", template], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cibo-dtr-summary-import-template.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const validateCSV = async () => {
    if (!file || !validation?.ok) return;

    try {
      setLoading(true);
      setResult(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) throw new Error("Your session has expired. Please log in again.");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("dataset", dataset);
      formData.append("dry_run", "true");

      const response = await fetch(API_URL + "/admin/migrate-csv", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail || "File validation failed.");
      }

      setResult(data);
    } catch (error) {
      setResult({ status: "ERROR", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const importCSV = async () => {
    if (!file || !validation?.ok) return;

    const confirmed = window.confirm(
      "Import these validated records into the CIBO system?\n\nExisting records will be checked for duplicates before insertion."
    );

    if (!confirmed) return;

    try {
      setLoading(true);
      setResult(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) throw new Error("Your session has expired. Please log in again.");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("dataset", dataset);
      formData.append("dry_run", "false");

      const response = await fetch(API_URL + "/admin/migrate-csv", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail || "File import failed.");
      }

      setResult(data);
    } catch (error) {
      setResult({ status: "ERROR", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <HRLayout>
      <div className="cibo-page-root" style={styles.wrapper}>
        <h1 className="cibo-page-title" style={styles.title}>Data Migration</h1>
        <p style={styles.subtitle}>
          Import existing CIBO records from CSV files or a CIBO DTR Excel workbook, with validation before data reaches the database.
        </p>

        <div style={styles.card}>
          <div style={styles.steps}>
            <div><b>1.</b> Select data type</div>
            <div><b>2.</b> Upload CSV / DTR Excel</div>
            <div><b>3.</b> Validate</div>
            <div><b>4.</b> Import</div>
          </div>

          <div style={styles.grid}>
            <div>
              <label style={styles.label}>Data Type</label>
              <select
                value={dataset}
                onChange={(e) => {
                  setDataset(e.target.value);
                  setFile(null);
                  setParsed(null);
                  setValidation(null);
                  setResult(null);
                  setMatchReport(null);
                }}
                style={styles.input}
              >
                {DATASET_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={styles.label}>CSV or CIBO DTR Excel File</label>
              <input
                type="file"
                accept=".csv,text/csv,.xlsx,.xls"
                onChange={handleFile}
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.requirements}>
            <b>Required columns:</b>{" "}
            {selected.required.join(", ")}
            <br />
            <span>Example: {selected.example}</span>
            {dataset === "employees" && (
              <p style={{ margin: "8px 0 0" }}>
                Optional employee_no lets HR link existing employee profiles to CIBO employee codes before importing the historical DTR summary.
              </p>
            )}
            {dataset === "cibo_dtr_summary" && (
              <>
                <p style={{ margin: "8px 0 0" }}>
                  Use one row per employee per date. Match employee_no and branch_code to the employee profile already registered in this system. Enter daily hours as a number (for example 8 or 7.5); use 0 for OFF or leave codes. Preserve the original CIBO code in attendance_code.
                </p>
                <p style={{ margin: "6px 0 10px" }}>
                  The original CIBO workbook has multi-row headers, so exporting the worksheet directly to CSV will not make it import-ready. Reshape its day columns into one row per employee/date using this template.
                </p>
                <button type="button" onClick={downloadDtrTemplate} style={styles.secondaryBtn}>
                  Download DTR CSV Template
                </button>
              </>
            )}
          </div>

          {validation && (
            <div
              style={{
                ...styles.message,
                background: validation.ok ? "#ecfdf5" : "#fef2f2",
                color: validation.ok ? "#166534" : "#991b1b",
                borderColor: validation.ok ? "#bbf7d0" : "#fecaca",
              }}
            >
              {validation.ok ? "✓ " : "✕ "}
              {validation.message}
            </div>
          )}

          {parsed?.records?.length > 0 && dataset === "cibo_dtr_summary" && (
            <div style={{ ...styles.requirements, marginTop: "16px" }}>
              <b>Employee matching</b>
              <p style={{ margin: "6px 0 10px" }}>
                Check which DTR employees match existing system profiles. This is a read-only check; it does not create employees or import attendance.
              </p>
              <button type="button" onClick={checkEmployeeMatches} disabled={loading} style={styles.secondaryBtn}>
                {loading ? "Checking..." : "Check Employee Matches"}
              </button>
              {matchReport?.error && <p style={{ color: "#991b1b" }}>{matchReport.error}</p>}
              {matchReport?.employees && (
                <div style={{ marginTop: "14px" }}>
                  <div style={styles.stats}>
                    <span>Distinct employees: <b>{matchReport.totalEmployees}</b></span>
                    <span>Matched: <b>{matchReport.matched}</b></span>
                    <span>Needs review: <b>{matchReport.needsReview}</b></span>
                  </div>
                  <div style={{ ...styles.tableWrap, marginTop: "12px" }}>
                    <table style={styles.table}>
                      <thead><tr>
                        <th style={styles.th}>Employee No.</th>
                        <th style={styles.th}>DTR Name</th>
                        <th style={styles.th}>Branch</th>
                        <th style={styles.th}>Daily Records</th>
                        <th style={styles.th}>System Profile</th>
                        <th style={styles.th}>Match Status</th>
                      </tr></thead>
                      <tbody>
                        {matchReport.employees.map((row) => (
                          <tr key={row.employee_no + "::" + row.branch_code}>
                            <td style={styles.td}>{row.employee_no}</td>
                            <td style={styles.td}>{row.employee_name || "-"}</td>
                            <td style={styles.td}>{row.branch_code || "-"}{row.branch_name ? " — " + row.branch_name : ""}</td>
                            <td style={styles.td}>{row.record_count}</td>
                            <td style={styles.td}>{row.matched_name || "-"}</td>
                            <td style={{ ...styles.td, color: row.match_status === "Matched" ? "#166534" : "#991b1b", fontWeight: 600 }}>{row.match_status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p style={styles.previewNote}>No employee profiles or attendance records are changed by this report.</p>
                </div>
              )}
            </div>
          )}

          {parsed?.records?.length > 0 && (
            <div style={styles.previewSection}>
              <h3 style={styles.previewTitle}>
                Preview ({parsed.records.length} records)
              </h3>

              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {parsed.headers.map((header) => (
                        <th key={header} style={styles.th}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((record, rowIndex) => (
                      <tr key={rowIndex}>
                        {parsed.headers.map((header) => (
                          <td key={header} style={styles.td}>
                            {record[header] || "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {parsed.records.length > 8 && (
                <p style={styles.previewNote}>
                  Showing the first 8 records only. All {parsed.records.length} records will be validated.
                </p>
              )}
            </div>
          )}

          <div style={styles.actions}>
            <button
              type="button"
              onClick={validateCSV}
              disabled={!file || !validation?.ok || loading}
              style={styles.secondaryBtn}
            >
              {loading ? "Processing..." : "Validate File"}
            </button>

            <button
              type="button"
              onClick={importCSV}
              disabled={!file || !validation?.ok || loading || result?.status !== "VALID"}
              style={styles.primaryBtn}
            >
              Import Data
            </button>
          </div>

          {result && (
            <div
              style={{
                ...styles.result,
                borderColor: result.status === "ERROR" ? "#fecaca" : "#d1d5db",
                background: result.status === "ERROR" ? "#fef2f2" : "#f9fafb",
              }}
            >
              <h3 style={styles.resultTitle}>
                {result.status === "ERROR"
                  ? "Migration Error"
                  : result.status === "IMPORTED"
                  ? "Migration Complete"
                  : "Validation Complete"}
              </h3>

              {result.message && <p>{result.message}</p>}

              {result.status !== "ERROR" && (
                <div style={styles.stats}>
                  <span>Records: <b>{result.total ?? 0}</b></span>
                  <span>Valid: <b>{result.valid ?? 0}</b></span>
                  <span>Imported: <b>{result.imported ?? 0}</b></span>
                  <span>Skipped: <b>{result.skipped ?? 0}</b></span>
                </div>
              )}

              {result.errors?.length > 0 && (
                <div style={styles.errorList}>
                  <b>Records requiring attention:</b>
                  {result.errors.slice(0, 10).map((error, index) => (
                    <div key={index}>Row {error.row}: {error.message}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </HRLayout>
  );
}

const styles = {
  wrapper: { padding: "20px" },
  title: {
    margin: "0 0 8px",
    fontSize: "25px",
    fontWeight: "650",
    color: "#111827",
  },
  subtitle: {
    margin: "0 0 20px",
    color: "#6b7280",
    fontSize: "14px",
  },
  card: {
    background: "#fff",
    borderRadius: "12px",
    padding: "28px",
    border: "1px solid #e5e7eb",
  },
  steps: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "10px",
    marginBottom: "25px",
    color: "#4b5563",
    fontSize: "13px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
  },
  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: "600",
    color: "#374151",
    marginBottom: "7px",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 12px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    background: "#fff",
    color: "#111827",
  },
  requirements: {
    marginTop: "18px",
    padding: "14px",
    background: "#f9fafb",
    borderRadius: "8px",
    color: "#4b5563",
    fontSize: "13px",
    lineHeight: "1.7",
  },
  message: {
    marginTop: "16px",
    padding: "12px 14px",
    border: "1px solid",
    borderRadius: "8px",
    fontSize: "13px",
  },
  previewSection: { marginTop: "22px" },
  previewTitle: { margin: "0 0 10px", fontSize: "15px", color: "#111827" },
  tableWrap: { overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "8px" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "12px" },
  th: {
    padding: "10px",
    background: "#f3f4f6",
    borderBottom: "1px solid #e5e7eb",
    textAlign: "left",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "9px 10px",
    borderBottom: "1px solid #f3f4f6",
    whiteSpace: "nowrap",
  },
  previewNote: { color: "#6b7280", fontSize: "12px" },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "22px",
  },
  primaryBtn: {
    padding: "10px 18px",
    background: "#f97316",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  },
  secondaryBtn: {
    padding: "10px 18px",
    background: "#374151",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  },
  result: {
    marginTop: "20px",
    padding: "18px",
    border: "1px solid",
    borderRadius: "10px",
    color: "#374151",
  },
  resultTitle: { margin: "0 0 8px", fontSize: "16px", color: "#111827" },
  stats: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "10px",
    marginTop: "12px",
    fontSize: "13px",
  },
  errorList: {
    marginTop: "14px",
    padding: "12px",
    background: "#fff",
    borderRadius: "8px",
    fontSize: "12px",
    lineHeight: "1.7",
  },
};
