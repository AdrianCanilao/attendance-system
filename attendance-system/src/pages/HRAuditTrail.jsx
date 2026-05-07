import HRLayout from "../layouts/HRLayout";

export default function HRAuditTrail() {
  return (
    <HRLayout>
      <div style={styles.container}>
        <h1 style={styles.title}>
          HR Audit Trail
        </h1>

        <p style={styles.subtitle}>
          Monitor employee attendance
          activities, corrections, and
          system actions.
        </p>

        <div style={styles.card}>
          <h3>Audit Logs</h3>

          <p>
            No audit logs available yet.
          </p>
        </div>
      </div>
    </HRLayout>
  );
}

const styles = {
  container: {
    padding: "10px",
  },

  title: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#111827",
    marginBottom: "8px",
  },

  subtitle: {
    color: "#6b7280",
    marginBottom: "25px",
  },

  card: {
    background: "#fff",
    padding: "20px",
    borderRadius: "14px",
    border: "1px solid #e5e7eb",
  },
};