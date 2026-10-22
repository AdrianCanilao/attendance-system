import { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import { useLocation, useNavigate } from "react-router-dom";
import Webcam from "react-webcam";
import { supabase } from "../supabaseClient";
import ManagerLayout from "../layouts/ManagerLayout";
import HRLayout from "../layouts/HRLayout";
import { logAudit } from "../utils/auditlogger";
import { isValidEmail } from "../utils/emailValidation";

const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const INSIGHTFACE_URL = (import.meta.env.VITE_INSIGHTFACE_URL || "http://127.0.0.1:8002").replace(/\/$/, "");

const isStrongPassword = (password) =>
  password.length >= 8 &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password) &&
  /\d/.test(password) &&
  /[^A-Za-z0-9]/.test(password);

export default function RegisterEmployee() {
  const [showPassword, setShowPassword] = useState(false);
  const webcamRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const stagedEmployee = location.state?.stagedEmployee || null;
  const isBranchSupervisorStagedRegistration = Boolean(stagedEmployee?.sent_to_ms_at);
  const PageLayout = isBranchSupervisorStagedRegistration ? ManagerLayout : stagedEmployee ? HRLayout : ManagerLayout;

  const [form, setForm] = useState({
    employee_no: stagedEmployee?.employee_no || "",
    name: stagedEmployee?.full_name || "",
    email: "",
    password: "",
    contact: "",
    position: "",
    branch_id: stagedEmployee?.branch_id || "",
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
    if (stagedEmployee?.branch_id) fetchShifts(stagedEmployee.branch_id);
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
      (stagedEmployee && !String(form.employee_no || "").trim()) ||
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
            employee_no: form.employee_no.trim(),
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

      if (stagedEmployee?.id) {
        const linkResponse = await fetch(
          API_URL + "/admin/staged-legacy-employees/" + encodeURIComponent(stagedEmployee.id) + "/link",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + accessToken,
            },
            body: JSON.stringify({ user_id: userId }),
          }
        );
        let linkData = {};
        try { linkData = await linkResponse.json(); } catch {}
        if (!linkResponse.ok) {
          throw new Error(linkData?.detail || "The account was registered, but the staged DTR record could not be linked.");
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

      await Swal.fire({ title: stagedEmployee ? "Staged employee registered and linked!" : "Employee registered!", text: stagedEmployee ? "The account was created and the DTR employee record is now linked. Historical attendance has not been imported." : "The employee account was created successfully.", icon: "success", confirmButtonColor: "#f97316" });
      if (stagedEmployee) {
        navigate(stagedEmployee.sent_to_ms_at ? "/manager/staged-employees" : "/hr/staged-employees", { replace: true });
        return;
      }

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
    <PageLayout>
      <div className="cibo-page-root cibo-register-employee-page" style={styles.wrapper}>
        <h1 className="cibo-page-title" style={styles.pageTitle}>Register Employee</h1>
        {stagedEmployee && <div style={{ background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 8, padding: 12, marginBottom: 16, color: "#9a3412" }}>Preparing registration for staged DTR employee <strong>{stagedEmployee.employee_no} — {stagedEmployee.full_name}</strong>. Confirm the details and complete required fields and facial enrollment.</div>}

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
                  <label style={styles.label}>Employee Code <span style={styles.required}>*</span></label>
                  <span style={styles.counter}>Max 50 characters</span>
                </div>
                <input
                  name="employee_no"
                  placeholder="Enter CIBO employee code"
                  value={form.employee_no}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  maxLength={50}
                  required
                  aria-required="true"
                  aria-invalid={isFieldInvalid("employee_no")}
                  style={{ ...styles.input, ...(isFieldInvalid("employee_no") ? styles.inputError : {}) }}
                />
              </div>
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
                <div style={{ position: "relative" }}>
<input
                  type={showPassword ? "text" : "password"}
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
                  style={{ ...styles.input, ...(isFieldInvalid("password") ? styles.inputError : {}) , paddingRight: 44 }}
                />
<button
  type="button"
  onClick={() => setShowPassword((visible) => !visible)}
  aria-label={showPassword ? "Hide password" : "Show password"}
  title={showPassword ? "Hide password" : "Show password"}
  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: 0, background: "transparent", color: "#4b5563", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", justifyContent: "center" }}
>
  {showPassword ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.9 10.9 0 0 1 12 5c5 0 9 5 9 7a10.8 10.8 0 0 1-3 4.2"/><path d="M6.6 6.6C4.3 8 3 10.4 3 12c0 2 4 7 9 7a9.8 9.8 0 0 0 3-.5"/></svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
  )}
</button>
</div>
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
                  disabled={Boolean(stagedEmployee)}
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
    </PageLayout>
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
