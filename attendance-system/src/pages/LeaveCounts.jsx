import EmployeeLayout from "../layouts/EmployeeLayout";

export default function LeaveCounts() {
  return (
    <EmployeeLayout>
      <div style={styles.container}>
        <h1 style={styles.title}>Edit Leave Counts</h1>

        <div style={styles.card}>
          Leave count management page
        </div>
      </div>
    </EmployeeLayout>
  );
}

const styles = {
  container: {
    padding: "30px",
  },

  title: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#111827",
    marginBottom: "20px",
  },

  card: {
    background: "#fff",
    padding: "30px",
    borderRadius: "16px",
    border: "1px solid #e5e7eb",
  },
};