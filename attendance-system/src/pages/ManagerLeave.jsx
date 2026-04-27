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
  const { data, error } = await supabase
    .from("leave_requests")
    .select("*")
    .order("created_at", { ascending: false });

  console.log("LEAVE DATA:", data);

  if (error) {
    console.log(error);
    return;
  }

  setRequests(data);
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
      <h2>Leave Requests</h2>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table border="1" width="100%">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Dates</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {requests?.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: "center" }}>
                  No leave requests
                </td>
              </tr>
            ) : (
              requests.map((req) => (
                <tr key={req.id}>
                  <td>{req.employee_profiles?.full_name || "Unknown"}</td>
                  <td>{req.leave_type}</td>
                  <td>
                    {req.start_date} - {req.end_date}
                  </td>
                  <td>{req.reason}</td>

                  {/* STATUS WITH COLOR */}
                  <td>
                    <span
                      style={{
                        color:
                          req.status === "Approved"
                            ? "green"
                            : req.status === "Rejected"
                            ? "red"
                            : "orange",
                        fontWeight: "bold",
                      }}
                    >
                      {req.status}
                    </span>
                  </td>

                  {/* ACTION BUTTONS */}
                  <td>
                    {req.status === "Pending" ? (
                      <>
                        <button
                          onClick={() =>
                            updateStatus(req.id, "Approved")
                          }
                        >
                          Approve
                        </button>

                        <button
                          onClick={() =>
                            updateStatus(req.id, "Rejected")
                          }
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <span>—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </ManagerLayout>
  );
}