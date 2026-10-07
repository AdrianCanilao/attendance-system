import { useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { logAudit } from "../utils/auditlogger";
import { isValidEmail } from "../utils/emailValidation";

function EyeIcon({ hidden = false }) {
  return hidden ? (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.1A10.9 10.9 0 0 1 12 4.9c5 0 8.7 3.7 10 7.1a11.8 11.8 0 0 1-3.1 4.5" /><path d="M6.2 6.2C4.4 7.5 3.2 9.4 2 12c1.3 3.4 5 7.1 10 7.1 1 0 2-.1 2.9-.4" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.7" />
    </svg>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem("cibo_remember_me") === "true");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

  const getDeviceId = () => {
    let id = localStorage.getItem("cibo_device_id");
    if (!id) {
      id = window.crypto?.randomUUID?.() || ("cibo-" + Date.now() + "-" + Math.random().toString(36).slice(2));
      localStorage.setItem("cibo_device_id", id);
    }
    return id;
  };

  const getDeviceName = () => {
    const platform = navigator.userAgentData?.platform || navigator.platform || "Unknown device";
    return `${platform} Browser`;
  };

  const handleRememberChange = (checked) => {
    setRememberMe(checked);
    if (checked) {
      localStorage.setItem("cibo_remember_me", "true");
    } else {
      localStorage.removeItem("cibo_remember_me");
      localStorage.removeItem("sb-gncvkqqmreufoarakjmj-auth-token");
      sessionStorage.removeItem("sb-gncvkqqmreufoarakjmj-auth-token");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password) {
      alert("Please enter your email and password.");
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      alert("Please enter a valid email address.");
      return;
    }

    // Set the persistence choice before Supabase creates the session.
    if (rememberMe) {
      localStorage.setItem("cibo_remember_me", "true");
      sessionStorage.removeItem("sb-gncvkqqmreufoarakjmj-auth-token");
    } else {
      localStorage.removeItem("cibo_remember_me");
      localStorage.removeItem("sb-gncvkqqmreufoarakjmj-auth-token");
      sessionStorage.removeItem("sb-gncvkqqmreufoarakjmj-auth-token");
      localStorage.removeItem("role");
      sessionStorage.removeItem("role");
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error || !data?.user) {
        await logAudit({
          user_id: null,
          user_name: normalizedEmail,
          role: "unknown",
          action: "LOGIN_FAILED",
          description: `Failed login attempt for ${normalizedEmail}`,
        });
        alert("Invalid email or password.");
        return;
      }

      const deviceResponse = await fetch(API_URL + "/auth/device-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + data.session.access_token,
        },
        body: JSON.stringify({
          device_id: getDeviceId(),
          device_name: getDeviceName(),
          device_type: "web",
        }),
      });

      let deviceData = {};
      try { deviceData = await deviceResponse.json(); } catch { deviceData = {}; }

      if (!deviceResponse.ok) {
        await supabase.auth.signOut();
        localStorage.removeItem("role");
        sessionStorage.removeItem("role");
        alert(deviceData.detail || "This device is not authorized to use CIBO.");
        return;
      }

      const user = data.user;
      const { data: profile, error: profileError } = await supabase
        .from("employee_profiles")
        .select("id, role_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        await logAudit({
          user_id: user.id,
          user_name: user.email,
          role: "unknown",
          action: "LOGIN_PROFILE_FAILED",
          description: `Login succeeded but employee profile was not found for ${user.email}`,
        });
        alert("Profile not found. Contact admin.");
        return;
      }

      const { data: roleData, error: roleError } = await supabase
        .from("roles")
        .select("name")
        .eq("id", profile.role_id)
        .single();

      if (roleError || !roleData) {
        await logAudit({
          user_id: user.id,
          user_name: user.email,
          role: "unknown",
          action: "LOGIN_ROLE_FAILED",
          description: `Login succeeded but role could not be resolved for ${user.email}`,
        });
        alert("Role not found.");
        return;
      }

      const role = roleData.name.trim().toLowerCase();

      await logAudit({
        user_id: user.id,
        user_name: user.email,
        role,
        action: "LOGIN",
        description: `${user.email} logged into the system`,
      });

      // Store the UI role in the same persistence scope as the auth session.
      if (rememberMe) {
        localStorage.setItem("role", role);
        sessionStorage.removeItem("role");
      } else {
        sessionStorage.setItem("role", role);
        localStorage.removeItem("role");
      }

      setTimeout(() => {
        if (role === "maintenance") navigate("/manager/profile");
        else if (role === "hr") navigate("/hr/profile");
        else if (role === "employee") navigate("/employee/profile");
        else alert("Unknown role detected.");
      }, 150);
    } catch {
      alert("Unable to sign in right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cibo-login" style={styles.container}>
      <div style={styles.overlay} />
      <main className="cibo-login-card" style={styles.card}>
        <div style={styles.brandArea}>
          <img src="/logo.png" alt="CIBO" style={styles.logo} />
          <div style={styles.brandAccent}>CIBO ATTENDANCE</div>
        </div>

        <div style={styles.headingArea}>
          <h1 style={styles.title}>Welcome back</h1>
          <p style={styles.subtitle}>Sign in to access your attendance portal</p>
        </div>

        <form onSubmit={handleLogin} noValidate>
          <div style={styles.group}>
            <label htmlFor="login-email" style={styles.label}>
              Email <span style={styles.required}>*</span>
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              inputMode="email"
              maxLength={254}
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              disabled={loading}
            />
          </div>

          <div style={{ ...styles.group, marginBottom: "10px" }}>
            <label htmlFor="login-password" style={styles.label}>
              Password <span style={styles.required}>*</span>
            </label>
            <div style={styles.passwordWrapper}>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                minLength={8}
                maxLength={64}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...styles.input, paddingRight: "50px" }}
                disabled={loading}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((value) => !value)}
                style={styles.eyeButton}
              >
                <EyeIcon hidden={showPassword} />
              </button>
            </div>
          </div>

          <div style={styles.forgotRow}>
            <label style={styles.rememberLabel}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => handleRememberChange(e.target.checked)}
                disabled={loading}
                style={{
                  ...styles.rememberCheckbox,
                  backgroundColor: rememberMe ? "#f97316" : "#ffffff",
                  backgroundImage: rememberMe
                    ? "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.2 8.3 6.5 11.5 12.8 4.8' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")"
                    : "none",
                }}
              />
              <span>Remember me</span>
            </label>

            <button
              type="button"
              onClick={() => navigate("/forgot-password")}
              style={styles.forgotButton}
              disabled={loading}
            >
              Forgot password?
            </button>
          </div>

          <button type="submit" style={styles.button} disabled={loading}>
            <span>{loading ? "Signing in..." : "Sign in"}</span>
            {!loading && <span style={styles.buttonArrow} aria-hidden="true">→</span>}
          </button>
        </form>

        <p style={styles.footer}>CIBO Attendance Management System</p>
      </main>
    </div>
  );
}

