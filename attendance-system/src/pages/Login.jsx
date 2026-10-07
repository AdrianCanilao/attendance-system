import { useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { logAudit } from "../utils/auditlogger";
import { isValidEmail } from "../utils/emailValidation";

export default function Login() {
  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      alert("Please enter your email and password.");
      return;
    }

    if (!isValidEmail(email)) {
      alert("Please enter a valid email address.");
      return;
    }

    if (email.trim().length > 254) {
      alert("Email cannot exceed 254 characters.");
      return;
    }
    if (password.length < 8) {
      alert("Password must be at least 8 characters.");
      return;
    }
    if (password.length > 64) {
      alert("Password cannot exceed 64 characters.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword(
          {
            email,
            password,
          }
        );

      if (
        error ||
        !data ||
        !data.user
      ) {
        await logAudit({
          user_id: null,
          user_name: email,
          role: "unknown",
          action: "LOGIN_FAILED",
          description: `Failed login attempt for ${email}${error?.message ? `: ${error.message}` : ""}`,
        });

        alert("Invalid email or password.");
        return;
      }

      const user = data.user;

      // 👤 GET PROFILE
      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("employee_profiles")
        .select("id, role_id")
        .eq("id", user.id)
        .single();

      if (
        profileError ||
        !profile
      ) {
        await logAudit({
          user_id: user.id,
          user_name: user.email,
          role: "unknown",
          action: "LOGIN_PROFILE_FAILED",
          description: `Login succeeded but employee profile was not found for ${user.email}`,
        });

        alert(
          "Profile not found. Contact admin."
        );
        return;
      }

      // 🧑‍💼 GET ROLE
      const {
        data: roleData,
        error: roleError,
      } = await supabase
        .from("roles")
        .select("name")
        .eq("id", profile.role_id)
        .single();

      if (
        roleError ||
        !roleData
      ) {
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

      const role =
        roleData.name
          .trim()
          .toLowerCase();

      await logAudit({
        user_id: user.id,
        user_name: user.email,
        role: role,
        action: "LOGIN",
        description:
          `${user.email} logged into the system`,
      });

      // ✅ SAVE ROLE
      localStorage.setItem(
        "role",
        role
      );


      // ✅ WAIT BEFORE NAVIGATION
      setTimeout(() => {
        if (role === "maintenance") {
          navigate(
            "/manager/profile"
          );
        }

        else if (role === "hr") {
          navigate(
            "/hr/profile"
          );
        }

        else if (
          role === "employee"
        ) {
          navigate(
            "/employee/profile"
          );
        }

        else {
          alert(
            "Unknown role detected"
          );
        }
      }, 150);

    } catch (err) {
      alert(
        "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cibo-login" style={styles.container}>
      <div style={styles.overlay}></div>

      <div className="cibo-login-card" style={styles.card}>
        <img
          src="/logo.png"
          alt="logo"
          style={styles.logo}
        />

        <h1 style={styles.title}>
          Attendance <br />
          System
        </h1>

        <p style={styles.subtitle}>
          Company Login Portal
        </p>

        <form onSubmit={handleLogin}>
          <div style={styles.group}>
            <label style={styles.label}>Email <span style={styles.required}>*</span></label>

            <input
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Enter email"
              style={{
                ...styles.input,
                color: "#000",
              }}
              value={email}
              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }
            />
          </div>

          <div style={styles.group}>
            <label style={styles.label}>Password <span style={styles.required}>*</span></label>

            <div style={styles.passwordWrap}>
              <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              maxLength={64}
              autoComplete="current-password"
              placeholder="Enter password"
              style={{
                ...styles.input,
                color: "#000",
              }}
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
            />
              <button type="button" onClick={() => setShowPassword((v) => !v)} style={styles.eyeButton} aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? (
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.9 10.9 0 0 1 12 4c5.2 0 8.9 4.3 10 8-.4 1.4-1.2 2.8-2.2 4M6.2 6.2C4.6 7.4 3.5 9.1 2 12c1.1 3.7 4.8 8 10 8 1.5 0 2.8-.3 4-.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8"/></svg>
                )}
              </button>
            </div>
          </div>

          <div style={styles.forgotRow}>
            <button type="button" onClick={() => navigate("/forgot-password")} style={styles.forgotButton}>Forgot password?</button>
          </div>

          <button
            type="submit"
            style={styles.button}
            disabled={loading}
          >
            {loading
              ? "Logging in..."
              : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    height: "100vh",
    width: "100vw",
    overflow: "hidden",

    backgroundImage:
      "url('/bg.jpg')",

    backgroundSize: "cover",

    backgroundPosition:
      "center",

    backgroundRepeat:
      "no-repeat",

    display: "flex",

    justifyContent:
      "center",

    alignItems:
      "center",

    position: "relative",
  },

  overlay: {
    position: "absolute",

    inset: 0,

    background:
      "rgba(0,0,0,0.6)",
  },

  card: {
    position: "relative",

    zIndex: 1,

    width: "360px",

    background: "#ffffff",

    padding: "35px",

    borderRadius: "10px",

    boxShadow:
      "0 10px 30px rgba(0,0,0,0.3)",

    borderTop:
      "5px solid #f97316",

    textAlign: "center",
  },

  logo: {
    width: "70px",

    height: "70px",

    objectFit: "contain",

    marginBottom: "10px",
  },

  title: {
    marginBottom: "10px",

    color: "#f97316",

    fontWeight: "bold",

    fontSize: "26px",

    lineHeight: "1.2",
  },

  subtitle: {
    marginBottom: "20px",

    color: "#777",

    fontSize: "14px",
  },

  label: { fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "7px" },
  required: { color: "#dc2626" },
  passwordWrap: { position: "relative" },
  eyeButton: { position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", color: "#6b7280", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "4px" },
  forgotRow: { textAlign: "right", marginTop: "-5px", marginBottom: "10px" },
  forgotButton: { border: "none", background: "transparent", color: "#ea580c", fontWeight: "600", fontSize: "13px", cursor: "pointer", padding: 0 },

  group: {
    display: "flex",

    flexDirection:
      "column",

    marginBottom: "15px",

    textAlign: "left",
  },

  input: {
    padding: "10px",

    borderRadius: "5px",

    border:
      "1px solid #ddd",

    marginTop: "5px",

    background: "#ffffff",

    color: "#000",

    fontSize: "14px",
  },

  button: {
    width: "100%",

    padding: "12px",

    background: "#f97316",

    color: "#fff",

    border: "none",

    borderRadius: "5px",

    fontWeight: "bold",

    cursor: "pointer",

    marginTop: "10px",

    transition: "0.3s",
  },
};