import { useEffect, useState } from "react";
import HRLayout from "../layouts/HRLayout";
import { supabase } from "../supabaseClient";
import { logAudit } from "../utils/auditLogger";

const searchPlaceholderStyle = `
.searchInput::placeholder {
  color: #666;
}
`;
export default function HRAuditTrail() {
  const [logs, setLogs] = useState([]);
const [loading, setLoading] = useState(true);
const [search, setSearch] = useState("");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) {
      setLogs(data || []);
    }

    setLoading(false);
  };

  return (
    <HRLayout>
      <div style={styles.container}>
        <h1 style={styles.title}>
          HR Audit Trail
        </h1>

        <p style={styles.subtitle}>
          Monitor employee attendance activities,
          corrections, and system actions.
        </p>

        <input
  placeholder="Search audit logs..."
  className="searchInput"
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  style={styles.search}
/>

        <div style={styles.card}>
          <div style={styles.headerRow}>
            <div style={styles.headerCell}>User</div>
            <div style={styles.headerCell}>Role</div>
            <div style={styles.headerCell}>Action</div>
            <div style={styles.headerCell}>Description</div>
            <div style={styles.headerCell}>Date</div>
          </div>

          {loading ? (
            <div style={styles.empty}>
              Loading audit logs...
            </div>
          ) : logs.length === 0 ? (
            <div style={styles.empty}>
              No audit logs available yet.
            </div>
          ) : (
            logs
  .filter((log) =>
    (
      (log.user_name || "") +
      (log.action || "") +
      (log.description || "")
    )
      .toLowerCase()
      .includes(search.toLowerCase())
  )
  .map((log) => (
              <div key={log.id} style={styles.row}>
                <div style={styles.cell}>
                  {log.user_name || "Unknown"}
                </div>

                <div style={styles.cell}>
                  <span style={styles.roleBadge}>
                    {log.role}
                  </span>
                </div>

                <div style={styles.cell}>
                  {log.action}
                </div>

                <div style={styles.cell}>
                  {log.description}
                </div>

                <div style={styles.cell}>
                  {new Date(
                    log.created_at
                  ).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </HRLayout>
  );
}

const styles = {
  container: {
    padding: "10px",
  },

  title: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#111827",
    marginBottom: "8px",
  },

  subtitle: {
    color: "#6b7280",
    marginBottom: "25px",
  },

  card: {
    background: "#fff",
    borderRadius: "14px",
    border: "1px solid #e5e7eb",
    overflow: "hidden",
  },

  headerRow: {
    display: "grid",
    gridTemplateColumns:
      "1fr 120px 160px 2fr 220px",
    background: "#f9fafb",
    borderBottom: "1px solid #e5e7eb",
    padding: "16px",
    fontWeight: "600",
    color: "#111827",
  },

  row: {
    display: "grid",
    gridTemplateColumns:
      "1fr 120px 160px 2fr 220px",
    padding: "16px",
    borderBottom: "1px solid #f3f4f6",
    alignItems: "center",
  },

  headerCell: {
    fontSize: "14px",
  },

  cell: {
    fontSize: "14px",
    color: "#374151",
    wordBreak: "break-word",
  },

  roleBadge: {
    background: "#f97316",
    color: "#fff",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "600",
  },

  empty: {
    padding: "40px",
    textAlign: "center",
    color: "#6b7280",
  },
  search: {
  width: "300px",
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid #d1d5db",
  marginBottom: "15px",
  fontSize: "14px",
  backgroundColor: "#ffffff",
  color: "#000000",
  outline: "none",
},
};