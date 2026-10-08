import { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import EmployeeLayout from "../layouts/EmployeeLayout";
import ManagerLayout from "../layouts/ManagerLayout";
import Webcam from "react-webcam";
import { logAudit } from "../utils/auditlogger";

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

const [showCamera, setShowCamera] = useState(false);
const [verificationAlert, setVerificationAlert] = useState(null);
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
const [recognitionStatus, setRecognitionStatus] = useState("scanning");
const recognizingFaceRef = useRef(false);
const noFaceCountRef = useRef(0);
const unknownFaceCountRef = useRef(0);
const [deviceLocation, setDeviceLocation] = useState(null);
  const [locationChecking, setLocationChecking] = useState(false);
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
        .eq("status", "Approved")
        .lte("start_date", today)
        .gte("end_date", today);

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

  for (let i = 0; i < 12; i++) {
    const image = webcamRef.current.getScreenshot();

    if (!image) {
      continue;
    }

    const blob = await fetch(image).then((res) => res.blob());

    frames.push(blob);

    await new Promise((res) => setTimeout(res, 150));
  }

  return frames;
};
const validateLiveFace = async () => {
  if (!webcamRef.current) return;

  if (recognizingFaceRef.current) return;

  const image = webcamRef.current.getScreenshot();

  if (!image) return;

  try {
    setCheckingFace(true);
    setRecognizingFace(true);
    setRecognitionStatus("scanning");
    recognizingFaceRef.current = true;

    const blob = await fetch(image).then((res) =>
      res.blob()
    );

    const formData = new FormData();

    formData.append(
      "file",
      blob,
      "live-face.jpg"
    );

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

    if (!validationData.valid) {
      noFaceCountRef.current += 1;
      unknownFaceCountRef.current = 0;

      setDetectedFace(null);
      setIdentityVerified(false);

      // Keep the status stable instead of switching every 700ms.
      // Show "No face detected" only after several consecutive misses.
      if (noFaceCountRef.current >= 3) {
        setRecognitionStatus("no-face");
      } else {
        setRecognitionStatus((current) =>
          current === "no-face" ? current : "scanning"
        );
      }

      return;
    }

    noFaceCountRef.current = 0;

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

    if (
      recognitionData.status !== "Match"
    ) {
      unknownFaceCountRef.current += 1;

      setDetectedFace({
        name: null,
        distance: recognitionData.distance,
        unknown: true,
      });

      setIdentityVerified(false);

      // Do not flash "Face not registered" from a single uncertain frame.
      if (unknownFaceCountRef.current >= 2) {
        setRecognitionStatus("unknown");

        setFaceStatus({
          ...validationData,
          message: "Face not recognized.",
        });
      } else {
        setRecognitionStatus("scanning");
      }

      return;
    }

    unknownFaceCountRef.current = 0;

    const detectedEmployeeId =
      recognitionData.employee_id || recognitionData.employee?.id;

    const detectedEmployeeName =
      recognitionData.full_name || recognitionData.employee?.full_name;

    setDetectedFace({
      name: detectedEmployeeName,
      distance: recognitionData.distance,
      employeeId: detectedEmployeeId,
    });
    setRecognitionStatus("recognized");

    if (
      detectedEmployeeId === currentEmployeeId
    ) {
      setIdentityVerified(true);

      setRecognitionStatus("recognized");
      setFaceStatus({
        ...validationData,
        message: "Identity verified.",
      });

    } else {
      setIdentityVerified(false);

      setRecognitionStatus("mismatch");
      setFaceStatus({
        ...validationData,
        message:
          "Detected face does not match the logged-in employee.",
      });

    }

  } catch (error) {
    setDetectedFace(null);
    setIdentityVerified(false);
    setRecognitionStatus("error");

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

  noFaceCountRef.current = 0;
  unknownFaceCountRef.current = 0;

  const interval = setInterval(() => {
    validateLiveFace();
  }, 700);

  return () => {
    clearInterval(interval);
  };
}, [showCamera, currentEmployeeId, identityVerified]);
const getDeviceLocation = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location services are not available on this device."));
      return;
    }

    let watchId = null;
    let bestPosition = null;

    const finish = (position) => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }

      const { latitude, longitude } = position.coords;

      resolve({
        label: `Offsite (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`,
      });
    };

    const timeoutId = setTimeout(() => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }

      if (bestPosition && bestPosition.coords.accuracy <= 200) {
        finish(bestPosition);
        return;
      }

      reject(
        new Error(
          "Unable to get an accurate location. Please enable Location Services and try again, preferably on a phone with GPS."
        )
      );
    }, 15000);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (
          !bestPosition ||
          position.coords.accuracy < bestPosition.coords.accuracy
        ) {
          bestPosition = position;
        }

        if (position.coords.accuracy <= 100) {
          clearTimeout(timeoutId);
          finish(position);
        }
      },
      (error) => {
        clearTimeout(timeoutId);

        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
        }

        reject(
          new Error(
            error.code === 1
              ? "Location permission is required to take attendance."
              : "Unable to get your current location."
          )
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      }
    );
  });

