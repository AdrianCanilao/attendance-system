import { useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import ManagerLayout from "../layouts/ManagerLayout";

const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

const DATASET_OPTIONS = [
  {
    value: "attendance",
    label: "Attendance History",
    required: ["email", "date", "time_in", "time_out", "status"],
    example: "email,date,time_in,time_out,status,late_minutes,overtime_minutes",
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
    example: "email,full_name,contact,position,branch_code,shift_name",
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

    if (!nextFile) return;

    if (!nextFile.name.toLowerCase().endsWith(".csv")) {
      setValidation({
        ok: false,
        message: "Please select a CSV file.",
      });
      return;
    }

    const text = await nextFile.text();
    const data = parseCSV(text);

    if (!data.headers.length) {
      setValidation({
        ok: false,
        message: "The CSV file is empty.",
      });
      return;
    }

    const missing = selected.required.filter(
      (column) => !data.headers.includes(column)
    );

    setParsed(data);
    setValidation({
      ok: missing.length === 0,
      message:
        missing.length === 0
          ? `${data.records.length} record(s) detected. Required columns are present.`
          : `Missing required column(s): ${missing.join(", ")}`,
    });
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
        throw new Error(data?.detail || "CSV validation failed.");
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
      "Import this CSV into the CIBO system?\n\nExisting records will be checked for duplicates before insertion."
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
        throw new Error(data?.detail || "CSV import failed.");
      }

      setResult(data);
    } catch (error) {
      setResult({ status: "ERROR", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ManagerLayout>
      <div style={styles.wrapper}>
        <h1 style={styles.title}>Data Migration</h1>
        <p style={styles.subtitle}>
          Import existing CIBO records using CSV while validating the data before it reaches the database.
        </p>

        <div style={styles.card}>
          <div style={styles.steps}>
            <div><b>1.</b> Select data type</div>
            <div><b>2.</b> Upload CSV</div>
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
              <label style={styles.label}>CSV File</label>
              <input
                type="file"
                accept=".csv,text/csv"
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
              {loading ? "Processing..." : "Validate CSV"}
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
    </ManagerLayout>
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
