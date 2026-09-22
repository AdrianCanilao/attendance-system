import { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import EmployeeLayout from "../layouts/EmployeeLayout";
import ManagerLayout from "../layouts/ManagerLayout";
import Webcam from "react-webcam";
import { logAudit } from "../utils/auditLogger";

const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const INSIGHTFACE_URL = (import.meta.env.VITE_INSIGHTFACE_URL || "http://127.0.0.1:8002").replace(/\/$/, "");

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
const recognizingFaceRef = useRef(false);

const [showCamera, setShowCamera] = useState(false);
const [scanAction, setScanAction] = useState(null);
const [faceStatus, setFaceStatus] = useState({
  valid: false,
  message: "Position your face inside the camera.",
  box: null,
});
const [checkingFace, setCheckingFace] = useState(false);
const [currentEmployeeId, setCurrentEmployeeId] = useState(null);

const [detectedFace, setDetectedFace] = useState(null);

const [identityVerified, setIdentityVerified] = useState(false);

const [recognizingFace, setRecognizingFace] = useState(false);
  const location = window.location.pathname;

  const managerMode =
  isManager ||
  location.includes("/manager") ||
  location.includes("/maintenance");

  const ROLE_IDS = {
  maintenance:
      "b381a7a0-9595-4c69-abf1-5c15a827647a",

    employee:
      "e4dbb928-7f0e-4da9-9eff-d7700d37b25a",
  };
  const GRACE_MINUTES = 10;

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

    setCurrentEmployeeId(employeeId);

    setName(profile.full_name || "Employee");

    setProfileClockIn(
      profile.clock_in || "-"
    );

    setProfileClockOut(
      profile.clock_out || "-"
    );

    const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

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

  // Capture the same 8 verification frames, but sample more frequently
  // so a quick blink is less likely to be missed.
  for (let i = 0; i < 8; i++) {
    const image = webcamRef.current.getScreenshot();

    if (!image) {
      continue;
    }

    const blob = await fetch(image).then((res) => res.blob());

    frames.push(blob);

    // Capture every 200 ms.
    await new Promise((res) => setTimeout(res, 200));
  }

  return frames;
};
const validateLiveFace = async () => {
  if (!webcamRef.current) return;

  if (recognizingFaceRef.current) return;

  recognizingFaceRef.current = true;

  const image = webcamRef.current.getScreenshot();

  if (!image) return;

  try {
    setCheckingFace(true);
    setRecognizingFace(true);

    const blob = await fetch(image).then((res) =>
      res.blob()
    );

    const formData = new FormData();

    formData.append(
      "file",
      blob,
      "live-face.jpg"
    );

    // ========================================================
    // 1. EXISTING FACE VALIDATION
    // ========================================================

    const validationResponse = await fetch(
      API_URL + "/validate-face",
      {
        method: "POST",
        body: formData,
      }
    );

    const validationData =
      await validationResponse.json();

    setFaceStatus(validationData);

    // If face position/quality is invalid,
    // don't run recognition.
    if (!validationData.valid) {
      setDetectedFace(null);
      setIdentityVerified(false);
      return;
    }

    // ========================================================
    // 2. INSIGHTFACE RECOGNITION
    // ========================================================

    const recognitionResponse = await fetch(
      INSIGHTFACE_URL + "/recognize-live-face",
      {
        method: "POST",
        body: formData,
      }
    );

    if (!recognitionResponse.ok) {
      throw new Error(
        "InsightFace recognition server error"
      );
    }

    const recognitionData =
      await recognitionResponse.json();

    console.log(
      "INSIGHTFACE RESULT:",
      recognitionData
    );

    // ========================================================
    // 3. UNKNOWN FACE
    // ========================================================

    if (
      recognitionData.status !== "Match"
    ) {
      setDetectedFace({
        name: null,
        distance: recognitionData.distance,
      });

      setIdentityVerified(false);

      setFaceStatus({
        ...validationData,
        message: "Unknown face.",
      });

      return;
    }

    // ========================================================
    // 4. DISPLAY DETECTED EMPLOYEE
    // ========================================================

    const detectedEmployeeId =
      recognitionData.employee_id;

    const detectedEmployeeName =
      recognitionData.full_name;

    setDetectedFace({
      name: detectedEmployeeName,
      distance: recognitionData.distance,
      employeeId: detectedEmployeeId,
    });

    // ========================================================
    // 5. COMPARE WITH LOGGED-IN EMPLOYEE
    // ========================================================

    if (
      detectedEmployeeId === currentEmployeeId
    ) {
      setIdentityVerified(true);

      setFaceStatus({
        ...validationData,
        message: "Identity verified.",
      });

      console.log(
        "IDENTITY VERIFIED:",
        detectedEmployeeName
      );
    } else {
      setIdentityVerified(false);

      setFaceStatus({
        ...validationData,
        message:
          "Detected face does not match the logged-in employee.",
      });

      console.log(
        "IDENTITY MISMATCH:",
        detectedEmployeeName
      );
    }

  } catch (error) {

    console.error(
      "Live face recognition error:",
      error
    );

    setDetectedFace(null);
    setIdentityVerified(false);
    recognizingFaceRef.current = false;

    setFaceStatus({
      valid: false,
      message:
        "Face recognition unavailable.",
      box: null,
    });

  } finally {

    setCheckingFace(false);
    setRecognizingFace(false);
    recognizingFaceRef.current = false;
  }
};
useEffect(() => {
  if (!showCamera || identityVerified) {
    return;
  }

  const interval = setInterval(() => {
    validateLiveFace();
  }, 700);

  return () => {
    clearInterval(interval);
  };
}, [showCamera, currentEmployeeId, identityVerified]);
const openAttendanceCamera = (actionType) => {
  if (loading) return;

    setScanAction(actionType);

    setDetectedFace(null);

    setIdentityVerified(false);

    setFaceStatus({
      valid: false,
      message: "Position your face inside the box.",
      box: null,
    });

    setShowCamera(true);
};

