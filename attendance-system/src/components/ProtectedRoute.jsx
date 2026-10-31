import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

const API_URL = (import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "https://cibo-attendance-api.onrender.com" : "http://127.0.0.1:8000")).replace(/\/$/, "");

function getDeviceId() {
  let id = localStorage.getItem("cibo_device_id");
  if (!id) {
    id = window.crypto?.randomUUID?.() || ("cibo-" + Date.now() + "-" + Math.random().toString(36).slice(2));
    localStorage.setItem("cibo_device_id", id);
  }
  return id;
}

export default function ProtectedRoute({ children, role }) {
  const userRole = sessionStorage.getItem("role") || localStorage.getItem("role");
  const [checkingDevice, setCheckingDevice] = useState(true);
  const [deviceAllowed, setDeviceAllowed] = useState(false);
  const [sessionReplaced, setSessionReplaced] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkDevice = async () => {
      const { data } = await supabase.auth.getSession();
      const accessToken = data?.session?.access_token;

      if (!accessToken) {
        if (!cancelled) {
          setDeviceAllowed(false);
          setCheckingDevice(false);
        }
        return;
      }

      try {
        const setupResponse = await fetch(API_URL + "/auth/password-setup/status", {
          headers: { Authorization: "Bearer " + accessToken },
        });
        if (!setupResponse.ok) throw new Error("Account setup check unavailable");
        const setup = await setupResponse.json();
        if (setup.status !== "active") {
          if (!cancelled) {
            setDeviceAllowed(false);
            setCheckingDevice(false);
          }
          if (setup.status === "pending_setup") {
            window.location.replace("/setup-password");
          } else {
            await supabase.auth.signOut();
            window.location.replace("/");
          }
          return;
        }
        const response = await fetch(API_URL + "/auth/device-check", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + accessToken,
          },
          body: JSON.stringify({
            device_id: getDeviceId(),
            device_name: (navigator.userAgentData?.platform || navigator.platform || "Unknown device") + " Browser",
            device_type: "web",
          }),
        });

        if (!response.ok) {
          await supabase.auth.signOut();
          localStorage.removeItem("role");
          sessionStorage.removeItem("role");
          if (!cancelled) setDeviceAllowed(false);
        } else if (!cancelled) {
          setDeviceAllowed(true);
        }
      } catch {
        if (!cancelled) setDeviceAllowed(false);
      } finally {
        if (!cancelled) setCheckingDevice(false);
      }
    };

    checkDevice();
    // Re-check when returning to a backgrounded tab and periodically while active.
    // A newer login on another device makes this session unusable.
    const verifyActiveSession = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) return;
      const { data: active, error } = await supabase.rpc("is_active_session");
      if (error || active !== true) {
        if (!cancelled) {
          setSessionReplaced(true);
          setDeviceAllowed(false);
        }
        await supabase.auth.signOut({ scope: "local" });
        localStorage.removeItem("role");
        sessionStorage.removeItem("role");
      }
    };
    const onFocus = () => { if (!cancelled) verifyActiveSession(); };
    const onVisibility = () => { if (document.visibilityState === "visible") onFocus(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const interval = window.setInterval(verifyActiveSession, 15000);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
  }, []);

  if (!userRole) return <Navigate to="/" replace />;
  if (role && userRole !== role) return <Navigate to="/" replace />;
  if (checkingDevice) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#475467" }}>Checking device authorization...</div>;
  }
  if (sessionReplaced) {
    return <div role="alert" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
      <div><h2>Session ended</h2><p>Your account was signed in on another device or browser. Only one session can remain active.</p>
      <a href="/">Sign in again</a></div>
    </div>;
  }
  if (!deviceAllowed) return <Navigate to="/" replace />;

  return children;
}