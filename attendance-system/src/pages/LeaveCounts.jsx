import ManagerLayout from "../layouts/ManagerLayout";

export default function LeaveCounts() {
  return (
    <ManagerLayout>
      <div style={styles.container}>
        <h1 style={styles.title}>Edit Leave Counts</h1>

        <div style={styles.card}>
          Leave count management page
        </div>
      </div>
    </ManagerLayout>
  );
}

const styles = {
  container: {
    padding: "30px",
  },

  title: {
    fontSize: "36px",
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: "20px",
  },

  card: {
    background: "#fff",
    padding: "30px",
    borderRadius: "20px",
    border: "1px solid #e5e7eb",
    fontSize: "20px",
  },
};