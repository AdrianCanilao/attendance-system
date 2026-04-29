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

  const [showCamera, setShowCamera] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
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
  };

  const closeModal = () => {
    setSelected(null);
    setImageSrc(null);
    setShowCamera(false);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const captureFace = () => {
    const image = webcamRef.current.getScreenshot();
    setImageSrc(image);
    setShowCamera(false);
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
          email: form.email,
          contact_number: form.contact,
          position: form.position,
        })
        .eq("id", selected.id);

          // 🔥 update face if changed
    if (imageSrc && imageSrc.startsWith("data:image")) {
      const blob = await fetch(imageSrc).then((r) => r.blob());

      const fileName = `employees/${selected.id}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("faces")
        .upload(fileName, blob, { upsert: true });

      if (uploadError) {
        console.error(uploadError);
        alert("Failed to upload image");
        return;
      }

      const { data } = supabase.storage
        .from("faces")
        .getPublicUrl(fileName);

      const publicUrl = data.publicUrl;

      await supabase
        .from("employee_profiles")
        .update({ face_url: publicUrl })
        .eq("id", selected.id);
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

        {/* SEARCH */}
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

        {/* LIST */}
        <div style={styles.list}>
          {filtered.map((emp) => (
            <div
              key={emp.id}
              style={styles.card}
              onClick={() => openModal(emp)}
              onMouseEnter={(e) => {
                e.currentTarget.style.border = "1px solid #f97316";
                e.currentTarget.style.background = "#fff7ed";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.border = "1px solid #e5e7eb";
                e.currentTarget.style.background = "#fff";
              }}
            >
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

        {/* MODAL */}
        {selected && (
          <div style={styles.modalOverlay}>
            <div style={styles.modal}>
              <h3>Edit Employee</h3>

              <div style={styles.topSection}>
                <div style={styles.avatarBox}>
                  <div style={styles.avatarInner}>
                    {imageSrc ? (
                      <img src={imageSrc} style={styles.avatarImg} />
                    ) : (
                      <span>👤</span>
                    )}
                  </div>

                  <button onClick={() => setShowCamera(true)} style={styles.primary}>
                    Update Face
                  </button>
                </div>

                {showCamera && (
                  <div style={{ width: "220px" }}>
                    <Webcam ref={webcamRef} screenshotFormat="image/jpeg" style={{ width: "100%" }} />
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
                  <input name="email" value={form.email} onChange={handleChange} style={styles.input} />
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
    width: "42px",
    height: "42px",
    borderRadius: "50%",
    background: "#e5e7eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  avatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
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
    gap: "20px",
    marginBottom: "20px",
  },

  avatarBox: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  avatarInner: {
    width: "100px",
    height: "100px",
    borderRadius: "50%",
    overflow: "hidden",
    background: "#eee",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
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
};