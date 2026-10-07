import { useEffect, useMemo, useState } from "react";
import HRLayout from "../layouts/HRLayout";
import { supabase } from "../supabaseClient";
import { logCurrentUserAudit } from "../utils/auditlogger";

const API_URL = (import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "https://cibo-attendance-api.onrender.com" : "http://127.0.0.1:8000")).replace(/\/$/, "");

export default function DeviceManagement() {
  const [devices, setDevices] = useState([]);
  const [search, setSearch] = useState("");
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter((d) =>
      [d.device_name, d.device_id, d.device_type, d.employee_profiles?.full_name,
       d.employee_profiles?.email, d.branches?.branch_name]
        .filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [devices, search]);

  return (
    <HRLayout>
      <div style={styles.page}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Device Management</h1>
            <p style={styles.subtitle}>
              Control which devices can use the CIBO system. New normal web devices are allowed automatically; HR can block or whitelist them.
            </p>
          </div>
          <button onClick={loadDevices} style={styles.refresh}>Refresh</button>
        </div>

        <div style={styles.info}>
          <strong>How this works:</strong> You do not need to approve every device.
          A normal device is automatically registered as Allowed. Use Blocked for
          a device that must not access CIBO, and Whitelisted for a device that you
          explicitly trust, such as a company kiosk.
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.toolbar}>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search device, user, or branch..." style={styles.search} />
          <span style={styles.count}>{filtered.length} device(s)</span>
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead><tr>
              <th style={styles.th}>Device</th><th style={styles.th}>User</th>
              <th style={styles.th}>Branch</th><th style={styles.th}>Type</th>
              <th style={styles.th}>Status</th><th style={styles.th}>Last Seen</th>
              <th style={styles.th}>Action</th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={styles.empty}>Loading devices...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="7" style={styles.empty}>No registered devices yet.</td></tr>
              ) : filtered.map((device) => {
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
                    <span style={status === "BLOCKED" ? styles.badgeBlocked : status === "WHITELISTED" ? styles.badgeWhite : styles.badgeAllowed}>{status}</span>
                  </td>
                  <td style={styles.td}>{device.last_seen ? new Date(device.last_seen).toLocaleString() : "—"}</td>
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
      </div>
    </HRLayout>
  );
}

const styles = {
  page: { padding: "8px 4px 30px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px", marginBottom: "18px" },
  title: { margin: 0, color: "#111827", fontSize: "25px", fontWeight: 700 },
  subtitle: { margin: "7px 0 0", color: "#667085", fontSize: "13px", maxWidth: "760px", lineHeight: 1.5 },
  refresh: { border: "none", background: "#f97316", color: "#fff", borderRadius: "8px", padding: "10px 15px", cursor: "pointer", fontWeight: 600 },
  info: { background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", padding: "13px 15px", borderRadius: "10px", fontSize: "13px", lineHeight: 1.5, marginBottom: "18px" },
  error: { background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "12px 14px", borderRadius: "9px", marginBottom: "15px", fontSize: "13px" },
  toolbar: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "15px", marginBottom: "12px" },
  search: { width: "340px", maxWidth: "100%", padding: "11px 13px", border: "1px solid #d1d5db", borderRadius: "8px", outline: "none", background: "#fff" },
  count: { color: "#667085", fontSize: "13px" },
  tableWrap: { overflowX: "auto", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: "950px" },
  th: { textAlign: "left", padding: "13px 14px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", color: "#475467", fontSize: "12px", fontWeight: 700 },
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
