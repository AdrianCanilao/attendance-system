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

  const captureFrames = async () => {
    const frames = [];
    await new Promise((res) => setTimeout(res, 2000));

    for (let i = 0; i < 5; i++) {
      const image = webcamRef.current.getScreenshot();
      const blob = await fetch(image).then((res) => res.blob());
      frames.push(blob);
      await new Promise((res) => setTimeout(res, 600));
    }

    return frames;
  };

  const handleScan = async (actionType) => {
    console.log("🔥 BUTTON CLICKED:", actionType);

    if (loading) return;

    try {
      setLoading(true);

      const frames = await captureFrames();

      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) {
        alert("User not found");
        return;
      }

      const { data: profile } = await supabase
        .from("employee_profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      const today = new Date().toISOString().split("T")[0];

      const { data: existing } = await supabase
        .from("attendance_logs")
        .select("*")
        .eq("employee_id", user.id)
        .eq("log_date", today)
        .maybeSingle();

      // 🚫 VALIDATION
      if (actionType === "time_in" && existing?.time_in) {
        alert("Already timed in today");
        return;
      }

      if (actionType === "time_out" && !existing?.time_in) {
        alert("You must time-in first");
        return;
      }

      if (actionType === "time_out" && existing?.time_out) {
        alert("Already timed out today");
        return;
      }

      // 🔥 VERIFY FACE
      const formData = new FormData();
      frames.forEach((blob) => formData.append("files", blob));
      formData.append("user_id", user.id);
      formData.append("full_name", profile.full_name);

      const res = await fetch("http://localhost:8000/verify-face", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.status !== "Match") {
        alert("Face not recognized");
        return;
      }

      // 🔥 FILE STRUCTURE
      const safeName = profile.full_name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_");

      const firstBlob = frames[0];

      // 🔥 CREATE FOLDERS IF FIRST TIME-IN
      if (actionType === "time_in") {
        await supabase.storage
          .from("faces")
          .upload(`attendance/${safeName}/time_in/.init.jpg`, firstBlob, { upsert: true });

        await supabase.storage
          .from("faces")
          .upload(`attendance/${safeName}/time_out/.init.jpg`, firstBlob, { upsert: true });
      }

      const fileName = `attendance/${safeName}/${actionType}/${Date.now()}.jpg`;

      console.log("📁 Uploading:", fileName);

      const { error: uploadError } = await supabase.storage
        .from("faces")
        .upload(fileName, firstBlob, { upsert: true });

      if (uploadError) {
        console.error(uploadError);
        alert("Upload failed");
        return;
      }

      // 🔥 AUTO DELETE INIT FILE
      const initPath = `attendance/${safeName}/${actionType}/.init.jpg`;

      await supabase.storage
        .from("faces")
        .remove([initPath])
        .catch(() => {});

      const { data: urlData } = supabase.storage
        .from("faces")
        .getPublicUrl(fileName);

      const faceUrl = urlData.publicUrl;

      // 🔥 SAVE DB
      if (actionType === "time_in") {
        await supabase.from("attendance_logs").insert({
          employee_id: user.id,
          log_date: today,
          time_in: new Date().toISOString(),
          face_url: faceUrl,
        });
      } else {
        await supabase
          .from("attendance_logs")
          .update({
            time_out: new Date().toISOString(),
            face_url: faceUrl,
          })
          .eq("id", existing.id);
      }

      alert("Attendance recorded");
      loadData();

    } catch (err) {
      console.error(err);
      alert("Scan failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <EmployeeLayout>
      <h2>Welcome, {name}</h2>

      <div style={styles.card}>
        <h3>Status: <span style={styles.status(status)}>{status}</span></h3>
        <p>Time In: {timeIn}</p>
        <p>Time Out: {timeOut}</p>
      </div>

      <div style={styles.cameraBox}>
        <p>Please blink your eyes during scanning</p>

        <Webcam
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          style={styles.camera}
        />

        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={() => handleScan("time_in")} disabled={loading}>
            {loading ? "Processing..." : "Time In"}
          </button>

          <button onClick={() => handleScan("time_out")} disabled={loading}>
            {loading ? "Processing..." : "Time Out"}
          </button>
        </div>
      </div>

      <button onClick={loadData}>Refresh</button>
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