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
  const [hoveredImage, setHoveredImage] = useState(null);

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

  const calculateLate = (timeInISO, shiftIn) => {
  if (!timeInISO || !shiftIn) return "-";

  const actual = new Date(timeInISO);

  const [hours, minutes] = shiftIn.split(":");

  const shift = new Date(timeInISO);

  // ✅ add 10 minute allowance
  shift.setHours(parseInt(hours));
  shift.setMinutes(parseInt(minutes) + 10);
  shift.setSeconds(0);

  // ✅ not late
  if (actual <= shift) return "0m";

  const diff = Math.floor((actual - shift) / 60000);

  const hrs = Math.floor(diff / 60);
  const mins = diff % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }

  return `${mins}m`;
};

 const calculateOvertime = (timeOutISO, shiftOut) => {
  if (!timeOutISO || !shiftOut) return "-";

  const actual = new Date(timeOutISO);

  const [hours, minutes] = shiftOut.split(":");

  const shift = new Date(timeOutISO);

  shift.setHours(parseInt(hours));
  shift.setMinutes(parseInt(minutes));
  shift.setSeconds(0);

  // ✅ no overtime
  if (actual <= shift) return "0m";

  const diff = Math.floor((actual - shift) / 60000);

  const hrs = Math.floor(diff / 60);
  const mins = diff % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }

  return `${mins}m`;
};

  const fetchDashboardData = async () => {
    const today = new Date().toISOString().split("T")[0];

    const { data: employees } = await supabase
      .from("employee_profiles")
      .select(
        "id, full_name, position, clock_in, clock_out"
      );

    const { data: attendance } = await supabase
      .from("attendance_logs")
      .select("*");

    const { data: leaves } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("status", "Approved");
      const {
  data: corrections,
  error: correctionError,
} = await supabase
  .from("attendance_corrections")
  .select("*");

if (correctionError) {
  console.log(correctionError);
}

    let result = [];
    let presentCount = 0;
    let absentCount = 0;

    (employees || []).forEach((emp) => {
      const attendanceToday = attendance?.find(
        (a) =>
          a.employee_id === emp.id &&
          a.log_date === today
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
          ? new Date(attendanceToday.time_in).toLocaleTimeString(
              "en-US",
              {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
                timeZone: "Asia/Manila",
              }
            )
          : "-",

        time_out: attendanceToday?.time_out
          ? new Date(attendanceToday.time_out).toLocaleTimeString(
              "en-US",
              {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
                timeZone: "Asia/Manila",
              }
            )
          : "-",

        late: calculateLate(
          attendanceToday?.time_in,
          emp.clock_in
        ),

        overtime: calculateOvertime(
          attendanceToday?.time_out,
          emp.clock_out
        ),

        time_in_face_url:attendanceToday?.time_in_face_url || null,

        time_out_face_url:attendanceToday?.time_out_face_url || null,

        status,

correction:
  corrections?.find(
    (c) => c.employee_id === emp.id
  ) || null,
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
      (log.name || "")
        .toLowerCase()
        .includes(value.toLowerCase())
    );

    setFilteredLogs(filtered);
  };

  return (
    <ManagerLayout>
      <div style={styles.header}>
        <h2 style={styles.pageTitle}>Attendance Log</h2>
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
            <h3 style={styles.tableTitle}>
              Daily Attendance Report
            </h3>

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
              style={styles.searchIcon}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              fill="none"
            >
              <circle cx="11" cy="11" r="8" />
              <line
                x1="21"
                y1="21"
                x2="16.65"
                y2="16.65"
              />
            </svg>

            <input
              type="text"
              placeholder="Search employee..."
              value={search}
              onChange={(e) =>
                handleSearch(e.target.value)
              }
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
                <th style={styles.th}>Late</th>
                <th style={styles.th}>Overtime</th>
                <th style={styles.th}>Hours Worked</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Correction</th>
              </tr>
            </thead>

            <tbody>
              {(filteredLogs || []).map((log, i) => (
                <tr key={i} style={styles.row}>
                  <td style={styles.td}>{log.name}</td>

                  <td style={styles.td}>
                    {log.position}
                  </td>

                  <td style={styles.td}>
                    <div style={styles.timeContainer}>
                      {log.time_in_face_url && (
                        <img
                          src={log.time_in_face_url}
                          alt="Time In"
                          onMouseEnter={() => setHoveredImage(`in-${i}`)}
                          onMouseLeave={() => setHoveredImage(null)}
                          style={{
                            ...styles.timeAvatar,
                            ...(hoveredImage === `in-${i}`
                              ? styles.timeAvatarHover
                              : {}),
                          }}
                        />
                      )}

                      <span>{log.time_in}</span>
                    </div>
                  </td>

                  <td style={styles.td}>
                    <div style={styles.timeContainer}>
                      {log.time_out_face_url && (
                        <img
                          src={log.time_out_face_url}
                          alt="Time Out"
                          onMouseEnter={() => setHoveredImage(`out-${i}`)}
                          onMouseLeave={() => setHoveredImage(null)}
                          style={{
                            ...styles.timeAvatar,
                            ...(hoveredImage === `out-${i}`
                              ? styles.timeAvatarHover
                              : {}),
                          }}
                        />
                      )}

                      <span>{log.time_out}</span>
                    </div>
                  </td>

                  <td style={styles.td}>
                    {log.late}
                  </td>

                  <td style={styles.td}>
                    {log.overtime}
                  </td>

                  <td style={styles.td}>
                    {calculateHoursWorked(
                      log.time_in_raw,
                      log.time_out_raw
                    )}
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
                  <td style={styles.td}>
  {log.correction ? (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <span
        style={{
          fontSize: "13px",
          color: "#374151",
          maxWidth: "220px",
          wordBreak: "break-word",
        }}
      >
        {log.correction.concern}
      </span>

      {log.correction.attachment_url && (
        <a
          href={log.correction.attachment_url}
          target="_blank"
          rel="noreferrer"
          style={{
            background: "#f97316",
            color: "#fff",
            padding: "6px 10px",
            borderRadius: "8px",
            textDecoration: "none",
            fontSize: "12px",
            fontWeight: "600",
            width: "fit-content",
          }}
        >
          View Attachment
        </a>
      )}
    </div>
  ) : (
    "-"
  )}
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

    minHeight: "calc(100vh - 220px)",
    display: "flex",
    flexDirection: "column",
  },

  tableHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "15px",
    paddingBottom: "10px",
    borderBottom: "2px solid #e5e7eb",
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
    color: "#111827",
  },

  searchInput: {
    padding: "8px 12px 8px 32px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#111827",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

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


  avatarWrapper: {
    position: "relative",
    display: "inline-block",
  },

    timeContainer: {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  minHeight: "40px",
  },
  timeAvatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    objectFit: "cover",
    border: "2px solid #e5e7eb",
    cursor: "pointer",
    transition: "0.25s ease",
  },

  timeAvatarHover: {
    transform: "scale(4)",
    borderRadius: "12px",
    zIndex: 9999,
    position: "relative",
    boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
  },

  tableWrapperScrollable: {
    width: "100%",
    flex: 1,
    overflowY: "auto",
  },
    pageTitle: {
      fontSize: "25px",
      fontWeight: "650",
      color: "#111827",
      margin: "0 0 20px 0",
      padding: 0,
      letterSpacing: "-0.3px",
      lineHeight: "1.2",
  },
};