import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import ManagerLayout from "../layouts/ManagerLayout";

export default function ManagerDashboard() {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [search, setSearch] = useState("");

  const [total, setTotal] = useState(0);
  const [present, setPresent] = useState(0);
  const [absent, setAbsent] = useState(0);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const calculateHoursWorked = (timeInISO, timeOutISO) => {
    if (!timeInISO || !timeOutISO) return "-";

    const start = new Date(timeInISO);
    const end = new Date(timeOutISO);

    const diff = (end - start) / 1000 / 60;
    if (diff <= 0) return "-";

    const hours = Math.floor(diff / 60);
    const minutes = Math.floor(diff % 60);

    return `${hours}h ${minutes}m`;
  };

  const fetchDashboardData = async () => {
    const today = new Date().toISOString().split("T")[0];

    const { data: employees } = await supabase
      .from("employee_profiles")
      .select("id, full_name, position");

    const { data: attendance } = await supabase
      .from("attendance_logs")
      .select("*");

    const { data: leaves } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("status", "Approved");

    let result = [];
    let presentCount = 0;
    let absentCount = 0;

    (employees || []).forEach((emp) => {
      const attendanceToday = attendance?.find(
        (a) => a.employee_id === emp.id && a.log_date === today
      );

      const leaveToday = leaves?.find(
        (l) =>
          l.employee_id === emp.id &&
          today >= l.start_date &&
          today <= l.end_date
      );

      let status = "Absent";

      if (attendanceToday?.time_in) {
        status = "Present";
        presentCount++;
      } else if (leaveToday) {
        status = "On Leave";
      } else {
        absentCount++;
      }

      result.push({
        name: emp.full_name,
        position: emp.position || "-",

        time_in_raw: attendanceToday?.time_in || null,
        time_out_raw: attendanceToday?.time_out || null,

        time_in: attendanceToday?.time_in
          ? new Date(attendanceToday.time_in).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
              timeZone: "Asia/Manila",
            })
          : "-",

        time_out: attendanceToday?.time_out
          ? new Date(attendanceToday.time_out).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
              timeZone: "Asia/Manila",
            })
          : "-",

        face_url: attendanceToday?.face_url || null,

        status,
      });
    });

    setLogs(result);
    setFilteredLogs(result);
    setTotal(employees?.length || 0);
    setPresent(presentCount);
    setAbsent(absentCount);
  };

  const handleSearch = (value) => {
    setSearch(value);

    const filtered = logs.filter((log) =>
      (log.name || "").toLowerCase().includes(value.toLowerCase())
    );

    setFilteredLogs(filtered);
  };

  return (
    <ManagerLayout>
      <div style={styles.header}>
        <h2 style={styles.title}>Attendance Log</h2>
      </div>

      <div style={styles.cards}>
        <div style={styles.card}>
          <p style={styles.cardLabel}>Total Employees</p>
          <h2>{total}</h2>
        </div>

        <div style={styles.card}>
          <p style={styles.cardLabel}>Present</p>
          <h2 style={{ color: "#16a34a" }}>{present}</h2>
        </div>

        <div style={styles.card}>
          <p style={styles.cardLabel}>Absent</p>
          <h2 style={{ color: "#dc2626" }}>{absent}</h2>
        </div>
      </div>

      <div style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <div>
            <h3 style={styles.tableTitle}>Daily Attendance Report</h3>
            <p style={styles.dateText}>
              {new Date().toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          <div style={styles.searchWrapper}>
            <svg style={styles.searchIcon} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>

            <input
              type="text"
              placeholder="Search employee..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              style={styles.searchInput}
            />
          </div>
        </div>

        <div style={styles.tableWrapperScrollable}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Employee</th>
                <th style={styles.th}>Position</th>
                <th style={styles.th}>Time In</th>
                <th style={styles.th}>Time Out</th>
                <th style={styles.th}>Hours Worked</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>

            <tbody>
              {(filteredLogs || []).map((log, i) => (
                <tr key={i} style={styles.row}>
                  {/* 🔥 UPDATED EMPLOYEE CELL */}
                  <td style={styles.td}>{log.name}</td>

                  <td style={styles.td}>{log.position}</td>
                  <td style={styles.timeInCell}>
  {log.face_url && (
    <div
  style={styles.avatarWrapper}
  onMouseEnter={(e) => {
  const preview = e.currentTarget.querySelector(".preview");
  preview.style.opacity = 1;
  preview.querySelector("img").style.transform = "scale(1)";
}}
onMouseLeave={(e) => {
  const preview = e.currentTarget.querySelector(".preview");
  preview.style.opacity = 0;
  preview.querySelector("img").style.transform = "scale(0.95)";
}}
>
      <img
        src={log.face_url}
        alt="face"
        style={styles.timeAvatar}
      />

      {/* 🔥 HOVER PREVIEW */}
      <div style={styles.preview} className="preview">
        <img src={log.face_url} style={styles.previewImg} />
      </div>
    </div>
  )}

  <span>{log.time_in}</span>
</td>
                  <td style={styles.td}>{log.time_out}</td>

                  <td style={styles.td}>
                    {calculateHoursWorked(log.time_in_raw, log.time_out_raw)}
                  </td>

                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.badge,
                        background:
                          log.status === "Present"
                            ? "#dcfce7"
                            : log.status === "On Leave"
                            ? "#fef9c3"
                            : "#fee2e2",
                        color:
                          log.status === "Present"
                            ? "#166534"
                            : log.status === "On Leave"
                            ? "#92400e"
                            : "#991b1b",
                      }}
                    >
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ManagerLayout>
  );
}

const styles = {
  header: { marginBottom: "20px" },
  title: { margin: 0, fontWeight: "600", color: "#111827" },

  cards: { display: "flex", gap: "20px", marginBottom: "25px" },

  card: {
    flex: 1,
    background: "#fff",
    padding: "20px",
    borderRadius: "12px",
    border: "2px solid #e5e7eb",
  },

  cardLabel: { fontSize: "14px", color: "#374151" },

  tableCard: {
    background: "#fff",
    borderRadius: "12px",
    padding: "20px",
    border: "2px solid #e5e7eb",
  },

  tableHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "15px",
    paddingBottom: "10px",
    borderBottom: "2px solid #e5e7eb",
  },

  dateText: { fontSize: "14px", color: "#374151" },

  searchWrapper: { position: "relative", display: "flex", alignItems: "center" },

  searchIcon: {
    position: "absolute",
    left: "10px",
    width: "16px",
    height: "16px",
    color: "#111827",
  },

  searchInput: {
    padding: "8px 12px 8px 32px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#111827",
  },

  tableWrapper: { width: "100%", overflowX: "auto" },

  table: { width: "100%", borderCollapse: "collapse" },

  th: {
    textAlign: "left",
    padding: "12px",
    background: "#f9fafb",
    borderBottom: "1px solid #e5e7eb",
  },

  td: {
    padding: "12px",
    borderBottom: "1px solid #f1f5f9",
    color: "#111827",
  },

  employeeCell: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },

  avatar: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    objectFit: "cover",
  },

  row: { transition: "0.2s" },

  badge: {
    padding: "6px 12px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "600",
  },

  tableTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "600",
    color: "#111827",
  },
  timeInCell: {
  display: "flex",
  alignItems: "center",
  gap: "10px",
},

avatarWrapper: {
  position: "relative",
  display: "inline-block",
},

timeAvatar: {
  width: "32px",
  height: "32px",
  borderRadius: "50%",
  objectFit: "cover",
  border: "2px solid #e5e7eb",
  cursor: "pointer",
},

/* 🔥 HOVER PREVIEW BOX */
preview: {
  position: "absolute",
  bottom: "45px",        // 🔥 moves it ABOVE
  left: "50%",
  transform: "translateX(-50%)", // 🔥 center align

  zIndex: 10,

  opacity: 0,
  pointerEvents: "none",
  transition: "0.2s ease",

  background: "#fff",
  padding: "6px",
  borderRadius: "10px",
  boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
},
previewImg: {
  width: "120px",
  height: "120px",
  objectFit: "cover",
  borderRadius: "8px",
  transform: "scale(0.95)",
  transition: "0.2s",
},
tableWrapperScrollable: {
  width: "100%",
  maxHeight: "350px",   // 🔥 adjust height as you like
  overflowY: "auto",    // 🔥 enables vertical scroll
},
};