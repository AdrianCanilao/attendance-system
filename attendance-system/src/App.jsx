import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import ManagerDashboard from "./pages/ManagerDashboard";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import LeaveRequest from "./pages/LeaveRequest";
import ManagerLeave from "./pages/ManagerLeave";
import MyLeave from "./pages/MyLeave";
import RegisterEmployee from "./pages/RegisterEmployee";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route
          path="/manager"
          element={
            <ProtectedRoute role="manager">
              <ManagerDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/manager/register"
          element={
            <ProtectedRoute role="manager">
              <RegisterEmployee />
            </ProtectedRoute>
          }
        />

        <Route
          path="/manager/leave"
          element={
            <ProtectedRoute role="manager">
              <ManagerLeave />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee"
          element={
            <ProtectedRoute role="employee">
              <EmployeeDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/leave"
          element={
            <ProtectedRoute role="employee">
              <LeaveRequest />
            </ProtectedRoute>
          }
        />

        <Route
          path="/my-leave"
          element={
            <ProtectedRoute role="employee">
              <MyLeave />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}