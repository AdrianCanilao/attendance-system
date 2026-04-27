import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import ManagerLayout from "../layouts/ManagerLayout";

export default function ManagerDashboard() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [present, setPresent] = useState(0);
  const [absent, setAbsent] = useState(0);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const today = new Date().toISOString().split("T")[0];

    const { data: attendance, error: attendanceError } = await supabase
      .from("attendance_logs")
      .select("log_date, time_in, time_out, employee_id");

    if (attendanceError) {
      console.log("attendance error:", attendanceError);
      return;
    }

    const { data: leaves, error: leaveError } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("status", "Approved");

    if (leaveError) {
      console.log("leave error:", leaveError);
      return;
    }

    const { data: employees, error: employeeError } = await supabase
      .from("employee_profiles")
      .select("id, full_name");

    if (employeeError) {
      console.log("employee error:", employeeError);
      return;
    }

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
        date: today,
        time_in: attendanceToday?.time_in || "-",
        time_out: attendanceToday?.time_out || "-",
        status,
      });
    });

    setLogs(result);
    setTotal(employees?.length || 0);
    setPresent(presentCount);
    setAbsent(absentCount);
  };

  return (
    <ManagerLayout>
      <div style={styles.cards}>
        <div style={styles.card}>
          <p>Total Employees</p>
          <h2>{total}</h2>
        </div>

        <div style={styles.card}>
          <p>Present</p>
          <h2 style={{ color: "green" }}>{present}</h2>
        </div>

        <div style={styles.card}>
          <p>Absent</p>
          <h2 style={{ color: "red" }}>{absent}</h2>
        </div>
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Name</th>
            <th style={styles.th}>Date</th>
            <th style={styles.th}>Time In</th>
            <th style={styles.th}>Time Out</th>
            <th style={styles.th}>Status</th>
          </tr>
        </thead>

        <tbody>
          {logs.map((log, i) => (
            <tr key={i}>
              <td style={styles.td}>{log.name}</td>
              <td style={styles.td}>{log.date}</td>
              <td style={styles.td}>{log.time_in}</td>
              <td style={styles.td}>{log.time_out}</td>
              <td
                style={{
                  ...styles.td,
                  fontWeight: "bold",
                  color:
                    log.status === "Present"
                      ? "green"
                      : log.status === "On Leave"
                      ? "orange"
                      : "red",
                }}
              >
                {log.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ManagerLayout>
  );
}

const styles = {
  cards: {
    display: "flex",
    gap: "20px",
    marginBottom: "20px",
  },
  card: {
    flex: 1,
    background: "#fff",
    padding: "20px",
    borderRadius: "10px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    background: "#fff",
    borderRadius: "10px",
    overflow: "hidden",
  },
  th: {
    background: "#f97316",
    color: "#fff",
    padding: "10px",
  },
  td: {
    padding: "10px",
    borderBottom: "1px solid #eee",
  },
};