import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaChartBar, FaClipboardList, FaUsers, FaUser } from "react-icons/fa";

export default function Sidebar({ role }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [openEmployee, setOpenEmployee] = useState(false);

  const isActive = (path) => location.pathname === path;

  return (
    <div style={styles.sidebar}>
      {/* LOGO */}
      <div style={styles.logoContainer}>
        <div style={styles.logoCircle}>C</div>
        <h3 style={styles.logoText}>CIBO</h3>
      </div>

      {/* EMPLOYEE SIDE */}
      {/* EMPLOYEE SIDE */}
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
      <FaChartBar /> Take Attendance
    </button>

    {/* 🔽 LEAVE MANAGEMENT */}
    <div>
      <button
        onClick={() => setOpenEmployee(!openEmployee)}
        style={styles.link}
      >
        <FaClipboardList /> Leave Management{" "}
        {openEmployee ? "▾" : "▸"}
      </button>

      <div
        style={{
          ...styles.dropdown,
          maxHeight: openEmployee ? "200px" : "0px",
          opacity: openEmployee ? 1 : 0,
        }}
      >
        <button
          onClick={() => navigate("/leave")}
          style={{
            ...styles.sublink,
            ...(isActive("/leave") && styles.activeSubLink),
          }}
        >
          Leave Request
        </button>

        <button
          onClick={() => navigate("/my-leave")}
          style={{
            ...styles.sublink,
            ...(isActive("/my-leave") && styles.activeSubLink),
          }}
        >
          Leave Records
        </button>
      </div>
    </div>
  </>
)}

      {/* MANAGER SIDE */}
      {role === "manager" && (
        <>
          {/* 🔥 PROFILE FIRST */}
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

          {/* 🔽 EMPLOYEE DROPDOWN */}
          <div>
            <button
              onClick={() => setOpenEmployee(!openEmployee)}
              style={styles.link}
            >
              <FaUsers color="#ffffff" /> Employee Management {openEmployee ? "▾" : "▸"}
            </button>

            <div
              style={{
                ...styles.dropdown,
                maxHeight: openEmployee ? "200px" : "0px",
                opacity: openEmployee ? 1 : 0,
              }}
            >
              <button
                onClick={() => navigate("/manager/register")}
                style={{
                  ...styles.sublink,
                  ...(isActive("/manager/register") && styles.activeSubLink),
                }}
              >
                Register Employee
              </button>

              <button
                onClick={() => navigate("/manager/edit")}
                style={{
                  ...styles.sublink,
                  ...(isActive("/manager/edit") && styles.activeSubLink),
                }}
              >
                Edit Employee
              </button>
            </div>
          </div>

          <button
            onClick={() => navigate("/manager/leave")}
            style={{
              ...styles.link,
              ...(isActive("/manager/leave") && styles.activeLink),
            }}
          >
            <FaClipboardList /> Manage Leave
          </button>
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
    letterSpacing: "0.5px",
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
    letterSpacing: "0.3px",
    transition: "0.2s",
  },

  activeLink: {
    background: "#f97316",
    color: "#fff",
    fontWeight: "600",
  },

  dropdown: {
    display: "flex",
    flexDirection: "column",
    marginLeft: "28px",
    marginTop: "6px",
    gap: "4px",
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
    fontSize: "13.5px",
    borderRadius: "8px",
    fontWeight: "400",
    transition: "0.2s",
  },

  activeSubLink: {
    background: "#f97316",
    color: "#fff",
    fontWeight: "500",
  },
};