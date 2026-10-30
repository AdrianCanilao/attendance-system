import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { logCurrentUserAudit } from "../utils/auditlogger";
import { FaBell } from "react-icons/fa";
import Sidebar from "../components/Sidebar";
import RoleMobileNavigation from "../components/RoleMobileNavigation";
import { useEffect, useRef, useState } from "react";

export default function HRLayout({ children }) {
  const navigate = useNavigate();

  const [showNotifications, setShowNotifications] =
    useState(false);

  const notificationRef = useRef(null);

  const handleLogout = async () => {
    await logCurrentUserAudit({
      action: "LOGOUT",
      description: "User logged out of the system",
      role: "hr",
    });

    await supabase.auth.signOut();
    localStorage.removeItem("role");
    sessionStorage.removeItem("role");
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
    <div className="cibo-hr-layout cibo-role-responsive" style={styles.container}>
      <style>{`
        .cibo-role-menu-toggle, .cibo-role-mobile-nav, .cibo-role-mobile-logo { display: none; }
        @media (max-width: 768px) {
          .cibo-role-responsive > .cibo-sidebar { display: none !important; }
          .cibo-role-responsive .cibo-main, .cibo-role-responsive .cibo-hr-main { min-width: 0 !important; width: 100% !important; }
          .cibo-role-responsive .cibo-topbar, .cibo-role-responsive .cibo-hr-topbar { height: 64px !important; min-height: 64px !important; padding: 0 12px !important; gap: 8px !important; position: relative !important; overflow: visible !important; }
          .cibo-role-mobile-logo { display: block; width: 42px; height: 42px; object-fit: contain; flex-shrink: 0; }
          .cibo-role-responsive .cibo-topbar-title, .cibo-role-responsive .cibo-hr-topbar > h3 { flex: 1 1 auto !important; min-width: 0 !important; max-width: none !important; overflow: hidden !important; white-space: nowrap !important; text-overflow: ellipsis !important; font-size: 14px !important; }
          .cibo-role-top-actions { gap: 10px !important; min-width: 0 !important; flex-shrink: 0 !important; }
          .cibo-role-top-actions > div:not(.cibo-notification-wrapper):not(.cibo-hr-notification), .cibo-role-top-actions > button:not(.cibo-role-menu-toggle) { display: none !important; }
          .cibo-role-menu-toggle { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; background: transparent; color: #1f2937; border: 0; border-radius: 8px; font-size: 21px; cursor: pointer; }
          .cibo-role-mobile-nav.is-open { display: flex; }
          .cibo-role-mobile-nav { position: absolute; top: 64px; left: 0; right: 0; z-index: 4000; flex-direction: column; gap: 4px; padding: 12px; background: #1f2937; max-height: calc(100dvh - 64px); overflow-y: auto; box-shadow: 0 10px 22px rgba(0,0,0,.18); }
          .cibo-role-mobile-nav button { width: 100%; min-height: 44px; text-align: left; padding: 12px 14px; border: 0; border-radius: 8px; color: white; background: transparent; font-size: 14px; font-weight: 500; white-space: normal; cursor: pointer; }
          .cibo-role-mobile-nav button[aria-current="page"], .cibo-role-mobile-nav button:hover { background: #f97316; }

          .cibo-role-mobile-nav { background: #1f2937; }
          .cibo-role-mobile-nav .cibo-role-nav-primary, .cibo-role-mobile-nav .cibo-role-nav-group-toggle { display: flex; align-items: center; gap: 12px; }
          .cibo-role-mobile-nav .cibo-role-nav-primary > svg, .cibo-role-mobile-nav .cibo-role-nav-group-toggle > svg { flex-shrink: 0; }
          .cibo-role-mobile-nav .cibo-role-nav-group-toggle { border: 2px solid #111827; padding: 10px 12px; }
          .cibo-role-mobile-nav .cibo-role-nav-group-toggle > span { flex: 1; }
          .cibo-role-mobile-nav .cibo-role-nav-submenu { padding: 4px 0 8px 26px; display: flex; flex-direction: column; gap: 2px; }
          .cibo-role-mobile-nav .cibo-role-nav-submenu button { color: #cbd5e1; min-height: 38px; padding: 9px 10px; font-size: 13px; }
          .cibo-role-mobile-nav .cibo-role-nav-submenu button[aria-current="page"] { color: white; font-weight: 600; }
          .cibo-role-mobile-nav .cibo-role-nav-group-toggle:hover { background: #293548; }
          .cibo-role-menu-toggle:focus-visible, .cibo-role-mobile-nav button:focus-visible { outline: 3px solid #f97316; outline-offset: 2px; }
          .cibo-role-responsive .cibo-content, .cibo-role-responsive .cibo-hr-content { padding: 16px 14px !important; min-width: 0 !important; }
        }
        @media (max-width: 374px) {
          .cibo-role-responsive .cibo-topbar, .cibo-role-responsive .cibo-hr-topbar { padding: 0 8px !important; gap: 6px !important; }
          .cibo-role-responsive .cibo-topbar-title, .cibo-role-responsive .cibo-hr-topbar > h3 { font-size: 12px !important; }
        }
      `}</style>
      {/* SIDEBAR */}
      <Sidebar role="hr" />

      {/* MAIN */}
      <div className="cibo-hr-main" style={styles.main}>
        {/* TOPBAR */}
        <div className="cibo-hr-topbar" style={styles.topbar}>
          <img className="cibo-role-mobile-logo" src="/cibologo.png" alt="CIBO" />
          <h3 style={{ margin: 0 }}>
            HR Dashboard
          </h3>

          <div className="cibo-role-top-actions" style={styles.topRight}>
            {/* NOTIFICATION */}
            <div
              className="cibo-hr-notification" style={styles.notificationWrapper}
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
                <div className="cibo-hr-notification-dropdown" style={styles.notificationDropdown}>
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

            <RoleMobileNavigation role="hr" onLogout={handleLogout} />
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
        <div className="cibo-hr-content" style={styles.content}>
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
    maxHeight: "min(70vh, 620px)",
    overflowY: "auto",
    overscrollBehavior: "contain",
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