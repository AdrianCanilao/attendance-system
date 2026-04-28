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

  // 🔹 handle input change
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // 🔹 open camera
  const openCamera = () => setShowCamera(true);

  // 🔹 capture image
  const captureFace = () => {
    const image = webcamRef.current.getScreenshot();
    setImageSrc(image);
    setShowCamera(false);
  };

  // 🔥 REGISTER EMPLOYEE + FACE
  const handleRegister = async () => {
    const { name, email, password, contact, position } = form;

    if (!name || !email || !password || !contact || !position) {
      alert("Please fill all fields");
      return;
    }

    if (!imageSrc) {
      alert("Please capture face first");
      return;
    }

    try {
      setLoading(true);

      // 🔥 1. CREATE USER
const { data: authData, error: authError } =
  await supabase.auth.signUp({
    email,
    password,
  });

if (authError) {
  alert(authError.message);
  return;
}

// 🚨 CRITICAL CHECK
if (!authData || !authData.user) {
  alert("User creation failed. Check email confirmation settings.");
  return;
}

const userId = authData.user.id;

// 🔥 2. INSERT PROFILE
const EMPLOYEE_ROLE_ID = "e4dbb928-7f0e-4da9-9eff-d7700d37b25a";

const { error: profileError } = await supabase
  .from("employee_profiles")
  .insert([
    {
      id: userId, // ✅ NOW IT EXISTS
      full_name: name,
      email,
      contact_number: contact,
      position,
      role_id: EMPLOYEE_ROLE_ID,
    },
  ]);

if (profileError) {
  alert(profileError.message);
  return;
}

      // 🔥 3. UPLOAD FACE
      const blob = await fetch(imageSrc).then((res) => res.blob());

      const formData = new FormData();
      formData.append("file", blob);
      formData.append("user_id", userId);

      const res = await fetch("http://127.0.0.1:8000/upload-face", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.status !== "Uploaded") {
        alert("Face upload failed");
        return;
      }

      // 🔥 4. SAVE FACE URL TO DATABASE
      await supabase
        .from("employee_profiles")
        .update({ face_url: data.url })
        .eq("id", userId);

      alert("✅ Employee registered successfully!");

      // 🔄 RESET FORM
      setForm({
        name: "",
        email: "",
        password: "",
        contact: "",
        position: "",
      });
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
      <h2>Register Employee</h2>

      {/* FORM */}
      <input
        name="name"
        placeholder="Full Name"
        value={form.name}
        onChange={handleChange}
        style={styles.input}
      />

      <input
        name="email"
        placeholder="Email"
        value={form.email}
        onChange={handleChange}
        style={styles.input}
      />

      <input
        type="password"
        name="password"
        placeholder="Password"
        value={form.password}
        onChange={handleChange}
        style={styles.input}
      />

      <input
        name="contact"
        placeholder="Contact Number"
        value={form.contact}
        onChange={handleChange}
        style={styles.input}
      />

      <input
        name="position"
        placeholder="Position"
        value={form.position}
        onChange={handleChange}
        style={styles.input}
      />

      <br />

      {/* CAMERA BUTTON */}
      <button onClick={openCamera} style={styles.button}>
        Open Camera
      </button>

      {/* CAMERA */}
      {showCamera && (
        <div style={{ marginTop: "20px" }}>
          <Webcam
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            style={styles.camera}
          />
          <br />
          <button onClick={captureFace} style={styles.button}>
            Capture Face
          </button>
        </div>
      )}

      {/* PREVIEW */}
      {imageSrc && (
        <div style={{ marginTop: "15px" }}>
          <p>Captured Face:</p>
          <img src={imageSrc} alt="preview" width={200} />
        </div>
      )}

      <br />

      <button onClick={handleRegister} disabled={loading} style={styles.button}>
        {loading ? "Registering..." : "Register Employee"}
      </button>
    </ManagerLayout>
  );
}

const styles = {
  input: {
    display: "block",
    width: "100%",
    maxWidth: "320px",
    padding: "10px",
    marginBottom: "10px",
  },
  camera: {
    width: "320px",
    borderRadius: "10px",
  },
  button: {
    padding: "10px 16px",
    background: "#f97316",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    marginTop: "10px",
  },
};