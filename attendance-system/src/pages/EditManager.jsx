import { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import { getStorageAccessUrl } from "../utils/storageAccess";
import HRLayout from "../layouts/HRLayout";
import Webcam from "react-webcam";
import { logCurrentUserAudit } from "../utils/auditlogger";

const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const INSIGHTFACE_URL = (import.meta.env.VITE_INSIGHTFACE_URL || "http://127.0.0.1:8002").replace(/\/$/, "");

const isStrongPassword = (password) =>
  password.length >= 8 &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password) &&
  /\d/.test(password) &&
  /[^A-Za-z0-9]/.test(password);

export default function EditManager() {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const handleBlur = (e) => {
    setTouched((prev) => ({ ...prev, [e.target.name]: true }));
  };

  const isFieldInvalid = (name) =>
    ["name", "email", "contact", "position", "branch_id", "shift_id"].includes(name) &&
    (touched[name] || submitAttempted) &&
    !String(form[name] || "").trim();

  const getRemainingCharacters = (name, maxLength) =>
    Math.max(0, maxLength - String(form[name] || "").length);

const [branches, setBranches] = useState([]);
const [shifts, setShifts] = useState([]);
  const [hasFace, setHasFace] = useState(true);
  const [showCamera, setShowCamera] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [step, setStep] = useState(0);
  const [capturedImages, setCapturedImages] = useState([]);
  const [faceStatus, setFaceStatus] = useState({
    valid: false,
    message: "Position your face inside the camera.",
    box: null,
  });
  const webcamRef = useRef(null);

  useEffect(() => {
  fetchEmployees();
  fetchBranches();
}, []);
const fetchBranches = async () => {
  const { data } = await supabase
    .from("branches")
    .select("*")
    .order("branch_name");

  setBranches(data || []);
};

const fetchShifts = async (branchId) => {
  if (!branchId) {
    setShifts([]);
    return;
  }

  const { data } = await supabase
    .from("branch_shifts")
    .select("*")
    .eq("branch_id", branchId)
    .order("time_in");

  setShifts(data || []);
};

  const fetchEmployees = async () => {
    const MANAGER_ROLE_ID = "b381a7a0-9595-4c69-abf1-5c15a827647a";

const { data } = await supabase
  .from("employee_profiles")
  .select("*")
  .eq("role_id", MANAGER_ROLE_ID);

    const resolvedEmployees = await Promise.all(
      (data || []).map(async (emp) => ({
        ...emp,
        face_access_url: await getStorageAccessUrl("faces", emp.face_url),
      }))
    );

    setEmployees(resolvedEmployees);
  };

  const filtered = employees.filter((emp) =>
    emp.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const openModal = async (emp) => {
    setSelected(emp);
    setTouched({});
    setSubmitAttempted(false);
    setForm({
  name: emp.full_name,
  email: emp.email,
  contact: emp.contact_number,
  position: emp.position,

  branch_id: emp.branch_id || "",
  shift_id: emp.shift_id || "",
  password: "",
});

fetchShifts(emp.branch_id);
const resolvedFaceUrl = await getStorageAccessUrl("faces", emp.face_url);
setImageSrc(resolvedFaceUrl || null);
    setHasFace(!!emp.face_url);
    setCapturedImages([]);
    setStep(0);
  };

  const closeModal = () => {
    setSelected(null);
    setTouched({});
    setSubmitAttempted(false);
    setImageSrc(null);
    setShowCamera(false);
    setCapturedImages([]);
    setStep(0);
  };

  const handleChange = (e) => {
    const { name } = e.target;
    let { value } = e.target;

    if (name === "name") {
      value = value.replace(/[0-9]/g, "").slice(0, 100);
    } else if (name === "email") {
      value = value.slice(0, 254);
    } else if (name === "password") {
      value = value.slice(0, 64);
    } else if (name === "contact") {
      value = value.replace(/\D/g, "").slice(0, 11);
    } else if (name === "position") {
      value = value.slice(0, 100);
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

const handleBranchChange = async (e) => {
  const branchId = e.target.value;

  setForm((prev) => ({
    ...prev,
    branch_id: branchId,
    shift_id: "",
  }));

  await fetchShifts(branchId);
};

// ============================================================
// INSIGHTFACE ENROLLMENT VALIDATION
// ============================================================

useEffect(() => {
  let interval;

  const validateLiveFace = async () => {
    if (!showCamera || !webcamRef.current) {
      return;
    }

    const image = webcamRef.current.getScreenshot();

    if (!image) {
      return;
    }

    try {
      const blob = await fetch(image).then((r) => r.blob());

      const formData = new FormData();

      formData.append(
        "file",
        blob,
        "face.jpg"
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


      setFaceStatus({
        valid: false,
        message: "Face validation unavailable.",
        box: null,
      });
    }
  };

  if (showCamera) {

    validateLiveFace();

    interval = setInterval(
      validateLiveFace,
      700
    );
  }

  return () => {
    if (interval) {
      clearInterval(interval);
    }
  };

}, [showCamera]);

// ✅ UPDATED CAPTURE (NO ALERTS + FIXED AVATAR)
const captureFace = async () => {

  if (!faceStatus.valid) {
    return;
  }

  const image =
    webcamRef.current.getScreenshot();

  if (!image) {
    return;
  }

  const blob =
    await fetch(image).then((r) => r.blob());

  const updated = [
    ...capturedImages,
    blob
  ];

  setCapturedImages(updated);

  // Set avatar using front-facing image
  if (step === 0) {
    setImageSrc(image);
  }

  if (step < 2) {

    setStep(step + 1);

    setFaceStatus({
      valid: false,
      message:
        step === 0
          ? "Turn your face slightly LEFT."
          : "Turn your face slightly RIGHT.",
      box: null,
    });

  } else {

    setShowCamera(false);
    setStep(0);

    setFaceStatus({
      valid: false,
      message: "Face capture complete.",
      box: null,
    });
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

  // ==========================================================
  // CHECK
  // ==========================================================

  if (capturedImages.length !== 3) {
    throw new Error("Exactly 3 face images are required.");
  }

  // ==========================================================
  // DELETE OLD FACE IMAGES
  // ==========================================================

  await deleteFaces();

  // ==========================================================
  // EMPLOYEE FOLDER
  // ==========================================================

  const safeName = form.name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  const labels = [
    "front",
    "left",
    "right",
  ];

  // ==========================================================
  // UPLOAD ALL 3 IMAGES
  // ==========================================================

  for (let i = 0; i < 3; i++) {

    const filePath =
      `employees/${safeName}/${labels[i]}.jpg`;

    const { error } =
      await supabase
        .storage
        .from("faces")
        .upload(
          filePath,
          capturedImages[i],
          {
            contentType: "image/jpeg",
            upsert: true,
          }
        );

    if (error) {
      throw new Error(
        `Failed to upload ${labels[i]} face: ${error.message}`
      );
    }
  }

  // ==========================================================
  // UPDATE PROFILE FACE URL
  // ==========================================================

  const facePath = `employees/${safeName}/front.jpg`;

  const { error: profileError } =
    await supabase
      .from("employee_profiles")
      .update({
        face_url: facePath,
      })
      .eq("id", selected.id);

  if (profileError) {
    throw new Error(
      `Failed to update employee face URL: ${profileError.message}`
    );
  }

  // ==========================================================
  // RELOAD INSIGHTFACE TEMPLATES
  // ==========================================================


  const reloadResponse =
    await fetch(
      INSIGHTFACE_URL + "/reload-templates?employee_id=" + encodeURIComponent(selected.id),
      {
        method: "POST",
      }
    );

  if (!reloadResponse.ok) {
    throw new Error(
      "InsightFace template reload failed."
    );
  }

  const reloadData =
    await reloadResponse.json();


  if (reloadData.status !== "OK") {
    throw new Error(
      "InsightFace templates could not be reloaded."
    );
  }

};

  // Freeze historical attendance against the shift that applied before an MS transfer/shift change.
  // Existing rows with a saved schedule are never recalculated.
  const snapshotHistoricalAttendance = async (employeeId, clockIn, clockOut, graceMinutes = 10) => {
    if (!employeeId || !clockIn || !clockOut) return;

    const { data: logs, error } = await supabase
      .from("attendance_logs")
      .select("id, log_date, time_in, time_out, scheduled_time_in, scheduled_time_out, late_minutes, overtime_minutes")
      .eq("employee_id", employeeId);

    if (error) throw new Error("Unable to read attendance history before the transfer.");

    const [inHour, inMinute] = String(clockIn).slice(0, 5).split(":").map(Number);
    const [outHour, outMinute] = String(clockOut).slice(0, 5).split(":").map(Number);
    const overnight = outHour * 60 + outMinute <= inHour * 60 + inMinute;

    for (const log of logs || []) {
      if (log.scheduled_time_in || log.scheduled_time_out) continue;

      const updates = {
        scheduled_time_in: clockIn,
        scheduled_time_out: clockOut,
      };

      if (log.time_in) {
        const scheduledIn = new Date(String(log.log_date) + "T" + String(clockIn).slice(0, 8) + "+08:00");
        const graceLimit = new Date(scheduledIn.getTime() + Number(graceMinutes || 0) * 60000);
        updates.late_minutes = Math.max(0, Math.floor((new Date(log.time_in) - graceLimit) / 60000));
      } else {
        updates.late_minutes = Number(log.late_minutes || 0);
      }

      if (log.time_out) {
        const scheduledOut = new Date(String(log.log_date) + "T00:00:00+08:00");
        if (overnight) scheduledOut.setDate(scheduledOut.getDate() + 1);
        scheduledOut.setHours(outHour, outMinute, 0, 0);
        updates.overtime_minutes = Math.max(0, Math.floor((new Date(log.time_out) - scheduledOut) / 60000));
      } else {
        updates.overtime_minutes = Number(log.overtime_minutes || 0);
      }

      const { error: updateError } = await supabase
        .from("attendance_logs")
        .update(updates)
        .eq("id", log.id);

      if (updateError) throw new Error("Unable to preserve one or more historical attendance records.");
    }
  };

  const handleUpdate = async () => {
  setSubmitAttempted(true);

  const requiredFields = ["name", "email", "contact", "position", "branch_id", "shift_id"];
  const missingFields = requiredFields.filter((field) => !String(form[field] || "").trim());

  if (missingFields.length) {
    setTouched((prev) => ({
      ...prev,
      ...Object.fromEntries(missingFields.map((field) => [field, true])),
    }));
    alert("Please fill all required fields.");
    return;
  }

  if (form.name && /[0-9]/.test(form.name)) {
    alert("Full name must not contain numbers.");
    return;
  }

  if (form.contact && !/^\d{1,11}$/.test(form.contact)) {
    alert("Contact number must contain digits only and be at most 11 digits.");
    return;
  }

  if (form.position && form.position.length > 100) {
    alert("Position must be 100 characters or fewer.");
    return;
  }

  if (form.email && form.email.length > 254) {
    alert("Email must be 254 characters or fewer.");
    return;
  }

  if (form.password && form.password.length > 64) {
    alert("Password must be 64 characters or fewer.");
    return;
  }

  if (form.password && !isStrongPassword(form.password)) {
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

    const branchChanged =
      selected?.branch_id !== (form.branch_id || null);

    if (branchChanged) {
      const previousBranch = branches.find((branch) => branch.id === selected?.branch_id);
      const newBranch = branches.find((branch) => branch.id === form.branch_id);

      const confirmed = confirm(
        `Transfer ${form.name} from ${previousBranch?.branch_name || "Unassigned"} to ${newBranch?.branch_name || "Unassigned"}?\n\nTheir existing account, attendance history, leave records, and face registration will remain with the same employee profile.`
      );

      if (!confirmed) {
        return;
      }
    }

    try {
      setLoading(true);

      if (form.password) {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;

        if (!accessToken) {
          throw new Error("Your session has expired. Please log in again.");
        }

        const passwordResponse = await fetch(API_URL + "/admin/update-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + accessToken,
          },
          body: JSON.stringify({
            target_user_id: selected.id,
            password: form.password,
          }),
        });

        const passwordData = await passwordResponse.json();

        if (!passwordResponse.ok) {
          throw new Error(passwordData.detail || "Unable to update password.");
        }
      }

      // Freeze the previous schedule into historical attendance rows before
      // changing the MS profile. This prevents old late/overtime values from
      // being recalculated using the new branch/shift.
      const shiftChanged = selected?.shift_id !== (form.shift_id || null);
      const branchChangedForSchedule = selected?.branch_id !== (form.branch_id || null);

      if (shiftChanged || branchChangedForSchedule) {
        await snapshotHistoricalAttendance(
          selected.id,
          selected.clock_in,
          selected.clock_out,
          selected.grace_minutes
        );
      }

      // Keep the denormalized schedule fields on employee_profiles in sync
      // with the newly selected branch shift.
      let selectedShift = null;

      if (form.shift_id) {
        const { data: shiftData, error: shiftError } = await supabase
          .from("branch_shifts")
          .select("id, branch_id, time_in, time_out, grace_minutes")
          .eq("id", form.shift_id)
          .eq("branch_id", form.branch_id)
          .single();

        if (shiftError || !shiftData) {
          throw new Error("The selected shift could not be found for the selected branch.");
        }

        selectedShift = shiftData;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error("Your session has expired. Please log in again.");
      }

      const profileResponse = await fetch(
        API_URL + "/admin/update-manager-profile",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + accessToken,
          },
          body: JSON.stringify({
            target_user_id: selected.id,
            name: form.name,
            contact: form.contact,
            position: form.position,
            branch_id: form.branch_id || null,
            shift_id: form.shift_id || null,
          }),
        }
      );

      let profileData = {};
      try {
        profileData = await profileResponse.json();
      } catch {
        profileData = {};
      }

      if (!profileResponse.ok) {
        throw new Error(
          profileData.detail ||
          profileData.message ||
          "Unable to update Branch Supervisor profile."
        );
      }

      const previousBranch = branches.find((branch) => branch.id === selected.branch_id);
      const newBranch = branches.find((branch) => branch.id === form.branch_id);

      if (selected.branch_id !== (form.branch_id || null)) {
        const auditResult = await logCurrentUserAudit({
          action: "TRANSFER_MAINTENANCE_SPECIALIST",
          description:
            `Transferred maintenance specialist: ${form.name} | Previous Branch: ${previousBranch?.branch_name || "Unassigned"} | New Branch: ${newBranch?.branch_name || "Unassigned"}`,
        });

        if (auditResult?.error) {
          
        }
      }

      if (capturedImages.length === 3) {
        await uploadFaces();
      }

      await logCurrentUserAudit({
        action: "UPDATE_MAINTENANCE_SPECIALIST",
        description: `Updated maintenance specialist: ${form.name}`,
      });

      alert("✅ Updated!");
      closeModal();
      fetchEmployees();
    } catch (error) {
      console.error("Branch Supervisor update failed:", error);
      alert(
        "Update failed:\n\n" +
        (error?.message || "Unknown error. Check the browser console for details.")
      );
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

    await logCurrentUserAudit({
      action: "DELETE_MAINTENANCE_SPECIALIST",
      description: `Deleted maintenance specialist: ${selected.full_name}`,
    });

    alert("Deleted");
    closeModal();
    fetchEmployees();
  };

  return (
    <HRLayout>
      <div className="cibo-hr-page cibo-hr-edit-page" style={styles.wrapper}>
        <h1 style={styles.pageTitle}>Edit Manager</h1>

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
                {emp.face_access_url ? (
                  <img src={emp.face_access_url} style={styles.avatarImg} />
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
          <div className="cibo-hr-edit-modal-overlay" style={styles.modalOverlay}>
            <div className="cibo-hr-edit-modal" style={styles.modal}>
              <h3>Edit Manager</h3>

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
              <button
                onClick={() => {
                  setShowCamera(true);
                  setCapturedImages([]);
                  setStep(0);

                  setFaceStatus({
                    valid: false,
                    message: "Position your face inside the camera.",
                    box: null,
                  });
                }}
                style={{ ...styles.primary, marginTop: "10px" }}
              >
                Update Face
              </button>
            </div>

                  {showCamera && (
                    <div style={{ width: "280px", textAlign: "center", marginTop: "0px" }}>
                    
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

                    <div
                      style={{
                        position: "relative",
                        width: "280px",
                        height: "210px",
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
                          width: "280px",
                          height: "210px",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />

                      {faceStatus.box && (
                        <div
                          style={{
                            position: "absolute",

                            left: `${(faceStatus.box.x / 320) * 100}%`,
                            top: `${(faceStatus.box.y / 240) * 100}%`,
                            width: `${(faceStatus.box.w / 320) * 100}%`,
                            height: `${(faceStatus.box.h / 240) * 100}%`,

                            border: faceStatus.valid
                              ? "3px solid #22c55e"
                              : "3px solid #ef4444",

                            borderRadius: "12px",
                            boxSizing: "border-box",
                            pointerEvents: "none",
                            transition: "all 0.2s ease",
                          }}
                        />
                      )}
                    </div>

                    <p
                      style={{
                        marginTop: "8px",
                        marginBottom: "8px",
                        fontSize: "13px",
                        color: faceStatus.valid
                          ? "#16a34a"
                          : "#dc2626",
                        fontWeight: "500",
                      }}
                    >
                      {faceStatus.message}
                    </p>

                    <button
                      onClick={captureFace}
                      disabled={!faceStatus.valid}
                      style={{
                        ...styles.primary,
                        opacity: faceStatus.valid ? 1 : 0.5,
                        cursor: faceStatus.valid
                          ? "pointer"
                          : "not-allowed",
                      }}
                    >
                      Capture
                    </button>
                  </div>
                )}
              </div>

              <div className="cibo-hr-form-grid" style={styles.grid}>
                <div>
                  <div style={styles.fieldHeader}>
                    <label style={styles.label}>Full Name <span style={styles.required}>*</span></label>
                    <span style={styles.counter}>Max 100 • {getRemainingCharacters("name", 100)} remaining</span>
                  </div>
                  <input
                    name="name"
                    value={form.name || ""}
                    onChange={handleChange}
                    onBlur={handleBlur}
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
                    value={form.email || ""}
                    disabled
                    maxLength={254}
                    aria-required="true"
                    aria-invalid={isFieldInvalid("email")}
                    style={{ ...styles.disabledInput, ...(isFieldInvalid("email") ? styles.inputError : {}) }}
                  />
                </div>

                <div>
                  <div style={styles.fieldHeader}>
                    <label style={styles.label}>Contact <span style={styles.required}>*</span></label>
                    <span style={styles.counter}>Max 11 • {getRemainingCharacters("contact", 11)} remaining</span>
                  </div>
                  <input
                    name="contact"
                    value={form.contact || ""}
                    onChange={handleChange}
                    onBlur={handleBlur}
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
                    value={form.position || ""}
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
                    <label style={styles.label}>Password (optional)</label>
                    <span style={styles.counter}>Max 64 • {getRemainingCharacters("password", 64)} remaining</span>
                  </div>
                  <input
                    name="password"
                    type="password"
                    value={form.password || ""}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Enter new password"
                    maxLength={64}
                    style={styles.input}
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <div style={styles.fieldHeader}>
                    <label style={styles.label}>Branch <span style={styles.required}>*</span></label>
                  </div>
                  <select
                    name="branch_id"
                    value={form.branch_id || ""}
                    onChange={handleBranchChange}
                    onBlur={handleBlur}
                    style={{ ...styles.input, ...(isFieldInvalid("branch_id") ? styles.inputError : {}) }}
                    required
                    aria-required="true"
                    aria-invalid={isFieldInvalid("branch_id")}
                  >
                    <option value="">Select Branch</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.branch_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={styles.fieldHeader}>
                    <label style={styles.label}>Shift <span style={styles.required}>*</span></label>
                  </div>
                  <select
                    name="shift_id"
                    value={form.shift_id || ""}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    style={{ ...styles.input, ...(isFieldInvalid("shift_id") ? styles.inputError : {}) }}
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
                        })} -{" "}
                        {new Date(`1970-01-01T${shift.time_out}`).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })})
                      </option>
                    ))}
                  </select>
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
    </HRLayout>
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

  fieldHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    minHeight: "18px",
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

  inputError: {
    border: "1px solid #dc2626",
    boxShadow: "0 0 0 1px rgba(220,38,38,.08)",
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
  pageTitle: {
    fontSize: "25px",
    fontWeight: "650",
    color: "#111827",
    margin: "0 20px 0",
    padding: 0,
    letterSpacing: "-0.3px",
    lineHeight: "1.2",
  },
};