import { Navigate } from "react-router-dom";

export default function ProtectedRoute({
  children,
  role,
}) {
  const userRole =
    localStorage.getItem("role");

  console.log(
    "ProtectedRoute role:",
    role
  );

  console.log(
    "Stored role:",
    userRole
  );

  if (!userRole) {
    console.log("NO ROLE FOUND");
    return <Navigate to="/" />;
  }

  if (role && userRole !== role) {
    console.log("ROLE MISMATCH");
    return <Navigate to="/" />;
  }

  console.log("ACCESS GRANTED");

  return children;
}