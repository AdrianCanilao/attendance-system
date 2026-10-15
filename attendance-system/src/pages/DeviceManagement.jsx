import { useEffect, useMemo, useState } from "react";
import HRLayout from "../layouts/HRLayout";
import { supabase } from "../supabaseClient";
import { logCurrentUserAudit } from "../utils/auditlogger";
import DatePicker from "react-datepicker";

const API_URL = (import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "https://cibo-attendance-api.onrender.com" : "http://127.0.0.1:8000")).replace(/\/$/, "");

export default function DeviceManagement() {
  const [devices, setDevices] = useState([]);
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || "";
  };

  const loadDevices = async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const response = await fetch(API_URL + "/admin/devices", {
        headers: { Authorization: "Bearer " + token },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to load devices.");
      setDevices(data.devices || []);
    } catch (err) {
      setError(err.message || "Unable to load devices.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDevices(); }, []);

  const updateStatus = async (device, status) => {
    setBusyId(device.device_id);
    setError("");
    try {
      const token = await getToken();
      const response = await fetch(
        API_URL + "/admin/devices/" + encodeURIComponent(device.device_id),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify({ status }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to update device.");

      await logCurrentUserAudit({
        action: "DEVICE_STATUS_CHANGED",
        description: "Changed device " + (device.device_name || device.device_id) + " status to " + status,
      });

      await loadDevices();
    } catch (err) {
      setError(err.message || "Unable to update device.");
    } finally {
      setBusyId(null);
    }
  };

  const typeOptions = useMemo(
    () => [...new Set(devices.map((device) => (device.device_type || "web").toLowerCase()))].sort(),
    [devices]
  );

  const branchOptions = useMemo(
    () => [...new Set(devices.map((device) => device.branches?.branch_name).filter(Boolean))].sort(),
    [devices]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return devices.filter((device) => {
      const searchable = [
        device.device_name, device.device_id, device.device_type,
        device.employee_profiles?.full_name, device.employee_profiles?.email,
        device.branches?.branch_name, device.status,
      ].filter(Boolean).join(" ").toLowerCase();
      const normalizedType = (device.device_type || "web").toLowerCase();
      const normalizedStatus = device.status || "ALLOWED";
      const localDate = device.last_seen ? (() => {
        const d = new Date(device.last_seen);
        return String(d.getFullYear()) + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      })() : "";
      return searchable.includes(q) &&
        (branchFilter === "ALL" || (device.branches?.branch_name || "") === branchFilter) &&
        (typeFilter === "ALL" || normalizedType === typeFilter) &&
        (statusFilter === "ALL" || normalizedStatus === statusFilter) &&
        (!dateFilter || localDate === dateFilter);
    });
  }, [devices, search, branchFilter, typeFilter, statusFilter, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedDevices = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, branchFilter, typeFilter, statusFilter, dateFilter]);

  return (
    <HRLayout>
      <div className="cibo-page-root" style={styles.page}>
        <div style={styles.header}>
          <div>
            <h1 className="cibo-page-title" style={styles.title}>Device Management</h1>
          </div>
          <button onClick={loadDevices} style={styles.refresh}>Refresh</button>
        </div>


        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.toolbar}>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search device, user, or branch..." style={styles.search} />
          <span style={styles.count}>{filtered.length} device(s)</span>
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <colgroup>
              <col style={{ width: "19%" }} />
              <col style={{ width: "17%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "20%" }} />
            </colgroup>
            <thead><tr>
              <th style={styles.th}>Device</th><th style={styles.th}>User</th>
              <th style={styles.th}>
                <select aria-label="Filter by branch" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} style={styles.headerSelect}>
                  <option value="ALL">Branch</option>
                  {branchOptions.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
                </select>
              </th>
              <th style={styles.th}>
                <select aria-label="Filter by device type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={styles.headerSelect}>
                  <option value="ALL">Type</option>
                  {typeOptions.map((type) => <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>)}
                </select>
              </th>
              <th style={styles.th}>
                <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={styles.headerSelect}>
                  <option value="ALL">Status</option>
                  <option value="ALLOWED">Allowed</option>
                  <option value="WHITELISTED">Whitelisted</option>
                  <option value="BLOCKED">Denied</option>
                </select>
              </th>
              <th style={styles.th}>
                <div style={styles.dateHeader}>
                  <span>Date</span>
                  <DatePicker
                    selected={dateFilter ? new Date(dateFilter + "T12:00:00") : new Date()}
                    onChange={(date) => {
                      if (!date) { setDateFilter(""); return; }
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(2, "0");
                      const day = String(date.getDate()).padStart(2, "0");
                      setDateFilter(String(year) + "-" + month + "-" + day);
                    }}
                    dateFormat="dd/MM/yyyy"
                    className="calendar-input"
                    popperPlacement="bottom-end"
                    ariaLabelledBy="device-date-filter-label"
                  />
                </div>
              </th>
              <th style={styles.th}>Action</th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={styles.empty}>Loading devices...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="7" style={styles.empty}>No registered devices yet.</td></tr>
              ) : paginatedDevices.map((device) => {
                const status = device.status || "ALLOWED";
                return <tr key={device.id}>
                  <td style={styles.td}>
                    <div style={styles.deviceName}>{device.device_name || "Unknown device"}</div>
                    <div style={styles.deviceId}>{device.device_id}</div>
                  </td>
                  <td style={styles.td}>{device.employee_profiles?.full_name || "—"}
                    <div style={styles.muted}>{device.employee_profiles?.email || ""}</div>
                  </td>
                  <td style={styles.td}>{device.branches?.branch_name || "—"}</td>
                  <td style={styles.td}>{device.device_type || "web"}</td>
                  <td style={styles.td}>
                    <span style={status === "BLOCKED" ? styles.badgeBlocked : status === "WHITELISTED" ? styles.badgeWhite : styles.badgeAllowed}>{status === "BLOCKED" ? "Denied" : status}</span>
                  </td>
                  <td style={styles.td}>{device.last_seen ? new Date(device.last_seen).toLocaleDateString("en-GB") : "—"}</td>
                  <td style={styles.td}>
                    <div style={styles.actions}>
                      {status === "BLOCKED" ? (
                        <button disabled={busyId === device.device_id} onClick={() => updateStatus(device, "ALLOWED")} style={styles.allow}>Unblock</button>
                      ) : (
                        <button disabled={busyId === device.device_id} onClick={() => updateStatus(device, "BLOCKED")} style={styles.block}>Block</button>
                      )}
                      {status !== "WHITELISTED" && status !== "BLOCKED" && (
                        <button disabled={busyId === device.device_id} onClick={() => updateStatus(device, "WHITELISTED")} style={styles.white}>Whitelist</button>
                      )}
                    </div>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <div style={styles.pagination}>
            <span style={styles.pageInfo}>
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} devices
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
  page: { padding: "8px 4px 30px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px", marginBottom: "18px" },
  title: { margin: 0, color: "#111827", fontSize: "25px", fontWeight: 700 },
  refresh: { border: "none", background: "#f97316", color: "#fff", borderRadius: "8px", padding: "10px 15px", cursor: "pointer", fontWeight: 600 },
  error: { background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "12px 14px", borderRadius: "9px", marginBottom: "15px", fontSize: "13px" },
  toolbar: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "15px", marginBottom: "12px" },
  search: { width: "340px", maxWidth: "100%", padding: "11px 13px", border: "1px solid #d1d5db", borderRadius: "8px", outline: "none", background: "#fff" },
  count: { color: "#667085", fontSize: "13px" },
  tableWrap: { overflowX: "auto", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px" },
  table: { width: "100%", tableLayout: "fixed", borderCollapse: "collapse", minWidth: "1100px" },
  th: { textAlign: "left", padding: "13px 14px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", color: "#475467", fontSize: "12px", fontWeight: 700 },
  headerSelect: { display: "block", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box", border: "none", outline: "none", background: "transparent", color: "#475467", fontSize: "12px", fontWeight: 700, cursor: "pointer", padding: 0, textOverflow: "ellipsis" },
  dateHeader: { display: "flex", alignItems: "center", justifyContent: "flex-start", gap: "7px", whiteSpace: "nowrap" },
  pagination: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", padding: "14px 4px" },
  pageInfo: { color: "#667085", fontSize: "13px" },
  pageControls: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" },
  pageButton: { border: "1px solid #d1d5db", borderRadius: "8px", background: "#fff", color: "#344054", padding: "7px 10px", fontSize: "13px", cursor: "pointer" },
  disabledButton: { opacity: 0.45, cursor: "not-allowed" },
  pageNumber: { color: "#344054", fontSize: "13px", padding: "0 5px" },
  td: { padding: "13px 14px", borderBottom: "1px solid #f0f2f5", color: "#344054", fontSize: "13px", verticalAlign: "middle" },
  deviceName: { fontWeight: 650, color: "#111827" },
  deviceId: { marginTop: "3px", color: "#98a2b3", fontSize: "10px", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis" },
  muted: { marginTop: "3px", color: "#98a2b3", fontSize: "11px" },
  badgeAllowed: { display: "inline-block", background: "#ecfdf3", color: "#027a48", padding: "5px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 700 },
  badgeWhite: { display: "inline-block", background: "#eff6ff", color: "#1d4ed8", padding: "5px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 700 },
  badgeBlocked: { display: "inline-block", background: "#fef2f2", color: "#b42318", padding: "5px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 700 },
  actions: { display: "flex", gap: "7px", flexWrap: "wrap" },
  allow: { border: "none", background: "#16a34a", color: "#fff", borderRadius: "7px", padding: "7px 10px", cursor: "pointer", fontSize: "11px" },
  block: { border: "none", background: "#dc2626", color: "#fff", borderRadius: "7px", padding: "7px 10px", cursor: "pointer", fontSize: "11px" },
  white: { border: "none", background: "#2563eb", color: "#fff", borderRadius: "7px", padding: "7px 10px", cursor: "pointer", fontSize: "11px" },
  empty: { padding: "40px", textAlign: "center", color: "#98a2b3" },
};
