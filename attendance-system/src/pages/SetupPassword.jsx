import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

const API_URL = (import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "https://cibo-attendance-api.onrender.com" : "http://127.0.0.1:8000")).replace(/\\/$/, "");

export default function SetupPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && !data?.session) navigate("/", { replace: true });
    });
    return () => { active = false; };
  }, [navigate]);

  const submit = async (event) => {
    event.preventDefault();
    if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      setMessage("Use at least 12 characters, including uppercase, lowercase, a number and a symbol.");
      return;
    }
    if (password !== confirm) { setMessage("Passwords do not match."); return; }
    setSaving(true);
    setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) throw new Error("Session expired. Please log in again.");
      const response = await fetch(API_URL + "/auth/password-setup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + data.session.access_token },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Unable to update password.");
      await supabase.auth.signOut();
      navigate("/", { replace: true });
    } catch (error) {
      setMessage(error.message || "Unable to update password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f3f5f8", padding: 20 }}>
      <section style={{ background: "#fff", width: "min(440px, 100%)", borderRadius: 18, padding: 32, boxShadow: "0 10px 35px #1018281a" }}>
        <img src="/logo.png" alt="CIBO" style={{ width: 70, display: "block", margin: "0 auto 20px" }} />
        <h1 style={{ color: "#172033", fontSize: 24 }}>Set your permanent password</h1>
        <p style={{ color: "#667085" }}>Your temporary password is for account setup only. Choose a strong permanent password to continue.</p>
        <form onSubmit={submit}>
          <label htmlFor="new-password">New password</label>
          <input id="new-password" type="password" autoComplete="new-password" minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} required style={field} />
          <label htmlFor="confirm-password">Confirm password</label>
          <input id="confirm-password" type="password" autoComplete="new-password" minLength={12} value={confirm} onChange={(e) => setConfirm(e.target.value)} required style={field} />
          {message && <p role="alert" style={{ color: "#b42318" }}>{message}</p>}
          <button disabled={saving} type="submit" style={{ ...field, background: "#ea580c", color: "#fff", border: 0, fontWeight: 700, cursor: "pointer" }}>{saving ? "Saving…" : "Set permanent password"}</button>
        </form>
        <button onClick={async () => { await supabase.auth.signOut(); navigate("/", { replace: true }); }} style={{ background: "none", border: 0, color: "#ea580c", cursor: "pointer" }}>Back to login</button>
      </section>
    </main>
  );
}
const field = { display: "block", boxSizing: "border-box", width: "100%", padding: 13, margin: "8px 0 18px", borderRadius: 9, border: "1px solid #d0d5dd" };
