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
const formatTime = (time) => {
  if (!time || time === "-") return "-";

  const [h, m] = time.split(":");
  let hour = parseInt(h);

  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;

  return `${hour}:${m} ${ampm}`;
};

const calculateHoursWorked = (timeIn, timeOut) => {
  if (!timeIn || !timeOut || timeIn === "-" || timeOut === "-") {
    return "-";
  }

  const [h1, m1] = timeIn.split(":");
  const [h2, m2] = timeOut.split(":");

  const start = parseInt(h1) * 60 + parseInt(m1);
  const end = parseInt(h2) * 60 + parseInt(m2);

  const diff = end - start;

  if (diff <= 0 || isNaN(diff)) return "-";

  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;

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

  status,
});
    });

    setLogs(result);
    setFilteredLogs(result); // 🔥 important for search
    setTotal(employees?.length || 0);
    setPresent(presentCount);
    setAbsent(absentCount);
  };

  // 🔍 SAFE SEARCH
  const handleSearch = (value) => {
    setSearch(value);

    const filtered = logs.filter((log) =>
      (log.name || "").toLowerCase().includes(value.toLowerCase())
    );

    setFilteredLogs(filtered);
  };

  return (
    <ManagerLayout>
      {/* HEADER */}
      <div style={styles.header}>
        <h2 style={styles.title}>Attendance Log</h2>
      </div>

      {/* CARDS */}
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

      {/* TABLE CARD */}
      <div style={styles.tableCard}>
        {/* TOP BAR (DATE + SEARCH ONLY) */}
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
    <svg
      xmlns="http://www.w3.org/2000/svg"
      style={styles.searchIcon}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-4.35-4.35m1.85-5.65a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z"
      />
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

        {/* TABLE */}
        <div style={styles.tableWrapper}>
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
                  <td style={styles.td}>{log.name}</td>
                  <td style={styles.td}>{log.position}</td>
                  <td style={styles.td}>{log.time_in}</td>
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
  header: {
    marginBottom: "20px",
  },

  title: {
    margin: 0,
    fontWeight: "600",
    color: "#111827",
  },

  cards: {
    display: "flex",
    gap: "20px",
    marginBottom: "25px",
  },

  card: {
    flex: 1,
    background: "#fff",
    padding: "20px",
    borderRadius: "12px",
    border: "2px solid #e5e7eb",
  },

  cardLabel: {
    fontSize: "14px",
    color: "#374151",
  },

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
  borderBottom: "2px solid #e5e7eb", // 🔥 ADD THIS
},

  dateText: {
    fontSize: "14px",
    color: "#374151",
  },

  searchWrapper: {
  position: "relative",
  display: "flex",
  alignItems: "center",
},

searchIcon: {
  position: "absolute",
  left: "10px",
  width: "16px",
  height: "16px",
  color: "#111827", // 🔥 BLACK icon
},

searchInput: {
  padding: "8px 12px 8px 32px",
  borderRadius: "8px",
  border: "1px solid #e5e7eb",
  outline: "none",
  background: "#ffffff",
  color: "#111827", // 🔥 BLACK text
  fontSize: "14px",
},

  tableWrapper: {
    width: "100%",
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  th: {
    textAlign: "left",
    padding: "12px",
    background: "#f9fafb",
    fontWeight: "600",
    color: "#111827",
    borderBottom: "1px solid #e5e7eb",
  },

  td: {
    padding: "12px",
    borderBottom: "1px solid #f1f5f9",
    color: "#111827",
  },

  row: {
    transition: "0.2s",
  },

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
};