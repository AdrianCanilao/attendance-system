import { useEffect, useMemo, useState } from "react";
import HRLayout from "../layouts/HRLayout";
import { supabase } from "../supabaseClient";

const PAGE_SIZE = 10;

export default function HRAuditTrail() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("hr_audit_logs_safe")
      .select("id,user_name,role,action,description,created_at")
      .order("created_at", { ascending: false });

    if (!error) setLogs(data || []);
    setLoading(false);
  };

  const roleOptions = [
    { value: "hr", label: "HR" },
    { value: "employee", label: "Employee" },
    { value: "maintenance", label: "Maintenance" },
    { value: "kiosk", label: "Kiosk" },
    { value: "web", label: "Web" },
  ];

  const normalizeRole = (role) => {
    const normalized = (role || "").trim().toLowerCase();
    return normalized === "manager" ? "maintenance" : normalized;
  };
  const actionOptions = useMemo(
    () => [...new Set(logs.map((log) => log.action).filter(Boolean))].sort(),
    [logs]
  );

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return logs
      .filter((log) => {
        const searchable = [log.user_name, log.role, log.action, log.description]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return (
          searchable.includes(query) &&
          (roleFilter === "ALL" || normalizeRole(log.role) === roleFilter) &&
          (actionFilter === "ALL" || log.action === actionFilter) &&
          (!dateFilter || new Date(log.created_at).toLocaleDateString("en-CA") === dateFilter)
        );
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [logs, search, roleFilter, actionFilter, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedLogs = filteredLogs.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, roleFilter, actionFilter, dateFilter]);

  const headerSelectStyle = {
    ...styles.headerSelect,
  };

  return (
    <HRLayout>
      <div className="cibo-page-root cibo-hr-page cibo-hr-audit-page" style={styles.container}>
        <h1 className="cibo-page-title" style={styles.title}>HR Audit Trail</h1>

        <div style={styles.filters}>
          <input
            placeholder="Search audit logs..."
            className="searchInput"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.search}
            aria-label="Search audit logs"
          />
          <button type="button" onClick={fetchLogs} style={styles.refreshButton}>
            Refresh
          </button>
        </div>

        <div style={styles.card}>
          <div style={styles.headerRow}>
            <div style={styles.headerCell}>User</div>
            <div style={styles.headerCell}>
              <select aria-label="Filter by role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={headerSelectStyle}>
                <option value="ALL">Role</option>
                {roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
            </div>
            <div style={styles.headerCell}>
              <select aria-label="Filter by action" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} style={headerSelectStyle}>
                <option value="ALL">Action</option>
                {actionOptions.map((action) => <option key={action} value={action}>{action}</option>)}
              </select>
            </div>
            <div style={styles.headerCell}>Description</div>
            <div style={styles.headerCell}>
              <div style={styles.dateHeader}>
                <span>{dateFilter ? new Date(dateFilter + "T12:00:00").toLocaleDateString("en-GB") : new Date().toLocaleDateString("en-GB")}</span>
                <label style={styles.calendarButton} title="Choose audit date" aria-label="Choose audit date">
                  <span style={styles.calendarIcon}>▦</span>
                  <input
                    type="date"
                    aria-label="Filter by date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    style={styles.hiddenDateInput}
                  />
                </label>
              </div>
            </div>
          </div>

          {loading ? (
            <div style={styles.empty}>Loading audit logs...</div>
          ) : filteredLogs.length === 0 ? (
            <div style={styles.empty}>No audit logs match your filters.</div>
          ) : (
            paginatedLogs.map((log) => (
              <div key={log.id} style={styles.row}>
                <div style={styles.cell}>{log.user_name || "Unknown"}</div>
                <div style={styles.cell}>
                  <span style={styles.roleBadge}>{normalizeRole(log.role) === "maintenance" ? "Maintenance" : (roleOptions.find((role) => role.value === normalizeRole(log.role))?.label || "Unknown")}</span>
                </div>
                <div style={styles.cell}>{log.action || "-"}</div>
                <div style={styles.cell}>{log.description || "-"}</div>
                <div style={styles.cell}>{new Date(log.created_at).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>

        {!loading && filteredLogs.length > 0 && (
          <div style={styles.pagination}>
            <span style={styles.pageInfo}>
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredLogs.length)} of {filteredLogs.length} records
            </span>
            <div style={styles.pageControls}>
              <button type="button" onClick={() => setCurrentPage(1)} disabled={safePage === 1} style={{ ...styles.pageButton, ...(safePage === 1 ? styles.disabledButton : {}) }} aria-label="First page">«</button>
              <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={safePage === 1} style={{ ...styles.pageButton, ...(safePage === 1 ? styles.disabledButton : {}) }}>Previous</button>
              <span style={styles.pageNumber}>Page {safePage} of {totalPages}</span>
              <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={safePage === totalPages} style={{ ...styles.pageButton, ...(safePage === totalPages ? styles.disabledButton : {}) }}>Next</button>
              <button type="button" onClick={() => setCurrentPage(totalPages)} disabled={safePage === totalPages} style={{ ...styles.pageButton, ...(safePage === totalPages ? styles.disabledButton : {}) }} aria-label="Last page">»</button>
            </div>
          </div>
        )}
      </div>
    </HRLayout>
  );
}

const styles = {
  container: { padding: "0 10px 10px" },
  title: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#111827",
    margin: "0 0 12px",
  },
  card: {
    background: "#fff",
    borderRadius: "14px",
    border: "1px solid #e5e7eb",
    overflow: "hidden",
    width: "100%",
  },
  headerRow: {
    display: "grid",
    gridTemplateColumns: "minmax(150px, 1.2fr) minmax(100px, 0.45fr) minmax(120px, 0.6fr) minmax(220px, 2.2fr) minmax(180px, 0.9fr)",
    background: "#f9fafb",
    borderBottom: "1px solid #e5e7eb",
    padding: "0 16px",
    fontWeight: "600",
    color: "#111827",
    alignItems: "center",
    minHeight: "52px",
    gap: "12px",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "minmax(150px, 1.2fr) minmax(100px, 0.45fr) minmax(120px, 0.6fr) minmax(220px, 2.2fr) minmax(180px, 0.9fr)",
    padding: "16px",
    borderBottom: "1px solid #f3f4f6",
    alignItems: "center",
    gap: "12px",
  },
  headerCell: { fontSize: "14px", minWidth: 0 },
  dateHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "8px",
    color: "#111827",
    fontSize: "14px",
    fontWeight: "600",
    whiteSpace: "nowrap",
  },
  calendarButton: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    borderRadius: "6px",
    cursor: "pointer",
    color: "#374151",
  },
  calendarIcon: { fontSize: "18px", lineHeight: 1 },
  hiddenDateInput: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    opacity: 0,
    cursor: "pointer",
  },
  headerSelect: {
    width: "100%",
    minWidth: 0,
    padding: "7px 22px 7px 0",
    border: "none",
    borderRadius: "0",
    backgroundColor: "transparent",
    color: "#111827",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    outline: "none",
  },
  cell: { fontSize: "14px", color: "#374151", wordBreak: "break-word", minWidth: 0 },
  roleBadge: {
    display: "inline-block",
    background: "#f97316",
    color: "#fff",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "600",
    maxWidth: "100%",
    overflowWrap: "anywhere",
  },
  empty: { padding: "40px", textAlign: "center", color: "#6b7280" },
  filters: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", flexWrap: "wrap" },
  refreshButton: {
    padding: "10px 16px",
    borderRadius: "10px",
    border: "none",
    backgroundColor: "#f97316",
    color: "#fff",
    fontWeight: "600",
    cursor: "pointer",
  },
  search: {
    width: "min(100%, 360px)",
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #d1d5db",
    marginBottom: "0",
    fontSize: "14px",
    backgroundColor: "#fff",
    color: "#000",
    outline: "none",
    boxSizing: "border-box",
  },
  pagination: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    padding: "14px 4px",
  },
  pageInfo: { color: "#6b7280", fontSize: "13px" },
  pageControls: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" },
  pageButton: {
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    background: "#fff",
    color: "#374151",
    padding: "7px 10px",
    fontSize: "13px",
    cursor: "pointer",
  },
  disabledButton: { opacity: 0.45, cursor: "not-allowed" },
  pageNumber: { color: "#374151", fontSize: "13px", padding: "0 5px" },
};
