import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { supabase } from "../supabaseClient";
import ManagerLayout from "../layouts/ManagerLayout";
import { logAudit } from "../utils/auditlogger";
import { isValidEmail } from "../utils/emailValidation";

const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

const isStrongPassword = (password) =>
  password.length >= 8 &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password) &&
  /\d/.test(password) &&
  /[^A-Za-z0-9]/.test(password);

export default function RegisterEmployee() {
  const webcamRef = useRef(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    contact: "",
    position: "",
    branch_id: "",
    shift_id: "",
  });

  const [showCamera, setShowCamera] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [capturedImages, setCapturedImages] = useState([]);
  const [step, setStep] = useState(0);
  const [branches, setBranches] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [faceStatus, setFaceStatus] = useState({
    valid: false,
    message: "Position your face inside the box.",
    box: null,
  });

  const [checkingFace, setCheckingFace] = useState(false);
  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    const { data, error } = await supabase
      .from("branches")
      .select("*")
      .order("branch_name");

    if (!error) {
      setBranches(data || []);
    }
  };

  const fetchShifts = async (branchId) => {
    if (!branchId) {
      setShifts([]);
      return;
    }

    const { data, error } = await supabase
      .from("branch_shifts")
      .select("*")
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .order("time_in");

    if (!error) {
      setShifts(data || []);
    }
  };

  const steps = ["Look straight", "Turn LEFT", "Turn RIGHT"];

  const handleChange = (e) => {
    const { name } = e.target;
    let { value } = e.target;

    if (name === "name") {
      value = value.replace(/[0-9]/g, "").slice(0, 100);
    } else if (name === "position") {
      value = value.slice(0, 100);
    } else if (name === "email") {
      value = value.slice(0, 254);
    } else if (name === "password") {
      value = value.slice(0, 64);
    } else if (name === "contact") {
      value = value.replace(/\D/g, "").slice(0, 11);
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === "branch_id") {
      setForm((prev) => ({
        ...prev,
        branch_id: value,
        shift_id: "",
      }));

      fetchShifts(value);
    }
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const isFieldInvalid = (name) => {
    const value = form[name];
    return (touched[name] || submitAttempted) && !String(value || "").trim();
  };

  const getRemainingCharacters = (name, maxLength) => {
    return Math.max(0, maxLength - String(form[name] || "").length);
  };

  const openCamera = () => {
    setCapturedImages([]);
    setStep(0);
    setShowCamera(true);
  };

  const validateLiveFace = async () => {
    if (!webcamRef.current) return;

    const image = webcamRef.current.getScreenshot();

    if (!image) return;

    try {
      setCheckingFace(true);

      const blob = await fetch(image).then((r) => r.blob());

      const formData = new FormData();

      formData.append(
        "file",
        blob,
        "live-face.jpg"
      );

      const response = await fetch(
        API_URL + "/validate-face",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      setFaceStatus(data);

    } catch (error) {

      setFaceStatus({
        valid: false,
        message: "Camera validation unavailable.",
        box: null,
      });

    } finally {
      setCheckingFace(false);
    }
  };

  // LIVE CAMERA VALIDATION
  useEffect(() => {
    if (!showCamera) {
      return;
    }

    const interval = setInterval(() => {
      validateLiveFace();
    }, 700);

    return () => {
      clearInterval(interval);
    };
  }, [showCamera, step]);

  const captureFrames = async () => {
    const frames = [];

    for (let i = 0; i < 5; i++) {
      const image = webcamRef.current.getScreenshot();
      const blob = await fetch(image).then(r => r.blob());

      frames.push(blob);
      await new Promise(res => setTimeout(res, 300));
    }

    return frames;
  };

  const captureFace = () => {

    if (!faceStatus.valid) {
      alert(faceStatus.message);
      return;
    }

    const image = webcamRef.current?.getScreenshot();

    if (!image) {
      alert("Unable to capture camera image.");
      return;
    }

    const newImages = [
      ...capturedImages,
      image
    ];

    setCapturedImages(newImages);

    if (step === 0) {
      setImageSrc(image);
    }

    if (step < 2) {

      setStep(step + 1);

      setFaceStatus({
        valid: false,
        message:
          step === 0
            ? "Now turn your face slightly LEFT."
            : "Now turn your face slightly RIGHT.",
        box: null,
      });

    } else {

      setShowCamera(false);

      setFaceStatus({
        valid: false,
        message: "Face registration completed.",
        box: null,
      });
    }
  };

  const handleRegister = async (e) => {
    // Prevent the browser from navigating/reloading the page
    // when the registration form is submitted.
    e.preventDefault();
    setSubmitAttempted(true);

    const {
      name,
      email,
      password,
      contact,
      position,
    } = form;

    if (
      !name ||
      !email ||
      !password ||
      !contact ||
      !position ||
      !form.branch_id ||
      !form.shift_id
    ) {
      alert("Please fill all fields");
      return;
    }

    if (!isValidEmail(email)) {
      alert("Please enter a valid email address.");
      return;
    }

    if (name.trim().length > 100) {
      alert("Full name must be 100 characters or fewer.");
      return;
    }

    if (email.trim().length > 254) {
      alert("Email must be 254 characters or fewer.");
      return;
    }

    if (!/^\d{1,11}$/.test(contact)) {
      alert("Contact number must contain digits only and be at most 11 digits.");
      return;
    }

    if (position.trim().length > 100) {
      alert("Position must be 100 characters or fewer.");
      return;
    }

    if (!isStrongPassword(password)) {
      alert(
        "Password must have:\n\n" +
        "• 8 or more characters\n" +
        "• 1 uppercase letter\n" +
        "• 1 lowercase letter\n" +
        "• 1 number\n" +
        "• 1 special character"
      );
      return;
    }

    if (capturedImages.length < 3) {
      alert("Complete all face steps");
      return;
    }

    let accessToken = null;
    let createdUserId = null;
    const uploadedFaceFiles = [];

    try {
      setLoading(true);

      // Create the employee through the trusted FastAPI backend.
      // This keeps the Branch Supervisor's Supabase browser session intact.
      const {
        data: currentSessionData,
        error: currentSessionError,
      } = await supabase.auth.getSession();

      if (currentSessionError) {
        throw new Error(
          "Unable to read the current Branch Supervisor session: " +
          currentSessionError.message
        );
      }

      accessToken = currentSessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error("Your session has expired. Please log in again.");
      }

      const registrationResponse = await fetch(
        API_URL + "/admin/register-employee",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + accessToken,
          },
          body: JSON.stringify({
            name,
            email,
            password,
            contact,
            position,
            branch_id: form.branch_id,
            shift_id: form.shift_id,
          }),
        }
      );

      let registrationData = null;

      try {
        registrationData = await registrationResponse.json();
      } catch {
        registrationData = null;
      }

      if (!registrationResponse.ok) {
        throw new Error(
          registrationData?.detail ||
          "Employee registration request failed."
        );
      }

      const userId = registrationData?.user_id;

      if (!userId) {
        throw new Error("Employee account could not be created.");
      }

      createdUserId = userId;

      // UPLOAD MULTIPLE IMAGES
      for (let i = 0; i < capturedImages.length; i++) {
        const blob = await fetch(capturedImages[i]).then((r) => r.blob());

        const formData = new FormData();
        formData.append("file", blob);
        formData.append("user_id", userId);
        formData.append("full_name", name);

        const res = await fetch(API_URL + "/upload-face", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (data.status !== "Uploaded") {
          throw new Error(data.message || "Face upload failed. Please recapture the employee's face and try again.");
        }

        if (data.file) {
          uploadedFaceFiles.push(data.file);
        }

        if (i === 0) {
          await supabase
            .from("employee_profiles")
            .update({ face_url: data.url })
            .eq("id", userId);
        }
      }

      const { data: currentUser } = await supabase.auth.getUser();

      await logAudit({
        user_id: currentUser.user.id,
        user_name: currentUser.user.email,
        role: "maintenance",
        action: "REGISTER_EMPLOYEE",
        description: `Registered employee: ${name}`,
      });

      // RELOAD INSIGHTFACE EMPLOYEE TEMPLATES
      try {
        const reloadResponse = await fetch(
          INSIGHTFACE_URL + "/reload-templates?employee_id=" + encodeURIComponent(userId),
          {
            method: "POST",
          }
        );

        const reloadData = await reloadResponse.json();

        if (reloadData.status !== "OK") {
        }

      } catch (reloadError) {
      }

      alert("✅ Employee registered!");

      setForm({
        name: "",
        email: "",
        password: "",
        contact: "",
        position: "",
        branch_id: "",
        shift_id: "",
      });

      setCapturedImages([]);
      setImageSrc(null);

    } catch (err) {
      console.error("Employee registration failed:", err);

      if (createdUserId && accessToken) {
        try {
          await fetch(API_URL + "/admin/rollback-employee-registration", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + accessToken,
            },
            body: JSON.stringify({
              user_id: createdUserId,
              file_paths: uploadedFaceFiles,
            }),
          });
        } catch (rollbackError) {
          console.error("Employee registration rollback failed:", rollbackError);
        }
      }

      alert(
        "Registration failed:\n\n" +
        (err?.message || "Unknown error. Check the browser console for details.")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ManagerLayout>
      <div className="cibo-register-employee-page" style={styles.wrapper}>
        <h1 style={styles.pageTitle}>Register Employee</h1>

        <div className="cibo-register-employee-card" style={styles.card}>
          <div className={`cibo-register-employee-topSection ${showCamera ? "camera-open" : ""}`} style={styles.topSection}>
            <div className="cibo-register-employee-avatarWrapper" style={styles.avatarWrapper}>
              <div style={styles.avatarBox}>
                <div style={styles.avatarInner}>
                  {imageSrc ? (
                    <img src={imageSrc} alt="avatar" style={styles.avatarImg} />
                  ) : (
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="#9ca3af">
                      <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 
                      2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 
                      1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z"/>
                    </svg>
                  )}
                </div>
              </div>

              <button type="button" onClick={openCamera} style={styles.cameraBtn}>
                Open Camera
              </button>
            </div>

            <div className="cibo-register-employee-cameraWrapper" style={styles.cameraWrapper}>
              {showCamera ? (
                <>
                  <p style={styles.stepText}>
                    Step {step + 1}/3: {steps[step]}
                  </p>

                  <div
                    style={{
                      position: "relative",
                      width: "320px",
                      height: "240px",
                      borderRadius: "12px",
                      overflow: "hidden",
                      background: "#111827",
                    }}
                  >
                    <Webcam
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      videoConstraints={{
                        width: 320,
                        height: 240,
                        facingMode: "user",
                      }}
                      style={{
                        width: "320px",
                        height: "240px",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />

                    {/* FACE BOX */}
                    <div
                      style={{
                        position: "absolute",
                        left: faceStatus.box
                          ? `${(faceStatus.box.x / 320) * 100}%`
                          : "25%",
                        top: faceStatus.box
                          ? `${(faceStatus.box.y / 240) * 100}%`
                          : "20%",
                        width: faceStatus.box
                          ? `${(faceStatus.box.w / 320) * 100}%`
                          : "50%",
                        height: faceStatus.box
                          ? `${(faceStatus.box.h / 240) * 100}%`
                          : "60%",
                        border: faceStatus.valid
                          ? "3px solid #22c55e"
                          : "3px solid #ef4444",
                        borderRadius: "12px",
                        boxSizing: "border-box",
                        pointerEvents: "none",
                        transition: "all 0.2s ease",
                      }}
                    />
                  </div>

                  <div
                    style={{
                      marginTop: "10px",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: faceStatus.valid
                        ? "#dcfce7"
                        : "#fee2e2",
                      color: faceStatus.valid
                        ? "#166534"
                        : "#991b1b",
                      fontSize: "13px",
                      fontWeight: "600",
                      textAlign: "center",
                    }}
                  >
                    {faceStatus.valid
                      ? "🟢 " + faceStatus.message
                      : "🔴 " + faceStatus.message}
                  </div>

                  <button
                    type="button"
                    onClick={captureFace}
                    disabled={!faceStatus.valid}
                    style={{
                      ...styles.captureBtn,
                      background:
                        faceStatus.valid
                          ? "#16a34a"
                          : "#9ca3af",
                      cursor:
                        faceStatus.valid
                          ? "pointer"
                          : "not-allowed",
                      opacity:
                        faceStatus.valid
                          ? 1
                          : 0.7,
                    }}
                  >
                    {faceStatus.valid
                      ? "Capture"
                      : "Waiting for Face..."}
                  </button>
                </>
              ) : (
                <div style={{ height: "200px" }} />
              )}
            </div>
          </div>

          <form onSubmit={handleRegister} noValidate>
            <div className="cibo-register-employee-grid" style={styles.grid}>
              <div>
                <div style={styles.fieldHeader}>
                  <label style={styles.label}>Full Name <span style={styles.required}>*</span></label>
                  <span style={styles.counter}>Max 100 • {getRemainingCharacters("name", 100)} remaining</span>
                </div>
                <input
                  name="name"
                  placeholder="Enter full name"
                  value={form.name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  autoComplete="name"
                  maxLength={100}
                  pattern="[A-Za-zÀ-ÖØ-öø-ÿ' .-]+"
                  title="Full name must not contain numbers."
                  required
                  aria-required="true"
                  aria-invalid={isFieldInvalid("name")}
                  style={{ ...styles.input, ...(isFieldInvalid("name") ? styles.inputError : {}) }}
                />
              </div>

              <div>
                <div style={styles.fieldHeader}>
                  <label style={styles.label}>Email <span style={styles.required}>*</span></label>
                  <span style={styles.counter}>Max 254 • {getRemainingCharacters("email", 254)} remaining</span>
                </div>
                <input
                  type="email"
                  name="email"
                  placeholder="Enter email address"
                  value={form.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  autoComplete="email"
                  maxLength={254}
                  required
                  aria-required="true"
                  aria-invalid={isFieldInvalid("email")}
                  style={{ ...styles.input, ...(isFieldInvalid("email") ? styles.inputError : {}) }}
                />
              </div>

              <div>
                <div style={styles.fieldHeader}>
                  <label style={styles.label}>Password <span style={styles.required}>*</span></label>
                  <span style={styles.counter}>Max 64 • {getRemainingCharacters("password", 64)} remaining</span>
                </div>
                <input
                  type="password"
                  name="password"
                  placeholder="Enter password"
                  value={form.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={64}
                  required
                  aria-required="true"
                  aria-invalid={isFieldInvalid("password")}
                  style={{ ...styles.input, ...(isFieldInvalid("password") ? styles.inputError : {}) }}
                />
              </div>

              <div>
                <div style={styles.fieldHeader}>
                  <label style={styles.label}>Contact Number <span style={styles.required}>*</span></label>
                  <span style={styles.counter}>Max 11 • {getRemainingCharacters("contact", 11)} remaining</span>
                </div>
                <input
                  type="tel"
                  name="contact"
                  placeholder="Enter contact number"
                  value={form.contact}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  autoComplete="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={11}
                  required
                  aria-required="true"
                  aria-invalid={isFieldInvalid("contact")}
                  style={{ ...styles.input, ...(isFieldInvalid("contact") ? styles.inputError : {}) }}
                />
              </div>

              <div>
                <div style={styles.fieldHeader}>
                  <label style={styles.label}>Position <span style={styles.required}>*</span></label>
                  <span style={styles.counter}>Max 100 • {getRemainingCharacters("position", 100)} remaining</span>
                </div>
                <input
                  name="position"
                  placeholder="Enter position"
                  value={form.position}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  maxLength={100}
                  required
                  aria-required="true"
                  aria-invalid={isFieldInvalid("position")}
                  style={{ ...styles.input, ...(isFieldInvalid("position") ? styles.inputError : {}) }}
                />
              </div>

              <div>
                <div style={styles.fieldHeader}>
                  <label style={styles.label}>Branch Assignment <span style={styles.required}>*</span></label>
                </div>
                <select
                  name="branch_id"
                  value={form.branch_id}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required
                  aria-required="true"
                  aria-invalid={isFieldInvalid("branch_id")}
                  style={{ ...styles.input, ...(isFieldInvalid("branch_id") ? styles.inputError : {}) }}
                >
                  <option value="">Select Branch</option>

                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.branch_name} ({branch.branch_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={styles.fieldHeader}>
                  <label style={styles.label}>Shift Assignment <span style={styles.required}>*</span></label>
                </div>

                <select
                  name="shift_id"
                  value={form.shift_id}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  style={{ ...styles.input, ...(isFieldInvalid("shift_id") ? styles.inputError : {}) }}
                  disabled={!form.branch_id}
                  required
                  aria-required="true"
                  aria-invalid={isFieldInvalid("shift_id")}
                >
                  <option value="">Select Shift</option>

                  {shifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.shift_name} (
                      {new Date(`1970-01-01T${shift.time_in}`).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })}
                      {" - "}
                      {new Date(`1970-01-01T${shift.time_out}`).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })}
                      )
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button type="submit" disabled={loading} style={styles.primaryBtn}>
              {loading ? "Registering..." : "Register Employee"}
            </button>
          </form>
        </div>
      </div>
    </ManagerLayout>
  );
}

const styles = {
  wrapper: { padding: "20px" },

  title: {
    margin: 0,
    fontSize: "24px",
    fontWeight: "700",
    color: "#111827",
  },

  card: {
    background: "#fff",
    borderRadius: "12px",
    padding: "30px",
  },

  topSection: {
    display: "flex",
    gap: "40px",
    marginBottom: "30px",
    alignItems: "flex-start",
  },

  avatarWrapper: {
    width: "193px",
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
  },

  defaultAvatar: {
    width: "193px",
    height: "193px",
    borderRadius: "50%",
    background: "#e5e7eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },

  cameraWrapper: {
    width: "260px",
    minHeight: "220px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
  },

  camera: {
    width: "260px",
    borderRadius: "10px",
  },

  cameraBtn: {
    background: "#f97316",
    color: "#fff",
    border: "none",
    padding: "8px 14px",
    borderRadius: "8px",
    cursor: "pointer",
  },

  captureBtn: {
    background: "#f97316",
    color: "#fff",
    padding: "8px 14px",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
  },

  fieldHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    minHeight: "18px",
  },

  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: "500",
    color: "#374151",
    marginBottom: "6px",
  },

  required: {
    color: "#dc2626",
    fontWeight: "800",
  },

  counter: {
    color: "#98a2b3",
    fontSize: "11px",
    fontWeight: "500",
    marginBottom: "6px",
    whiteSpace: "nowrap",
  },

  input: {
    width: "100%",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    fontSize: "14px",
    color: "#111827",
    boxSizing: "border-box",
    outline: "none",
  },

  inputError: {
    border: "1px solid #dc2626",
    boxShadow: "0 0 0 1px rgba(220,38,38,.08)",
  },

  primaryBtn: {
    marginTop: "15px",
    padding: "10px 16px",
    background: "#f97316",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  },

  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: "500",
    color: "#374151",
    marginBottom: "6px",
  },

  avatarBox: {
    width: "193px",
    height: "193px",
    minWidth: "193px",
    minHeight: "193px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarInner: {
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    background: "#e5e7eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  avatarImg: {
    width: "300px",
    height: "300px",
    borderRadius: "50%",
    objectFit: "cover",
  },

  stepText: {
    marginTop: "-25px",
    marginBottom: "0px",
    fontWeight: "500",
    textAlign: "center",
  },

  pageTitle: {
    fontSize: "25px",
    fontWeight: "650",
    color: "#111827",
    margin: "0 0 20px 0",
    padding: 0,
    letterSpacing: "-0.3px",
    lineHeight: "1.2",
  },
};
