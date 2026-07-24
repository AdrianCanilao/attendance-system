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
          grace_minutes: formData.grace_minutes,
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
          grace_minutes: formData.grace_minutes,
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

  async function deactivateShift(id) {
    const confirmDelete = window.confirm(
      "Deactivate this shift?"
    );

    if (!confirmDelete) return;

    const { error } = await supabase
      .from("branch_shifts")
      .update({
        is_active: false,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

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
            <h2 style={{ margin: 0 }}>
              Shift Settings
            </h2>

            <p
              style={{
                color: "#666",
                marginTop: "8px",
              }}
            >
              Configure shifts for every branch.
            </p>
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
            }}
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.branch_name}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: "10px",
            overflow: "hidden",
            boxShadow: "0 2px 10px rgba(0,0,0,.08)",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            <thead
              style={{
                background: "#ff7a00",
                color: "#fff",
              }}
            >
              <tr>
                <th style={{ padding: "14px" }}>Shift</th>
                <th>Time In</th>
                <th>Time Out</th>
                <th>Grace (mins)</th>
                <th>Status</th>
                <th width="220">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="6"
                    style={{
                      textAlign: "center",
                      padding: "30px",
                    }}
                  >
                    Loading...
                  </td>
                </tr>
              ) : shifts.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    style={{
                      textAlign: "center",
                      padding: "30px",
                    }}
                  >
                    No shifts found.
                  </td>
                </tr>
              ) : (
                shifts.map((shift) => (
                  <tr
                    key={shift.id}
                    style={{
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    <td style={{ padding: "14px" }}>
                      {shift.shift_name}
                    </td>

                    <td>{shift.time_in}</td>

                    <td>{shift.time_out}</td>

                    <td>{shift.grace_minutes}</td>

                    <td>
                      <span
                        style={{
                          background: shift.is_active
                            ? "#4CAF50"
                            : "#999",
                          color: "#fff",
                          padding: "5px 10px",
                          borderRadius: "20px",
                          fontSize: "13px",
                        }}
                      >
                        {shift.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td>
                      <button
                        onClick={() => openEditForm(shift)}
                        style={{
                          background: "#1976D2",
                          color: "#fff",
                          border: "none",
                          padding: "8px 14px",
                          borderRadius: "6px",
                          marginRight: "8px",
                          cursor: "pointer",
                        }}
                      >
                        Edit
                      </button>

                      {shift.is_active && (
                        <button
                          onClick={() =>
                            deactivateShift(shift.id)
                          }
                          style={{
                            background: "#d32f2f",
                            color: "#fff",
                            border: "none",
                            padding: "8px 14px",
                            borderRadius: "6px",
                            cursor: "pointer",
                          }}
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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

                <label>Grace Minutes</label>

                <input
                  type="number"
                  value={formData.grace_minutes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      grace_minutes: Number(e.target.value),
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