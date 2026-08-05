import { useEffect, useState } from "react";
import HRLayout from "../layouts/HRLayout";
import { supabase } from "../supabaseClient";

export default function ShiftSettings() {
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingShift, setEditingShift] = useState(null);

  const [formData, setFormData] = useState({
    shift_name: "",
    time_in: "",
    time_out: "",
    grace_minutes: 10,
  });

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    if (selectedBranch) {
      loadShifts(selectedBranch);
    } else {
      setShifts([]);
    }
  }, [selectedBranch]);

  async function loadBranches() {
    setLoading(true);

    const { data, error } = await supabase
      .from("branches")
      .select("*")
      .order("branch_name");

    if (!error) {
      setBranches(data);

      if (data.length > 0) {
        setSelectedBranch(data[0].id);
      }
    }

    setLoading(false);
  }

  async function loadShifts(branchId) {
    const { data, error } = await supabase
      .from("branch_shifts")
      .select("*")
      .eq("branch_id", branchId)
      .order("time_in");

    if (!error) {
      setShifts(data);
    }
  }

  function openAddForm() {
    setEditingShift(null);

    setFormData({
      shift_name: "",
      time_in: "",
      time_out: "",
      grace_minutes: 10,
    });

    setShowForm(true);
  }

  function openEditForm(shift) {
    setEditingShift(shift);

    setFormData({
      shift_name: shift.shift_name,
      time_in: shift.time_in,
      time_out: shift.time_out,
      grace_minutes: shift.grace_minutes,
    });

    setShowForm(true);
  }

  async function saveShift(e) {
    e.preventDefault();

    if (!selectedBranch) {
      alert("Please select a branch.");
      return;
    }

    if (
      !formData.shift_name ||
      !formData.time_in ||
      !formData.time_out
    ) {
      alert("Please complete all required fields.");
      return;
    }

    if (editingShift) {
      const { error } = await supabase
        .from("branch_shifts")
        .update({
          shift_name: formData.shift_name,
          time_in: formData.time_in,
          time_out: formData.time_out,
          grace_minutes: 10,
          updated_at: new Date(),
        })
        .eq("id", editingShift.id);

      if (error) {
        alert(error.message);
        return;
      }

      alert("Shift updated successfully.");
    } else {
      const { error } = await supabase
        .from("branch_shifts")
        .insert({
          branch_id: selectedBranch,
          shift_name: formData.shift_name,
          time_in: formData.time_in,
          time_out: formData.time_out,
          grace_minutes: 10,
          is_active: true,
        });

      if (error) {
        alert(error.message);
        return;
      }

      alert("Shift added successfully.");
    }

    setShowForm(false);
    loadShifts(selectedBranch);
  }
  async function deleteShift(id) {
  const confirmDelete = window.confirm(
    "Delete this shift?"
  );

  if (!confirmDelete) return;

  const { error } = await supabase
    .from("branch_shifts")
    .delete()
    .eq("id", id);

  if (error) {
    alert(error.message);
    return;
  }

  alert("Shift deleted successfully.");

  loadShifts(selectedBranch);
}

  return (
    <HRLayout>
      <div
        style={{
          padding: "30px",
          background: "#f8f9fa",
          minHeight: "100vh",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "25px",
          }}
        >
          <div>
  <h1 style={styles.pageTitle}>
    Shift Settings
  </h1>
</div>

          <button
            onClick={openAddForm}
            style={{
              background: "#ff7a00",
              color: "#fff",
              border: "none",
              padding: "12px 18px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            + Add Shift
          </button>
        </div>
                <div
          style={{
            background: "#fff",
            padding: "20px",
            borderRadius: "10px",
            marginBottom: "25px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
          }}
        >
          <label
            style={{
              display: "block",
              fontWeight: "bold",
              marginBottom: "10px",
            }}
          >
            Select Branch
          </label>

          <select
  value={selectedBranch}
  onChange={(e) => setSelectedBranch(e.target.value)}
  style={{
    width: "100%",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #ccc",
    backgroundColor: "#fff",
    color: "#111827",
    fontSize: "15px",
    appearance: "auto",
    WebkitAppearance: "menulist",
    MozAppearance: "menulist",
  }}
>
            {branches.map((branch) => (
              <option
  key={branch.id}
  value={branch.id}
  style={{
    backgroundColor: "#fff",
    color: "#111827",
  }}
>
  {branch.branch_name}
</option>
            ))}
          </select>
        </div>

<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(380px,1fr))",
    gap: "25px",
  }}
