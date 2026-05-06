import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import EmployeeLayout from "../layouts/EmployeeLayout";

export default function LeaveRequest() {
  const [showModal, setShowModal] = useState(false);
  const [attachment, setAttachment] = useState(null);

  const [selectedLeave, setSelectedLeave] = useState("");

  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");

  const [credits, setCredits] = useState({
    sick_leave: 5,
    vacation_leave: 5,
    emergency_leave: 5,
    service_incentive_leave: 5,
    birthday_leave: 1,
    official_business: "-",
  });

  useEffect(() => {
    fetchCredits();
  }, []);

  const fetchCredits = async () => {
    const { data: userData } = await supabase.auth.getUser();

    const user = userData?.user;

    if (!user) return;

    const { data: profile } = await supabase
      .from("employee_profiles")
      .select("id")
      .eq("email", user.email)
      .single();

    if (!profile) return;

    const { data } = await supabase
      .from("leave_credits")
      .select("*")
      .eq("employee_id", profile.id)
      .single();

    if (data) {
      setCredits(data);
    }
  };

  const leaveCards = [
  {
    title: "Sick Leave",
    type: "Sick Leave",
    key: "sick_leave",
    color: "#f97316",
  },
  {
    title: "Vacation Leave",
    type: "Vacation Leave",
    key: "vacation_leave",
    color: "#f97316",
  },
  {
    title: "Emergency Leave",
    type: "Emergency Leave",
    key: "emergency_leave",
    color: "#f97316",
  },
  {
    title: "Service Incentive Leave",
    type: "Service Incentive Leave",
    key: "service_incentive_leave",
    color: "#f97316",
  },
  {
    title: "Birthday Leave",
    type: "Birthday Leave",
    key: "birthday_leave",
    color: "#f97316",
  },
  {
    title: "Official Business",
    type: "Official Business",
    key: "official_business",
    color: "#f97316",
  },
];
const openModal = (leaveType) => {
  setSelectedLeave(leaveType);
  setShowModal(true);
};

  const submitLeave = async (e) => {
    e.preventDefault();

    const { data: userData } = await supabase.auth.getUser();

    const user = userData?.user;

    if (!user) {
      alert("Not logged in");
      return;
    }

    try {
      const { data: profile } = await supabase
        .from("employee_profiles")
        .select("id")
        .eq("email", user.email)
        .single();

      if (!profile) {
        alert("Employee profile not found");
        return;
      }

      const { error } = await supabase
        .from("leave_requests")
        .insert([
          {
            employee_id: profile.id,
            leave_type: selectedLeave,
            start_date: start,
            end_date: end,
            reason,
            status: "Pending",
          },
        ]);

      if (error) {
        console.log(error);
        alert("Failed to submit leave");
        return;
      }

      // 🔥 LOCAL DEDUCTION
      const selectedCard = leaveCards.find(
        (card) => card.title === selectedLeave
      );

      if (selectedCard) {
        setCredits((prev) => ({
          ...prev,
          [selectedCard.key]: Math.max(prev[selectedCard.key] - 1, 0),
        }));
      }

      alert("Leave request submitted!");

      setShowModal(false);

      setStart("");
      setEnd("");
      setReason("");

    } catch (err) {
      console.log(err);
      alert("Something went wrong");
    }
  };

  return (
    <EmployeeLayout>
      <div style={styles.page}>
        <h1 style={styles.pageTitle}>Leave Request</h1>

        <div style={styles.grid}>
          {leaveCards.map((leave) => (
            <div
              key={leave.key}
              style={{
                ...styles.card,
                borderTop: `6px solid ${leave.color}`,
              }}
              onClick={() => openModal(leave.title)}
            >
              <div style={styles.cardTitle}>
                {leave.title}
              </div>

              <div
                style={{
                  ...styles.circle,
                  border: `4px solid ${leave.color}`,
                  color: "#f97316",
                }}
              >
                {credits[leave.key]}
              </div>

              <div style={styles.remainingText}>
                Remaining Credits
              </div>
            </div>
          ))}
        </div>

        {/* MODAL */}
        {showModal && (
          <div style={styles.overlay}>
            <div style={styles.modal}>
              <div style={styles.modalHeader}>
                <h2 style={styles.modalTitle}>
                  {selectedLeave}
                </h2>

                <button
                  style={styles.closeButton}
                  onClick={() => setShowModal(false)}
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={submitLeave}
                style={styles.form}
              >
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Start Date
                  </label>

                  <input
                    type="date"
                    value={start}
                    onChange={(e) =>
                      setStart(e.target.value)
                    }
                    style={styles.input}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    End Date
                  </label>

                  <input
                    type="date"
                    value={end}
                    onChange={(e) =>
                      setEnd(e.target.value)
                    }
                    style={styles.input}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Reason
                  </label>

                  <textarea
                    value={reason}
                    onChange={(e) =>
                      setReason(e.target.value)
                    }
                    placeholder="Enter reason..."
                    rows={5}
                    style={styles.textarea}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
  <label style={styles.label}>Attachment</label>

  {/* 🔥 FILE INPUT CUSTOM STYLE */}
  <style>
    {`
      input[type="file"]::file-selector-button {
        background: #ffffff;
        color: #111827;
        border: 1px solid #d1d5db;
        padding: 8px 14px;
        border-radius: 8px;
        cursor: pointer;
        margin-right: 12px;
        font-weight: 500;
      }

      input[type="file"]::file-selector-button:hover {
        background: #f9fafb;
      }
    `}
  </style>

  <input
    type="file"
    accept="image/*,.pdf,.doc,.docx"
    onChange={(e) => setAttachment(e.target.files[0])}
    style={styles.fileInput}
  />
</div>

                <button
                  type="submit"
                  style={styles.submitButton}
                >
                  Submit Request
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </EmployeeLayout>
  );
}

const styles = {
  page: {
    padding: "0px 10px",
  },

  pageTitle: {
    fontSize: "25px",
    fontWeight: "650",
    marginBottom: "20px",
    color: "#111827",
  },

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "20px",
  },

  card: {
    background: "#fff",
    borderRadius: "16px",
    padding: "20px",
    cursor: "pointer",
    border: "2px solid #d1d5db",
    transition: "0.25s",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  },

  cardTitle: {
    fontSize: "15px",
    fontWeight: "600",
    color: "#374151",
    minHeight: "40px",
  },

  circle: {
    width: "110px",
    height: "110px",
    borderRadius: "50%",
    margin: "20px auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "42px",
    fontWeight: "700",
    background: "#fff",
    color: "#f97316",
  },

  remainingText: {
    textAlign: "center",
    fontSize: "14px",
    color: "#6b7280",
  },

  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },

  modal: {
    width: "500px",
    background: "#fff",
    borderRadius: "20px",
    padding: "25px",
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },

  modalTitle: {
    margin: 0,
    fontSize: "24px",
    color: "#111827",
  },

  closeButton: {
  border: "none",
  background: "transparent",
  fontSize: "28px",
  cursor: "pointer",
  color: "#000000", // 🔥 black X
  fontWeight: "600",
},

  form: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },

  formGroup: {
    display: "flex",
    flexDirection: "column",
  },

  label: {
    marginBottom: "8px",
    fontWeight: "600",
    color: "#374151",
  },

  input: {
  padding: "14px",
  borderRadius: "10px",
  border: "1px solid #d1d5db",
  fontSize: "14px",

  background: "#ffffff", // 🔥 white
  color: "#111827",      // 🔥 black text
},

  textarea: {
  padding: "14px",
  borderRadius: "10px",
  border: "1px solid #d1d5db",
  resize: "none",
  fontSize: "14px",

  background: "#ffffff", // 🔥 white
  color: "#111827",      // 🔥 black text
},

  submitButton: {
    marginTop: "10px",
    padding: "14px",
    border: "none",
    borderRadius: "10px",
    background: "#f97316",
    color: "#fff",
    fontWeight: "600",
    fontSize: "15px",
    cursor: "pointer",
  },
  fileInput: {
  width: "100%",
  padding: "12px 16px",
  background: "#ffffff",
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  fontSize: "14px",
  color: "#111827",
  cursor: "pointer",
  boxSizing: "border-box",
},
};