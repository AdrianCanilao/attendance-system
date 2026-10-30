import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

const API_URL = (import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "https://cibo-attendance-api.onrender.com" : "http://127.0.0.1:8000")).replace(new RegExp("/+$"), "");

export default function SetupPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && !data?.session) navigate("/", { replace: true });
    });
    return () => { active = false; };
  }, [navigate]);

  const submit = async (event) => {
    event.preventDefault();
    if (password.length < 8 || password.length > 64 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      setMessage("Use 8–64 characters, including uppercase, lowercase, a number and a symbol.");
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

  const requirements = [
    { label: "8–64 characters", met: password.length >= 8 && password.length <= 64 },
    { label: "Uppercase letter (A–Z)", met: /[A-Z]/.test(password) },
    { label: "Lowercase letter (a–z)", met: /[a-z]/.test(password) },
    { label: "Number (0–9)", met: /[0-9]/.test(password) },
    { label: "Special character (e.g. @, !, #)", met: /[^A-Za-z0-9]/.test(password) },
  ];

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f5f6f8", padding: "24px 14px", boxSizing: "border-box" }}>
      <section style={{ background: "#fff", width: "min(385px, 100%)", borderRadius: 22, padding: "clamp(20px, 5vw, 34px)", boxShadow: "0 14px 42px #17203318", boxSizing: "border-box" }}>
        <header style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ width: 64, height: 64, background: "#f97316", borderRadius: 14, display: "grid", placeItems: "center", margin: "0 auto 12px", color: "#fff", fontWeight: 800, letterSpacing: 1 }}>CIBO</div>
          <div style={{ color: "#ea580c", fontSize: 11, letterSpacing: 2, fontWeight: 700 }}>CIBO ATTENDANCE</div>
          <h1 style={{ color: "#172033", fontSize: 26, margin: "18px 0 8px", fontWeight: 800 }}>Set your permanent password</h1>
          <p style={{ color: "#667085", fontSize: 14, lineHeight: 1.5, margin: 0 }}>For your security, replace your temporary password before accessing your dashboard.</p>
        </header>
        <form onSubmit={submit}>
          <label htmlFor="new-password" style={label}>New password <span style={{ color: "#f97316" }}>*</span></label>
          <div style={inputWrapper}>
            <input id="new-password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={64} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Enter new password" style={input} />
            <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide new password" : "Show new password"} style={eyeButton}><EyeIcon visible={showPassword}/></button>
          </div>
          <div style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 12px", margin: "0 0 18px", fontSize: 12 }}>
            <div style={{ fontWeight: 700, color: "#344054", marginBottom: 6 }}>Password requirements</div>
            {requirements.map((req) => <div key={req.label} style={{ color: req.met ? "#15803d" : "#667085", margin: "4px 0" }}>{req.met ? "✓" : "○"} {req.label}</div>)}
          </div>
          <label htmlFor="confirm-password" style={label}>Confirm password <span style={{ color: "#f97316" }}>*</span></label>
          <div style={inputWrapper}>
            <input id="confirm-password" type={showConfirm ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={64} value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="Confirm new password" style={input} />
            <button type="button" onClick={() => setShowConfirm((v) => !v)} aria-label={showConfirm ? "Hide confirmation" : "Show confirmation"} style={eyeButton}><EyeIcon visible={showConfirm}/></button>
          </div>
          {confirm && password !== confirm && <p style={{ color: "#b42318", fontSize: 12 }}>Passwords do not match.</p>}
          {message && <p role="alert" style={{ color: "#b42318", fontSize: 13 }}>{message}</p>}
          <button disabled={saving} type="submit" style={{ width: "100%", padding: 14, borderRadius: 10, background: "linear-gradient(90deg, #ff7915, #f35a09)", color: "#fff", border: 0, fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>{saving ? "Saving…" : "Set permanent password"}</button>
        </form>
        <button type="button" onClick={async () => { await supabase.auth.signOut(); navigate("/", { replace: true }); }} style={{ display: "block", margin: "18px auto 0", background: "none", border: 0, color: "#ea580c", cursor: "pointer" }}>Back to login</button>
      </section>
    </main>
  );
}
const label = { display: "block", fontSize: 13, fontWeight: 600, color: "#344054", marginBottom: 8 };
const inputWrapper = { position: "relative", marginBottom: 16 };
const input = { display: "block", boxSizing: "border-box", width: "100%", padding: "13px 48px 13px 13px", borderRadius: 10, border: "1px solid #d0d5dd", fontSize: 14, background: "#b8c1d0", color: "#172033" };
const eyeButton = { position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "transparent", border: 0, padding: 8, color: "#667085", cursor: "pointer", display: "flex", alignItems: "center" };
function EyeIcon({ visible }) {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7z"/><circle cx="12" cy="12" r="3"/>
    {visible && <path d="M3 3l18 18" strokeWidth="2"/>}
  </svg>;
}
