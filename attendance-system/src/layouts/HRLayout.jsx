import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { FaBell } from "react-icons/fa";
import Sidebar from "../components/Sidebar";
import { useEffect, useRef, useState } from "react";

export default function HRLayout({ children }) {
  const navigate = useNavigate();

  const [showNotifications, setShowNotifications] =
    useState(false);

  const notificationRef = useRef(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("role");
    navigate("/");
  };

  // CLOSE NOTIFICATION WHEN CLICK OUTSIDE
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(
          event.target
        )
      ) {
        setShowNotifications(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  // SAMPLE HR NOTIFICATIONS
  const notifications = [
    {
      message:
        "⚠ 3 attendance correction requests pending.",
      level: "warning",
    },
    {
      message:
        "📋 Monthly attendance report is ready.",
      level: "normal",
    },
  ];

  return (
    <div style={styles.container}>
      {/* SIDEBAR */}
      <Sidebar role="hr" />

      {/* MAIN */}
      <div style={styles.main}>
        {/* TOPBAR */}
        <div style={styles.topbar}>
          <h3 style={{ margin: 0 }}>
            HR Dashboard
          </h3>

          <div style={styles.topRight}>
            {/* NOTIFICATION */}
            <div
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
                <div style={styles.redDot}></div>
              </div>

              {/* DROPDOWN */}
              {showNotifications && (
                <div style={styles.notificationDropdown}>
                  <h4 style={styles.notificationTitle}>
                    Notifications
                  </h4>

                  {notifications.map(
                    (notif, index) => (
                      <div
                        key={index}
                        style={{
                          ...styles.notificationItem,

                          background:
                            notif.level ===
                            "warning"
                              ? "#fff7ed"
                              : "#f9fafb",
                        }}
                      >
                        {notif.message}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {/* PROFILE */}
            <div style={styles.profile}>
              <div style={styles.avatar}>H</div>

              <div>
                <p
                  style={{
                    margin: 0,
                    fontWeight: "600",
                  }}
                >
                  HR
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
        <div style={styles.content}>
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