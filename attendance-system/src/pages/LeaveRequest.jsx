import { useState } from "react";
import { supabase } from "../supabaseClient";
import EmployeeLayout from "../layouts/EmployeeLayout";

export default function LeaveRequest() {
  const [type, setType] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");

  const submitLeave = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      alert("Not logged in");
      return;
    }

    console.log("RUNNING INSERT HERE");
    
    const { error } = await supabase.from("leave_requests").insert({
      employee_id: user.id,
      leave_type: type,
      start_date: start,
      end_date: end,
      reason: reason,
      status: "Pending",
    });

    if (error) {
      console.log(error);
      alert("Error submitting leave");
      return;
    }

    alert("Leave request submitted!");
  };

  return (
    <EmployeeLayout>
      <h2>Leave Request</h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "300px" }}>
        
        <select onChange={(e) => setType(e.target.value)}>
          <option value="">Select Type</option>
          <option value="Sick">Sick</option>
          <option value="Vacation">Vacation</option>
          <option value="Emergency">Emergency</option>
        </select>

        <input type="date" onChange={(e) => setStart(e.target.value)} />
        <input type="date" onChange={(e) => setEnd(e.target.value)} />

        <textarea
          placeholder="Reason"
          onChange={(e) => setReason(e.target.value)}
        />

        <button onClick={submitLeave}>Submit</button>
      </div>
    </EmployeeLayout>
  );
}