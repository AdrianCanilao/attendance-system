import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import ManagerLayout from "../layouts/ManagerLayout";
import EmployeeLayout from "../layouts/EmployeeLayout";
import { FaUser } from "react-icons/fa";
import { useLocation } from "react-router-dom";

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [stats, setStats] = useState({
    timeIn: 0,
    timeOut: 0,
  });
  const [attendanceLogs, setAttendanceLogs] = useState([]);

  const [today] = useState(new Date());

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;

    if (!user) return;

    // ✅ GET USER ROLE
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    setRole(roleData?.role);

    // ✅ GET EMPLOYEE PROFILE
    const { data: emp, error } = await supabase
      .from("employee_profiles")
      .select("*")
      .eq("email", user.email)
      .single();

    console.log("EMPLOYEE PROFILE:", emp);

    if (error || !emp) return;

    // ✅ SAVE PROFILE
    setProfile({
      ...emp,
      avatar:
        emp?.face_url ||
        emp?.photo_url ||
        emp?.image ||
        emp?.avatar ||
        "",
    });

    // ✅ SET IMAGE URL
    if (
      emp?.face_url &&
      emp.face_url !== "" &&
      emp.face_url !== null
    ) {
      setImageUrl(emp.face_url);
    } else if (
      emp?.photo_url &&
      emp.photo_url !== "" &&
      emp.photo_url !== null
    ) {
      setImageUrl(emp.photo_url);
    } else if (
      emp?.image &&
      emp.image !== "" &&
      emp.image !== null
    ) {
      setImageUrl(emp.image);
    } else if (
      emp?.avatar &&
      emp.avatar !== "" &&
      emp.avatar !== null
    ) {
      setImageUrl(emp.avatar);
    } else {
      // fallback image
      setImageUrl(
        "https://cdn-icons-png.flaticon.com/512/149/149071.png"
      );
    }

    // ✅ FETCH ATTENDANCE STATS
    const safeName = emp.full_name
      ?.toLowerCase()
      .replace(/\s+/g, "_");

    fetchAttendanceStats(safeName);
    const { data: logs } = await supabase
  .from("attendance_logs")
  .select("*")
  .eq("employee_id", emp.id)
  .order("created_at", { ascending: false });

