import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { logCurrentUserAudit } from "../utils/auditlogger";
import { FaBell } from "react-icons/fa";
import Sidebar from "../components/Sidebar";

export default function ManagerLayout({ children }) {
  const navigate = useNavigate();

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const notificationRef = useRef(null);

  const [branchName, setBranchName] = useState("");

  const handleLogout = async () => {
    await logCurrentUserAudit({
      action: "LOGOUT",
      description: "User logged out of the system",
      role: "manager",
    });

    await supabase.auth.signOut();
    localStorage.removeItem("role");
    sessionStorage.removeItem("role");
    navigate("/");
  };

  // FETCH BRANCH NAME
  useEffect(() => {
    fetchBranch();
    fetchNotifications();

    // Keep the notification bell current without requiring a page reload.
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Refresh immediately whenever the notification dropdown is opened.
  useEffect(() => {
    if (showNotifications) fetchNotifications();
  }, [showNotifications]);

  // Subscribe to Supabase Realtime so new leave notifications appear
  // immediately instead of waiting for the 30-second refresh interval.
  useEffect(() => {
    let channel;

    const subscribeToNotifications = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      if (!user) return;

      channel = supabase
        .channel(`manager-notifications-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchNotifications();
          }
        )
        .subscribe();
    };

    subscribeToNotifications();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const fetchBranch = async () => {
    const email = localStorage.getItem("email");

    if (!email) return;

    const { data, error } = await supabase
      .from("employee_profiles")
      .select(`
        branch_id,
        branches (
          branch_name
        )
      `)
      .eq("email", email)
      .single();

    if (!error && data?.branches?.branch_name) {
      setBranchName(data.branches.branch_name);
    }
  };

  // CLOSE NOTIFICATION WHEN CLICK OUTSIDE
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  // NOTIFICATIONS
  const fetchNotifications = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;

    if (!user) {
      setNotifications([]);
      return;
    }

    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, title, message, created_at, read_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error) {
      setNotifications(data || []);
    }
  };

  const markNotificationsRead = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return;

    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);

    await fetchNotifications();
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="cibo-layout" style={styles.container}>
      {/* SIDEBAR */}
      <Sidebar role="maintenance" />

      {/* MAIN */}
      <div className="cibo-main" style={styles.main}>
        {/* TOPBAR */}
        <div className="cibo-topbar" style={styles.topbar}>
          <h3 className="cibo-topbar-title" style={{ margin: 0 }}>
            Maintenance Specialist Dashboard
            {branchName && ` - ${branchName}`}
          </h3>

          <div style={styles.topRight}>
            {/* NOTIFICATION */}
            <div
              className="cibo-notification-wrapper"
              style={styles.notificationWrapper}
              ref={notificationRef}
            >
              <div
                style={styles.bellContainer}
                onClick={() =>
                  setShowNotifications(
                    !showNotifications
                  )
                }
              >
                <FaBell
                  size={18}
                  style={{
                    cursor: "pointer",
                  }}
                />

                {/* RED DOT */}
                {unreadCount > 0 && <div style={styles.redDot}></div>}
              </div>

              {/* DROPDOWN */}
              {showNotifications && (
                <div className="cibo-notification-dropdown" style={styles.notificationDropdown}>
                  <div style={styles.notificationHeader}>
                    <h4 style={styles.notificationTitle}>
                      Notifications
                    </h4>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markNotificationsRead}
                        style={styles.markReadButton}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div style={styles.notificationItem}>
                      No new notifications.
                    </div>
                  ) : notifications.map(
                    (notif, index) => (
                      <div
                        key={notif.id || index}
                        style={{
                          ...styles.notificationItem,

                          background:
                            notif.level ===
                            "critical"
                              ? "#fee2e2"
                              : notif.level ===
                                "urgent"
                              ? "#fef3c7"
                              : notif.level ===
                                "warning"
                              ? "#fff7ed"
                              : "#f9fafb",
                        }}
                      >
                        <div style={styles.notificationItemTitle}>{notif.title || "Notification"}</div>
                        <div>{notif.message}</div>
                        <div style={styles.notificationTime}>{new Date(notif.created_at).toLocaleString()}</div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {/* PROFILE */}
            <div className="cibo-top-profile" style={styles.profile}>
              <div style={styles.avatar}>M</div>

              <div>
                <p
                  style={{
                    margin: 0,
                    fontWeight: "600",
                  }}
                >
                  M.S.
                </p>
              </div>
            </div>

            {/* LOGOUT */}
            <button
              onClick={handleLogout}
              style={styles.logout}
            >
              Logout
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="cibo-content" style={styles.content}>
          {children}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    height: "100vh",
    width: "100%",
  },

  main: {
    flex: 1,
    background: "#f9fafb",
    display: "flex",
    flexDirection: "column",
  },

  topbar: {
    height: "76px",
    minHeight: "76px",
    background: "#ffffff",
    borderBottom: "2px solid #f97316",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 28px",
    boxSizing: "border-box",
  },

  topRight: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
  },

  notificationWrapper: {
    position: "relative",
  },

  bellContainer: {
    position: "relative",
    cursor: "pointer",
  },

  redDot: {
    width: "8px",
    height: "8px",
    background: "#ef4444",
    borderRadius: "50%",
    position: "absolute",
    top: "-2px",
    right: "-2px",
  },

  notificationDropdown: {
    position: "absolute",
    top: "38px",
    right: 0,
    width: "320px",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    boxShadow:
      "0 10px 25px rgba(0,0,0,0.08)",
    padding: "14px",
    zIndex: 999,
  },

  notificationHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    padding: "12px 15px",
  },

  markReadButton: {
    border: "none",
    background: "transparent",
    color: "#f97316",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
  },

  notificationItemTitle: {
    fontWeight: "700",
    marginBottom: "3px",
  },

  notificationTime: {
    marginTop: "5px",
    fontSize: "11px",
    color: "#6b7280",
  },

  notificationTitle: {
    margin: "0 0 12px 0",
    fontSize: "16px",
    fontWeight: "700",
    color: "#0f172a",
  },

  notificationItem: {
    padding: "12px",
    borderRadius: "10px",
    fontSize: "14px",
    color: "#111827",
    marginBottom: "10px",
    lineHeight: "1.5",
  },

  profile: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },

  avatar: {
    width: "35px",
    height: "35px",
    borderRadius: "50%",
    background: "#f97316",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    color: "#fff",
  },

  logout: {
    padding: "6px 12px",
    background: "#f97316",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },

  content: {
    padding: "24px",
    flex: 1,
    overflow: "auto",
  },
};