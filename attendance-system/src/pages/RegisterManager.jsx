import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { supabase } from "../supabaseClient";
import HRLayout from "../layouts/HRLayout";
import { logAudit } from "../utils/auditlogger";
import { isValidEmail } from "../utils/emailValidation";

const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const INSIGHTFACE_URL = (import.meta.env.VITE_INSIGHTFACE_URL || "http://127.0.0.1:8002").replace(/\/$/, "");

export default function RegisterManager() {
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
    .order("time_in");

  if (!error) {
    setShifts(data || []);
  }
};

  const steps = ["Look straight", "Turn LEFT", "Turn RIGHT"];

  const handleChange = async (e) => {
  const { name, value } = e.target;

  const updated = {
    ...form,
    [name]: value,
  };

  setForm(updated);

  if (name === "branch_id") {
    updated.shift_id = "";
    setForm(updated);

    fetchShifts(value);
  }
};

const openCamera = () => {
  setCapturedImages([]);
  setStep(0);

  setFaceStatus({
    valid: false,
    message: "Position your face inside the box.",
    box: null,
  });

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
      INSIGHTFACE_URL + "/validate-enrollment-face",
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();

    setFaceStatus(data);

  } catch (error) {
    console.error(
      "Live face validation error:",
      error
    );

    setFaceStatus({
      valid: false,
      message: "Camera validation unavailable.",
      box: null,
    });

  } finally {
    setCheckingFace(false);
  }
};


// 🔥 LIVE CAMERA VALIDATION
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
  const handleRegister = async () => {
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

    if (capturedImages.length < 3) {
      alert("Complete all face steps");
      return;
    }

    try {
      setLoading(true);

      const { data: authData, error: authError } =
        await supabase.auth.signUp({ email, password });

      if (authError) {
        alert(authError.message);
        return;
      }

      const userId = authData.user.id;
      const MANAGER_ROLE_ID = "b381a7a0-9595-4c69-abf1-5c15a827647a";

      await supabase.from("employee_profiles").insert([
        {
          id: userId,
          full_name: name,
          email,
          contact_number: contact,
          position,
          role_id: MANAGER_ROLE_ID,
branch_id: form.branch_id,
shift_id: form.shift_id,
        },
      ]);

      // 🔥 UPLOAD MULTIPLE IMAGES
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
          alert("Face upload failed");
          return;
        }

        if (i === 0) {
          await supabase
            .from("employee_profiles")
            .update({ face_url: data.url })
            .eq("id", userId);
        }
      }

      // =====================================================
      // 🔄 RELOAD INSIGHTFACE EMPLOYEE TEMPLATES
      // =====================================================
      try {
        console.log("🔄 Reloading InsightFace templates...");

        const reloadResponse = await fetch(
          INSIGHTFACE_URL + "/reload-templates",
          {
            method: "POST",
          }
        );

        const reloadData = await reloadResponse.json();

        console.log(
          "🔄 INSIGHTFACE TEMPLATE RELOAD:",
          reloadData
        );

        if (reloadData.status !== "OK") {
          console.warn(
            "⚠️ Maintenance specialist registered, but InsightFace templates were not reloaded."
          );
        }
      } catch (reloadError) {
        console.warn(
          "⚠️ Maintenance specialist registered, but InsightFace reload failed:",
          reloadError
        );
      }

      const { data: currentUser } =
        await supabase.auth.getUser();

await logAudit({
  user_id: currentUser.user.id,
  user_name: currentUser.user.email,
  role: "hr",
action: "REGISTER_MAINTENANCE",
  description: `Registered manager: ${name}`,
});

      alert("✅ Maintenance Specialist registered!");

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
      console.error(err);
      alert("Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <HRLayout>
      <div className="cibo-hr-page cibo-hr-register-page" style={styles.wrapper}>
        <h1 style={styles.pageTitle}>Register Maintenance Specialist</h1>

        <div style={styles.card}>
          <div className={`topSection ${showCamera ? "camera-open" : ""}`} style={styles.topSection}>
            <div className="avatarWrapper" style={styles.avatarWrapper}>
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

              <button onClick={openCamera} style={styles.cameraBtn}>
                Open Camera
              </button>
            </div>

            <div className="cameraWrapper" style={styles.cameraWrapper}>
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

                  {/* FACE STATUS */}
                  <div
                    style={{
                      width: "320px",
                      boxSizing: "border-box",
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

                  {/* CAPTURE BUTTON */}
                  <button
                    onClick={captureFace}
                    disabled={!faceStatus.valid}
                    style={{
                      ...styles.captureBtn,

                      background: faceStatus.valid
                        ? "#16a34a"
                        : "#9ca3af",

                      cursor: faceStatus.valid
                        ? "pointer"
                        : "not-allowed",

                      opacity: faceStatus.valid
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

          <div className="cibo-hr-form-grid" style={styles.grid}>
            <div>
              <label style={styles.label}>Full Name</label>
              <input
                name="name"
                placeholder="Enter full name"
                value={form.name}
                onChange={handleChange}
                style={styles.input}
              />
            </div>

            <div>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                name="email"
                placeholder="Enter email address"
                value={form.email}
                onChange={handleChange}
                style={styles.input}
              />
            </div>

            <div>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                name="password"
                placeholder="Enter password"
                value={form.password}
                onChange={handleChange}
                style={styles.input}
              />
            </div>

            <div>
              <label style={styles.label}>Contact Number</label>
              <input
                name="contact"
                placeholder="Enter contact number"
                value={form.contact}
                onChange={handleChange}
                style={styles.input}
              />
            </div>

            <div>
  <label style={styles.label}>Position</label>

  <input
    name="position"
    placeholder="Enter position"
    value={form.position}
    onChange={handleChange}
    style={styles.input}
  />
</div>

<div>
  <label style={styles.label}>Branch Assignment</label>

  <select
    name="branch_id"
    value={form.branch_id}
    onChange={handleChange}
    style={styles.input}
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
  <label style={styles.label}>Shift Assignment</label>

  <select
    name="shift_id"
    value={form.shift_id}
    onChange={handleChange}
    style={styles.input}
    disabled={!form.branch_id}
  >
    <option value="">
      {form.branch_id
        ? "Select Shift"
        : "Select Branch First"}
    </option>

    {shifts.map((shift) => (
      <option key={shift.id} value={shift.id}>
        {`${shift.shift_name} (${new Date(
          `1970-01-01T${shift.time_in}`
        ).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })} - ${new Date(
          `1970-01-01T${shift.time_out}`
        ).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })})`}
      </option>
    ))}
  </select>
</div>
          </div>

          <button onClick={handleRegister} disabled={loading} style={styles.primaryBtn}>
            {loading ? "Registering..." : "Register Manager"}
          </button>
        </div>
      </div>
    </HRLayout>
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
  width: "320px",
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

  input: {
    width: "100%",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    fontSize: "14px",
    color: "#111827",
    boxSizing: "border-box",
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