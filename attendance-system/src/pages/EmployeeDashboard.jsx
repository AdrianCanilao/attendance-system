import { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import EmployeeLayout from "../layouts/EmployeeLayout";
import ManagerLayout from "../layouts/ManagerLayout";
import Webcam from "react-webcam";
import { logAudit } from "../utils/auditLogger";

export default function EmployeeDashboard({
  isManager = false,
}) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState("Absent");
  const [timeIn, setTimeIn] = useState("-");
  const [timeOut, setTimeOut] = useState("-");
  const [profileClockIn, setProfileClockIn] = useState("-");
  const [profileClockOut, setProfileClockOut] = useState("-");
  const [loading, setLoading] = useState(false);

  const webcamRef = useRef(null);

  const location = window.location.pathname;

  const managerMode =
    isManager ||
    location.includes("/manager");

  const ROLE_IDS = {
    manager:
      "b381a7a0-9595-4c69-abf1-5c15a827647a",

    employee:
      "e4dbb928-7f0e-4da9-9eff-d7700d37b25a",
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatDateTime = (dateString) => {
    if (!dateString || dateString === "-")
      return "-";

    const date = new Date(dateString);

    return date.toLocaleString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatTime = (time) => {
    if (!time || time === "-") return "-";

    const [hours, minutes] = time.split(":");

    let hour = parseInt(hours);

    const ampm =
      hour >= 12 ? "PM" : "AM";

    hour = hour % 12;
    hour = hour ? hour : 12;

    return `${hour}:${minutes} ${ampm}`;
  };

  const loadData = async () => {
    const { data: userData } =
      await supabase.auth.getUser();

    const user = userData?.user;

    if (!user) return;

    const { data: profile, error } =
      await supabase
        .from("employee_profiles")
        .select(
          "id, full_name, clock_in, clock_out, role_id"
        )
        .eq("id", user.id)
        .single();

    console.log("PROFILE:", profile);
    console.log("PROFILE ERROR:", error);

    if (!profile) return;

    const employeeId = profile.id;

    setName(profile.full_name || "Employee");

    setProfileClockIn(
      profile.clock_in || "-"
    );

    setProfileClockOut(
      profile.clock_out || "-"
    );

    const today = new Date()
      .toISOString()
      .split("T")[0];

    const { data: attendance } =
      await supabase
        .from("attendance_logs")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("log_date", today)
        .maybeSingle();

    const { data: leave } =
      await supabase
        .from("leave_requests")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("status", "Approved");

    let currentStatus = "Absent";

    if (attendance?.time_in)
      currentStatus = "Present";
    else if (leave?.length > 0)
      currentStatus = "On Leave";

    setStatus(currentStatus);

    setTimeIn(attendance?.time_in || "-");

    setTimeOut(
      attendance?.time_out || "-"
    );
  };

  const captureFrames = async () => {
    const frames = [];

    await new Promise((res) =>
      setTimeout(res, 2000)
    );

    for (let i = 0; i < 5; i++) {
      const image =
        webcamRef.current.getScreenshot();

      const blob = await fetch(image).then(
        (res) => res.blob()
      );

      frames.push(blob);

      await new Promise((res) =>
        setTimeout(res, 600)
      );
    }

    return frames;
  };

  const handleScan = async (
    actionType
  ) => {
    if (loading) return;

    try {
      setLoading(true);

      const frames =
        await captureFrames();

      const { data: userData } =
        await supabase.auth.getUser();

      const user = userData?.user;

      if (!user) {
        alert("User not found");
        return;
      }

      const { data: profile, error } =
        await supabase
          .from("employee_profiles")
          .select(
            "id, full_name, role_id"
          )
          .eq("id", user.id)
          .single();

      console.log(
        "SCAN PROFILE:",
        profile
      );

      console.log(
        "SCAN ERROR:",
        error
      );

      if (!profile) {
        alert("Profile not found");
        return;
      }

      const employeeId = profile.id;

      const today = new Date()
        .toISOString()
        .split("T")[0];

      const { data: existing } =
        await supabase
          .from("attendance_logs")
          .select("*")
          .eq("employee_id", employeeId)
          .eq("log_date", today)
          .maybeSingle();

      if (
        actionType === "time_in" &&
        existing?.time_in
      ) {
        alert("Already timed in today");
        return;
      }

      if (
        actionType === "time_out" &&
        !existing?.time_in
      ) {
        alert("You must time-in first");
        return;
      }

      if (
        actionType === "time_out" &&
        existing?.time_out
      ) {
        alert("Already timed out today");
        return;
      }

      const formData = new FormData();

      frames.forEach((blob) =>
        formData.append("files", blob)
      );

      formData.append(
        "user_id",
        user.id
      );

      formData.append(
        "full_name",
        profile.full_name
      );

      console.log(
        "Sending to FastAPI..."
      );

      const res = await fetch(
        "http://localhost:8000/verify-face",
        {
          method: "POST",
          body: formData,
        }
      );

      console.log(
        "FASTAPI RESPONSE:",
        res
      );

      if (!res.ok) {
        alert(
          "FastAPI server error"
        );

        setLoading(false);

        return;
      }

      const result =
        await res.json();

      console.log(
        "FACE RESULT:",
        result
      );

      if (
        result.status !== "Match"
      ) {
        alert(
          "Face not recognized"
        );

        return;
      }

      const safeName =
        profile.full_name
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "_");

      const firstBlob = frames[0];

      const fileName = `attendance/${safeName}/${actionType}/${Date.now()}.jpg`;

      const {
        error: uploadError,
      } = await supabase.storage
        .from("faces")
        .upload(fileName, firstBlob, {
          upsert: true,
        });

      if (uploadError) {
        console.log(uploadError);

        alert("Upload failed");

        return;
      }

      const { data: urlData } =
        supabase.storage
          .from("faces")
          .getPublicUrl(fileName);

      const faceUrl =
        urlData.publicUrl;

      if (
        actionType === "time_in"
      ) {
        await supabase
          .from("attendance_logs")
          .insert({
            employee_id: employeeId,

            log_date: new Date()
              .toISOString()
              .split("T")[0],

            time_in:
              new Date().toISOString(),

            time_in_face_url:
              faceUrl,
          });

        await logAudit({
          user_id: employeeId,

          user_name:
            profile.full_name,

          role: managerMode
            ? "manager"
            : "employee",

          action: "TIME_IN",

          description: `${profile.full_name} timed in`,
        });
      } else {
        await supabase
          .from("attendance_logs")
          .update({
            time_out:
              new Date().toISOString(),

            time_out_face_url:
              faceUrl,
          })
          .eq(
            "employee_id",
            employeeId
          )
          .is("time_out", null);

        await logAudit({
          user_id: employeeId,

          user_name:
            profile.full_name,

          role: managerMode
            ? "manager"
            : "employee",

          action: "TIME_OUT",

          description: `${profile.full_name} timed out`,
        });
      }

      alert(
        "Attendance recorded"
      );

      loadData();
    } catch (err) {
      console.error(err);

      alert("Scan failed");
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>
          Take Attendance
        </h1>
      </div>

      <div style={styles.cards}>
        <div style={styles.card}>
          <p>Status</p>

          <h3 style={styles.status(status)}>
            {status}
          </h3>
        </div>

        <div style={styles.card}>
          <p>Time In</p>

          <h3>
            {formatDateTime(timeIn)}
          </h3>
        </div>

        <div style={styles.card}>
          <p>Time Out</p>

          <h3>
            {formatDateTime(timeOut)}
          </h3>
        </div>

        <div style={styles.card}>
          <p>Registered Clock In</p>

          <h3>
            {formatTime(
              profileClockIn
            )}
          </h3>
        </div>

        <div style={styles.card}>
          <p>
            Registered Clock Out
          </p>

          <h3>
            {formatTime(
              profileClockOut
            )}
          </h3>
        </div>
      </div>

      <div style={styles.cameraCard}>
        <p>
          Please blink your eyes
          during scanning
        </p>

        <Webcam
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          style={styles.camera}
        />

        <div style={styles.actions}>
          <button
            style={styles.primaryBtn}
            onClick={() =>
              handleScan("time_in")
            }
            disabled={loading}
          >
            {loading
              ? "Processing..."
              : "Time In"}
          </button>

          <button
            style={styles.secondaryBtn}
            onClick={() =>
              handleScan("time_out")
            }
            disabled={loading}
          >
            {loading
              ? "Processing..."
              : "Time Out"}
          </button>
        </div>
      </div>
    </>
  );

if (managerMode) {
  return content;
}

return (
  <EmployeeLayout>
    {content}
  </EmployeeLayout>
);
}

const styles = {
  cards: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "20px",
    marginBottom: "25px",
  },

  card: {
    background: "#fff",
    padding: "20px",
    borderRadius: "12px",
    border: "2px solid #e5e7eb",
  },

  cameraCard: {
    background: "#fff",
    padding: "20px",
    borderRadius: "12px",
    border: "2px solid #e5e7eb",
    textAlign: "center",
  },

  camera: {
    width: "320px",
    marginBottom: "15px",
  },

  actions: {
    display: "flex",
    justifyContent: "center",
    gap: "12px",
  },

  primaryBtn: {
    padding: "10px 20px",
    background: "#f97316",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  },

  secondaryBtn: {
    padding: "10px 20px",
    background: "#374151",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  },

  pageHeader: {
    marginBottom: "25px",
    paddingTop: "10px",
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

  status: (status) => ({
    color:
      status === "Present"
        ? "green"
        : status === "On Leave"
        ? "orange"
        : "red",
  }),
};