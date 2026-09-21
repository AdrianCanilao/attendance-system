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
      if (attendanceLoading) return;
      if (scanState === "scanning" || scanState === "success") {
        return;
      }

      const imageSrc =
        webcamRef.current.getScreenshot();

      if (!imageSrc) return;

      recognitionBusyRef.current = true;

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

      await new Promise((resolve) =>
        setTimeout(resolve, 150)
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
      <div style={styles.container}>
        <div style={styles.logo}>
          CIBO
        </div>

        <h1 style={styles.title}>
          ATTENDANCE KIOSK
        </h1>

        {!cameraOpen ? (
          <>
            <div style={styles.homeCard}>
              <div style={styles.homeActions}>
                <button
                  style={styles.timeInButton}
                  onClick={() =>
                    openAttendanceCamera(
                      "TIME IN"
                    )
                  }
                >
                  TIME IN
                </button>

                <button
                  style={styles.timeOutButton}
                  onClick={() =>
                    openAttendanceCamera(
                      "TIME OUT"
                    )
                  }
                >
                  TIME OUT
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

                <div style={styles.selectedAction}>
                  {selectedAction}
                </div>
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
                  width: 640,
                  height: 480,
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
              <div
                style={
                  attendanceResult.type ===
                  "success"
                    ? styles.successBox
                    : attendanceResult.type ===
                      "warning"
                    ? styles.warningBox
                    : styles.errorBox
                }
              >
                <div
                  style={styles.resultTitle}
                >
                  {attendanceResult.type ===
                  "success"
                    ? "ATTENDANCE RECORDED"
                    : attendanceResult.type ===
                      "warning"
                    ? "VERIFICATION FAILED"
                    : "SYSTEM ERROR"}
                </div>

                <div
                  style={styles.resultMessage}
                >
                  {attendanceResult.message}
                </div>

                <button
                  style={
                    styles.dismissButton
                  }
                  onClick={
                    continueToKiosk
                  }
                >
                  CONTINUE
                </button>
              </div>
            )}

            {!attendanceResult &&
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

        <p style={styles.footer}>
          CIBO Attendance Monitoring System
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    width: "100%",
    background: "#f8f9fa",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "Arial, sans-serif",
    padding: "20px",
    boxSizing: "border-box",
  },

  container: {
    width: "100%",
    maxWidth: "900px",
    textAlign: "center",
  },

  logo: {
    fontSize: "48px",
    fontWeight: "800",
    color: "#f97316",
    marginBottom: "5px",
  },

  title: {
    fontSize: "42px",
    fontWeight: "700",
    color: "#111827",
    margin: "0",
  },

  subtitle: {
    fontSize: "20px",
    color: "#6b7280",
    marginTop: "12px",
    marginBottom: "25px",
    fontWeight: "500",
  },

  homeCard: {
    background: "#fff",
    padding: "45px 30px",
    borderRadius: "20px",
    boxShadow:
      "0 8px 25px rgba(0, 0, 0, 0.12)",
    marginTop: "10px",
  },

  homeIcon: {
    fontSize: "55px",
    marginBottom: "10px",
  },

  homeTitle: {
    fontSize: "28px",
    color: "#111827",
    margin: "0 0 10px",
  },

  homeText: {
    fontSize: "16px",
    color: "#6b7280",
    margin: "0 auto 30px",
    maxWidth: "520px",
    lineHeight: "1.5",
  },

  homeActions: {
    display: "flex",
    justifyContent: "center",
    gap: "20px",
    flexWrap: "wrap",
  },

  cameraCard: {
    background: "#fff",
    padding: "30px",
    borderRadius: "20px",
    boxShadow:
      "0 8px 25px rgba(0, 0, 0, 0.12)",
    marginTop: "10px",
  },

  actionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "18px",
  },

  actionLabel: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#6b7280",
    letterSpacing: "0.5px",
  },

  selectedAction: {
    fontSize: "24px",
    fontWeight: "800",
    color: "#111827",
    marginTop: "3px",
  },

  cancelButton: {
    border: "none",
    borderRadius: "9px",
    padding: "10px 18px",
    background: "#e5e7eb",
    color: "#374151",
    fontWeight: "700",
    cursor: "pointer",
  },

  cameraContainer: {
    position: "relative",
    width: "640px",
    maxWidth: "100%",
    height: "480px",
    margin: "0 auto",
    background: "#111827",
    borderRadius: "15px",
    overflow: "hidden",
  },

  camera: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },

  cameraLoading: {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    background: "#111827",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    fontSize: "18px",
  },

  loadingCircle: {
    width: "35px",
    height: "35px",
    border: "4px solid #fff",
    borderTop: "4px solid transparent",
    borderRadius: "50%",
    marginBottom: "15px",
    animation:
      "spin 1s linear infinite",
  },

  cameraStatus: {
    marginTop: "15px",
    fontSize: "16px",
    fontWeight: "600",
  },

  recognitionBox: {
    marginTop: "18px",
    padding: "18px",
    borderRadius: "15px",
    border: "2px solid #d1d5db",
    minHeight: "120px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },

  recognizedLabel: {
    fontSize: "15px",
    fontWeight: "700",
    color: "#16a34a",
    marginBottom: "5px",
  },

  recognitionStatus: {
    fontSize: "17px",
    fontWeight: "700",
    color: "#374151",
    marginBottom: "5px",
  },

  employeeName: {
    fontSize: "30px",
    fontWeight: "700",
    color: "#111827",
  },

  distance: {
    fontSize: "14px",
    color: "#6b7280",
    marginTop: "4px",
  },

  blinkInstruction: {
    marginTop: "12px",
    fontSize: "15px",
    fontWeight: "600",
    color: "#374151",
  },

  blinkInstructionActive: {
    marginTop: "12px",
    fontSize: "16px",
    fontWeight: "700",
    color: "#f97316",
  },

  resultMessage: {
    fontSize: "16px",
    color: "#4b5563",
  },

  readyBox: {
    marginTop: "18px",
    padding: "15px",
    borderRadius: "12px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1e3a8a",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },

  scanningBox: {
    marginTop: "18px",
    padding: "16px",
    borderRadius: "12px",
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "12px",
  },

  smallSpinner: {
    width: "22px",
    height: "22px",
    border: "3px solid #fdba74",
    borderTop: "3px solid transparent",
    borderRadius: "50%",
    animation:
      "spin 1s linear infinite",
  },

  actionArea: {
    display: "flex",
    justifyContent: "center",
    gap: "20px",
    marginTop: "22px",
    flexWrap: "wrap",
  },

  timeInButton: {
    width: "240px",
    height: "80px",
    border: "none",
    borderRadius: "14px",
    background: "#f97316",
    color: "#fff",
    fontSize: "24px",
    fontWeight: "700",
    boxShadow:
      "0 6px 16px rgba(0, 0, 0, 0.12)",
    cursor: "pointer",
  },

  timeOutButton: {
    width: "240px",
    height: "80px",
    border: "none",
    borderRadius: "14px",
    background: "#374151",
    color: "#fff",
    fontSize: "24px",
    fontWeight: "700",
    boxShadow:
      "0 6px 16px rgba(0, 0, 0, 0.12)",
    cursor: "pointer",
  },

  helperText: {
    marginTop: "18px",
    marginBottom: "0",
    fontSize: "14px",
    color: "#6b7280",
  },

  successBox: {
    marginTop: "20px",
    padding: "20px",
    borderRadius: "15px",
    background: "#ecfdf5",
    border: "2px solid #22c55e",
  },

  warningBox: {
    marginTop: "20px",
    padding: "20px",
    borderRadius: "15px",
    background: "#fff7ed",
    border: "2px solid #f97316",
  },

  errorBox: {
    marginTop: "20px",
    padding: "20px",
    borderRadius: "15px",
    background: "#fef2f2",
    border: "2px solid #ef4444",
  },

  resultTitle: {
    fontSize: "20px",
    fontWeight: "700",
    color: "#111827",
    marginBottom: "8px",
  },

  dismissButton: {
    marginTop: "15px",
    padding: "12px 30px",
    border: "none",
    borderRadius: "10px",
    background: "#374151",
    color: "#fff",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
  },

  footer: {
    marginTop: "30px",
    color: "#9ca3af",
    fontSize: "14px",
  },
};
