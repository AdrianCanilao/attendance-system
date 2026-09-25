import { useEffect, useState } from "react";
import HRLayout from "../layouts/HRLayout";
import { supabase } from "../supabaseClient";
import { logCurrentUserAudit } from "../utils/auditlogger";

export default function BranchSettings() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    branch_name: "",
    branch_code: "",
    address: "",
    is_active: true,
  });

  useEffect(() => {
    loadBranches();
  }, []);

  async function loadBranches() {
    setLoading(true);

    const { data, error } = await supabase
      .from("branches")
      .select("*")
      .order("branch_name");

    if (error) {
      alert(error.message);
      setBranches([]);
    } else {
      setBranches(data || []);
    }

    setLoading(false);
  }

  function openAddForm() {
    setEditingBranch(null);
    setFormData({
      branch_name: "",
      branch_code: "",
      address: "",
      is_active: true,
    });
    setShowForm(true);
  }

  function openEditForm(branch) {
    setEditingBranch(branch);
    setFormData({
      branch_name: branch.branch_name || "",
      branch_code: branch.branch_code || "",
      address: branch.address || "",
      is_active: branch.is_active !== false,
    });
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;
    setShowForm(false);
    setEditingBranch(null);
  }

  async function saveBranch(e) {
    e.preventDefault();

    const branchName = formData.branch_name.trim();
    const branchCode = formData.branch_code.trim().toUpperCase();
    const address = formData.address.trim();

    if (!branchName || !branchCode || !address) {
      alert("Please complete Branch Name, Branch Code, and Address.");
      return;
    }

    setSaving(true);

    try {
      if (editingBranch) {
        const { error } = await supabase
          .from("branches")
          .update({
            branch_name: branchName,
            branch_code: branchCode,
            address,
            is_active: formData.is_active,
          })
          .eq("id", editingBranch.id);

        if (error) throw error;

        await logCurrentUserAudit({
          action: "UPDATE_BRANCH",
          description: `Updated branch: ${branchName} (${branchCode})`,
          role: "hr",
        });

        alert("Branch updated successfully.");
      } else {
        const { error } = await supabase
          .from("branches")
          .insert({
            branch_name: branchName,
            branch_code: branchCode,
            address,
            is_active: true,
          });

        if (error) throw error;

        await logCurrentUserAudit({
          action: "REGISTER_BRANCH",
          description: `Registered branch: ${branchName} (${branchCode})`,
          role: "hr",
        });

        alert("Branch added successfully.");
      }

      setShowForm(false);
      setEditingBranch(null);
      await loadBranches();
    } catch (error) {
      alert(error.message || "Failed to save branch.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleBranch(branch) {
    const nextStatus = !branch.is_active;

    const { error } = await supabase
      .from("branches")
      .update({ is_active: nextStatus })
      .eq("id", branch.id);

    if (error) {
      alert(error.message);
      return;
    }

    await logCurrentUserAudit({
      action: nextStatus ? "ACTIVATE_BRANCH" : "DEACTIVATE_BRANCH",
      description: `${nextStatus ? "Activated" : "Deactivated"} branch: ${branch.branch_name} (${branch.branch_code})`,
      role: "hr",
    });

    await loadBranches();
  }

  return (
    <HRLayout>
      <div className="cibo-hr-page cibo-hr-branch-page" style={styles.wrapper}>
        <div className="cibo-branch-page-header" style={styles.header}>
          <div>
            <h1 style={styles.pageTitle}>Branch Settings</h1>
            <p style={styles.subtitle}>
              Manage the branches available throughout the attendance system.
            </p>
          </div>

          <button onClick={openAddForm} style={styles.primary}>
            + Add Branch
          </button>
        </div>

        <div className="cibo-branch-list" style={styles.list}>
          {loading ? (
            <div style={styles.empty}>Loading branches...</div>
          ) : branches.length === 0 ? (
            <div style={styles.empty}>No branches found.</div>
          ) : (
            branches.map((branch) => (
              <div key={branch.id} className="cibo-branch-card" style={styles.card}>
                <div style={styles.cardTop}>
                  <div>
                    <h3 style={styles.branchName}>{branch.branch_name}</h3>
                    <div style={styles.code}>Code: {branch.branch_code}</div>
                  </div>

                  <span
                    style={{
                      ...styles.badge,
                      background: branch.is_active ? "#dcfce7" : "#e5e7eb",
                      color: branch.is_active ? "#166534" : "#4b5563",
                    }}
                  >
                    {branch.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div style={styles.address}>
                  {branch.address || "No address provided"}
                </div>

                <div className="cibo-branch-actions" style={styles.actions}>
                  <button onClick={() => openEditForm(branch)} style={styles.primary}>
                    Edit
                  </button>

                  <button
                    onClick={() => toggleBranch(branch)}
                    style={branch.is_active ? styles.secondary : styles.primary}
                  >
                    {branch.is_active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {showForm && (
          <div className="cibo-branch-modal-overlay" style={styles.overlay}>
            <div className="cibo-branch-modal" style={styles.modal}>
              <h2 style={styles.modalTitle}>
                {editingBranch ? "Edit Branch" : "Add Branch"}
              </h2>

              <form onSubmit={saveBranch}>
                <label style={styles.label}>Branch Name</label>
                <input
                  value={formData.branch_name}
                  onChange={(e) =>
                    setFormData({ ...formData, branch_name: e.target.value })
                  }
                  placeholder="e.g. BGC Branch"
                  style={styles.input}
                />

                <label style={styles.label}>Branch Code</label>
                <input
                  value={formData.branch_code}
                  onChange={(e) =>
                    setFormData({ ...formData, branch_code: e.target.value })
                  }
                  placeholder="e.g. BGC"
                  style={styles.input}
                />

                <label style={styles.label}>Address</label>
                <input
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  placeholder="e.g. High Street"
                  style={styles.input}
                />

                {editingBranch && (
                  <label style={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          is_active: e.target.checked,
                        })
                      }
                    />
                    Active branch
                  </label>
                )}

                <div style={styles.modalActions}>
                  <button
                    type="button"
                    onClick={closeForm}
                    disabled={saving}
                    style={styles.cancel}
                  >
                    Cancel
                  </button>

                  <button type="submit" disabled={saving} style={styles.primary}>
                    {saving
                      ? "Saving..."
                      : editingBranch
                      ? "Update Branch"
                      : "Add Branch"}
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
  wrapper: {
    padding: "30px",
    background: "#f8f9fa",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    marginBottom: "25px",
  },
  pageTitle: {
    fontSize: "25px",
    fontWeight: "650",
    color: "#111827",
    margin: "0 0 6px",
    lineHeight: "1.2",
  },
  subtitle: {
    margin: 0,
    color: "#6b7280",
    fontSize: "14px",
  },
  list: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "20px",
  },
  card: {
    background: "#fff",
    borderRadius: "14px",
    padding: "22px",
    boxShadow: "0 3px 12px rgba(0,0,0,.08)",
    border: "1px solid #e5e7eb",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  },
  branchName: {
    margin: 0,
    color: "#111827",
    fontSize: "19px",
  },
  code: {
    marginTop: "6px",
    color: "#6b7280",
    fontSize: "13px",
    fontWeight: "600",
  },
  badge: {
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "600",
    whiteSpace: "nowrap",
  },
  address: {
    marginTop: "18px",
    color: "#374151",
    minHeight: "20px",
  },
  actions: {
    display: "flex",
    gap: "10px",
    marginTop: "20px",
  },
  primary: {
    background: "#ff7a00",
    color: "#fff",
    border: "none",
    padding: "11px 16px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  secondary: {
    background: "#6b7280",
    color: "#fff",
    border: "none",
    padding: "11px 16px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  empty: {
    background: "#fff",
    borderRadius: "14px",
    padding: "40px",
    textAlign: "center",
    color: "#6b7280",
    gridColumn: "1 / -1",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.45)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
    zIndex: 10000,
  },
  modal: {
    background: "#fff",
    width: "450px",
    maxWidth: "100%",
    borderRadius: "14px",
    padding: "25px",
    boxSizing: "border-box",
  },
  modalTitle: {
    margin: "0 0 20px",
    color: "#111827",
  },
  label: {
    display: "block",
    fontWeight: "600",
    fontSize: "14px",
    marginBottom: "7px",
    color: "#111827",
  },
  input: {
    width: "100%",
    padding: "12px",
    marginBottom: "17px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    boxSizing: "border-box",
    background: "#fff",
    color: "#111827",
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "20px",
    color: "#374151",
    fontSize: "14px",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "8px",
  },
  cancel: {
    background: "#6b7280",
    color: "#fff",
    border: "none",
    padding: "11px 16px",
    borderRadius: "8px",
    cursor: "pointer",
  },
};
