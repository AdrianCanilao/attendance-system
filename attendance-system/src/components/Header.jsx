export default function Header() {
  const logout = () => {
    localStorage.removeItem("role");
    window.location.href = "/";
  };

  return (
    <div style={{ background: "#eee", padding: "10px" }}>
      <button onClick={logout}>Logout</button>
    </div>
  );
}