import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import EmployeeLayout from "../layouts/EmployeeLayout";

export default function MyLeave() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyLeave();
  }, []);

  const fetchMyLeave = async () => {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("employee_profiles")
      .select("id")
      .eq("email", user.email)
      .single();

    if (!profile) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("employee_id", profile.id)
      .order("created_at", { ascending: false });

    setRequests(data || []);
    setLoading(false);
  };

  return (
    <EmployeeLayout>
      <div style={styles.container}>
        <h1 style={styles.pageTitle}>Leave Records</h1>

        <div style={styles.card}>
          {loading ? (
            <div style={styles.loading}>Loading...</div>
          ) : requests.length === 0 ? (
            <div style={styles.empty}>
              No leave requests found
            </div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.header}>Leave Type</th>
                  <th style={styles.header}>Dates</th>
                  <th style={styles.header}>Reason</th>
                  <th style={styles.header}>Attachment</th>
                  <th style={styles.header}>Status</th>
                </tr>
              </thead>

              <tbody>
                {requests.map((req) => (
                  <tr key={req.id} style={styles.row}>
                    <td
                      style={{
                        ...styles.cell,
                        ...styles.firstCell,
                      }}
                    >
                      {req.leave_type}
                    </td>

                    <td style={styles.cell}>
                      {req.start_date} - {req.end_date}
                    </td>

                    <td style={styles.cell}>
                      {req.reason || "—"}
                    </td>

                    <td style={styles.cell}>
                      {req.attachment_url ? (
                        req.attachment_url.match(
                          /\.(jpg|jpeg|png|gif|webp)$/i
                        ) ? (
                          <img
                            src={req.attachment_url}
                            alt="attachment"
                            style={styles.attachmentImage}
                            onClick={() =>
                              window.open(
                                req.attachment_url,
                                "_blank"
                              )
                            }
                          />
                        ) : (
                          <a
                            href={req.attachment_url}
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

                    <td
                      style={{
                        ...styles.cell,
                        ...styles.lastCell,
                      }}
                    >
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </EmployeeLayout>
  );
}

const styles = {
  container: {
  padding: "8px 20px 20px 20px",
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

  card: {
    background: "#ffffff",
    borderRadius: "20px",
    padding: "22px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: "0 14px",
  },

  header: {
    textAlign: "left",
    padding: "14px 16px",
    color: "#000000",
    fontSize: "14px",
    fontWeight: "700",
  },

  row: {
    background: "#ffffff",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  },

  cell: {
    padding: "22px 16px",
    background: "#ffffff",
    verticalAlign: "middle",
    fontSize: "15px",
    color: "#000000",
    borderTop: "1px solid #e5e7eb",
    borderBottom: "1px solid #e5e7eb",
  },

  firstCell: {
    borderTopLeftRadius: "14px",
    borderBottomLeftRadius: "14px",
    borderLeft: "1px solid #e5e7eb",
  },

  lastCell: {
    borderTopRightRadius: "14px",
    borderBottomRightRadius: "14px",
    borderRight: "1px solid #e5e7eb",
  },

  status: {
    padding: "8px 16px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "700",
    display: "inline-block",
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
    color: "#000000",
    fontSize: "14px",
  },

  loading: {
    textAlign: "center",
    padding: "40px",
    color: "#6b7280",
  },

  empty: {
    textAlign: "center",
    padding: "40px",
    color: "#000000",
    fontSize: "15px",
  },
};