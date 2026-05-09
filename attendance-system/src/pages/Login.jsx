import { useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { logAudit } from "../utils/auditLogger";

export default function Login() {
  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const navigate = useNavigate();

  const handleLogin = async () => {

    console.log("Login clicked");

    if (!email || !password) {
      alert(
        "Please enter email and password"
      );
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

      console.log(
        "LOGIN RESPONSE:",
        data,
        error
      );

      if (
        error ||
        !data ||
        !data.user
      ) {
        alert(
          error?.message ||
            "Invalid login credentials"
        );
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

      console.log(
        "PROFILE:",
        profile,
        profileError
      );

      if (
        profileError ||
        !profile
      ) {
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

      console.log(
        "ROLE:",
        roleData,
        roleError
      );

      if (
        roleError ||
        !roleData
      ) {
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

      console.log(
        "FINAL ROLE:",
        role
      );

      // ✅ SAVE ROLE
      localStorage.setItem(
        "role",
        role
      );

      // ✅ SAVE EMAIL
      localStorage.setItem(
        "email",
        email
      );

      // ✅ SAVE USER ID
      localStorage.setItem(
        "user_id",
        user.id
      );

      // ✅ WAIT BEFORE NAVIGATION
      setTimeout(() => {

        if (role === "maintenance") {

          console.log(
            "GOING TO MAINTENANCE"
          );

          navigate(
            "/manager/profile"
          );

        }

        else if (role === "hr") {

          console.log(
            "GOING TO HR"
          );

          navigate(
            "/hr/profile"
          );

        }

        else if (
          role === "employee"
        ) {

          console.log(
            "GOING TO EMPLOYEE"
          );

          navigate(
            "/employee/profile"
          );

        }

        else {

          console.log(
            "UNKNOWN ROLE"
          );

          alert(
            "Unknown role detected"
          );

        }

      }, 150);

    } catch (err) {

      console.error(
        "LOGIN ERROR:",
        err
      );

      alert(
        "Something went wrong"
      );

    } finally {

      setLoading(false);

    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.overlay}></div>

      <div style={styles.card}>
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

        <div>

          <div style={styles.group}>
            <label>Email</label>

            <input
              type="email"
              placeholder="Enter email"
              style={styles.input}
              value={email}
              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }
            />
          </div>

          <div style={styles.group}>
            <label>Password</label>

            <input
              type="password"
              placeholder="Enter password"
              style={styles.input}
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value
                )
              }
            />
          </div>

          <button
            type="button"
            onClick={handleLogin}
            style={styles.button}
            disabled={loading}
          >
            {loading
              ? "Logging in..."
              : "Login"}
          </button>

        </div>
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