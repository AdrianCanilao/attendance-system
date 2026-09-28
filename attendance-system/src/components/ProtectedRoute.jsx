import { Navigate } from "react-router-dom";

export default function ProtectedRoute({
  children,
  role,
}) {
  const userRole =
    localStorage.getItem("role");



  if (!userRole) {
    return <Navigate to="/" />;
  }

  if (role && userRole !== role) {
    return <Navigate to="/" />;
  }


  return children;
}