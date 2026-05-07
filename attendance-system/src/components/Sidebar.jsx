import { useState } from "react";
import {
  useNavigate,
  useLocation,
} from "react-router-dom";

import {
  FaChartBar,
  FaClipboardList,
  FaUsers,
  FaUser,
} from "react-icons/fa";

export default function Sidebar({ role }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [openEmployee, setOpenEmployee] = useState(false);
  const [leaveDropdown, setLeaveDropdown] = useState(false);

  const isActive = (path) => location.pathname === path;

  return (
    <div style={styles.sidebar}>
      {/* LOGO */}
      <div style={styles.logoContainer}>
        <div style={styles.logoCircle}>C</div>
        <h3 style={styles.logoText}>CIBO</h3>
      </div>

      {/* ================= EMPLOYEE ================= */}
      {role === "employee" && (
        <>
          <button
            onClick={() => navigate("/employee/profile")}
            style={{
              ...styles.link,
              ...(isActive("/employee/profile") && styles.activeLink),
            }}
          >
            <FaUser /> Profile
          </button>

          <button
            onClick={() => navigate("/employee")}
            style={{
              ...styles.link,
              ...(isActive("/employee") && styles.activeLink),
            }}
          >
            <FaChartBar /> Attendance Log
          </button>

          {/* LEAVE MANAGEMENT */}
          <div>
            <button
              onClick={() => setLeaveDropdown(!leaveDropdown)}
              style={styles.link}
            >
              <FaClipboardList />
              Leave Overview
              {leaveDropdown ? " ▾" : " ▸"}
            </button>

            <div
              style={{
                ...styles.dropdown,
                maxHeight: leaveDropdown ? "200px" : "0px",
                opacity: leaveDropdown ? 1 : 0,
              }}
            >
              <button
                onClick={() => navigate("/employee/leave-request")}
                style={{
                  ...styles.sublink,
                  ...(isActive("/employee/leave-request") &&
                    styles.activeSubLink),
                }}
              >
                Leave Request
              </button>

              <button
                onClick={() => navigate("/employee/myleave")}
                style={{
                  ...styles.sublink,
                  ...(isActive("/employee/myleave") &&
                    styles.activeSubLink),
                }}
              >
                Leave Records
              </button>
            </div>
          </div>
        </>
      )}

      {/* ================= MANAGER ================= */}
      {role === "manager" && (
        <>
          <button
            onClick={() => navigate("/manager/profile")}
            style={{
              ...styles.link,
              ...(isActive("/manager/profile") && styles.activeLink),
            }}
          >
            <FaUser /> Profile
          </button>

          <button
            onClick={() => navigate("/manager")}
            style={{
              ...styles.link,
              ...(isActive("/manager") && styles.activeLink),
            }}
          >
            <FaChartBar /> Attendance Log
          </button>

          {/* EMPLOYEE MANAGEMENT */}
          <div>
            <button
              onClick={() => setOpenEmployee(!openEmployee)}
              style={styles.link}
            >
              <FaUsers />
              Employee Management
              {openEmployee ? " ▾" : " ▸"}
            </button>

            <div
              style={{
                ...styles.dropdown,
                maxHeight: openEmployee ? "250px" : "0px",
                opacity: openEmployee ? 1 : 0,
              }}
            >
              <button
                onClick={() => navigate("/manager/register")}
                style={{
                  ...styles.sublink,
                  ...(isActive("/manager/register") &&
                    styles.activeSubLink),
                }}
              >
                Register Employee
              </button>

              <button
                onClick={() => navigate("/manager/edit")}
                style={{
                  ...styles.sublink,
                  ...(isActive("/manager/edit") &&
                    styles.activeSubLink),
                }}
              >
                Edit Employee
              </button>

              <button
                onClick={() => navigate("/manager/employees")}
                style={{
                  ...styles.sublink,
                  ...(isActive("/manager/employees") &&
                    styles.activeSubLink),
                }}
              >
                Employee List
              </button>
            </div>
          </div>

          {/* MANAGER LEAVE MANAGEMENT */}
          <div>
            <button
              onClick={() => setLeaveDropdown(!leaveDropdown)}
              style={styles.link}
            >
              <FaClipboardList />
              Leave Management
              {leaveDropdown ? " ▾" : " ▸"}
            </button>

            <div
              style={{
                ...styles.dropdown,
                maxHeight: leaveDropdown ? "200px" : "0px",
                opacity: leaveDropdown ? 1 : 0,
              }}
            >
              <button
                onClick={() => navigate("/manager/leave")}
                style={{
                  ...styles.sublink,
                  ...(isActive("/manager/leave") &&
                    styles.activeSubLink),
                }}
              >
                Leave Approval
              </button>

              <button
                onClick={() => navigate("/manager/edit-leave-counts")}
                style={{
                  ...styles.sublink,
                  ...(isActive("/manager/edit-leave-counts") &&
                    styles.activeSubLink),
                }}
              >
                Edit Leave Counts
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  sidebar: {
    width: "240px",
    background: "#1f2937",
    color: "#fff",
    padding: "24px 18px",
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
  },

  logoContainer: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "28px",
  },

  logoCircle: {
    width: "42px",
    height: "42px",
    borderRadius: "10px",
    background: "#f97316",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    fontSize: "18px",
  },

  logoText: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "600",
  },

  link: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 14px",
    background: "transparent",
    color: "#e5e7eb",
    border: "none",
    cursor: "pointer",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: "500",
    marginBottom: "8px",
  },

  activeLink: {
    background: "#f97316",
    color: "#fff",
  },

  dropdown: {
    display: "flex",
    flexDirection: "column",
    marginLeft: "28px",
    marginTop: "6px",
    overflow: "hidden",
    transition: "all 0.3s ease",
  },

  sublink: {
    padding: "8px 10px",
    background: "transparent",
    color: "#9ca3af",
    border: "none",
    textAlign: "left",
    cursor: "pointer",
    fontSize: "13px",
    borderRadius: "8px",
  },

  activeSubLink: {
    background: "#f97316",
    color: "#fff",
  },

  menuGroup: {
    width: "100%",
  },

  menuItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 14px",
    cursor: "pointer",
    borderRadius: "10px",
    color: "#e5e7eb",
  },

  menuLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },

  dropdownArrow: {
    fontSize: "12px",
  },

  subMenu: {
    marginLeft: "38px",
    marginTop: "8px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  subMenuItem: {
    color: "#ffffff",
    textDecoration: "none",
    fontSize: "14px",
    padding: "8px 12px",
    borderRadius: "8px",
  },
};