const styles = {
  container: { minHeight: "100dvh", width: "100%", overflow: "auto", backgroundImage: "url('/bg.jpg')", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat", display: "flex", justifyContent: "center", alignItems: "center", position: "relative", padding: "28px 20px", boxSizing: "border-box" },
  overlay: { position: "fixed", inset: 0, background: "linear-gradient(135deg, rgba(15,23,42,.72), rgba(15,23,42,.52) 45%, rgba(249,115,22,.18))" },
  card: { position: "relative", zIndex: 1, width: "min(430px, 100%)", boxSizing: "border-box", background: "rgba(255,255,255,.97)", padding: "38px 42px 30px", borderRadius: "24px", boxShadow: "0 28px 70px rgba(0,0,0,.28), 0 8px 24px rgba(0,0,0,.12)", border: "1px solid rgba(255,255,255,.7)" },
  brandArea: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "22px" },
  logo: { width: "72px", height: "72px", objectFit: "contain", borderRadius: "14px", marginBottom: "10px" },
  brandAccent: { color: "#f97316", fontSize: "11px", fontWeight: "800", letterSpacing: "2px" },
  headingArea: { textAlign: "center", marginBottom: "28px" },
  title: { margin: "0 0 8px", color: "#172033", fontSize: "30px", lineHeight: "1.15", letterSpacing: "-0.7px", fontWeight: "750" },
  subtitle: { margin: 0, color: "#667085", fontSize: "14px", lineHeight: "1.5" },
  group: { display: "flex", flexDirection: "column", marginBottom: "19px", textAlign: "left" },
  label: { marginBottom: "8px", color: "#344054", fontSize: "13px", fontWeight: "650" },
  required: { color: "#f97316", fontWeight: "800" },
  input: { width: "100%", height: "50px", boxSizing: "border-box", padding: "0 15px", borderRadius: "11px", border: "1px solid #d9dee7", background: "#fff", color: "#172033", fontSize: "14px", outline: "none" },
  passwordWrapper: { position: "relative", width: "100%" },
  eyeButton: { position: "absolute", top: "50%", right: "7px", transform: "translateY(-50%)", width: "38px", height: "38px", display: "grid", placeItems: "center", border: "none", borderRadius: "8px", background: "transparent", color: "#667085", cursor: "pointer", padding: 0 },
  forgotRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "18px", marginBottom: "20px", width: "100%" },
  forgotButton: { border: "none", background: "transparent", color: "#ea580c", fontSize: "13px", fontWeight: "650", cursor: "pointer", padding: "3px 0" },
  rememberLabel: { display: "inline-flex", alignItems: "center", gap: "6px", color: "#667085", fontSize: "13px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" },
  rememberCheckbox: { width: "14px", height: "14px", margin: 0, padding: 0, appearance: "none", WebkitAppearance: "none", border: "1px solid #cbd5e1", borderRadius: "3px", backgroundColor: "#fff", backgroundRepeat: "no-repeat", backgroundPosition: "center", backgroundSize: "12px 12px", cursor: "pointer", flexShrink: 0 },
  button: { width: "100%", height: "52px", display: "flex", alignItems: "center", justifyContent: "center", gap: "9px", border: "none", borderRadius: "11px", background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff", fontSize: "14px", fontWeight: "750", cursor: "pointer", boxShadow: "0 8px 18px rgba(234,88,12,.24)" },
  buttonArrow: { fontSize: "18px", lineHeight: 1, marginTop: "-1px" },
  footer: { margin: "20px 0 0", textAlign: "center", color: "#98a2b3", fontSize: "11px" },
};
