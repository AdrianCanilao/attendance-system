import { useRef, useState, useEffect } from "react";
import Webcam from "react-webcam";
import { supabase } from "../supabaseClient";
import ManagerLayout from "../layouts/ManagerLayout";

export default function RegisterEmployee() {
  const webcamRef = useRef(null);
  const [employees, setEmployees] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from("employee_profiles")
      .select("id, full_name");

    if (error) {
      console.log("fetchEmployees error:", error);
      return;
    }

    setEmployees(data || []);
  };

  const handleRegister = async () => {
    if (!selectedUser) {
      alert("Please select employee first");
      return;
    }

    if (!webcamRef.current) {
      alert("Camera not ready");
      return;
    }

    const imageSrc = webcamRef.current.getScreenshot();

    if (!imageSrc) {
      alert("Camera not ready");
      return;
    }

    const blob = await fetch(imageSrc).then((res) => res.blob());

    console.log("USER:", selectedUser);
    console.log("BLOB:", blob);

    const formData = new FormData();
    formData.append("file", blob);
    formData.append("user_id", selectedUser);

    console.log("🚀 SENDING TO BACKEND...");

    try {
      const res = await fetch("http://127.0.0.1:8000/upload-face", {
        method: "POST",
        body: formData,
      });

      console.log("🔥 FETCH DONE");

      const text = await res.text();
      console.log("🔥 RAW RESPONSE:", text);

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        alert("Invalid JSON response from backend");
        return;
      }

      console.log("📦 RESPONSE:", data);

      if (data.status === "Uploaded") {
        alert("✅ Face uploaded successfully!");
        console.log("FACE URL:", data.url);
      } else {
        alert(data.message || "Upload failed");
      }

    } catch (err) {
      console.error("FETCH ERROR:", err);
      alert("Backend connection failed");
    }
  };

  return (
    <ManagerLayout>
      <h2>Register Employee Face</h2>

      <select
        value={selectedUser}
        onChange={(e) => setSelectedUser(e.target.value)}
        style={styles.select}
      >
        <option value="">Select Employee</option>
        {employees.map((emp) => (
          <option key={emp.id} value={emp.id}>
            {emp.full_name}
          </option>
        ))}
      </select>

      <br />
      <br />

      <Webcam
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        style={styles.camera}
      />

      <br />
      <br />

      <button onClick={handleRegister} style={styles.button}>
        Register Face
      </button>
    </ManagerLayout>
  );
}

const styles = {
  select: {
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
  },
};