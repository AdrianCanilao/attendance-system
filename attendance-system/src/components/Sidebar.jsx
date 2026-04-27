import { Link } from "react-router-dom";

export default function Sidebar({ role }) {
  return (
    <div style={{ width: "200px", background: "#222", color: "#fff", padding: "20px" }}>
      <h3>{role.toUpperCase()}</h3>

      {role === "employee" && (
        <>
          <p><Link to="/employee" style={{ color: "#fff" }}>Dashboard</Link></p>
          <p><Link to="/leave" style={{ color: "#fff" }}>Leave Request</Link></p>
          <p><Link to="/my-leave">My Leave</Link></p>
        </>
      )}

      {role === "manager" && (
        <>
          <p><Link to="/manager" style={{ color: "#fff" }}>Dashboard</Link></p>
          <p><Link to="/manager/leave" style={{ color: "#fff" }}>Manage Leave</Link></p>
        </>
      )}
    </div>
  );
}