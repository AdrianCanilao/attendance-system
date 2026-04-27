import { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import EmployeeLayout from "../layouts/EmployeeLayout";
import Webcam from "react-webcam";

export default function EmployeeDashboard() {
  const [name, setName] = useState("");
  const [status, setStatus] = useState("Absent");
  const [timeIn, setTimeIn] = useState("-");
  const [timeOut, setTimeOut] = useState("-");
  const [loading, setLoading] = useState(false);

  const webcamRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;

    if (!user) return;

    // 🔹 PROFILE
    const { data: profile } = await supabase
      .from("employee_profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    setName(profile?.full_name || "Employee");

    const today = new Date().toISOString().split("T")[0];

    // 🔹 ATTENDANCE
    const { data: attendance } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("employee_id", user.id)
      .eq("log_date", today)
      .maybeSingle();

    // 🔹 LEAVE
    const { data: leave } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("employee_id", user.id)
      .eq("status", "Approved");

    let currentStatus = "Absent";

    if (attendance?.time_in) {
      currentStatus = "Present";
    } else if (leave?.length > 0) {
      currentStatus = "On Leave";
    }

    setStatus(currentStatus);
    setTimeIn(attendance?.time_in || "-");
    setTimeOut(attendance?.time_out || "-");
  };

  // 🔥 FACE SCAN
  const handleScan = async () => {
  if (loading) return;

  try {
    setLoading(true);

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    const blob = await fetch(imageSrc).then(res => res.blob());

    const formData = new FormData();
    formData.append("file", blob, "face.jpg");

    const res = await fetch("http://127.0.0.1:8000/recognize", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (data.status === "Match" && data.user === user.id) {
      console.log("✅ Face recognized");

      const today = new Date().toISOString().split("T")[0];

      const { data: existing } = await supabase
        .from("attendance_logs")
        .select("*")
        .eq("employee_id", user.id)
        .eq("log_date", today)
        .maybeSingle();

      if (!existing) {
        console.log("RUNNING INSERT HERE - attendance_logs");

await supabase.from("attendance_logs").insert({
  employee_id: user.id,
  log_date: today,
  time_in: new Date().toISOString(),
});

      } else if (!existing.time_out) {
        await supabase
          .from("attendance_logs")
          .update({ time_out: new Date().toISOString() })
          .eq("id", existing.id);
      }

      loadData();
    }

  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false);
  }
};

  return (
    <EmployeeLayout>
      <h2>Welcome, {name}</h2>

      {/* STATUS */}
      <div style={styles.card}>
        <h3>
          Status: <span style={styles.status(status)}>{status}</span>
        </h3>
        <p>Time In: {timeIn}</p>
        <p>Time Out: {timeOut}</p>
      </div>

      {/* CAMERA */}
      <div style={styles.cameraBox}>
        <Webcam
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          style={styles.camera}
        />

        <button
          style={styles.scanBtn}
          onClick={handleScan}
          disabled={loading}
        >
          {loading ? "Scanning..." : "Scan Face"}
        </button>
      </div>

      {/* REFRESH */}
      <div style={styles.actions}>
        <button style={styles.btn} onClick={loadData}>
          Refresh
        </button>
      </div>
    </EmployeeLayout>
  );
}

const styles = {
  card: {
    background: "#fff",
    padding: "20px",
    borderRadius: "10px",
    marginTop: "20px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
  },

  cameraBox: {
    marginTop: "30px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
  },

  camera: {
    width: "320px",
    borderRadius: "10px",
  },

  scanBtn: {
    padding: "12px 20px",
    background: "#f97316",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
  },

  actions: {
    marginTop: "20px",
    display: "flex",
    gap: "10px",
  },

  btn: {
    padding: "10px 20px",
    background: "#555",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
  },

  status: (status) => ({
    color:
      status === "Present"
        ? "green"
        : status === "On Leave"
        ? "orange"
        : "red",
  }),
};