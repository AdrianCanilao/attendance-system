import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import HRLayout from "../layouts/HRLayout";
import Swal from "sweetalert2";

const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export default function StagedEmployees() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadEmployees = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Your session has expired. Please log in again.");
      const response = await fetch(API_URL + "/admin/staged-legacy-employees", { headers: { Authorization: "Bearer " + token } });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.detail || "Unable to load staged employees.");
      setEmployees(data.employees || []);
    } catch (e) { setError(e.message || "Unable to load staged employees."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const updateIntendedRole = (id, intended_role) => {
    setEmployees((current) => current.map((employee) => employee.id === id ? { ...employee, intended_role } : employee));
  };

  const saveIntendedRole = async (employee) => {
    if (!employee.intended_role) {
      await Swal.fire({ title: "Select a role", text: "Choose Employee or Maintenance Specialist first.", icon: "warning", confirmButtonColor: "#f97316" });
      return;
    }
    const confirmation = await Swal.fire({
      title: "Save intended role?",
      text: "This only saves the employee's planned role for registration. It does not create an account or grant permissions.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Save role",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#f97316",
      cancelButtonColor: "#6b7280",
    });
    if (!confirmation.isConfirmed) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Your session has expired. Please log in again.");
      const response = await fetch(API_URL + "/admin/staged-legacy-employees/" + encodeURIComponent(employee.id) + "/role", {
        method: "PATCH",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ intended_role: employee.intended_role }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.detail || "Unable to save role.");
      await Swal.fire({ title: "Role saved", text: data.message || "The intended role was saved.", icon: "success", confirmButtonColor: "#f97316" });
      await loadEmployees();
    } catch (e) {
      await Swal.fire({ title: "Could not save role", text: e.message || "Please try again.", icon: "error", confirmButtonColor: "#f97316" });
    }
  };

  const sendToMS = async (employee) => {
    const confirmation = await Swal.fire({
      title: "Send to Branch Supervisor?",
      text: `Send ${employee.employee_no} — ${employee.full_name} to the Branch Supervisor assigned to ${employee.branches?.branch_name || "this branch"}? Other branches will not be able to see this record.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Send to MS",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#f97316",
    });
    if (!confirmation.isConfirmed) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Your session expired. Please sign in again.");
      const response = await fetch(API_URL + "/admin/staged-legacy-employees/" + encodeURIComponent(employee.id) + "/send-to-ms", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.detail || "Unable to send this employee.");
      await Swal.fire({ title: "Employee sent to MS", text: "Only the Branch Supervisor assigned to " + (employee.branches?.branch_name || "this branch") + " can view and continue registration.", icon: "success", confirmButtonColor: "#f97316" });
      await loadEmployees();
    } catch (error) {
      await Swal.fire({ title: "Could not send employee", text: error.message || "Please try again.", icon: "error", confirmButtonColor: "#f97316" });
    }
  };

  const filtered = employees.filter((employee) => {
    const term = search.trim().toLowerCase();
    const matches = !term || [employee.employee_no, employee.full_name, employee.source_branch_code, employee.branches?.branch_name]
      .some((value) => String(value || "").toLowerCase().includes(term));
    return matches && (status === "all" || employee.profile_status === status);
  });
  const label = (value) => ({ incomplete: "Incomplete profile", ready: "Ready to link", linked: "Linked" }[value] || value || "Unknown");

  return <HRLayout>
    <div style={styles.page}>
      <div style={styles.heading}>
        <div>
          <h2 style={{ margin: 0, color: "#111827" }}>Staged Employees</h2>
          <p style={{ margin: "8px 0 0", color: "#64748b" }}>Legacy employee identities extracted from DTR files. These are not active login accounts and have no attendance imported.</p>
        </div>
        <button onClick={loadEmployees} disabled={loading} style={styles.refresh}>{loading ? "Loading..." : "Refresh"}</button>
      </div>
      <div style={styles.stats}>
        <div style={styles.stat}><span>Total staged</span><strong>{employees.length}</strong></div>
        <div style={styles.stat}><span>Incomplete</span><strong>{employees.filter((e) => e.profile_status === "incomplete").length}</strong></div>
        <div style={styles.stat}><span>Ready to link</span><strong>{employees.filter((e) => e.profile_status === "ready").length}</strong></div>
        <div style={styles.stat}><span>Linked</span><strong>{employees.filter((e) => e.profile_status === "linked").length}</strong></div>
      </div>
      <div style={styles.panel}>
        <div style={styles.filters}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee no., name, or branch..." style={styles.search} aria-label="Search staged employees" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={styles.select} aria-label="Filter staged employees by profile status">
            <option value="all" style={styles.option}>All statuses</option><option value="incomplete" style={styles.option}>Incomplete profile</option><option value="ready" style={styles.option}>Ready to link</option><option value="linked" style={styles.option}>Linked</option>
          </select>
        </div>
        {error && <div style={styles.error}>{error}</div>}
        {loading ? <p style={styles.note}>Loading staged employees...</p> : filtered.length === 0 ? <p style={styles.note}>No staged employees match your search.</p> :
          <div style={styles.tableWrap}><table style={styles.table}>
            <thead><tr><th style={styles.th}>Employee No.</th><th style={styles.th}>Name from DTR</th><th style={styles.th}>Source Branch</th><th style={styles.th}>Mapped Branch</th><th style={styles.th}>Source File</th><th style={styles.th}>Profile Status</th><th style={styles.th}>Intended Role</th><th style={styles.th}>Action</th></tr></thead>
            <tbody>{filtered.map((employee) => <tr key={employee.id}>
              <td style={styles.td}>{employee.employee_no}</td><td style={styles.td}>{employee.full_name}</td><td style={styles.td}>{employee.source_branch_code || "-"}</td>
              <td style={styles.td}>{employee.branches?.branch_name || "Branch needs mapping"}</td><td style={styles.td}>{employee.source_file_name || "-"}</td>
              <td style={styles.td}><span style={{ ...styles.badge, background: employee.profile_status === "linked" ? "#dcfce7" : employee.profile_status === "ready" ? "#fef3c7" : "#fee2e2", color: employee.profile_status === "linked" ? "#166534" : employee.profile_status === "ready" ? "#92400e" : "#991b1b" }}>{label(employee.profile_status)}</span></td>
              <td style={styles.td}>
                <select value={employee.intended_role || ""} disabled={employee.profile_status === "linked"} onChange={(event) => updateIntendedRole(employee.id, event.target.value)} style={styles.roleSelect}>
                  <option value="" style={{ color: "#111827", backgroundColor: "#ffffff" }}>Select role</option>
                  <option value="employee" style={{ color: "#111827", backgroundColor: "#ffffff" }}>Employee</option>
                  <option value="maintenance" style={{ color: "#111827", backgroundColor: "#ffffff" }}>Maintenance Specialist (MS)</option>
                </select>
              </td>
              <td style={styles.td}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button disabled={employee.profile_status === "linked"} onClick={() => saveIntendedRole(employee)} style={{ ...styles.saveRole, opacity: employee.profile_status === "linked" ? 0.5 : 1 }}>Save role</button>
                  {employee.intended_role === "maintenance" && employee.profile_status !== "linked" && (
                    <button
                      onClick={() => navigate("/hr/register-manager", { state: { stagedEmployee: employee } })}
                      style={styles.continueRole}
                    >Continue registration</button>
                  )}
                  {employee.intended_role === "employee" && employee.profile_status !== "linked" && (
                    employee.sent_to_ms_at ? (
                      <span style={{ ...styles.note, color: "#166534", fontWeight: 600 }}>Sent to MS</span>
                    ) : (
                      <button onClick={() => sendToMS(employee)} style={styles.continueRole}>Send to MS</button>
                    )
                  )}
                </div>
              </td>
            </tr>)}</tbody>
          </table></div>}
        <p style={styles.note}>Select and save the intended role here. This does not create an account or change access permissions. Actual registration and personal-information editing remain in the existing registration/Edit Employee workflows.</p>
      </div>
    </div>
  </HRLayout>;
}

const styles = {
  page: { maxWidth: 1500, margin: "0 auto", padding: "8px 0 24px", color: "#1f2937" },
  heading: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 20 },
  refresh: { border: 0, borderRadius: 8, padding: "10px 16px", background: "#f97316", color: "#fff", fontWeight: 600, cursor: "pointer" },
  stats: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 },
  stat: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 8 },
  panel: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 18 },
  filters: { display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" },
  search: { flex: "1 1 280px", minWidth: 220, border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 12px", fontSize: 14, backgroundColor: "#ffffff", color: "#111827", colorScheme: "light", boxSizing: "border-box", outlineColor: "#f97316" },
  select: { minWidth: 180, border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 12px", backgroundColor: "#ffffff", color: "#111827", colorScheme: "light", fontSize: 14, boxSizing: "border-box" },
  option: { backgroundColor: "#ffffff", color: "#111827" },
  tableWrap: { overflowX: "auto", width: "100%" }, table: { borderCollapse: "collapse", width: "100%", minWidth: 900, fontSize: 13 },
  th: { textAlign: "left", padding: "12px 10px", background: "#f3f4f6", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" },
  td: { padding: "12px 10px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top" },
  badge: { display: "inline-block", padding: "4px 8px", borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" },
  roleSelect: { minWidth: 190, border: "1px solid #cbd5e1", borderRadius: 7, padding: "8px", backgroundColor: "#ffffff", color: "#111827", colorScheme: "light", fontSize: 13, appearance: "auto" },
  saveRole: { border: 0, borderRadius: 7, padding: "8px 12px", background: "#f97316", color: "#fff", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  continueRole: { border: "1px solid #f97316", borderRadius: 7, padding: "8px 10px", background: "#fff7ed", color: "#9a3412", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  note: { color: "#64748b", fontSize: 13, margin: "16px 0 0" },
  error: { color: "#991b1b", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 12, marginBottom: 12 },
};