const openAttendanceCamera = async (actionType) => {
  if (loading || locationChecking) return;

  setLocationChecking(true);

  if (!currentEmployeeId) {
    alert("Employee profile is not ready. Please try again.");
    return;
  }

  try {
    const lockResponse = await fetch(
      `${API_URL}/attendance-verification-lock/${currentEmployeeId}`
    );

    if (lockResponse.ok) {
      const lockData = await lockResponse.json();

      if (lockData.is_locked) {
        const remainingMinutes = Math.ceil(
          (lockData.remaining_seconds || 0) / 60
        );

        alert(
          `Attendance verification is temporarily locked. Please try again in ${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"}.`
        );
        setLocationChecking(false);
        return;
      }
    }

    const locationData = await getDeviceLocation();
    setDeviceLocation(locationData);
    setLocationChecking(false);
    setScanAction(actionType);

    setDetectedFace(null);

    setIdentityVerified(false);

    setFaceStatus({
      valid: false,
      message: "Position your face inside the box.",
      box: null,
    });

    setShowCamera(true);
  } catch (locationError) {
    setLocationChecking(false);
    alert(locationError.message);
  }
};

const handleScan = async (
  actionType
) => {
  if (loading) return;

  setVerificationAlert(null);

  if (!identityVerified) {
    alert("Please verify your identity first.");
    return;
  }

  try {
      setLoading(true);

      const frames =
        await captureFrames();
        if (frames.length < 2) {
  await logAudit({
    user_id: null,
    user_name: "Unknown user",
    role: managerMode ? "maintenance" : "employee",
    action: "ATTENDANCE_FAILED_WEB",
    description: `Web ${actionType.toUpperCase()} failed: unable to capture enough frames`,
  });
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

const scheduledClockIn = profile.clock_in
  ? new Date(`${today}T${profile.clock_in}`)
  : null;

let scheduledClockOut = profile.clock_out
  ? new Date(`${today}T${profile.clock_out}`)
  : null;

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
        await logAudit({
          user_id: user.id,
          user_name: profile.full_name,
          role: managerMode ? "maintenance" : "employee",
          action: "ATTENDANCE_REJECTED_WEB",
          description: "Web TIME_IN rejected: employee already timed in today",
        });
        alert("Already timed in today");
        return;
      }

      // Time Out must use the schedule snapshot saved on the attendance row.
      // This prevents a transfer/shift change from changing historical overtime.
      if (actionType === "time_out" && existing?.scheduled_time_out) {
        scheduledClockOut = new Date(
          `${today}T${existing.scheduled_time_out}`
        );

        const scheduledInForOvernight = existing?.scheduled_time_in
          ? new Date(`${today}T${existing.scheduled_time_in}`)
          : scheduledClockIn;

        if (
          scheduledInForOvernight &&
          scheduledClockOut <= scheduledInForOvernight
        ) {
          scheduledClockOut.setDate(scheduledClockOut.getDate() + 1);
        }
      }

      if (
        actionType === "time_out" &&
        !existing?.time_in
      ) {
        await logAudit({
          user_id: user.id,
          user_name: profile.full_name,
          role: managerMode ? "maintenance" : "employee",
          action: "ATTENDANCE_REJECTED_WEB",
          description: "Web TIME_OUT rejected: employee has no time-in today",
        });
        alert("You must time-in first");
        return;
      }

      if (
        actionType === "time_out" &&
        existing?.time_out
      ) {
        await logAudit({
          user_id: user.id,
          user_name: profile.full_name,
          role: managerMode ? "maintenance" : "employee",
          action: "ATTENDANCE_REJECTED_WEB",
          description: "Web TIME_OUT rejected: employee already timed out today",
        });
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

      const res = await fetch(
        API_URL + "/verify-face",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!res.ok) {
        await logAudit({
          user_id: user.id,
          user_name: profile.full_name,
          role: managerMode ? "maintenance" : "employee",
          action: "ATTENDANCE_ERROR_WEB",
          description: `Web ${actionType.toUpperCase()} failed: face verification server error`,
        });

        alert(
          "FastAPI server error"
        );

        setLoading(false);

        return;
      }

      const result =
        await res.json();

      if (result.status === "Locked") {
        setShowCamera(false);
        setScanAction(null);

        const remainingMinutes = Math.ceil(
          (result.remaining_seconds || 300) / 60
        );

        await logAudit({
          user_id: user.id,
          user_name: profile.full_name,
          role: managerMode ? "maintenance" : "employee",
          action: "ATTENDANCE_REJECTED_WEB",
          description: `Web ${actionType.toUpperCase()} locked after repeated face/blink verification failures`,
        });

        alert(
          `Attendance verification is temporarily locked. Please try again in ${remainingMinutes} minutes.`
        );

        return;
      }

      if (
        result.status !== "Match"
      ) {
        await logAudit({
          user_id: user.id,
          user_name: profile.full_name,
          role: managerMode ? "maintenance" : "employee",
          action: "ATTENDANCE_REJECTED_WEB",
          description: `Web ${actionType.toUpperCase()} rejected: ${result.status || "Face not recognized"}`,
        });

        setVerificationAlert({
          title: "Please check",
          message:
            result.message || "Face not recognized",
        });

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
        await logAudit({
          user_id: user.id,
          user_name: profile.full_name,
          role: managerMode ? "maintenance" : "employee",
          action: "ATTENDANCE_ERROR_WEB",
          description: `Web ${actionType.toUpperCase()} failed: attendance photo upload failed`,
        });

        alert("Upload failed");

        return;
      }

      const faceUrl = fileName;

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
              time_in_location: deviceLocation?.label || null,
            });

        if (attendanceInsertError) {
          await logAudit({
            user_id: employeeId,
            user_name: profile.full_name,
            role: managerMode ? "maintenance" : "employee",
            action: "ATTENDANCE_ERROR_WEB",
            description: `Web TIME_IN database error: ${attendanceInsertError.message}`,
          });

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
          description: `${profile.full_name} timed in with status ${attendanceStatus}${lateMinutes > 0 ? ` (${lateMinutes} minutes late)` : ""}`,
        });
      } else {
        // Calculate overtime from the saved attendance schedule snapshot.
        // The schedule may be different from the employee's current shift
        // after a transfer, so use scheduledClockOut resolved above.
        let overtimeMinutes = 0;

        if (scheduledClockOut && now > scheduledClockOut) {
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
              time_out_location: deviceLocation?.label || null,
            })
            .eq("employee_id", employeeId)
            .eq("log_date", today)
            .is("time_out", null);

        if (attendanceUpdateError) {
          console.error("TIME_OUT UPDATE ERROR:", attendanceUpdateError);
          await logAudit({
            user_id: employeeId,
            user_name: profile.full_name,
            role: managerMode ? "maintenance" : "employee",
            action: "ATTENDANCE_ERROR_WEB",
            description: `Web TIME_OUT database error: ${attendanceUpdateError.message}`,
          });

          throw new Error(
            "Attendance Time Out could not be saved: " +
            attendanceUpdateError.message
          );
        }

        // Verify the saved row separately. This avoids relying on
        // PostgREST UPDATE ... RETURNING behavior while still making sure
        // the employee never receives a false success message.
        const { data: savedAttendance, error: verifyError } =
          await supabase
            .from("attendance_logs")
            .select("id,time_out,overtime_minutes,time_out_face_url,time_out_location")
            .eq("employee_id", employeeId)
            .eq("log_date", today)
            .maybeSingle();

        if (verifyError) {
          console.error("TIME_OUT VERIFY ERROR:", verifyError);
          throw new Error(
            "Time Out was submitted, but the saved attendance could not be verified: " +
            verifyError.message
          );
        }

        if (!savedAttendance?.time_out) {
          console.error("TIME_OUT VERIFY FAILED: no saved time_out", savedAttendance);
          throw new Error(
            "Time Out was not saved. Please try again."
          );
        }

        await logAudit({
          user_id: employeeId,
          user_name: profile.full_name,
          role: managerMode ? "maintenance" : "employee",
          action: "TIME_OUT",
          description: `${profile.full_name} timed out${savedAttendance.overtime_minutes > 0 ? ` with ${savedAttendance.overtime_minutes} minutes overtime` : ""}`,
        });
      }

      setShowCamera(false);
      setScanAction(null);
      setDeviceLocation(null);
      setFaceStatus({
        valid: false,
        message: "Position your face inside the camera.",
        box: null,
      });

      alert(
        "Attendance recorded"
      );

      // The attendance write has already succeeded at this point.
      // A refresh failure must not turn a successful attendance scan
      // into a misleading "Scan failed" message.
      try {
        await loadData();
      } catch (refreshError) {
        console.error("Attendance saved, but dashboard refresh failed:", refreshError);
      }
    } catch (err) {
      console.error("Attendance scan failed:", err);
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
          <h3>{formatDateTime(timeIn)}</h3>
        </div>

        <div style={styles.card}>
          <p>Time Out</p>
          <h3>{formatDateTime(timeOut)}</h3>
        </div>

        <div style={styles.card}>
          <p>Registered Clock In</p>
          <h3>{formatTime(profileClockIn)}</h3>
        </div>

        <div style={styles.card}>
          <p>Registered Clock Out</p>
          <h3>{formatTime(profileClockOut)}</h3>
        </div>
      </div>

      <div style={styles.attendanceButtons}>
        <button
          style={styles.primaryBtn}
          onClick={() => openAttendanceCamera("time_in")}
          disabled={loading || locationChecking}
        >
          Time In
        </button>

        <button
          style={styles.secondaryBtn}
          onClick={() => openAttendanceCamera("time_out")}
          disabled={loading || locationChecking}
        >
          Time Out
        </button>
      </div>

      <div style={styles.locationStatus}>
        {locationChecking && (
          <>
            <span style={styles.locationIndicator}>●</span>
            <span>Calculating if device has precise location...</span>
          </>
        )}
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

            <div style={styles.cameraLightFrame}>
              <div className="cibo-camera-wrapper" style={styles.cameraWrapper}>
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
            </div>

            <div
              style={{
                ...styles.faceStatus,
                color: identityVerified
                  ? "#16a34a"
                  : recognitionStatus === "unknown" ||
                    recognitionStatus === "mismatch"
                  ? "#dc2626"
                  : recognitionStatus === "no-face"
                  ? "#d97706"
                  : recognitionStatus === "error"
                  ? "#dc2626"
                  : "#6b7280",
              }}
            >
              <span style={styles.faceStatusIndicator}>
                {identityVerified
                  ? "●"
                  : recognitionStatus === "no-face"
                  ? "●"
                  : recognitionStatus === "unknown" ||
                    recognitionStatus === "mismatch" ||
                    recognitionStatus === "error"
                  ? "●"
                  : "●"}
              </span>
              {recognitionStatus === "recognized"
                ? "Face recognized"
                : recognitionStatus === "unknown"
                ? "Face not recognized"
                : recognitionStatus === "mismatch"
                ? "Face does not match this account"
                : recognitionStatus === "no-face"
                ? "No face detected"
                : recognitionStatus === "error"
                ? "Face recognition unavailable"
                : "Looking for your face…"}
            </div>

            <div style={styles.faceStatusHint}>
              {recognitionStatus === "no-face"
                ? "Move your face into the camera view."
                : recognitionStatus === "unknown"
                ? "Keep your face visible and look at the camera."
                : recognitionStatus === "error"
                ? "Please wait a moment and try again."
                : identityVerified
                ? "Identity verified. You can scan your attendance."
                : "Keep your face centered and look at the camera."}
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
              {recognitionStatus === "recognized" && detectedFace?.name ? (
                <>
                  Face recognized: {detectedFace.name}
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
                onClick={() => handleScan(scanAction)}
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
                  setDeviceLocation(null);
                }}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {verificationAlert && (
        <div style={styles.verificationAlertOverlay}>
          <div style={styles.verificationAlertModal}>
            <div style={styles.verificationAlertIcon}>×</div>

            <h2 style={styles.verificationAlertTitle}>
              {verificationAlert.title}
            </h2>

            <p style={styles.verificationAlertMessage}>
              {verificationAlert.message}
            </p>

            <button
              style={styles.verificationAlertButton}
              onClick={() => setVerificationAlert(null)}
            >
              OK
            </button>
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
    height: "240px",
    display: "block",
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

  verificationAlertOverlay: {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10001,
    pointerEvents: "auto",
  },

  verificationAlertModal: {
    background: "#fff",
    width: "min(700px, 88vw)",
    maxWidth: "700px",
    padding: "48px 40px 40px",
    borderRadius: "8px",
    textAlign: "center",
    boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
    border: "1px solid #e5e7eb",
  },

  verificationAlertIcon: {
    width: "96px",
    height: "96px",
    margin: "0 auto 28px",
    border: "5px solid #ef6b6b",
    borderRadius: "50%",
    color: "#ef6b6b",
    fontSize: "72px",
    fontWeight: "300",
    lineHeight: "82px",
    fontFamily: "Arial, sans-serif",
  },

  verificationAlertTitle: {
    margin: "0 0 22px",
    fontSize: "38px",
    fontWeight: "600",
    color: "#222",
  },

  verificationAlertMessage: {
    margin: "0 auto 34px",
    fontSize: "21px",
    lineHeight: "1.5",
    color: "#374151",
  },

  verificationAlertButton: {
    minWidth: "82px",
    padding: "12px 24px",
    background: "#f97316",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "18px",
    fontWeight: "600",
    cursor: "pointer",
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

  cameraLightFrame: {
    display: "inline-block",
    padding: "12px",
    border: "3px solid #ffffff",
    borderRadius: "16px",
    background: "#ffffff",
    boxShadow:
      "0 0 0 2px rgba(255,255,255,0.95), 0 0 24px 10px rgba(255,255,255,0.9)",
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
    minHeight: "28px",
    lineHeight: "28px",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    transition: "opacity 0.2s ease",
  },

  faceStatusIndicator: {
    fontSize: "10px",
    lineHeight: "1",
    color: "currentColor",
  },

  faceStatusHint: {
    minHeight: "22px",
    marginTop: "2px",
    fontSize: "13px",
    lineHeight: "22px",
    color: "#9ca3af",
    textAlign: "center",
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
    marginBottom: "6px",
  },

  locationStatus: {
    minHeight: "24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    color: "#6b7280",
    fontSize: "13px",
    fontWeight: "500",
    textAlign: "center",
  },

  locationIndicator: {
    color: "#f97316",
    fontSize: "12px",
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
