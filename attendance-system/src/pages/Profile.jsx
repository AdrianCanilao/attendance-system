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

        {/* STATS */}
        <div style={styles.statsContainer}>
          <div style={styles.statCard}>
            <h2 style={styles.statVal}>
              {stats.timeIn}
            </h2>

            <p style={styles.statLabel}>
              Time In Records
            </p>
          </div>

          <div style={styles.statCard}>
            <h2 style={styles.statVal}>
              {stats.timeOut}
            </h2>

            <p style={styles.statLabel}>
              Time Out Records
            </p>
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