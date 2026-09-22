import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { KIOSK_CODE } from "../kioskConfig";

const INSIGHTFACE_URL = (import.meta.env.VITE_INSIGHTFACE_URL || "http://127.0.0.1:8002").replace(/\/$/, "");
const BACKEND_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

const initialRecognition = {
  status: "Idle",
  employee_id: null,
  full_name: null,
  distance: null,
  message: "Select Time In or Time Out to start.",
};

export default function Kiosk() {
  const webcamRef = useRef(null);
  const recognitionBusyRef = useRef(false);
  const scanStartedRef = useRef(false);
  const recognitionAbortControllerRef = useRef(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);

  const [recognition, setRecognition] = useState(
    initialRecognition
  );

  const [scanState, setScanState] = useState("idle");
  const [attendanceLoading, setAttendanceLoading] =
    useState(false);
  const [attendanceResult, setAttendanceResult] =
    useState(null);

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date) =>
    date.toLocaleDateString("en-PH", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

  const formatTime = (date) =>
    date.toLocaleTimeString("en-PH", {
      hour: "numeric", minute: "2-digit", second: "2-digit",
    });

  // ------------------------------------------------------------
  // OPEN KIOSK CAMERA
  // ------------------------------------------------------------

  const openAttendanceCamera = (action) => {
    setSelectedAction(action);
    setAttendanceResult(null);
    setRecognition({
      ...initialRecognition,
      status: "Starting",
      message: "Starting camera...",
    });
    setScanState("waiting");
    setCameraReady(false);
    setCameraOpen(true);
    scanStartedRef.current = false;
  };

  // ------------------------------------------------------------
  // LIVE INSIGHTFACE RECOGNITION
  //
  // Camera is ONLY recognized after Time In / Time Out
  // has been clicked.
  // ------------------------------------------------------------

  useEffect(() => {
    if (!cameraOpen || !cameraReady) return;

    let intervalId;

    const recognizeFace = async () => {
      if (!webcamRef.current) return;
      if (recognitionBusyRef.current) return;
      if (scanStartedRef.current) return;
      if (attendanceLoading) return;
      if (scanState === "scanning" || scanState === "success") {
        return;
      }

      const imageSrc =
        webcamRef.current.getScreenshot();

      if (!imageSrc) return;

      recognitionBusyRef.current = true;
      const controller = new AbortController();
      recognitionAbortControllerRef.current = controller;

      try {
        const response = await fetch(imageSrc);
        const blob = await response.blob();

        const formData = new FormData();

        formData.append(
          "file",
          blob,
          "kiosk-live.jpg"
        );

        const recognitionResponse = await fetch(
          `${INSIGHTFACE_URL}/recognize-live-face`,
          {
            method: "POST",
            body: formData,
            signal: controller.signal,
          }
        );

        const data =
          await recognitionResponse.json();

        console.log(
          "KIOSK LIVE INSIGHTFACE:",
          data
        );

        if (!recognitionResponse.ok) {
          setRecognition({
            status: "Error",
            employee_id: null,
            full_name: null,
            distance: null,
            message:
              data.message ||
              "Unable to connect to InsightFace.",
          });

          return;
        }

        if (data.status === "Match") {
          const employee =
            data.employee || {};

          const employeeId =
            employee.id ||
            data.employee_id ||
            null;

          const fullName =
            employee.full_name ||
            data.full_name ||
            null;

          setRecognition({
            status: "Match",
            employee_id: employeeId,
            full_name: fullName,
            distance: data.distance,
            message:
              "Identity recognized.",
          });

          setScanState((current) =>
            current === "waiting"
              ? "recognized"
              : current
          );

          // Automatically begin the blink/attendance scan
          // once a recognized employee is stable on screen.
          if (
            employeeId &&
            !scanStartedRef.current
          ) {
            scanStartedRef.current = true;

            setTimeout(() => {
              startAttendanceScan();
            }, 700);
          }

        } else if (data.status === "No Face") {
          setRecognition({
            status: "No Face",
            employee_id: null,
            full_name: null,
            distance: null,
            message:
              "No face detected. Please look at the camera.",
          });

          setScanState("waiting");

        } else if (
          data.status === "Multiple Faces"
        ) {
          setRecognition({
            status: "Multiple Faces",
            employee_id: null,
            full_name: null,
            distance: null,
            message:
              "Only one person is allowed in front of the kiosk.",
          });

          setScanState("waiting");
          scanStartedRef.current = false;

        } else if (
          data.status === "Unknown"
        ) {
          setRecognition({
            status: "Unknown",
            employee_id: null,
            full_name: null,
            distance: data.distance,
            message:
              "Face not recognized.",
          });

          setScanState("waiting");
          scanStartedRef.current = false;

        } else {
          setRecognition({
            status: "Error",
            employee_id: null,
            full_name: null,
            distance: null,
            message:
              data.message ||
              "Recognition error.",
          });
        }

      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }

        console.error(
          "KIOSK LIVE RECOGNITION ERROR:",
          error
        );

        setRecognition({
          status: "Error",
          employee_id: null,
          full_name: null,
          distance: null,
          message:
            "Unable to connect to the recognition server.",
        });

      } finally {
        if (
          recognitionAbortControllerRef.current ===
          controller
        ) {
          recognitionAbortControllerRef.current = null;
        }

        recognitionBusyRef.current = false;
      }
    };

    recognizeFace();

    intervalId = setInterval(
      recognizeFace,
      700
    );

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }

      if (recognitionAbortControllerRef.current) {
        recognitionAbortControllerRef.current.abort();
        recognitionAbortControllerRef.current = null;
      }

      recognitionBusyRef.current = false;
    };
  }, [
    cameraOpen,
    cameraReady,
    attendanceLoading,
    scanState,
  ]);

  // ------------------------------------------------------------
  // CAPTURE FRAMES FOR BLINK / ATTENDANCE
  // ------------------------------------------------------------

  const captureFrames = async () => {
    const capturedFrames = [];

    for (let i = 0; i < 8; i++) {
      if (!webcamRef.current) break;

      const imageSrc =
        webcamRef.current.getScreenshot();

      if (imageSrc) {
        capturedFrames.push(imageSrc);
      }

      // Keep the same 8-frame verification, but give the blink
      // a slightly longer sampling window.
      await new Promise((resolve) =>
        setTimeout(resolve, 200)
      );
    }

    return capturedFrames;
  };

  // ------------------------------------------------------------
  // START ATTENDANCE SCAN
  //
  // main.py will:
  // - check blink
  // - verify InsightFace
  // - save photo
  // - record attendance
  // ------------------------------------------------------------

  const startAttendanceScan = async () => {
    if (!selectedAction) return;
    if (!webcamRef.current) return;
    if (attendanceLoading) return;

    setScanState("scanning");
    setAttendanceLoading(true);
    setAttendanceResult(null);

    try {
      const frameSources =
        await captureFrames();

      if (frameSources.length < 2) {
        throw new Error(
          "Not enough camera frames were captured."
        );
      }

      const formData = new FormData();

      formData.append(
        "action",
        selectedAction
      );

      formData.append(
        "kiosk_code",
        KIOSK_CODE
      );

      for (
        let i = 0;
        i < frameSources.length;
        i++
      ) {
        const response = await fetch(
          frameSources[i]
        );

        const blob =
          await response.blob();

        formData.append(
          "files",
          blob,
          `kiosk_frame_${i + 1}.jpg`
        );
      }

      console.log(
        "📸 Sending kiosk frames:",
        frameSources.length
      );

      const response = await fetch(
        `${BACKEND_URL}/kiosk-verify-live`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data =
        await response.json();

      console.log(
        "🔥 KIOSK VERIFICATION RESULT:",
        data
      );

      if (!response.ok) {
        throw new Error(
          data.message ||
          "Kiosk verification failed."
        );
      }

      if (data.status !== "Match") {
        setScanState("recognized");

        setAttendanceResult({
          type:
            data.status === "Fake"
              ? "warning"
              : "error",
          message:
            data.message ||
            "Attendance was not recorded.",
        });

        scanStartedRef.current = false;
        return;
      }

      const employee =
        data.employee || {};

      setRecognition((current) => ({
        ...current,
        status: "Match",
        employee_id:
          employee.id ||
          current.employee_id,
        full_name:
          employee.full_name ||
          current.full_name,
        distance:
          data.distance ??
          current.distance,
        message:
          "Identity and liveness verified.",
      }));

      setScanState("success");

      setAttendanceResult({
        type: "success",
        recordedAt: new Date(),
        message:
          data.attendance?.message ||
          `${
            selectedAction === "TIME IN"
              ? "Time In"
              : "Time Out"
          } recorded successfully.`,
      });

    } catch (error) {
      console.error(
        "KIOSK ATTENDANCE ERROR:",
        error
      );

      setScanState("recognized");

      setAttendanceResult({
        type: "error",
        message:
          error.message ||
          "Unable to record attendance.",
      });

      scanStartedRef.current = false;

    } finally {
      setAttendanceLoading(false);
    }
  };

  // ------------------------------------------------------------
  // CLOSE / RESET KIOSK
  // ------------------------------------------------------------

  const continueToKiosk = () => {
    setCameraOpen(false);
    setCameraReady(false);
    setSelectedAction(null);
    setRecognition(initialRecognition);
    setScanState("idle");
    setAttendanceLoading(false);
    setAttendanceResult(null);
    scanStartedRef.current = false;
    recognitionBusyRef.current = false;
  };

  // ------------------------------------------------------------
  // MAIN KIOSK SCREEN
  // ------------------------------------------------------------

  return (
    <div style={styles.page}>
      <div style={styles.overlay}></div>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.brandBlock}>
            <div style={styles.logo}>CIBO</div>
            <h1 style={styles.title}>ATTENDANCE KIOSK</h1>
            <div style={styles.tagline}>
              GOOD PEOPLE&nbsp;&nbsp; GREAT FOOD&nbsp;&nbsp; BRIGHTER DAYS
            </div>
          </div>
          <div style={styles.clockBlock}>
            <div style={styles.dateText}>{formatDate(currentTime)}</div>
            <div style={styles.timeText}>{formatTime(currentTime)}</div>
          </div>
        </header>

        {!cameraOpen ? (
          <>
            <div style={styles.homeCard}>
              <div style={styles.homeIntro}>
                <div style={styles.homeTitle}>CIBO ATTENDANCE KIOSK</div>
                <div style={styles.homeText}>Please select an action to begin facial recognition.</div>
              </div>
              <div style={styles.homeActions}>
                <button style={styles.timeInButton} onClick={() => openAttendanceCamera("TIME IN")}>
                  <span style={styles.buttonIcon}>↪</span>
                  <span><strong>TIME IN</strong><small>Start your work day</small></span>
                </button>

                <button style={styles.timeOutButton} onClick={() => openAttendanceCamera("TIME OUT")}>
                  <span style={styles.buttonIcon}>↪</span>
                  <span><strong>TIME OUT</strong><small>End your work day</small></span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={styles.cameraCard}>
            <div style={styles.actionHeader}>
              <div>
                <div style={styles.actionLabel}>
                  SELECTED ACTION
                </div>

                <div style={styles.selectedAction}>{selectedAction}</div>
                <div style={styles.actionHint}>Look at the camera and blink once</div>
              </div>

              {scanState !== "success" && (
                <button
                  style={styles.cancelButton}
                  onClick={continueToKiosk}
                  disabled={attendanceLoading}
                >
                  CANCEL
                </button>
              )}
            </div>

            <div style={styles.cameraContainer}>
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                screenshotQuality={0.9}
                videoConstraints={{
                  width: 1280,
                  height: 720,
                  facingMode: "user",
                }}
                onUserMedia={() =>
                  setCameraReady(true)
                }
                onUserMediaError={(error) => {
                  console.error(
                    "Camera error:",
                    error
                  );

                  setCameraReady(false);

                  setRecognition({
                    status: "Error",
                    employee_id: null,
                    full_name: null,
                    distance: null,
                    message:
                      "Camera access failed. Check camera permissions.",
                  });
                }}
                style={styles.camera}
              />

              {!cameraReady && (
                <div style={styles.cameraLoading}>
                  <div
                    style={styles.loadingCircle}
                  ></div>

                  <p>
                    Starting camera...
                  </p>
                </div>
              )}
            </div>

            <div
              style={{
                ...styles.cameraStatus,
                color: cameraReady
                  ? "#16a34a"
                  : "#6b7280",
              }}
            >
              {cameraReady
                ? "● Camera Ready"
                : "● Starting Camera"}
            </div>

            <div
              style={{
                ...styles.recognitionBox,
                borderColor:
                  recognition.status ===
                  "Match"
                    ? "#22c55e"
                    : recognition.status ===
                      "Error"
                    ? "#ef4444"
                    : "#d1d5db",
                background:
                  recognition.status ===
                  "Match"
                    ? "#ecfdf5"
                    : "#f9fafb",
              }}
            >
              {recognition.status ===
              "Match" ? (
                <>
                  <div
                    style={
                      styles.recognizedLabel
                    }
                  >
                    IDENTITY RECOGNIZED
                  </div>

                  <div
                    style={
                      styles.employeeName
                    }
                  >
                    {recognition.full_name}
                  </div>

                  <div
                    style={styles.distance}
                  >
                    Recognition distance:{" "}
                    {typeof recognition.distance ===
                    "number"
                      ? recognition.distance.toFixed(
                          4
                        )
                      : "—"}
                  </div>

                  <div
                    style={
                      scanState ===
                      "scanning"
                        ? styles.blinkInstructionActive
                        : styles.blinkInstruction
                    }
                  >
                    {scanState ===
                    "scanning"
                      ? "👁 Please blink once..."
                      : scanState ===
                        "success"
                      ? "✓ Liveness verified"
                      : "Please blink once. Verification will start automatically."}
                  </div>
                </>
              ) : (
                <>
                  <div
                    style={
                      styles.recognitionStatus
                    }
                  >
                    {recognition.status ===
                    "No Face"
                      ? "WAITING FOR FACE"
                      : recognition.status ===
                        "Unknown"
                      ? "FACE NOT RECOGNIZED"
                      : recognition.status ===
                        "Multiple Faces"
                      ? "MULTIPLE FACES DETECTED"
                      : recognition.status ===
                        "Starting"
                      ? "STARTING CAMERA"
                      : recognition.status ===
                        "Idle"
                      ? "READY"
                      : recognition.status ===
                        "Error"
                      ? "RECOGNITION ERROR"
                      : "SCANNING"}
                  </div>

                  <div
                    style={
                      styles.resultMessage
                    }
                  >
                    {recognition.message}
                  </div>
                </>
              )}
            </div>

            {scanState ===
              "recognized" &&
              !attendanceLoading &&
              !attendanceResult && (
                <div style={styles.readyBox}>
                  <strong>
                    Identity verified.
                  </strong>

                  <span>
                    Please remain in front of
                    the camera and blink once.
                  </span>
                </div>
              )}

            {scanState ===
              "scanning" && (
              <div style={styles.scanningBox}>
                <div
                  style={
                    styles.smallSpinner
                  }
                ></div>

                <div>
                  <strong>
                    Verifying attendance...
                  </strong>

                  <span>
                    Checking liveness and
                    recording your attendance.
                  </span>
                </div>
              </div>
            )}

            {attendanceResult && (
              <div style={
                attendanceResult.type === "success"
                  ? styles.successBox
                  : attendanceResult.type === "warning"
                  ? styles.warningBox
                  : styles.errorBox
              }>
                <div style={styles.successHeader}>
                  <div style={styles.successIcon}>
                    {attendanceResult.type === "success" ? "✓" : "!"}
                  </div>
                  <div>
                    <div style={styles.resultTitle}>
                      {attendanceResult.type === "success"
                        ? (selectedAction + " RECORDED!")
                        : attendanceResult.type === "warning"
                        ? "VERIFICATION FAILED"
                        : "SYSTEM ERROR"}
                    </div>
                    <div style={styles.resultMessage}>{attendanceResult.message}</div>
                  </div>
                </div>

                {attendanceResult.type === "success" && (
                  <div style={styles.infoGrid}>
                    <div style={styles.infoRow}><span>Employee</span><strong>{recognition.full_name || "—"}</strong></div>
                    <div style={styles.infoRow}><span>Date</span><strong>{formatDate(attendanceResult.recordedAt || currentTime)}</strong></div>
                    <div style={styles.infoRow}><span>{selectedAction === "TIME IN" ? "Time In" : "Time Out"}</span><strong>{formatTime(attendanceResult.recordedAt || currentTime)}</strong></div>
                    <div style={styles.infoRow}><span>Kiosk</span><strong>{KIOSK_CODE}</strong></div>
                    <div style={styles.infoRow}><span>Status</span><strong style={styles.presentBadge}>Present</strong></div>
                    <div style={styles.infoRow}><span>Photo</span><strong style={styles.photoSaved}>✓ Attendance photo saved</strong></div>
                  </div>
                )}

                <button style={styles.dismissButton} onClick={continueToKiosk}>BACK TO KIOSK</button>
              </div>
            )}            {!attendanceResult &&
              scanState !== "scanning" &&
              scanState !== "success" && (
                <p style={styles.helperText}>
                  Look directly at the camera.
                  Only one person should be
                  visible.
                </p>
              )}
          </div>
        )}

        <footer style={styles.footer}>
          <strong>CIBO</strong> Attendance Monitoring System
          <span> • {KIOSK_CODE}</span>
        </footer>
      </div>
    </div>
  );
}

