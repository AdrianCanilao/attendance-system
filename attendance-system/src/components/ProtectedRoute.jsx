import { Navigate } from "react-router-dom";

export default function ProtectedRoute({
  children,
  role,
}) {
  // Remember Me stores the role in localStorage.
  // Without Remember Me, the role lives only for the current browser session.
  const userRole =
    sessionStorage.getItem("role") ||
    localStorage.getItem("role");

  if (!userRole) {
    return <Navigate to="/" replace />;
  }

  if (role && userRole !== role) {
    return <Navigate to="/" replace />;
  }

  return children;
}
