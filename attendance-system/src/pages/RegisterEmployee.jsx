import { useRef, useState } from "react";
import Webcam from "react-webcam";
import { supabase } from "../supabaseClient";
import ManagerLayout from "../layouts/ManagerLayout";

export default function RegisterEmployee() {
  const webcamRef = useRef(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    contact: "",
    position: "",
  });

  const [showCamera, setShowCamera] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [capturedImages, setCapturedImages] = useState([]);
  const [step, setStep] = useState(0);

  const steps = ["Look straight", "Turn LEFT", "Turn RIGHT"];

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const openCamera = () => {
    setCapturedImages([]);
    setStep(0);
    setShowCamera(true);
  };

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
    const image = webcamRef.current.getScreenshot();

    const newImages = [...capturedImages, image];
    setCapturedImages(newImages);

    if (step === 0) {
      setImageSrc(image);
    }

    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      setShowCamera(false);
    }
  };

  const handleRegister = async () => {
    const { name, email, password, contact, position } = form;

    if (!name || !email || !password || !contact || !position) {
      alert("Please fill all fields");
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
      const EMPLOYEE_ROLE_ID = "e4dbb928-7f0e-4da9-9eff-d7700d37b25a";

      await supabase.from("employee_profiles").insert([
        {
          id: userId,
          full_name: name,
          email,
          contact_number: contact,
          position,
          role_id: EMPLOYEE_ROLE_ID,
        },
      ]);

      // 🔥 UPLOAD MULTIPLE IMAGES (FIXED)
      for (let i = 0; i < capturedImages.length; i++) {
        const blob = await fetch(capturedImages[i]).then((r) => r.blob());

        const formData = new FormData();
        formData.append("file", blob);
        formData.append("user_id", userId);
        formData.append("full_name", name); // ✅ FIXED HERE

        const res = await fetch("http://127.0.0.1:8000/upload-face", {
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

      alert("✅ Employee registered!");

      setForm({
        name: "",
        email: "",
        password: "",
        contact: "",
        position: "",
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
    <ManagerLayout>
      <div style={styles.wrapper}>
        <h2 style={styles.title}>Register Employee</h2>

        <div style={styles.card}>
          <div style={styles.topSection}>
            <div style={styles.avatarWrapper}>
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

            <div style={styles.cameraWrapper}>
              {showCamera ? (
                <>
                  <p style={styles.stepText}>
                    Step {step + 1}/3: {steps[step]}
                  </p>

                  <Webcam
  ref={webcamRef}
  screenshotFormat="image/jpeg"
  videoConstraints={{
    width: 300,
    height: 300,
    facingMode: "user",
  }}
  style={{
    width: "260px",
    height: "182px",
    borderRadius: "12px",
    objectFit: "cover",
  }}
/>

                  <button onClick={captureFace} style={styles.captureBtn}>
                    Capture
                  </button>
                </>
              ) : (
                <div style={{ height: "200px" }} />
              )}
            </div>
          </div>

          <div style={styles.grid}>
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

            <div style={{ gridColumn: "span 2" }}>
              <label style={styles.label}>Position</label>
              <input
                name="position"
                placeholder="Enter position"
                value={form.position}
                onChange={handleChange}
                style={styles.input}
              />
            </div>
          </div>

          <button onClick={handleRegister} disabled={loading} style={styles.primaryBtn}>
            {loading ? "Registering..." : "Register Employee"}
          </button>
        </div>
      </div>
    </ManagerLayout>
  );
}
const styles = {
  wrapper: { padding: "20px" },

  title: { marginBottom: "15px" },

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
  width: "193px",        // 🔥 SAME SIZE
  flexShrink: 0,         // 🔥 STOP SHRINKING
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

  flexShrink: 0,          // 🔥 PREVENT FLEX SHRINK
},


  cameraWrapper: {
  width: "260px",
  minHeight: "220px",   // prevents layout jump
  display: "flex",
  flexDirection: "column",
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
  background: "#ffffff",        // 🔥 WHITE BG
  fontSize: "14px",
  color: "#111827",             // text color
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

  overflow: "hidden",   // 🔥 THIS IS THE KEY
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
};