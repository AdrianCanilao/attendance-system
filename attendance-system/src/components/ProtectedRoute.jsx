import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function ProtectedRoute({ children, role }) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    // 🔹 Check Supabase session
    const { data } = await supabase.auth.getUser();
    const user = data?.user;

    if (!user) {
      setAllowed(false);
      setLoading(false);
      return;
    }

    // 🔹 Check role from localStorage
    const userRole = localStorage.getItem("role");

    if (!userRole) {
      setAllowed(false);
      setLoading(false);
      return;
    }

    // 🔹 Compare role
    if (role && userRole !== role) {
      setAllowed(false);
    } else {
      setAllowed(true);
    }

    setLoading(false);
  };

  // ⏳ wait while checking
  if (loading) {
    return <p style={{ textAlign: "center" }}>Loading...</p>;
  }

  // 🚫 block access
  if (!allowed) {
    return <Navigate to="/" />;
  }

  // ✅ allow access
  return children;
}