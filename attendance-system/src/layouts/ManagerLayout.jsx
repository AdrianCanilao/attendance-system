import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { FaBell } from "react-icons/fa";
import Sidebar from "../components/Sidebar"; // ✅ IMPORTANT

export default function ManagerLayout({ children }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("role");
    navigate("/");
  };

  return (
    <div style={styles.container}>
      {/* ✅ REUSABLE SIDEBAR */}
      <Sidebar role="manager" />

      {/* MAIN */}
      <div style={styles.main}>
        {/* TOPBAR */}
        <div style={styles.topbar}>
          <h3 style={{ margin: 0 }}>Manager Dashboard</h3>

          <div style={styles.topRight}>
            <FaBell size={18} />

            <div style={styles.profile}>
              <div style={styles.avatar}>M</div>
              <div>
                <p style={{ margin: 0, fontWeight: "600" }}>Manager</p>
              </div>
            </div>

            {/* 🔥 LOGOUT BUTTON (optional here instead of sidebar) */}
            <button onClick={handleLogout} style={styles.logout}>
              Logout
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div style={styles.content}>{children}</div>
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
    height: "70px",
    background: "#f5f5f5",
    borderBottom: "2px solid #f97316",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 20px",
  },

  topRight: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
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
    padding: "20px",
  },
};