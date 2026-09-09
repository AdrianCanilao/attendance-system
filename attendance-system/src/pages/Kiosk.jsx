import { useRef, useState } from "react";
import Webcam from "react-webcam";

export default function Kiosk() {
  const webcamRef = useRef(null);

  const [selectedAction, setSelectedAction] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);

  const startAttendance = (action) => {
    setSelectedAction(action);
    setResult(null);
    setScanning(false);
    setCameraReady(false);
  };

  const cancelAttendance = () => {
    setSelectedAction(null);
    setCameraReady(false);
    setScanning(false);
    setResult(null);
  };

  // Convert the webcam screenshot into a file
  const dataURLtoFile = (dataUrl, fileName) => {
    const arr = dataUrl.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];

    const bstr = atob(arr[1]);
    let n = bstr.length;

    const u8arr = new Uint8Array(n);

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }

    return new File([u8arr], fileName, {
      type: mime,
    });
  };

  // Capture 5 frames and send them to FastAPI
  const scanFace = async () => {
    if (!webcamRef.current) {
      return;
    }

    if (scanning) {
      return;
    }

    setScanning(true);
    setResult(null);

    try {
      const formData = new FormData();

// Tell the backend whether this is TIME IN or TIME OUT
formData.append("action", selectedAction);

// Capture 5 frames
for (let i = 0; i < 5; i++) {
        const imageSrc =
          webcamRef.current.getScreenshot();

        if (!imageSrc) {
          continue;
        }

        const file = dataURLtoFile(
          imageSrc,
          `kiosk_frame_${i + 1}.jpg`
        );

        formData.append("files", file);

        // Small delay between frames
        await new Promise((resolve) =>
          setTimeout(resolve, 350)
        );
      }

      const response = await fetch(
        "http://127.0.0.1:8000/kiosk-verify",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      console.log("KIOSK RESPONSE:", data);

      if (!response.ok) {
        setResult({
          type: "error",
          message:
            data.message ||
            "Unable to connect to the face recognition server.",
        });

        return;
      }

      if (data.status === "Match") {
    setResult({
        type: "success",
        employee: data.employee,
        distance: data.distance,
        attendance: data.attendance,
        action: selectedAction
    });  
      } else if (data.status === "Fake") {
        setResult({
          type: "warning",
          message:
            data.message ||
            "Please blink naturally and try again.",
        });
      } else if (data.status === "No Face") {
        setResult({
          type: "warning",
          message:
            "No face detected. Please position your face in front of the camera.",
        });
      } else if (data.status === "No Match") {
        setResult({
          type: "warning",
          message:
            "Face not recognized. Please try again.",
        });
      } else {
        setResult({
          type: "error",
          message:
            data.message ||
            "An error occurred during face recognition.",
        });
      }
    } catch (error) {
      console.error(
        "KIOSK SCAN ERROR:",
        error
      );

      setResult({
        type: "error",
        message:
          "Unable to connect to the face recognition server.",
      });
    } finally {
      setScanning(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* HEADER */}
        <div style={styles.logo}>
          CIBO
        </div>

        <h1 style={styles.title}>
          ATTENDANCE KIOSK
        </h1>

        {!selectedAction ? (
          <>
            <p style={styles.subtitle}>
              Select an attendance action
            </p>

            {/* ACTION BUTTONS */}
            <div style={styles.buttons}>

              <button
                style={styles.timeInButton}
                onClick={() =>
                  startAttendance("TIME IN")
                }
              >
                <span style={styles.icon}>
                  ✓
                </span>

                TIME IN
              </button>

              <button
                style={styles.timeOutButton}
                onClick={() =>
                  startAttendance("TIME OUT")
                }
              >
                <span style={styles.icon}>
                  ↪
                </span>

                TIME OUT
              </button>

            </div>
          </>
        ) : (
          <>
            {/* CAMERA SCREEN */}

            <p style={styles.subtitle}>
              {selectedAction}
            </p>

            <div style={styles.cameraCard}>

              <p style={styles.instruction}>
                Please look directly at the camera
              </p>

              <p style={styles.blinkInstruction}>
                Please blink your eyes during scanning
              </p>

              {/* LIVE CAMERA */}
              <div style={styles.cameraContainer}>

                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
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
                  }}
                  style={styles.camera}
                />

                {!cameraReady && (
                  <div
                    style={styles.cameraLoading}
                  >
                    <div
                      style={styles.loadingCircle}
                    ></div>

                    <p>
                      Starting camera...
                    </p>
                  </div>
                )}

              </div>

              {/* CAMERA STATUS */}
              <div
                style={styles.cameraStatus}
              >
                {cameraReady
                  ? "● Camera Ready"
                  : "● Starting Camera"}
              </div>

              {/* SCAN BUTTON */}
              {!result && (
                <button
                  style={{
                    ...styles.scanButton,
                    opacity:
                      !cameraReady ||
                      scanning
                        ? 0.6
                        : 1,
                  }}
                  disabled={
                    !cameraReady ||
                    scanning
                  }
                  onClick={scanFace}
                >
                  {scanning
                    ? "SCANNING..."
                    : "SCAN FACE"}
                </button>
              )}

              {/* RESULT */}
              {result && (
                <div
                  style={
                    result.type ===
                    "success"
                      ? styles.successBox
                      : result.type ===
                        "warning"
                      ? styles.warningBox
                      : styles.errorBox
                  }
                >

                  {result.type ===
                    "success" ? (
                    <>
                      <div
                        style={
                          styles.resultIcon
                        }
                      >
                        ✓
                      </div>

                      <div
  style={
    styles.resultTitle
  }
>
  {result.attendance?.status === "Time In Recorded"
    ? "TIME IN SUCCESSFUL"
    : result.attendance?.status === "Time Out Recorded"
    ? "TIME OUT SUCCESSFUL"
    : "FACE RECOGNIZED"}
</div>

                      <div
                        style={
                          styles.employeeName
                        }
                      >
                        {result.employee
                          ?.full_name ||
                          "Employee"}
                      </div>

                      <div
                        style={
                          styles.resultMessage
                        }
                      >
                        {result.attendance?.message ||
  "Employee successfully identified."}
                      </div>
                    </>
                  ) : (
                    <>
                      <div
                        style={
                          styles.resultTitle
                        }
                      >
                        {result.type ===
                        "warning"
                          ? "SCAN UNSUCCESSFUL"
                          : "SYSTEM ERROR"}
                      </div>

                      <div
                        style={
                          styles.resultMessage
                        }
                      >
                        {result.message}
                      </div>
                    </>
                  )}

                </div>
              )}

              {/* RETRY */}
              {result &&
                result.type !==
                  "success" && (
                  <button
                    style={
                      styles.retryButton
                    }
                    onClick={() =>
                      setResult(null)
                    }
                  >
                    TRY AGAIN
                  </button>
                )}

              {/* CANCEL */}
              <button
                style={styles.cancelButton}
                onClick={cancelAttendance}
              >
                CANCEL
              </button>

            </div>
          </>
        )}

        {/* FOOTER */}
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
    fontSize: "24px",
    color: "#6b7280",
    marginTop: "12px",
    marginBottom: "35px",
    fontWeight: "500",
  },

  buttons: {
    display: "flex",
    justifyContent: "center",
    gap: "30px",
    flexWrap: "wrap",
  },

  timeInButton: {
    width: "300px",
    height: "180px",
    border: "none",
    borderRadius: "20px",
    background: "#f97316",
    color: "#fff",
    fontSize: "32px",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow:
      "0 8px 20px rgba(0, 0, 0, 0.15)",
  },

  timeOutButton: {
    width: "300px",
    height: "180px",
    border: "none",
    borderRadius: "20px",
    background: "#374151",
    color: "#fff",
    fontSize: "32px",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow:
      "0 8px 20px rgba(0, 0, 0, 0.15)",
  },

  icon: {
    display: "block",
    fontSize: "42px",
    marginBottom: "10px",
  },

  cameraCard: {
    background: "#fff",
    padding: "30px",
    borderRadius: "20px",
    boxShadow:
      "0 8px 25px rgba(0, 0, 0, 0.12)",
    marginTop: "10px",
  },

  instruction: {
    fontSize: "22px",
    fontWeight: "600",
    color: "#111827",
    margin: "0 0 5px 0",
  },

  blinkInstruction: {
    fontSize: "17px",
    color: "#6b7280",
    margin: "0 0 20px 0",
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
    borderTop:
      "4px solid transparent",
    borderRadius: "50%",
    marginBottom: "15px",
    animation:
      "spin 1s linear infinite",
  },

  cameraStatus: {
    marginTop: "15px",
    fontSize: "16px",
    fontWeight: "600",
    color: "#16a34a",
  },

  scanButton: {
    marginTop: "20px",
    padding: "16px 55px",
    border: "none",
    borderRadius: "12px",
    background: "#f97316",
    color: "#fff",
    fontSize: "20px",
    fontWeight: "700",
    cursor: "pointer",
  },

  successBox: {
    marginTop: "20px",
    padding: "20px",
    borderRadius: "15px",
    background: "#ecfdf5",
    border:
      "2px solid #22c55e",
  },

  warningBox: {
    marginTop: "20px",
    padding: "20px",
    borderRadius: "15px",
    background: "#fff7ed",
    border:
      "2px solid #f97316",
  },

  errorBox: {
    marginTop: "20px",
    padding: "20px",
    borderRadius: "15px",
    background: "#fef2f2",
    border:
      "2px solid #ef4444",
  },

  resultIcon: {
    fontSize: "45px",
    color: "#16a34a",
    fontWeight: "700",
  },

  resultTitle: {
    fontSize: "20px",
    fontWeight: "700",
    color: "#111827",
    marginBottom: "8px",
  },

  employeeName: {
    fontSize: "30px",
    fontWeight: "700",
    color: "#111827",
    marginBottom: "5px",
  },

  resultMessage: {
    fontSize: "16px",
    color: "#4b5563",
  },

  retryButton: {
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

  cancelButton: {
    marginTop: "20px",
    marginLeft: "10px",
    padding: "14px 40px",
    border: "none",
    borderRadius: "10px",
    background: "#e5e7eb",
    color: "#111827",
    fontSize: "18px",
    fontWeight: "600",
    cursor: "pointer",
  },

  footer: {
    marginTop: "40px",
    color: "#9ca3af",
    fontSize: "14px",
  },
};