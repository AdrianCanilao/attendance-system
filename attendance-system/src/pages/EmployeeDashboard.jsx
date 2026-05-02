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

    const { data: profile } = await supabase
      .from("employee_profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    setName(profile?.full_name || "Employee");

    const today = new Date().toISOString().split("T")[0];

    const { data: attendance } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("employee_id", user.id)
      .eq("log_date", today)
      .maybeSingle();

    const { data: leave } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("employee_id", user.id)
      .eq("status", "Approved");

    let currentStatus = "Absent";

    if (attendance?.time_in) currentStatus = "Present";
    else if (leave?.length > 0) currentStatus = "On Leave";

    setStatus(currentStatus);
    setTimeIn(attendance?.time_in || "-");
    setTimeOut(attendance?.time_out || "-");
  };

  // 🔥 NEW: MULTI-FRAME CAPTURE
  const captureFrames = async () => {
  const frames = [];


  await new Promise((res) => setTimeout(res, 2000)); // 2 sec prep time

  for (let i = 0; i < 5; i++) {
    const image = webcamRef.current.getScreenshot();
    const blob = await fetch(image).then((res) => res.blob());

    frames.push(blob);

    // 🔥 LONGER DELAY BETWEEN FRAMES
    await new Promise((res) => setTimeout(res, 600));
  }

  return frames;
};

  // 🔥 FACE SCAN + SAVE IMAGE
  const handleScan = async () => {
    console.log("🔥 BUTTON CLICKED"); // ADD THIS

    alert("Please blink your eyes during scanning"); // ✅ NEW

    if (loading) return;

    try {
      setLoading(true);

      const frames = await captureFrames(); // ✅ FIXED

      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      if (!user) {
        alert("User not found");
        return;
      }

      // 🔥 VERIFY FACE
      const formData = new FormData();

      frames.forEach((blob) => {
        formData.append("files", blob); // ✅ CORRECT
      });

      formData.append("user_id", user.id);

      console.log("🚀 Sending request...");
      const res = await fetch("http://localhost:8000/verify-face", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      console.log("✅ Response:", data);
      if (data.status !== "Match") {
        alert("❌ Face not recognized");
        return;
      }

      console.log("✅ Face verified");

      const today = new Date().toISOString().split("T")[0];

      // 🔥 USE FIRST FRAME FOR STORAGE
      const firstBlob = frames[0];

      const fileName = `attendance/${user.id}_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("faces")
        .upload(fileName, firstBlob, { upsert: true });

      if (uploadError) {
        console.error(uploadError);
        alert("Image upload failed");
        return;
      }

      const { data: urlData } = supabase.storage
        .from("faces")
        .getPublicUrl(fileName);

      const faceUrl = urlData.publicUrl;

      const { data: existing } = await supabase
        .from("attendance_logs")
        .select("*")
        .eq("employee_id", user.id)
        .eq("log_date", today)
        .maybeSingle();

      if (!existing) {
        await supabase.from("attendance_logs").insert({
          employee_id: user.id,
          log_date: today,
          time_in: new Date().toISOString(),
          face_url: faceUrl,
        });
      } else if (!existing.time_out) {
        await supabase
          .from("attendance_logs")
          .update({
            time_out: new Date().toISOString(),
            face_url: faceUrl,
          })
          .eq("id", existing.id);
      }

      alert("✅ Attendance recorded");
      loadData();

    } catch (err) {
      console.error("SCAN ERROR:", err);
      alert("Error scanning face");
    } finally {
      setLoading(false);
    }
  };

  return (
    <EmployeeLayout>
      <h2>Welcome, {name}</h2>

      <div style={styles.card}>
        <h3>
          Status: <span style={styles.status(status)}>{status}</span>
        </h3>
        <p>Time In: {timeIn}</p>
        <p>Time Out: {timeOut}</p>
      </div>

      <div style={styles.cameraBox}>
        <p style={{ fontWeight: "600", marginBottom: "10px" }}>
  Please blink your eyes during scanning
</p>
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
    borderRadius: "6px",
    cursor: "pointer",
  },

  actions: {
    marginTop: "20px",
  },

  btn: {
    padding: "10px 20px",
    background: "#555",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
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