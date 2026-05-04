import { useState } from "react";
import { supabase } from "../supabaseClient";
import EmployeeLayout from "../layouts/EmployeeLayout";

export default function LeaveRequest() {
  const [type, setType] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");


  // 🔥 GET employee_profiles ID (IMPORTANT)
const submitLeave = async () => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user;

  if (userError || !user) {
    alert("Not logged in");
    return;
  }

  // 🔒 Basic validation
  if (!type || !start || !end) {
    alert("Please fill all required fields");
    return;
  }

  try {
    // 🔥 GET employee profile
    const { data: profile, error: profileError } = await supabase
      .from("employee_profiles")
      .select("id")
      .eq("email", user.email)
      .single();

    if (profileError || !profile) {
      console.log("PROFILE ERROR:", profileError);
      alert("Employee profile not found");
      return;
    }

    // 🔥 INSERT LEAVE REQUEST (CORRECT ID)
    const { error: insertError } = await supabase
      .from("leave_requests")
      .insert([
        {
          employee_id: profile.id, // ✅ CORRECT
          leave_type: type,
          start_date: start,
          end_date: end,
          reason: reason || null,
          status: "Pending",
        },
      ]);

    if (insertError) {
      console.log("INSERT ERROR:", insertError);
      alert("Error submitting leave");
      return;
    }

    alert("Leave request submitted!");

    // 🔄 Optional reset
    setType("");
    setStart("");
    setEnd("");
    setReason("");

  } catch (err) {
    console.log("UNEXPECTED ERROR:", err);
    alert("Something went wrong");
  }
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