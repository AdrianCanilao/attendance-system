import { useNavigate, useLocation } from "react-router-dom";
import { FaBars, FaTimes, FaUser, FaChartBar, FaClipboardList, FaSignOutAlt } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import { logCurrentUserAudit } from "../utils/auditlogger";
import { FaBell } from "react-icons/fa";
import Sidebar from "../components/Sidebar";
import { useEffect, useRef, useState } from "react";

export default function EmployeeLayout({ children }) {

  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

  const [showNotifications, setShowNotifications] =
    useState(false);

  const [notifications, setNotifications] =
    useState([]);

  const [branchName, setBranchName] =
    useState("");

  const notificationRef = useRef(null);

  const handleLogout = async () => {
    await logCurrentUserAudit({
      action: "LOGOUT",
      description: "User logged out of the system",
      role: "employee",
    });

    await supabase.auth.signOut();

    localStorage.removeItem("role");
    sessionStorage.removeItem("role");
    localStorage.removeItem("email");
    sessionStorage.removeItem("email");
    localStorage.removeItem("user_id");
    sessionStorage.removeItem("user_id");

    navigate("/");
  };

  useEffect(() => {
    fetchNotifications();
    fetchBranch();

    // Keep the notification bell current without requiring a page reload.
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Refresh immediately whenever the notification dropdown is opened.
  useEffect(() => {
    if (showNotifications) fetchNotifications();
  }, [showNotifications]);

  // Subscribe to Supabase Realtime so leave-status notifications
  // appear immediately when an MS approves or rejects a request.
  useEffect(() => {
    let channel;

    const subscribeToNotifications = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      if (!user) return;

      channel = supabase
        .channel(`employee-notifications-${user.id}`)
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

  // ================= FETCH BRANCH =================

  const fetchBranch = async () => {

    try {

      const email =
        localStorage.getItem("email");

      if (!email) return;

      // GET EMPLOYEE PROFILE
      const { data: profile } =
        await supabase
          .from("employee_profiles")
          .select(`
            branch_id,
            branches (
              branch_name
            )
          `)
          .eq("email", email)
          .single();


      if (
        profile?.branches?.branch_name
      ) {
        setBranchName(
          profile.branches.branch_name
        );
      }

    } catch (err) {


    }
  };

  // CLOSE WHEN CLICK OUTSIDE
  useEffect(() => {

    const handleClickOutside =
      (event) => {

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

  // ================= NOTIFICATIONS =================

  const fetchNotifications =
    async () => {

    let notif = [];

    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) return;

    const today = new Date()
      .toISOString()
      .split("T")[0];

    const {
      data,
      error,
    } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("employee_id", user.id)
      .gte(
        "created_at",
        `${today}T00:00:00`
      )
      .lte(
        "created_at",
        `${today}T23:59:59`
      )
      .order("created_at", {
        ascending: false,
      });



    if (data && data.length > 0) {

      const attendance =
        data[0];

      // NOT TIMED IN
      if (!attendance.time_in) {

        notif.push({
          message:
            "⚠ You have not timed in today.",
          level: "urgent",
        });

      }

      // TIMED IN BUT NO TIME OUT
      else if (
        attendance.time_in &&
        attendance.time_out === null
      ) {

        notif.push({
          message:
            "⚠ You still haven't timed out today.",
          level: "urgent",
        });

      }

    } else {

      notif.push({
        message:
          "⚠ You have not timed in today.",
        level: "urgent",
      });

    }

    // DATABASE NOTIFICATIONS (leave status, branch-related events, etc.)
    const { data: dbNotifications } = await supabase
      .from("notifications")
      .select("id, type, title, message, created_at, read_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    const storedNotifications = (dbNotifications || []).map((item) => ({
      id: item.id,
      message: item.message,
      title: item.title,
      created_at: item.created_at,
      read_at: item.read_at,
      level: item.type === "leave_status" ? "normal" : "warning",
    }));

    if (notif.length === 0) {
      notif.push({
        message: "✅ No attendance reminders today.",
        level: "normal",
      });
    }

    setNotifications([...storedNotifications, ...notif]);
  };

  return (
    <div className="cibo-layout cibo-employee-layout" style={styles.container}>


      <style>{`
        .cibo-employee-mobile-logo, .cibo-employee-menu-toggle, .cibo-employee-mobile-nav { display: none; }
        @media (max-width: 768px) {
          .cibo-employee-layout > .cibo-sidebar { display: none !important; }
          .cibo-employee-layout .cibo-main { min-width: 0 !important; width: 100% !important; }
          .cibo-employee-layout .cibo-topbar { padding: 0 12px !important; gap: 10px !important; overflow: visible !important; }
          .cibo-employee-mobile-logo { display: block; width: 42px; height: 42px; flex-shrink: 0; object-fit: contain; }
          .cibo-employee-layout .cibo-topbar-title { max-width: none !important; flex: 1 1 auto !important; min-width: 0 !important; font-size: 14px !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
          .cibo-employee-layout .cibo-employee-top-actions { gap: 12px !important; min-width: 0 !important; }
          .cibo-employee-layout .cibo-top-profile, .cibo-employee-layout .cibo-employee-top-actions > button:not(.cibo-employee-menu-toggle) { display: none !important; }
          .cibo-employee-menu-toggle { display: flex; align-items: center; justify-content: center; width: 42px; height: 44px; flex-shrink: 0; background: transparent; border: 0; border-radius: 8px; color: #1f2937; font-size: 21px; cursor: pointer; }
          .cibo-employee-menu-toggle:focus-visible, .cibo-employee-mobile-nav button:focus-visible { outline: 3px solid #f97316; outline-offset: 2px; }
          .cibo-employee-mobile-nav.is-open { display: flex; }
          .cibo-employee-mobile-nav { position: absolute; top: 64px; left: 0; right: 0; z-index: 2999; background: #1f2937; padding: 12px; flex-direction: column; gap: 4px; box-shadow: 0 10px 22px rgba(0,0,0,.18); max-height: calc(100dvh - 64px); overflow-y: auto; }
          .cibo-employee-mobile-nav button { display: flex; align-items: center; gap: 12px; width: 100%; padding: 13px 14px; border: 0; border-radius: 8px; color: #fff; background: transparent; text-align: left; font-size: 14px; font-weight: 500; white-space: nowrap; cursor: pointer; }
          .cibo-employee-mobile-nav button:hover { background: #f97316; }
          .cibo-employee-layout .cibo-content { padding: 16px 14px !important; min-width: 0 !important; }
          .cibo-employee-layout .cibo-notification-dropdown { max-width: calc(100vw - 20px) !important; }
        }
        @media (max-width: 374px) {
          .cibo-employee-layout .cibo-topbar { padding: 0 8px !important; gap: 6px !important; }
          .cibo-employee-layout .cibo-topbar-title { font-size: 12px !important; }
          .cibo-employee-layout .cibo-employee-top-actions { gap: 8px !important; }
        }
      `}</style>

      {/* SIDEBAR */}
      <Sidebar role="employee" />

      {/* MAIN */}
      <div className="cibo-main" style={styles.main}>

        {/* TOPBAR */}
        <div className="cibo-topbar" style={styles.topbar}>
          <img className="cibo-employee-mobile-logo" src="/cibologo.png" alt="CIBO" />

          <h3 className="cibo-topbar-title" style={{ margin: 0 }}>

            Employee Dashboard

            {branchName &&
              ` - ${branchName}`}

          </h3>

          <div className="cibo-employee-top-actions" style={styles.topRight}>

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

                <div
                  style={styles.redDot}
                ></div>

              </div>

              {/* DROPDOWN */}
              {showNotifications && (

                <div
                  className="cibo-notification-dropdown"
                  style={styles.notificationDropdown}
                >

                  <h4
                    style={
                      styles.notificationTitle
                    }
                  >
                    Notifications
                  </h4>

                  {notifications.map(
                    (notif, index) => (

                      <div
                        key={notif.id || index}
                        style={{
                          ...styles.notificationItem,

                          background:
                            notif.level ===
                            "urgent"
                              ? "#fee2e2"
                              : "#f9fafb",
                        }}
                      >
                        <div style={styles.notificationItemTitle}>{notif.title || "Attendance Reminder"}</div>
                        <div>{notif.message}</div>
                        {notif.created_at && (
                          <div style={styles.notificationTime}>
                            {new Date(notif.created_at).toLocaleString()}
                          </div>
                        )}
                      </div>

                    )
                  )}

                </div>

              )}

            </div>

            <button type="button" className="cibo-employee-menu-toggle" aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={mobileMenuOpen} aria-controls="cibo-employee-mobile-nav" onClick={() => setMobileMenuOpen(value => !value)}>{mobileMenuOpen ? <FaTimes /> : <FaBars />}</button>

            {/* PROFILE */}
            <div className="cibo-top-profile" style={styles.profile}>

              <div style={styles.avatar}>
                E
              </div>

              <div>

                <p
                  style={{
                    margin: 0,
                    fontWeight: "600",
                  }}
                >
                  Employee
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

        <nav id="cibo-employee-mobile-nav" className={`cibo-employee-mobile-nav ${mobileMenuOpen ? "is-open" : ""}`} aria-label="Employee mobile navigation" aria-hidden={!mobileMenuOpen}>
          <button type="button" onClick={() => navigate("/employee/profile")}><FaUser /> Profile</button>
          <button type="button" onClick={() => navigate("/employee")}><FaChartBar /> Attendance Log</button>
          <button type="button" onClick={() => navigate("/employee/leave-request")}><FaClipboardList /> Leave Request</button>
          <button type="button" onClick={() => navigate("/employee/myleave")}><FaClipboardList /> Leave Records</button>
          <button type="button" onClick={handleLogout}><FaSignOutAlt /> Logout</button>
        </nav>

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
    borderBottom:
      "2px solid #f97316",
    display: "flex",
    alignItems: "center",
    justifyContent:
      "space-between",
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
    width: "300px",
    background: "#fff",
    border:
      "1px solid #e5e7eb",
    borderRadius: "12px",
    boxShadow:
      "0 10px 25px rgba(0,0,0,0.08)",
    padding: "14px",
    zIndex: 999,
    maxHeight: "min(70vh, 620px)",
    overflowY: "auto",
    overscrollBehavior: "contain",
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