const styles = {
  page: { position: "relative", height: "100vh", width: "100%", overflow: "hidden", backgroundImage: "linear-gradient(90deg, rgba(10,15,25,0.82), rgba(10,15,25,0.58)), url('/bg.jpg')", backgroundSize: "cover", backgroundPosition: "center", fontFamily: "Arial, Helvetica, sans-serif", boxSizing: "border-box" },
  overlay: { position: "absolute", inset: 0, background: "rgba(255,255,255,0.04)", pointerEvents: "none" },
  container: { position: "relative", zIndex: 1, width: "min(1500px, 94vw)", height: "100%", margin: "0 auto", display: "flex", flexDirection: "column", boxSizing: "border-box", padding: "18px 0 12px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", color: "#fff", flexShrink: 0 },
  brandBlock: { textAlign: "left" },
  logo: { fontSize: "clamp(36px, 4vw, 62px)", lineHeight: 0.9, fontWeight: "900", color: "#f97316", letterSpacing: "-2px" },
  title: { fontSize: "clamp(26px, 3vw, 48px)", lineHeight: 1, fontWeight: "900", color: "#fff", margin: "6px 0 0", letterSpacing: "-1px" },
  tagline: { marginTop: "9px", fontSize: "clamp(9px, 0.9vw, 13px)", letterSpacing: "4px", fontWeight: "700", color: "#fff", opacity: 0.9 },
  clockBlock: { textAlign: "right", paddingTop: "4px" },
  dateText: { fontSize: "clamp(12px, 1.1vw, 17px)", fontWeight: "600", color: "#fff" },
  timeText: { marginTop: "2px", fontSize: "clamp(24px, 2.4vw, 38px)", fontWeight: "900", color: "#fff" },
  homeCard: { flex: 1, minHeight: 0, marginTop: "16px", borderRadius: "26px", background: "rgba(255,255,255,0.96)", boxShadow: "0 20px 60px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "30px", boxSizing: "border-box" },
  homeIntro: { textAlign: "center", marginBottom: "28px" },
  homeTitle: { fontSize: "clamp(28px, 3vw, 46px)", fontWeight: "900", color: "#172033" },
  homeText: { marginTop: "8px", fontSize: "clamp(14px, 1.2vw, 19px)", color: "#64748b" },
  homeActions: { width: "min(900px, 90%)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" },
  buttonIcon: { fontSize: "clamp(34px, 4vw, 58px)", lineHeight: 1 },
  timeInButton: { minHeight: "150px", border: "none", borderRadius: "20px", background: "linear-gradient(135deg, #ff7a18, #f4510b)", color: "#fff", fontSize: "clamp(22px, 2vw, 34px)", fontWeight: "800", boxShadow: "0 12px 28px rgba(249,115,22,0.3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "20px" },
  timeOutButton: { minHeight: "150px", border: "none", borderRadius: "20px", background: "#273449", color: "#fff", fontSize: "clamp(22px, 2vw, 34px)", fontWeight: "800", boxShadow: "0 12px 28px rgba(0,0,0,0.2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "20px" },
  cameraCard: { flex: 1, minHeight: 0, marginTop: "12px", borderRadius: "24px", background: "rgba(255,255,255,0.98)", boxShadow: "0 20px 60px rgba(0,0,0,0.35)", padding: "18px", boxSizing: "border-box", display: "flex", flexDirection: "column" },
  actionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexShrink: 0 },
  actionLabel: { fontSize: "11px", fontWeight: "800", color: "#64748b", letterSpacing: "1px" },
  selectedAction: { fontSize: "clamp(25px, 2.2vw, 38px)", fontWeight: "900", color: "#172033", marginTop: "2px" },
  actionHint: { fontSize: "14px", color: "#64748b", marginTop: "2px" },
  cancelButton: { border: "none", borderRadius: "10px", padding: "11px 20px", background: "#e2e8f0", color: "#334155", fontWeight: "800", cursor: "pointer" },
  cameraContainer: { position: "relative", width: "min(100%, 900px)", aspectRatio: "16 / 9", maxHeight: "52vh", margin: "0 auto", background: "#0f172a", borderRadius: "18px", overflow: "hidden", flexShrink: 1 },
  camera: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  cameraLoading: { position: "absolute", inset: 0, background: "#111827", color: "#fff", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", fontSize: "18px" },
  loadingCircle: { width: "35px", height: "35px", border: "4px solid #fff", borderTop: "4px solid transparent", borderRadius: "50%", marginBottom: "15px", animation: "spin 1s linear infinite" },
  cameraStatus: { marginTop: "7px", fontSize: "14px", fontWeight: "700", flexShrink: 0 },
  recognitionBox: { marginTop: "8px", padding: "10px 18px", borderRadius: "14px", border: "2px solid #d1d5db", minHeight: "78px", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "center", flexShrink: 0 },
  recognizedLabel: { fontSize: "13px", fontWeight: "800", color: "#16a34a" },
  recognitionStatus: { fontSize: "15px", fontWeight: "800", color: "#334155" },
  employeeName: { fontSize: "clamp(24px, 2vw, 34px)", fontWeight: "900", color: "#172033" },
  distance: { fontSize: "12px", color: "#64748b" },
  blinkInstruction: { marginTop: "5px", fontSize: "14px", fontWeight: "700", color: "#334155" },
  blinkInstructionActive: { marginTop: "5px", fontSize: "15px", fontWeight: "800", color: "#f97316" },
  resultMessage: { fontSize: "14px", color: "#475569" },
  readyBox: { marginTop: "8px", padding: "9px 14px", borderRadius: "10px", background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a", display: "flex", flexDirection: "row", gap: "8px", justifyContent: "center", fontSize: "13px", flexShrink: 0 },
  scanningBox: { marginTop: "8px", padding: "10px", borderRadius: "10px", background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", fontSize: "13px", flexShrink: 0 },
  smallSpinner: { width: "18px", height: "18px", border: "3px solid #fdba74", borderTop: "3px solid transparent", borderRadius: "50%", animation: "spin 1s linear infinite" },
  successBox: { marginTop: "8px", padding: "14px 18px", borderRadius: "14px", background: "#ecfdf5", border: "2px solid #22c55e", flexShrink: 0 },
  warningBox: { marginTop: "8px", padding: "14px", borderRadius: "14px", background: "#fff7ed", border: "2px solid #f97316" },
  errorBox: { marginTop: "8px", padding: "14px", borderRadius: "14px", background: "#fef2f2", border: "2px solid #ef4444" },
  successHeader: { display: "flex", alignItems: "center", justifyContent: "center", gap: "14px" },
  successIcon: { width: "48px", height: "48px", borderRadius: "50%", background: "#16a34a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", fontWeight: "900", flexShrink: 0 },
  resultTitle: { fontSize: "clamp(18px, 1.5vw, 25px)", fontWeight: "900", color: "#166534", marginBottom: "2px" },
  infoGrid: { marginTop: "10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 22px", background: "#fff", borderRadius: "10px", padding: "4px 14px" },
  infoRow: { minHeight: "31px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", borderBottom: "1px solid #e2e8f0", fontSize: "12px", color: "#64748b" },
  presentBadge: { color: "#15803d", background: "#dcfce7", padding: "3px 9px", borderRadius: "999px" },
  photoSaved: { color: "#15803d" },
  dismissButton: { marginTop: "10px", padding: "10px 28px", border: "none", borderRadius: "10px", background: "#273449", color: "#fff", fontSize: "14px", fontWeight: "800", cursor: "pointer" },
  helperText: { margin: "7px 0 0", fontSize: "12px", color: "#64748b", flexShrink: 0 },
  footer: { marginTop: "8px", color: "#fff", fontSize: "12px", textAlign: "center", opacity: 0.9, flexShrink: 0 },
};
