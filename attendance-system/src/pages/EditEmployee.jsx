import { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import ManagerLayout from "../layouts/ManagerLayout";
import Webcam from "react-webcam";

export default function EditEmployee() {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [hasFace, setHasFace] = useState(true);
  const [showCamera, setShowCamera] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [step, setStep] = useState(0);
  const [capturedImages, setCapturedImages] = useState([]);
  const webcamRef = useRef(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    const { data } = await supabase.from("employee_profiles").select("*");
    setEmployees(data || []);
  };

  const filtered = employees.filter((emp) =>
    emp.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const openModal = (emp) => {
    setSelected(emp);
    setForm({
      name: emp.full_name,
      email: emp.email,
      contact: emp.contact_number,
      position: emp.position,
    });
setImageSrc(emp.face_url || null);
    setHasFace(!!emp.face_url);
    setCapturedImages([]);
    setStep(0);
  };

  const closeModal = () => {
    setSelected(null);
    setImageSrc(null);
    setShowCamera(false);
    setCapturedImages([]);
    setStep(0);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // ✅ UPDATED CAPTURE (NO ALERTS + FIXED AVATAR)
  const captureFace = async () => {
    const image = webcamRef.current.getScreenshot();
    const blob = await fetch(image).then((r) => r.blob());

    const updated = [...capturedImages, blob];
    setCapturedImages(updated);

    // ✅ ONLY SET AVATAR ON FRONT FACE
    if (step === 0) {
      setImageSrc(image);
    }

    if (step < 2) {
      setStep(step + 1);
    } else {
      setShowCamera(false);
      setStep(0);
    }
  };

  const deleteFaces = async () => {
  const safeName = form.name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  const folder = `employees/${safeName}`;

  const { data: files } = await supabase
    .storage
    .from("faces")
    .list(folder);

  if (!files || files.length === 0) return;

  const paths = files.map(f => `${folder}/${f.name}`);

  await supabase.storage
    .from("faces")
    .remove(paths);

  // 🔥 update UI state
  setHasFace(false);
  setImageSrc(null);
};

  const uploadFaces = async () => {
    console.log("Images:", capturedImages);
    if (capturedImages.length !== 3) return;

    const safeName = form.name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");

    const labels = ["front", "left", "right"];

    for (let i = 0; i < 3; i++) {
      const filePath = `employees/${safeName}/${labels[i]}.jpg`;

      await supabase.storage
        .from("faces")
        .upload(filePath, capturedImages[i], { contentType: "image/jpeg", upsert: true });
    }
    const publicUrl = supabase
  .storage
  .from("faces")
  .getPublicUrl(`employees/${safeName}/front.jpg`).data.publicUrl + `?t=${Date.now()}`;

  await supabase
  .from("employee_profiles")
  .update({ face_url: publicUrl })
  .eq("id", selected.id);
  };

  const handleUpdate = async () => {
    if (!form.name || !form.email) {
      alert("Name and Email required");
      return;
    }

    try {
      setLoading(true);

      await supabase
        .from("employee_profiles")
        .update({
          full_name: form.name,
          contact_number: form.contact,
          position: form.position,
        })
        .eq("id", selected.id);

      if (capturedImages.length === 3) {
        await uploadFaces();
      }

      alert("✅ Updated!");
      closeModal();
      fetchEmployees();
    } catch {
      alert("Update failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this employee?")) return;

    await supabase
      .from("employee_profiles")
      .delete()
      .eq("id", selected.id);

    alert("Deleted");
    closeModal();
    fetchEmployees();
  };

  return (
    <ManagerLayout>
      <div style={styles.wrapper}>
        <h2>Edit Employee</h2>

        <div style={styles.searchWrapper}>
          <span style={styles.searchIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            placeholder="Search employee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        <div style={styles.list}>
          {filtered.map((emp) => (
            <div key={emp.id} style={styles.card} onClick={() => openModal(emp)}>
              <div style={styles.avatar}>
                {emp.face_url ? (
                  <img src={emp.face_url} style={styles.avatarImg} />
                ) : (
                  <span style={styles.avatarText}>
                    {emp.full_name?.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              <div>
                <div style={styles.name}>{emp.full_name}</div>
                <div style={styles.position}>{emp.position || "No position"}</div>
              </div>
            </div>
          ))}
        </div>

        {selected && (
          <div style={styles.modalOverlay}>
            <div style={styles.modal}>
              <h3>Edit Employee</h3>

              <div style={styles.topSection}>
                <div style={styles.avatarBox}>
                   <p style={{ marginBottom: "8px", fontWeight: "500", visibility: "hidden" }}>
    Step
  </p>
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

  {hasFace ? (
    <button
      onClick={deleteFaces}
      style={{ ...styles.primary, marginTop: "10px" }}
    >
      Delete Registered Photo
    </button>
  ) : (
    <button
      onClick={() => {
        setShowCamera(true);
        setCapturedImages([]);
        setStep(0);
      }}
      style={{ ...styles.primary, marginTop: "10px" }}
    >
      Update Face
    </button>
  )}
</div>

                {showCamera && (
                  <div style={{ width: "220px", textAlign: "center", marginTop: "0px" }}>
                    
                    {/* ✅ STEP TEXT (LIKE REGISTER) */}
                    <p style={{ marginBottom: "8px", fontWeight: "500" }}>
                      Step {step + 1}/3: {
                        step === 0
                          ? "Look straight"
                          : step === 1
                          ? "Look LEFT"
                          : "Look RIGHT"
                      }
                    </p>

                    <Webcam
  ref={webcamRef}
  screenshotFormat="image/jpeg"
  style={{
    width: "220px",
    height: "220px",
    borderRadius: "12px",
    objectFit: "cover",
  }}
/>

                    <button onClick={captureFace} style={styles.primary}>
                      Capture
                    </button>
                  </div>
                )}
              </div>

              <div style={styles.grid}>
                <div>
                  <label style={styles.label}>Full Name</label>
                  <input name="name" value={form.name} onChange={handleChange} style={styles.input} />
                </div>

                <div>
                  <label style={styles.label}>Email</label>
                  <input value={form.email} disabled style={styles.disabledInput} />
                </div>

                <div>
                  <label style={styles.label}>Contact</label>
                  <input name="contact" value={form.contact} onChange={handleChange} style={styles.input} />
                </div>

                <div>
                  <label style={styles.label}>Position</label>
                  <input name="position" value={form.position} onChange={handleChange} style={styles.input} />
                </div>
              </div>

              <div style={styles.actions}>
                <button onClick={handleUpdate} style={styles.primary}>
                  {loading ? "Saving..." : "Save"}
                </button>

                <button onClick={handleDelete} style={styles.delete}>
                  Delete
                </button>

                <button onClick={closeModal} style={styles.cancel}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}
const styles = {
  wrapper: { padding: 20 },

  list: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginTop: "10px",
  },

  card: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    width: "100%",
    maxWidth: "500px",
    padding: "12px 16px",
    background: "#fff",
    borderRadius: "10px",
    border: "1px solid #e5e7eb",
    cursor: "pointer",
    transition: "0.2s",
  },

  avatar: {
  width: "50px",
  height: "50px",
  borderRadius: "50%",
  overflow: "hidden",
},
avatarImg: {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  borderRadius: "50%",
},

  avatarText: {
    fontWeight: "600",
    color: "#6b7280",
  },

  name: {
    fontWeight: "600",
    color: "#111827",
  },

  position: {
    fontSize: "12px",
    color: "#6b7280",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },

  modal: {
    background: "#fff",
    padding: "30px",
    borderRadius: "14px",
    width: "600px",
  },

  topSection: {
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start", // 🔥 IMPORTANT (align top)
  gap: "40px",
},

  avatarBox: {
  display: "flex",
  flexDirection: "column",
  alignItems: "center", // 🔥 CENTER CONTENT
},

  avatarInner: {
  width: "220px",
  height: "220px",
  borderRadius: "50%",
  backgroundColor: "#e5e7eb",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  margin: "0 auto",
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
  border: "1.5px solid #d1d5db",

  background: "#ffffff",   // 🔥 WHITE BACKGROUND
  color: "#111827",        // 🔥 BLACK TEXT

  boxSizing: "border-box",
  outline: "none",
},

  label: {
    fontSize: "13px",
    marginBottom: "5px",
    display: "block",
  },

  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "20px",
  },

  primary: {
    background: "#f97316",
    color: "#fff",
    padding: "10px 16px",
    borderRadius: "8px",
    border: "none",
  },

  delete: {
    background: "#ef4444",
    color: "#fff",
    padding: "10px 16px",
    borderRadius: "8px",
    border: "none",
  },

  cancel: {
  background: "#64666b",   // 🔥 LIGHT GRAY
  color: "#ffffff",
  padding: "10px 16px",
  borderRadius: "8px",
  border: "none",
  cursor: "pointer",
},

  searchWrapper: {
    display: "flex",
    alignItems: "center",
    background: "#fff",
    borderRadius: "8px",
    padding: "8px 12px",
    width: "300px",
    border: "1px solid #e5e7eb",
    marginBottom: "20px",
  },

  searchIcon: {
    marginRight: "8px",
  },

  searchInput: {
    border: "none",
    outline: "none",
    width: "100%",
    background: "transparent",
  },
  disabledInput: {
  width: "100%",
  padding: "12px",
  borderRadius: "8px",
  border: "1.5px solid #e5e7eb",

  background: "#f9fafb",   // 🔥 light gray
  color: "#6b7280",        // 🔥 muted text

  cursor: "not-allowed",
},
};