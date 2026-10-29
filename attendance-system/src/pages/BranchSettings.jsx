import { useEffect, useState } from "react";
import HRLayout from "../layouts/HRLayout";
import { supabase } from "../supabaseClient";
import { logCurrentUserAudit } from "../utils/auditlogger";

const BACKEND_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export default function BranchSettings() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [kioskFilter, setKioskFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("name");
  const [page, setPage] = useState(1);
  const pageSize = 9;
  const [showForm, setShowForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [saving, setSaving] = useState(false);
  const [kiosks, setKiosks] = useState([]);
  const [setupInfo, setSetupInfo] = useState(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [formData, setFormData] = useState({
    branch_name: "",
    branch_code: "",
    address: "",
    is_active: true,
  });

  useEffect(() => {
    loadBranches();
    loadKiosks();
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

  async function loadKiosks() {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        setKiosks([]);
        return;
      }

      const response = await fetch(BACKEND_URL + "/admin/kiosks", {
        headers: {
          Authorization: "Bearer " + accessToken,
        },
      });

      if (!response.ok) {
        setKiosks([]);
        return;
      }

      const data = await response.json();
      setKiosks(data.kiosks || []);
    } catch (error) {
      console.error("Unable to load kiosk settings:", error);
      setKiosks([]);
    }
  }

  async function generateKioskSetup(branch) {
    if (setupLoading) return;

    setSetupLoading(true);
    setSetupInfo(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error("Your HR session has expired. Please log in again.");
      }

      const response = await fetch(
        BACKEND_URL + "/admin/kiosks/" + branch.id + "/activation",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + accessToken,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || data.message || "Unable to generate kiosk setup credentials."
        );
      }

      const setupUrl =
        window.location.origin +
        "/kiosk?setup=" +
        encodeURIComponent(data.activation_token);

      setSetupInfo({
        branchName: branch.branch_name,
        kioskCode: data.kiosk_code,
        setupUrl,
        expiresAt: data.expires_at,
      });

      await loadKiosks();
    } catch (error) {
      alert(error.message || "Unable to generate kiosk setup credentials.");
    } finally {
      setSetupLoading(false);
    }
  }

  async function copySetupLink() {
    if (!setupInfo?.setupUrl) return;

    try {
      await navigator.clipboard.writeText(setupInfo.setupUrl);
      alert("Kiosk setup link copied.");
    } catch (error) {
      alert("Copy failed. Select and copy the setup link manually.");
    }
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
      await loadKiosks();
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
    await loadKiosks();
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filteredBranches = branches.filter((branch) => {
    const kiosk = kiosks.find((item) => item.branch_id === branch.id);
    const matchesSearch = [branch.branch_name, branch.branch_code, branch.address, kiosk?.kiosk_code]
      .some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "active" ? branch.is_active : !branch.is_active);
    const matchesKiosk = kioskFilter === "all" ||
      (kioskFilter === "paired" ? Boolean(kiosk?.is_paired) : !kiosk?.is_paired);
    return matchesSearch && matchesStatus && matchesKiosk;
  }).sort((a, b) => {
    if (sortOrder === "code") return (a.branch_code || "").localeCompare(b.branch_code || "");
    if (sortOrder === "status") return Number(b.is_active) - Number(a.is_active) ||
      (a.branch_name || "").localeCompare(b.branch_name || "");
    return (a.branch_name || "").localeCompare(b.branch_name || "");
  });
  const totalPages = Math.max(1, Math.ceil(filteredBranches.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleBranches = filteredBranches.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const updateFilter = (setter) => (value) => { setter(value); setPage(1); };

  return (
    <HRLayout>
      <div className="cibo-page-root cibo-hr-page cibo-hr-branch-page" style={styles.wrapper}>
        <div className="cibo-branch-page-header" style={styles.header}>
          <div>
            <h1 className="cibo-page-title" style={styles.pageTitle}>Branch Settings</h1>
            <p style={styles.subtitle}>
              Manage the branches available throughout the attendance system.
            </p>
          </div>

          <button onClick={openAddForm} style={styles.primary}>
            + Add Branch
          </button>
        </div>

        <div className="cibo-branch-toolbar">
          <label className="cibo-branch-search">
            <span>Search branches</span>
            <input type="search" value={search} onChange={(e) => updateFilter(setSearch)(e.target.value)}
              placeholder="Name, code, address or kiosk ID" aria-label="Search branches" />
          </label>
          <label><span>Status</span><select value={statusFilter} onChange={(e) => updateFilter(setStatusFilter)(e.target.value)}>
            <option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </select></label>
          <label><span>Kiosk</span><select value={kioskFilter} onChange={(e) => updateFilter(setKioskFilter)(e.target.value)}>
            <option value="all">All kiosks</option><option value="paired">Paired</option><option value="unpaired">Not paired</option>
          </select></label>
          <label><span>Sort by</span><select value={sortOrder} onChange={(e) => updateFilter(setSortOrder)(e.target.value)}>
            <option value="name">Branch name</option><option value="code">Branch code</option><option value="status">Active first</option>
          </select></label>
          <button type="button" className="cibo-branch-clear" onClick={() => {
            setSearch(""); setStatusFilter("all"); setKioskFilter("all"); setSortOrder("name"); setPage(1);
          }}>Clear filters</button>
        </div>
        <div className="cibo-branch-results" aria-live="polite">
          {loading ? "Loading..." : `Showing ${filteredBranches.length ? (currentPage - 1) * pageSize + 1 : 0}–${Math.min(currentPage * pageSize, filteredBranches.length)} of ${filteredBranches.length} matching branches (${branches.length} total)`}
        </div>
        <div className="cibo-branch-list" style={styles.list}>
          {loading ? (
            <div style={styles.empty}>Loading branches...</div>
          ) : branches.length === 0 ? (
            <div style={styles.empty}>No branches found.</div>
          ) : filteredBranches.length === 0 ? (
            <div style={styles.empty}>No branches match your filters. Try a different search or clear filters.</div>
          ) : (
            visibleBranches.map((branch) => (
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

                {(() => {
                  const kiosk = kiosks.find((item) => item.branch_id === branch.id);

                  return (
                    <div style={styles.kioskPanel}>
                      <div style={styles.kioskMeta}>
                        <span style={styles.kioskLabel}>Kiosk</span>
                        <strong>{kiosk?.kiosk_code || "Assigning..."}</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => generateKioskSetup(branch)}
                        disabled={setupLoading || !kiosk}
                        style={styles.kioskButton}
                      >
                        {setupLoading ? "Generating..." : kiosk?.is_paired ? "Re-pair Device" : "Pair Device"}
                      </button>
                    </div>
                  );
                })()}

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

        {!loading && totalPages > 1 && (
          <nav className="cibo-branch-pagination" aria-label="Branch pages">
            <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
            <span>Page {currentPage} of {totalPages}</span>
            <button type="button" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Next</button>
          </nav>
        )}
        <style>{`
          .cibo-branch-toolbar { display:grid; grid-template-columns:minmax(220px,2fr) repeat(3,minmax(130px,1fr)) auto; gap:12px; align-items:end; margin-bottom:14px; }
          .cibo-branch-toolbar label { display:flex; flex-direction:column; gap:6px; min-width:0; font-size:13px; font-weight:600; color:#334155; }
          .cibo-branch-toolbar input, .cibo-branch-toolbar select { box-sizing:border-box; width:100%; min-width:0; height:42px; border:1px solid #cbd5e1; border-radius:9px; background:#fff; color:#111827; padding:0 12px; font:inherit; }
          .cibo-branch-clear, .cibo-branch-pagination button { height:42px; padding:0 14px; background:#fff; border:1px solid #cbd5e1; border-radius:9px; color:#334155; cursor:pointer; font-weight:600; }
          .cibo-branch-results { font-size:13px; color:#64748b; margin-bottom:14px; }
          .cibo-branch-pagination { display:flex; align-items:center; justify-content:center; gap:16px; margin:24px 0; color:#334155; }
          .cibo-branch-pagination button:disabled { opacity:.45; cursor:not-allowed; }
          @media(max-width:1000px) { .cibo-branch-toolbar { grid-template-columns:repeat(2,minmax(0,1fr)); } .cibo-branch-search { grid-column:1/-1; } }
          @media(max-width:600px) {
            .cibo-hr-branch-page { padding:16px !important; }
            .cibo-branch-page-header { flex-direction:column; align-items:stretch !important; }
            .cibo-branch-page-header > button { width:100%; }
            .cibo-branch-toolbar { grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
            .cibo-branch-toolbar .cibo-branch-clear { grid-column:1/-1; }
            .cibo-branch-list { grid-template-columns:minmax(0,1fr) !important; gap:12px !important; }
            .cibo-branch-card { padding:16px !important; min-width:0; }
            .cibo-branch-card > div { min-width:0; }
            .cibo-branch-card button { white-space:normal; }
            .cibo-branch-actions { flex-wrap:wrap; }
            .cibo-branch-modal-overlay { padding:12px !important; }
            .cibo-branch-modal { max-height:90dvh; overflow-y:auto; }
          }
          @media(max-width:360px) { .cibo-branch-toolbar { grid-template-columns:minmax(0,1fr); } .cibo-branch-search,.cibo-branch-toolbar .cibo-branch-clear { grid-column:auto; } }
        `}</style>
        {setupInfo && (
          <div className="cibo-branch-modal-overlay" style={styles.overlay}>
            <div className="cibo-branch-modal" style={styles.setupModal}>
              <h2 style={styles.modalTitle}>Kiosk Device Setup</h2>
              <p style={styles.setupText}>
                {setupInfo.branchName} — {setupInfo.kioskCode}
              </p>
              <p style={styles.setupText}>
                Open this one-time link on the laptop or Raspberry Pi that will act as this branch kiosk.
              </p>
              <div style={styles.setupLinkBox}>{setupInfo.setupUrl}</div>
              <div style={styles.modalActions}>
                <button type="button" onClick={copySetupLink} style={styles.primary}>
                  Copy Setup Link
                </button>
                <button type="button" onClick={() => setSetupInfo(null)} style={styles.cancel}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
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
  kioskPanel: {
    marginTop: "16px",
    padding: "12px 14px",
    borderRadius: "10px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  kioskMeta: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    color: "#334155",
    fontSize: "13px",
  },
  kioskLabel: {
    color: "#64748b",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    fontWeight: "700",
  },
  kioskButton: {
    background: "#172033",
    color: "#fff",
    border: "none",
    padding: "9px 12px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "700",
    whiteSpace: "nowrap",
  },
  setupModal: {
    background: "#fff",
    width: "650px",
    maxWidth: "100%",
    borderRadius: "14px",
    padding: "25px",
    boxSizing: "border-box",
  },
  setupText: {
    color: "#475569",
    fontSize: "14px",
    lineHeight: "1.5",
  },
  setupLinkBox: {
    marginTop: "14px",
    padding: "14px",
    borderRadius: "9px",
    border: "1px solid #d1d5db",
    background: "#f8fafc",
    color: "#172033",
    fontSize: "13px",
    lineHeight: "1.5",
    wordBreak: "break-all",
    userSelect: "all",
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
