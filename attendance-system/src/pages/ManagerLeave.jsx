import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import ManagerLayout from "../layouts/ManagerLayout";

export default function ManagerLeave() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
  setLoading(true);

  const { data, error } = await supabase
    .from("leave_requests")
    .select(`
  *,
  employee_profiles!leave_requests_employee_id_fkey (
    full_name
  )
`)

    .order("created_at", { ascending: false });

  if (error) {
    console.log(error);
    setLoading(false);
    return;
  }

  console.log("REQUESTS:", data); // 🔥 DEBUG

  setRequests(data);
  setLoading(false);
};

  const updateStatus = async (id, status) => {
    const { error } = await supabase
      .from("leave_requests")
      .update({ status })
      .eq("id", id);

    if (error) {
      console.log(error);
      alert("Error updating status");
      return;
    }

    fetchRequests();
  };

  return (
    <ManagerLayout>
      <div style={styles.container}>
        <h2 style={styles.title}>Leave Requests</h2>

        <div style={styles.card}>
          {loading ? (
            <p style={styles.loading}>Loading...</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.header}>Name</th>
                  <th style={styles.header}>Type</th>
                  <th style={styles.header}>Dates</th>
                  <th style={styles.header}>Reason</th>
                  <th style={styles.header}>Status</th>
                  <th style={styles.header}>Action</th>
                </tr>
              </thead>

              <tbody>
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={styles.empty}>
                      No leave requests
                    </td>
                  </tr>
                ) : (
                  requests.map((req) => (
                    <tr key={req.id} style={styles.row}>
                      <td>
                        <td>
  {req.employee_profiles?.full_name || "Unknown"}
</td>
                      </td>

                      <td style={styles.cell}>{req.leave_type}</td>

                      <td>
                        {req.start_date} - {req.end_date}
                      </td>

                      <td>{req.reason}</td>

                      {/* STATUS */}
                      <td>
                        <span
                          style={{
                            ...styles.status,
                            ...(req.status === "Approved"
                              ? styles.approved
                              : req.status === "Rejected"
                              ? styles.rejected
                              : styles.pending),
                          }}
                        >
                          {req.status}
                        </span>
                      </td>

                      {/* ACTION */}
                      <td>
                        {req.status === "Pending" ? (
                          <div style={styles.actionGroup}>
                            <button
                              style={styles.approveBtn}
                              onClick={() =>
                                updateStatus(req.id, "Approved")
                              }
                            >
                              Approve
                            </button>

                            <button
                              style={styles.rejectBtn}
                              onClick={() =>
                                updateStatus(req.id, "Rejected")
                              }
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span style={styles.done}>—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </ManagerLayout>
  );
}

const styles = {
  container: {
    padding: "20px",
  },

  title: {
    marginBottom: "16px",
    fontWeight: "600",
  },

  card: {
  background: "#fff",
  borderRadius: "12px",
  padding: "20px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
},

  loading: {
    textAlign: "center",
    padding: "20px",
  },

  table: {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: "0 10px", // 🔥 adds vertical spacing between rows
},

  row: {
  background: "#fafafa",
  borderRadius: "10px",
},
  empty: {
    textAlign: "center",
    padding: "20px",
    color: "#6b7280",
  },

  status: {
    padding: "5px 10px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "500",
  },

  approved: {
    background: "#d1fae5",
    color: "#065f46",
  },

  rejected: {
    background: "#fee2e2",
    color: "#991b1b",
  },

  pending: {
    background: "#fef3c7",
    color: "#92400e",
  },

  actionGroup: {
  display: "flex",
  gap: "10px", // 🔥 more spacing
},

  approveBtn: {
  background: "#22c55e",
  color: "#fff",
  border: "none",
  padding: "8px 14px",
  borderRadius: "6px",
  cursor: "pointer",
},

  rejectBtn: {
  background: "#ef4444",
  color: "#fff",
  border: "none",
  padding: "8px 14px",
  borderRadius: "6px",
  cursor: "pointer",
},
  done: {
    color: "#9ca3af",
  },
  cell: {
  padding: "14px 16px",
  verticalAlign: "middle",
},
header: {
  textAlign: "left",
  padding: "10px 16px",
  fontSize: "14px",
  color: "#6b7280",
},
};