const handleScan = async (
  actionType
) => {
  if (loading) return;

  if (!identityVerified) {
    alert("Please verify your identity first.");
    return;
  }

  try {
      setLoading(true);

      const frames =
        await captureFrames();
        if (frames.length < 2) {
  alert("Unable to capture enough frames.");
  return;
}

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
      `
      id,
      full_name,
      role_id,
      clock_in,
      clock_out
      `
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

const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const now = new Date();

const scheduledClockIn = new Date(
  `${today}T${profile.clock_in}`
);

const scheduledClockOut = new Date(
  `${today}T${profile.clock_out}`
);

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
        API_URL + "/verify-face",
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
         const graceLimit = new Date(scheduledClockIn);

  graceLimit.setMinutes(
    graceLimit.getMinutes() + GRACE_MINUTES
  );

  let attendanceStatus = "Present";
  let lateMinutes = 0;

  if (now > graceLimit) {
    attendanceStatus = "Late";

    lateMinutes = Math.floor(
      (now - graceLimit) / 60000
    );
  }

        const { error: attendanceInsertError } =
          await supabase
            .from("attendance_logs")
            .insert({
              employee_id: employeeId,
              log_date: today,
              time_in: now.toISOString(),
              scheduled_time_in: profile.clock_in,
              scheduled_time_out: profile.clock_out,
              late_minutes: lateMinutes,
              overtime_minutes: 0,
              status: attendanceStatus,
              time_in_face_url: faceUrl,
            });

        if (attendanceInsertError) {
          throw new Error(
            "Attendance Time In could not be saved: " +
            attendanceInsertError.message
          );
        }

        await logAudit({
          user_id: employeeId,

          user_name:
            profile.full_name,

          role: managerMode
  ? "maintenance"
  : "employee",

          action: "TIME_IN",

          description: `${profile.full_name} timed in`,
        });
      } else {

  let overtimeMinutes = 0;

  if (now > scheduledClockOut) {
    overtimeMinutes = Math.floor(
      (now - scheduledClockOut) / 60000
    );
  }

  const { error: attendanceUpdateError } =
    await supabase
      .from("attendance_logs")
      .update({
        time_out: now.toISOString(),
        overtime_minutes: overtimeMinutes,
        time_out_face_url: faceUrl,
      })
      .eq("employee_id", employeeId)
      .eq("log_date", today)
      .is("time_out", null);

  if (attendanceUpdateError) {
    throw new Error(
      "Attendance Time Out could not be saved: " +
      attendanceUpdateError.message
    );
  }


        await logAudit({
          user_id: employeeId,

          user_name:
            profile.full_name,

          role: managerMode
  ? "maintenance"
  : "employee",

          action: "TIME_OUT",

          description: `${profile.full_name} timed out`,
        });
      }

      setShowCamera(false);
      setScanAction(null);
      setFaceStatus({
        valid: false,
        message: "Position your face inside the camera.",
        box: null,
      });

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

        <div style={styles.attendanceButtons}>
          <button
            style={styles.primaryBtn}
            onClick={() =>
              openAttendanceCamera("time_in")
            }
            disabled={loading}
          >
            Time In
          </button>

          <button
            style={styles.secondaryBtn}
            onClick={() =>
              openAttendanceCamera("time_out")
            }
            disabled={loading}
          >
            Time Out
          </button>

      </div>

      {showCamera && (
        <div style={styles.cameraOverlay}>

          <div style={styles.cameraModal}>

            <h2>
              {scanAction === "time_in"
                ? "Time In"
                : "Time Out"}
            </h2>

            <p style={styles.cameraInstruction}>
              Position your face inside the box
            </p>

            <div style={styles.cameraWrapper}>

              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{
                  width: 320,
                  height: 240,
                  facingMode: "user",
                }}
                style={styles.camera}
              />

              {faceStatus.box && (
                <div
                  style={{
                    ...styles.faceBox,
                    left: `${faceStatus.box.x}px`,
                    top: `${faceStatus.box.y}px`,
                    width: `${faceStatus.box.w}px`,
                    height: `${faceStatus.box.h}px`,
                    borderColor: faceStatus.valid
                      ? "#22c55e"
                      : "#ef4444",
                  }}
                />
              )}

            </div>

            <div
              style={{
                ...styles.faceStatus,
                color: identityVerified
                  ? "#16a34a"
                  : detectedFace?.name
                  ? "#dc2626"
                  : "#6b7280",
              }}
            >
              {identityVerified
                ? "Identity verified."
                : detectedFace?.name
                ? "Identity does not match the logged-in employee."
                : "Scanning for your face..."}
            </div>

            <div
              style={{
                marginTop: "10px",
                height: "48px",
                fontWeight: "600",
                color: identityVerified
                  ? "#16a34a"
                  : detectedFace?.name
                  ? "#dc2626"
                  : "#6b7280",
              }}
            >
              {detectedFace?.name ? (
                <>
                  Detected Face: {detectedFace.name}

                  <div
                    style={{
                      fontSize: "13px",
                      marginTop: "4px",
                      color: "#6b7280",
                      fontWeight: "400",
                    }}
                  >
                    Recognition distance:{" "}
                    {detectedFace.distance?.toFixed(4)}
                  </div>
                </>
              ) : (
                <span style={{ visibility: "hidden" }}>
                  Detected Face: —
                  <div>Recognition distance: —</div>
                </span>
              )}
            </div>

            <div
              style={{
                marginTop: "8px",
                height: "24px",
                fontWeight: "700",
                lineHeight: "24px",
              }}
            >
              {identityVerified ? (
                <span style={{ color: "#16a34a" }}>
                  🟢 Identity Verified
                </span>
              ) : detectedFace?.name ? (
                <span style={{ color: "#dc2626" }}>
                  🔴 Identity does not match
                </span>
              ) : (
                <span style={{ visibility: "hidden" }}>
                  🔴 Identity does not match
                </span>
              )}
            </div>

            <p style={styles.blinkText}>
              When ready, blink once during scanning.
            </p>

            <div style={styles.actions}>

              <button
                style={styles.primaryBtn}
                onClick={() =>
                  handleScan(scanAction)
                }
                disabled={
                loading ||
                !faceStatus.valid ||
                !identityVerified
              }
              >
                {loading
                  ? "Processing..."
                  : identityVerified
                  ? "Scan Attendance"
                  : "Verify Identity First"}
              </button>

              <button
                style={styles.secondaryBtn}
                onClick={() => {
                  setShowCamera(false);
                  setScanAction(null);
                }}
                disabled={loading}
              >
                Cancel
              </button>

            </div>

          </div>

        </div>
      )}
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
  cameraOverlay: {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.65)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
},

cameraModal: {
  background: "#fff",
  padding: "25px",
  borderRadius: "16px",
  width: "380px",
  maxWidth: "90%",
  textAlign: "center",
  boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
},

cameraInstruction: {
  marginBottom: "15px",
  color: "#6b7280",
},

cameraWrapper: {
  position: "relative",
  width: "320px",
  height: "240px",
  margin: "0 auto",
  overflow: "hidden",
  borderRadius: "10px",
  background: "#000",
},

camera: {
  width: "320px",
  height: "240px",
  display: "block",
},

faceBox: {
  position: "absolute",
  border: "3px solid",
  borderRadius: "10px",
  pointerEvents: "none",
  boxSizing: "border-box",
},

faceStatus: {
  marginTop: "15px",
  fontWeight: "600",
  height: "24px",
  lineHeight: "24px",
  overflow: "hidden",
},
blinkText: {
  fontSize: "14px",
  color: "#6b7280",
  marginTop: "10px",
  height: "20px",
  lineHeight: "20px",
},
  attendanceButtons: {
    display: "flex",
    justifyContent: "center",
    gap: "15px",
    marginTop: "10px",
    marginBottom: "25px",
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