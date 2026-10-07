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
    return () => { cancelled = true; };
  }, []);

  if (!userRole) return <Navigate to="/" replace />;
  if (role && userRole !== role) return <Navigate to="/" replace />;
  if (checkingDevice) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#475467" }}>Checking device authorization...</div>;
  }
  if (!deviceAllowed) return <Navigate to="/" replace />;

  return children;
}