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

    setRequests(data || []);
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

  const isImage = (url) => {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  };

  return (
    <ManagerLayout>
      <div style={styles.container}>
        <h2 style={styles.pagetitle}>Leave Requests</h2>

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
                  <th style={styles.header}>Attachment</th>
                  <th style={styles.header}>Status</th>
                  <th style={styles.header}>Action</th>
                </tr>
              </thead>

              <tbody>
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={styles.empty}>
                      No leave requests
                    </td>
                  </tr>
                ) : (
                  requests.map((req) => (
                    <tr key={req.id} style={styles.row}>
                      <td style={styles.cell}>
                        {req.employee_profiles?.full_name || "Unknown"}
                      </td>

                      <td style={styles.cell}>
                        {req.leave_type}
                      </td>

                      <td style={styles.cell}>
                        {req.start_date} - {req.end_date}
                      </td>

                      <td style={styles.cell}>
                        {req.reason || "—"}
                      </td>

                      {/* ATTACHMENT */}
                      <td style={styles.cell}>
  {req.attachment ? (
    isImage(req.attachment) ? (
      <img
        src={req.attachment}
        alt="attachment"
        style={styles.attachmentImage}
        onClick={() =>
          window.open(
            req.attachment,
            "_blank"
          )
        }
      />
    ) : (
      <a
        href={req.attachment}
        target="_blank"
        rel="noreferrer"
        style={styles.fileLink}
      >
        View File
      </a>
    )
  ) : (
    <span style={styles.noAttachment}>
      No Attachment
    </span>
  )}
</td>

                      {/* STATUS */}
                      <td style={styles.cell}>
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
                      <td style={styles.cell}>
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
    fontWeight: "700",
    fontSize: "32px",
    color: "#111827",
  },

  card: {
    background: "#fff",
    borderRadius: "16px",
    padding: "20px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
    overflowX: "auto",
  },

  loading: {
    textAlign: "center",
    padding: "20px",
  },

  table: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: "0 10px",
  },

  row: {
    background: "#fafafa",
  },

  header: {
    textAlign: "left",
    padding: "14px 16px",
    fontSize: "14px",
    color: "#6b7280",
    fontWeight: "600",
  },

  cell: {
    padding: "16px",
    verticalAlign: "middle",
    background: "#f9fafb",
    color: "#111827",
  },

  empty: {
    textAlign: "center",
    padding: "20px",
    color: "#6b7280",
  },

  status: {
    padding: "6px 12px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "600",
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
    gap: "10px",
  },

  approveBtn: {
    background: "#22c55e",
    color: "#fff",
    border: "none",
    padding: "8px 14px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
  },

  rejectBtn: {
    background: "#ef4444",
    color: "#fff",
    border: "none",
    padding: "8px 14px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
  },

  done: {
    color: "#9ca3af",
  },

  attachmentImage: {
    width: "70px",
    height: "70px",
    objectFit: "cover",
    borderRadius: "10px",
    border: "1px solid #d1d5db",
    cursor: "pointer",
  },

  fileLink: {
    color: "#f97316",
    fontWeight: "600",
    textDecoration: "none",
  },

  noAttachment: {
    color: "#9ca3af",
  },
    pageTitle: {
    fontSize: "25px",
    fontWeight: "650",
    color: "#111827",
    margin: "0 20px 0",
    padding: 0,
    letterSpacing: "-0.3px",
    lineHeight: "1.2",
  },
};