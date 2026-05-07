import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import ManagerDashboard from "./pages/ManagerDashboard";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import LeaveRequest from "./pages/LeaveRequest";
import ManagerLeave from "./pages/ManagerLeave";
import MyLeave from "./pages/MyLeave";
import RegisterEmployee from "./pages/RegisterEmployee";
import EditEmployee from "./pages/EditEmployee";
import Profile from "./pages/Profile";
import LeaveCounts from "./pages/LeaveCounts";
import EmployeeList from "./pages/EmployeeList";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* LOGIN */}
        <Route path="/" element={<Login />} />

        {/* ================= MANAGER ================= */}

        <Route
          path="/manager"
          element={
            <ProtectedRoute role="manager">
              <ManagerDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="/manager/employees" element={<EmployeeList />} />

        <Route
          path="/manager/profile"
          element={
            <ProtectedRoute role="manager">
              <Profile />
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
          path="/manager/edit"
          element={
            <ProtectedRoute role="manager">
              <EditEmployee />
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
          path="/manager/leave-approval"
          element={
            <ProtectedRoute role="manager">
              <ManagerLeave />
            </ProtectedRoute>
          }
        />

        <Route
  path="/manager/edit-leave-counts"
  element={
    <ProtectedRoute role="manager">
      <LeaveCounts />
    </ProtectedRoute>
  }
/>

        {/* ================= EMPLOYEE ================= */}

        <Route
          path="/employee"
          element={
            <ProtectedRoute role="employee">
              <EmployeeDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee/profile"
          element={
            <ProtectedRoute role="employee">
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee/leave-request"
          element={
            <ProtectedRoute role="employee">
              <LeaveRequest />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee/myleave"
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