>
  {loading ? (
    <h3>Loading...</h3>
  ) : (
    shifts.map((shift) => (
      <div
        key={shift.id}
        style={{
          background: "#fff",
          borderRadius: "14px",
          padding: "25px",
          boxShadow: "0 3px 12px rgba(0,0,0,.08)",
        }}
      >
        <h3
          style={{
            marginTop: 0,
            marginBottom: "25px",
            color: "#222",
          }}
        >
          {shift.shift_name} Shift
        </h3>

        <div style={{ marginBottom: "18px" }}>
          <label
            style={{
              display: "block",
              fontWeight: "600",
              marginBottom: "8px",
            }}
          >
            Time In
          </label>

          <div
            style={{
              padding: "12px",
              border: "1px solid #ddd",
              borderRadius: "8px",
              background: "#fafafa",
            }}
          >
            {new Date(
              `1970-01-01T${shift.time_in}`
            ).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })}
          </div>
        </div>

        <div style={{ marginBottom: "25px" }}>
          <label
            style={{
              display: "block",
              fontWeight: "600",
              marginBottom: "8px",
            }}
          >
            Time Out
          </label>

          <div
            style={{
              padding: "12px",
              border: "1px solid #ddd",
              borderRadius: "8px",
              background: "#fafafa",
            }}
          >
            {new Date(
              `1970-01-01T${shift.time_out}`
            ).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })}
          </div>
        </div>

        <div
  style={{
    display: "flex",
    gap: "10px",
    marginTop: "20px",
  }}
>
  <button
    onClick={() => openEditForm(shift)}
    style={{
      flex: 1,
      background: "#ff7a00",
      color: "#fff",
      border: "none",
      padding: "12px",
      borderRadius: "8px",
      cursor: "pointer",
      fontWeight: "bold",
    }}
  >
    Edit
  </button>

  <button
    onClick={() => deleteShift(shift.id)}
    style={{
      flex: 1,
      background: "#d32f2f",
      color: "#fff",
      border: "none",
      padding: "12px",
      borderRadius: "8px",
      cursor: "pointer",
      fontWeight: "bold",
    }}
  >
    Delete
  </button>
</div>
      </div>
    ))
  )}
</div>

        {showForm && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,.45)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <div
              style={{
                background: "#fff",
                width: "450px",
                borderRadius: "10px",
                padding: "25px",
              }}
            >
              <h3 style={{ marginTop: 0 }}>
                {editingShift ? "Edit Shift" : "Add Shift"}
              </h3>

              <form onSubmit={saveShift}>
                <label>Shift Name</label>

                <input
                  type="text"
                  value={formData.shift_name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      shift_name: e.target.value,
                    })
                  }
                  style={inputStyle}
                />

                <label>Time In</label>

                <input
                  type="time"
                  value={formData.time_in}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      time_in: e.target.value,
                    })
                  }
                  style={inputStyle}
                />

                <label>Time Out</label>

                <input
                  type="time"
                  value={formData.time_out}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      time_out: e.target.value,
                    })
                  }
                  style={inputStyle}
                />

                                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                    marginTop: "25px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    style={{
                      background: "#777",
                      color: "#fff",
                      border: "none",
                      padding: "10px 18px",
                      borderRadius: "8px",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    style={{
                      background: "#ff7a00",
                      color: "#fff",
                      border: "none",
                      padding: "10px 18px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    {editingShift ? "Update Shift" : "Save Shift"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </HRLayout>
  );
}
const styles = {
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
const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  marginTop: "8px",
  marginBottom: "18px",
  border: "1px solid #ccc",
  borderRadius: "8px",
  fontSize: "14px",
  boxSizing: "border-box",
};