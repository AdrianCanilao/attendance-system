import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import ManagerLayout from "../layouts/ManagerLayout";
import Swal from "sweetalert2";

const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export default function ManagerStagedEmployees() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Your session expired. Please sign in again.");
      const response = await fetch(API_URL + "/manager/staged-legacy-employees", {
        headers: { Authorization: "Bearer " + token },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.detail || "Unable to load staged employees for your branch.");
      setEmployees(data.employees || []);
    } catch (e) {
      setError(e.message || "Unable to load staged employees.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  return (
    <ManagerLayout>
      <div className="cibo-page-root" style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: 0, color: "#111827" }}>Staged Employees</h2>
            <p style={{ color: "#64748b", margin: "8px 0 0" }}>Legacy DTR employees sent by HR for registration at your branch.</p>
          </div>
          <button onClick={loadEmployees} disabled={loading} style={styles.button}>{loading ? "Loading..." : "Refresh"}</button>
        </div>
        <div style={styles.notice}>Branch restriction is enforced by the backend. You can only see staged employees assigned to your own branch.</div>
        {error && <div role="alert" style={styles.error}>{error}</div>}
        <div style={styles.tableWrap}>
          {loading ? <p style={styles.note}>Loading staged employees...</p> : employees.length === 0 ? <p style={styles.note}>No employees are waiting for registration at your branch.</p> : (
            <table style={styles.table}>
              <thead><tr>
                <th style={styles.th}>Employee No.</th><th style={styles.th}>Name from DTR</th><th style={styles.th}>Branch</th><th style={styles.th}>Source File</th><th style={styles.th}>Status</th><th style={styles.th}>Action</th>
              </tr></thead>
              <tbody>{employees.map((employee) => <tr key={employee.id}>
                <td style={styles.td}>{employee.employee_no}</td>
                <td style={styles.td}>{employee.full_name}</td>
                <td style={styles.td}>{employee.branches?.branch_name || employee.source_branch_code || "-"}</td>
                <td style={styles.td}>{employee.source_file_name || "-"}</td>
                <td style={styles.td}><span style={styles.badge}>Awaiting registration</span></td>
                <td style={styles.td}><button style={styles.button} onClick={() => navigate("/manager/register", { state: { stagedEmployee: employee } })}>Continue Registration</button></td>
              </tr>)}</tbody>
            </table>
          )}
        </div>
      </div>
    </ManagerLayout>
  );
}

const styles = {
  button: { border: 0, borderRadius: 7, background: "#f97316", color: "#fff", padding: "10px 14px", fontWeight: 600, cursor: "pointer" },
  notice: { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af", padding: 12, borderRadius: 8, marginBottom: 16 },
  error: { background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: 12, borderRadius: 8, marginBottom: 16 },
  tableWrap: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 780 },
  th: { textAlign: "left", padding: 12, background: "#f3f4f6", color: "#111827", fontSize: 13, whiteSpace: "nowrap" },
  td: { padding: 12, borderBottom: "1px solid #e5e7eb", color: "#1f2937", fontSize: 13 },
  note: { color: "#64748b", padding: 16 },
  badge: { display: "inline-block", borderRadius: 999, padding: "5px 9px", background: "#fef3c7", color: "#92400e", fontSize: 12, fontWeight: 600 },
};