setAttendanceLogs(logs || []);
  };

  const fetchAttendanceStats = async (safeName) => {
    const { data: timeInFiles } = await supabase.storage
      .from("faces")
      .list(`attendance/${safeName}/time_in`);

    const { data: timeOutFiles } = await supabase.storage
      .from("faces")
      .list(`attendance/${safeName}/time_out`);

    setStats({
      timeIn: timeInFiles?.length || 0,
      timeOut: timeOutFiles?.length || 0,
    });
  };
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

  const generateCalendar = () => {
    const date = new Date();

    const year = date.getFullYear();
    const month = date.getMonth();

    const firstDay = new Date(year, month, 1).getDay();

    const daysInMonth = new Date(
      year,
      month + 1,
      0
    ).getDate();

    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  };

  const calendarDays = generateCalendar();

  const location = useLocation();

  const Layout = location.pathname.startsWith("/manager")
    ? ManagerLayout
    : EmployeeLayout;

  return (
    <Layout>
      <div style={styles.container}>
        <h1 style={styles.pageTitle}>Profile</h1>

        <div style={styles.grid}>
          {/* PROFILE CARD */}
          <div style={styles.card}>
            <div style={styles.newProfileContent}>
              <div style={styles.newAvatarWrapper}>
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="avatar"
                    style={styles.newAvatar}
                  />
                ) : (
                  <div style={styles.avatarFallback}>
                    <FaUser size={60} />
                  </div>
                )}
              </div>

              <div style={styles.newProfileInfoContainer}>
                <div style={styles.headerRow}>
                  <h1 style={styles.profileName}>
                    {profile?.full_name || "Employee Name"}
                  </h1>
                </div>

                <div style={styles.infoBody}>
                  <div style={styles.infoTwoColumnRow}>
                    <div style={styles.infoItem}>
                      <span style={styles.label}>Role: </span>

                      <span style={styles.value}>
                        {role || "Staff"}
                      </span>
                    </div>

                    <div style={styles.infoItem}>
                      <span style={styles.label}>
                        Position:
                      </span>

                      <span style={styles.value}>
                        {profile?.position ||
                          "Position TBD"}
                      </span>
                    </div>
                  </div>

                  <div style={styles.infoItem}>
                    <span style={styles.label}>
                      E-mail:
                    </span>

                    <span style={styles.value}>
                      {profile?.email ||
                        "email@example.com"}
                    </span>
                  </div>

                  <div style={styles.infoItem}>
                    <span style={styles.label}>
                      Phone:
                    </span>

                    <span style={styles.value}>
                      {profile?.contact_number ||
                        "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CALENDAR */}
          <div style={styles.calendarCard}>
            <h4 style={styles.calendarTitle}>
              {today.toLocaleString("default", {
                month: "long",
              })}{" "}
              {today.getFullYear()}
            </h4>

            <div style={styles.calendarGrid}>
              {[
                "Sun",
                "Mon",
                "Tue",
                "Wed",
                "Thu",
                "Fri",
                "Sat",
              ].map((d) => (
                <div key={d} style={styles.dayHeader}>
                  {d}
                </div>
              ))}

              {calendarDays.map((day, i) => (
                <div
                  key={i}
                  style={{
                    ...styles.day,
                    ...(day === today.getDate()
                      ? styles.today
                      : {}),
                  }}
                >
                  {day || ""}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
  style={{
    ...styles.statCard,
    minHeight: "calc(100vh - 420px)",
    display: "flex",
    flexDirection: "column",
  }}
>
          <h2
            style={{
              fontSize: "20px",
              fontWeight: "700",
              marginBottom: "16px",
              color: "#111827",
            }}
          >
            Attendance Summary
          </h2>

          <div style={{ overflowX: "auto" }}>
  <table
    style={{
      width: "100%",
      borderCollapse: "collapse",
      tableLayout: "fixed",
    }}
  >
    <thead>
      <tr
        style={{
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        {[
          "Date",
  "Time In",
  "Time Out",
  "Late",
  "Overtime",
  "Hours Worked",
  "Status",
        ].map((header) => (
          <th
            key={header}
            style={{
              padding: "14px",
              textAlign: "center",
              fontWeight: "700",
              fontSize: "16px",
              color: "#111827",
            }}
          >
            {header}
          </th>
        ))}
      </tr>
    </thead>

    <tbody>
      {(attendanceLogs || []).slice(0, 5).map((log, index) => (
        <tr
          key={index}
          style={{
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          {/* DATE */}
<td
  style={{
    padding: "16px",
    textAlign: "center",
    verticalAlign: "middle",
  }}
>
  {log.time_in
    ? new Date(log.time_in).toLocaleDateString(
        "en-US",
        {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "Asia/Manila",
        }
      )
    : "-"}
</td>
          {/* TIME IN */}
          <td
            style={{
              padding: "16px",
              textAlign: "center",
              verticalAlign: "middle",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
              }}
            >
              {log.time_in_face_url && (
                <img
                  src={log.time_in_face_url}
                  alt="Time In"
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "50%",
                    objectFit: "cover",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform =
                      "scale(2.8)";
                    e.currentTarget.style.zIndex = "999";
                    e.currentTarget.style.position =
                      "relative";
                    e.currentTarget.style.boxShadow =
                      "0 8px 20px rgba(0,0,0,0.25)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform =
                      "scale(1)";
                    e.currentTarget.style.zIndex = "1";
                    e.currentTarget.style.boxShadow =
                      "none";
                  }}
                />
              )}

              <span>
                {log.time_in
                  ? new Date(
                      log.time_in
                    ).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                      timeZone: "Asia/Manila",
                    })
                  : "-"}
              </span>
            </div>
          </td>

          {/* TIME OUT */}
          <td
            style={{
              padding: "16px",
              textAlign: "center",
              verticalAlign: "middle",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
              }}
            >
              {log.time_out_face_url && (
                <img
                  src={log.time_out_face_url}
                  alt="Time Out"
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "50%",
                    objectFit: "cover",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform =
                      "scale(2.8)";
                    e.currentTarget.style.zIndex = "999";
                    e.currentTarget.style.position =
                      "relative";
                    e.currentTarget.style.boxShadow =
                      "0 8px 20px rgba(0,0,0,0.25)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform =
                      "scale(1)";
                    e.currentTarget.style.zIndex = "1";
                    e.currentTarget.style.boxShadow =
                      "none";
                  }}
                />
              )}

              <span>
                {log.time_out
                  ? new Date(
                      log.time_out
                    ).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                      timeZone: "Asia/Manila",
                    })
                  : "-"}
              </span>
            </div>
          </td>

          {/* LATE */}
          <td
            style={{
              padding: "16px",
              textAlign: "center",
            }}
          >
            {log.late_minutes
              ? `${log.late_minutes}m`
              : "-"}
          </td>

          {/* OVERTIME */}
          <td
            style={{
              padding: "16px",
              textAlign: "center",
            }}
          >
            {log.overtime_minutes
              ? `${log.overtime_minutes}m`
              : "-"}
          </td>

          {/* HOURS WORKED */}
          <td
            style={{
              padding: "16px",
              textAlign: "center",
            }}
          >
            {calculateHoursWorked(
              log.time_in,
              log.time_out
            )}
          </td>

          {/* STATUS */}
          <td
            style={{
              padding: "16px",
              textAlign: "center",
            }}
          >
            <span
              style={{
                padding: "6px 14px",
                borderRadius: "999px",
                fontSize: "12px",
                fontWeight: "600",
                background:
                  log.status === "Absent"
                    ? "#fee2e2"
                    : log.status === "Late"
                    ? "#fef3c7"
                    : "#dcfce7",

                color:
                  log.status === "Absent"
                    ? "#b91c1c"
                    : log.status === "Late"
                    ? "#92400e"
                    : "#166534",
              }}
            >
              {log.status || "Present"}
            </span>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
        </div>
      </div>
    </Layout>
  );
}

const styles = {
  container: {
    padding: "16px 24px",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1.8fr 1fr",
    gap: "20px",
    alignItems: "stretch",
    marginBottom: "16px",
  },

  card: {
    background: "#ffffff",
    padding: "16px 24px",
    borderRadius: "12px",
    border: "2px solid #e5e7eb",
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
    display: "flex",
    alignItems: "center",
  },

  newProfileContent: {
    display: "flex",
    gap: "30px",
    alignItems: "center",
    flex: 1,
  },

  newAvatarWrapper: {
    width: "180px",
    height: "180px",
    flexShrink: 0,
  },

  newAvatar: {
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    objectFit: "cover", 
  },

  avatarFallback: {
    width: "180px",
    height: "180px",
    borderRadius: "50%",
    background: "#f3f4f6",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#9ca3af",
  },

  newProfileInfoContainer: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    gap: "8px",
  },

  headerRow: {
    display: "flex",
    alignItems: "center",
    marginBottom: "4px",
  },

  profileName: {
    margin: 0,
    fontSize: "24px",
    fontWeight: "700",
    color: "#111827",
  },

  infoBody: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },

  infoTwoColumnRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
  },

  infoItem: {
    fontSize: "14px",
  },

  label: {
    color: "#6b7280",
    marginRight: "4px",
  },

  value: {
    color: "#374151",
    fontWeight: "600",
  },

  calendarCard: {
    background: "#fff",
    padding: "12px 16px",
    borderRadius: "12px",
    border: "2px solid #e5e7eb",
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },

  calendarTitle: {
    margin: "0 0 8px 0",
    fontSize: "14px",
    textAlign: "center",
    fontWeight: "600",
  },

  calendarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: "2px",
    textAlign: "center",
  },

  dayHeader: {
    fontWeight: "600",
    fontSize: "11px",
    color: "#9ca3af",
    paddingBottom: "4px",
  },

  day: {
    padding: "4px",
    fontSize: "11px",
    borderRadius: "4px",
  },

  today: {
    background: "#f97316",
    color: "#fff",
    fontWeight: "bold",
  },

  statsContainer: {
    display: "flex",
    gap: "20px",
  },

  statCard: {
    flex: 1,
    background: "#fff",
    padding: "16px",
    borderRadius: "12px",
    border: "2px solid #e5e7eb",
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
    textAlign: "center",
  },

  statVal: {
    fontSize: "24px",
    margin: "0 0 4px 0",
    fontWeight: "700",
  },

  statLabel: {
    fontSize: "14px",
    margin: 0,
    color: "#6b7280",
  },

  pageTitle: {
    fontSize: "25px",
    fontWeight: "650",
    color: "#111827",
    margin: "0 0 20px 0",
  },
};