import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import EmployeeLayout from "../layouts/EmployeeLayout";

export default function MyLeave() {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    fetchMyLeave();
  }, []);

  const fetchMyLeave = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    const { data } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("employee_id", user.id)
      .order("created_at", { ascending: false });

    setRequests(data);
  };

  return (
    <EmployeeLayout>
      <h2>My Leave Requests</h2>

      <table border="1" width="100%">
        <thead>
          <tr>
            <th>Type</th>
            <th>Dates</th>
            <th>Reason</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {requests?.map((req) => (
            <tr key={req.id}>
              <td>{req.leave_type}</td>
              <td>{req.start_date} - {req.end_date}</td>
              <td>{req.reason}</td>
              <td>{req.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </EmployeeLayout>
  );
}