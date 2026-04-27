import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function ManagerLayout({ children }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("role");
    navigate("/");
  };

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <h2 style={styles.logo}>Manager</h2>

        <button onClick={() => navigate("/manager")} style={styles.link}>
          Dashboard
        </button>

        <button onClick={() => navigate("/manager/register")} style={styles.link}>
          Register Employee
        </button>

        <button onClick={() => navigate("/manager/leave")} style={styles.link}>
          Manage Leave
        </button>

        <button onClick={handleLogout} style={styles.logout}>
          Back
        </button>
      </div>

      <div style={styles.main}>
        <div style={styles.header}>
          <h2>Manager Dashboard</h2>
        </div>

        <div style={styles.content}>{children}</div>
      </div>
    </div>
  );
}

const styles = {
  container: { display: "flex", height: "100vh" },
  sidebar: {
    width: "220px",
    background: "#1f2937",
    color: "#fff",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  logo: { marginBottom: "20px", color: "#f97316" },
  link: {
    padding: "10px",
    background: "transparent",
    color: "#fff",
    border: "none",
    textAlign: "left",
    cursor: "pointer",
  },
  logout: {
    marginTop: "auto",
    padding: "10px",
    background: "#f97316",
    color: "#fff",
    border: "none",
    cursor: "pointer",
  },
  main: { flex: 1, background: "#f3f4f6" },
  header: {
    padding: "20px",
    background: "#fff",
    borderBottom: "1px solid #ddd",
  },
  content: { padding: "20px" },
};