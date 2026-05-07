import { Link, useLocation } from "react-router-dom";

export default function HRLayout({ children }) {
  const location = useLocation();

  const menuItems = [
    {
  label: "Audit Trail",
  path: "/hr/profile"
},
    {
      label: "Employees",
      path: "/hr/employees",
    },
    {
      label: "Attendance",
      path: "/hr/attendance",
    },
    {
      label: "Reports",
      path: "/hr/reports",
    },
    {
      label: "Corrections",
      path: "/hr/corrections",
    },
  ];

  return (
    <div style={styles.container}>
      <aside style={styles.sidebar}>
        <div style={styles.logoSection}>
          <h2 style={styles.logo}>
            HR PANEL
          </h2>

          <p style={styles.subtitle}>
            Attendance System
          </p>
        </div>

        <nav style={styles.nav}>
          {menuItems.map((item) => {
            const active =
              location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  ...styles.link,
                  ...(active
                    ? styles.activeLink
                    : {}),
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main style={styles.main}>
        {children}
      </main>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    minHeight: "100vh",
    background: "#f8fafc",
  },

  sidebar: {
    width: "260px",
    background: "#111827",
    color: "#fff",
    padding: "24px 18px",
    display: "flex",
    flexDirection: "column",
  },

  logoSection: {
    marginBottom: "35px",
  },

  logo: {
    margin: 0,
    fontSize: "24px",
    fontWeight: "700",
  },

  subtitle: {
    marginTop: "6px",
    color: "#9ca3af",
    fontSize: "14px",
  },

  nav: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  link: {
    padding: "12px 14px",
    borderRadius: "10px",
    textDecoration: "none",
    color: "#d1d5db",
    fontWeight: "500",
    transition: "0.2s",
  },

  activeLink: {
    background: "#2563eb",
    color: "#fff",
  },

  main: {
    flex: 1,
    padding: "24px",
  },
};