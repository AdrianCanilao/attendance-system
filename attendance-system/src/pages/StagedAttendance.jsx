import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import HRLayout from "../layouts/HRLayout";

const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

const STATUS_LABELS = {
  awaiting_profile: "Awaiting profile",
  ready: "Ready for review",
  needs_review: "Needs review",
  imported: "Imported",
  skipped: "Skipped",
};

const EMPLOYEE_STATUS_LABELS = {
  linked: "Staged identity linked to account",
  incomplete: "Staged identity — not linked",
  ready: "Staged identity — ready to link",
  not_staged: "No staged employee identity",
};

export default function StagedAttendance() {
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Your session has expired. Please log in again.");
      const response = await fetch(API_URL + "/admin/staged-legacy-attendance?limit=5000", {
        headers: { Authorization: "Bearer " + token },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.detail || "Unable to load staged historical attendance.");
      setRecords(Array.isArray(data.records) ? data.records : []);
    } catch (err) {
      setError(err.message || "Unable to load staged historical attendance.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const counts = useMemo(() => {
    const value = { all: records.length, awaiting_profile: 0, ready: 0, needs_review: 0, imported: 0, skipped: 0 };
    records.forEach((row) => { if (value[row.review_status] !== undefined) value[row.review_status] += 1; });
    return value;
  }, [records]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return records.filter((row) => {
      const statusMatches = status === "all" || row.review_status === status;
      const searchMatches = !needle || [
        row.employee_no, row.employee_name, row.staged_employee_name, row.staged_employee_status, row.branch_code, row.attendance_code, row.log_date, row.source_file_name,
      ].some((value) => String(value || "").toLowerCase().includes(needle));
      return statusMatches && searchMatches;
    });
  }, [records, search, status]);

  const styles = {
    page: { padding: "28px 32px", color: "#111827" },
    heading: { fontSize: "26px", fontWeight: 700, margin: "0 0 8px" },
    subheading: { color: "#64748b", margin: "0 0 22px", lineHeight: 1.6 },
    panel: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "18px", marginBottom: "18px" },
    stats: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: "12px", marginBottom: "18px" },
    stat: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px" },
    label: { color: "#64748b", fontSize: "13px", marginBottom: "8px" },
    value: { fontSize: "24px", fontWeight: 700 },
    input: { padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px", minWidth: 0, width: "100%", boxSizing: "border-box" },
    button: { background: "#374151", color: "#fff", border: 0, borderRadius: "8px", padding: "10px 15px", fontWeight: 600, cursor: "pointer" },
    tableWrap: { overflowX: "auto", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px" },
    table: { borderCollapse: "collapse", width: "100%", minWidth: "1150px", fontSize: "13px" },
    th: { background: "#f3f4f6", padding: "12px 10px", textAlign: "left", whiteSpace: "nowrap", borderBottom: "1px solid #e5e7eb" },
    td: { padding: "12px 10px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top" },
  };

  const statusStyle = (value) => ({
    display: "inline-block",
    borderRadius: "999px",
    padding: "5px 9px",
    fontSize: "12px",
    fontWeight: 600,
    whiteSpace: "nowrap",
    background: value === "ready" ? "#dcfce7" : value === "needs_review" ? "#fee2e2" : value === "imported" ? "#dbeafe" : value === "skipped" ? "#f3f4f6" : "#fef3c7",
    color: value === "ready" ? "#166534" : value === "needs_review" ? "#991b1b" : value === "imported" ? "#1d4ed8" : value === "skipped" ? "#374151" : "#92400e",
  });

  return (
    <HRLayout>
      <div style={styles.page}>
        <h1 style={styles.heading}>Staged Attendance</h1>
        <p style={styles.subheading}>
          Review historical CIBO DTR rows held separately from live attendance. These records are not imported into attendance logs.
        </p>

        <div style={styles.stats}>
          {[
            ["Total staged", counts.all, "all"],
            ["Awaiting profile", counts.awaiting_profile, "awaiting_profile"],
            ["Ready for review", counts.ready, "ready"],
            ["Needs review", counts.needs_review, "needs_review"],
            ["Imported", counts.imported, "imported"],
          ].map(([label, value]) => (
            <div key={label} style={styles.stat}>
              <div style={styles.label}>{label}</div>
              <div style={styles.value}>{value}</div>
            </div>
          ))}
        </div>

        <div style={styles.panel}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ flex: "1 1 280px" }}>
              <input style={styles.input} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee code, name, branch, date, or attendance code..." />
            </div>
            <div style={{ flex: "0 1 230px" }}>
              <select style={styles.input} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by review status">
                <option value="all">All statuses ({counts.all})</option>
                <option value="awaiting_profile">Awaiting profile ({counts.awaiting_profile})</option>
                <option value="ready">Ready for review ({counts.ready})</option>
                <option value="needs_review">Needs review ({counts.needs_review})</option>
                <option value="imported">Imported ({counts.imported})</option>
                <option value="skipped">Skipped ({counts.skipped})</option>
              </select>
            </div>
            <button type="button" style={styles.button} onClick={loadRecords} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</button>
          </div>
          <p style={{ color: "#64748b", fontSize: "13px", margin: "12px 0 0" }}>
            Showing {filtered.length} of {records.length} staged rows. This page is read-only; no employee or attendance records are changed here.
          </p>
        </div>

        {error && <div role="alert" style={{ ...styles.panel, color: "#b91c1c", borderColor: "#fecaca" }}>{error}</div>}
        {loading ? <div style={styles.panel}>Loading staged attendance...</div> : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {["Employee No.", "Employee Name from DTR", "Staged Employee Match", "Branch", "Date", "Hours", "Overtime", "Original Code", "Proposed Status", "Review Status", "Review Note"].map((heading) => <th key={heading} style={styles.th}>{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td style={styles.td}>{row.employee_no}</td>
                    <td style={styles.td}>{row.employee_name || "—"}</td>
                    <td style={{ ...styles.td, minWidth: "210px" }}><div style={{ fontWeight: 600 }}>{EMPLOYEE_STATUS_LABELS[row.staged_employee_status] || row.staged_employee_status || "Not checked"}</div>{row.staged_employee_name && <div style={{ color: "#64748b", marginTop: "4px" }}>{row.staged_employee_name}</div>}{row.staged_employee_role && <div style={{ color: "#64748b", marginTop: "4px" }}>Intended role: {row.staged_employee_role}</div>}{row.staged_employee_linked_id && <div style={{ color: "#166534", marginTop: "4px", overflowWrap: "anywhere" }}>Account ID: {row.staged_employee_linked_id}</div>}<div style={{ color: "#64748b", marginTop: "6px", fontSize: "12px" }}>{row.employee_link_review_note || "Employee match is informational only."}</div></td>
                    <td style={styles.td}>{row.branch_code}</td>
                    <td style={styles.td}>{row.log_date}</td>
                    <td style={styles.td}>{row.total_hours_worked}</td>
                    <td style={styles.td}>{row.overtime_hours}</td>
                    <td style={styles.td}>{row.attendance_code}</td>
                    <td style={styles.td}>{row.proposed_status}</td>
                    <td style={styles.td}><span style={statusStyle(row.review_status)}>{STATUS_LABELS[row.review_status] || row.review_status}</span></td>
                    <td style={{ ...styles.td, minWidth: "270px", maxWidth: "400px" }}>{row.review_note || "No review note."}</td>
                  </tr>
                ))}
                {!filtered.length && <tr><td colSpan="11" style={{ ...styles.td, textAlign: "center", color: "#64748b" }}>{error ? "Records could not be loaded." : "No staged attendance rows match this filter."}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </HRLayout>
  );
}
