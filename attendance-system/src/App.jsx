import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

const Login = lazy(() => import("./pages/Login"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const SetupPassword = lazy(() => import("./pages/SetupPassword"));
const ManagerDashboard = lazy(() => import("./pages/ManagerDashboard"));
const EmployeeDashboard = lazy(() => import("./pages/EmployeeDashboard"));
import ProtectedRoute from "./components/ProtectedRoute";

const LeaveRequest = lazy(() => import("./pages/LeaveRequest"));
const ManagerLeave = lazy(() => import("./pages/ManagerLeave"));
const MyLeave = lazy(() => import("./pages/MyLeave"));

const RegisterEmployee = lazy(() => import("./pages/RegisterEmployee"));
const EditEmployee = lazy(() => import("./pages/EditEmployee"));
const Profile = lazy(() => import("./pages/Profile"));
const LeaveCounts = lazy(() => import("./pages/LeaveCounts"));
const EmployeeList = lazy(() => import("./pages/EmployeeList"));

const HRDashboard = lazy(() => import("./pages/HRDashboard"));
const HRAuditTrail = lazy(() => import("./pages/HRAuditTrail"));
const RegisterManager = lazy(() => import("./pages/RegisterManager"));
const EditManager = lazy(() => import("./pages/EditManager"));

const ManagerAttendanceTracker = lazy(() => import("./pages/ManagerAttendanceTracker"));
const ShiftSettings = lazy(() => import("./pages/ShiftSettings"));
const BranchSettings = lazy(() => import("./pages/BranchSettings"));
const DeviceManagement = lazy(() => import("./pages/DeviceManagement"));
const DataMigration = lazy(() => import("./pages/DataMigration"));
const StagedEmployees = lazy(() => import("./pages/StagedEmployees"));
const StagedAttendance = lazy(() => import("./pages/StagedAttendance"));
const ManagerStagedEmployees = lazy(() => import("./pages/ManagerStagedEmployees"));

const Kiosk = lazy(() => import("./pages/Kiosk"));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div role="status" style={{ padding: 24, textAlign: "center" }}>Loading page…</div>}>
      <Routes>

        {/* ================= LOGIN ================= */}

        <Route path="/" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/setup-password" element={<SetupPassword />} />


        {/* ================= KIOSK ================= */}

        {/* 
          Public route.
          Employees do NOT log in on the physical kiosk.
        */}

        <Route
          path="/kiosk"
          element={<Kiosk />}
        />


        {/* ================= MAINTENANCE SPECIALIST ================= */}

        <Route
          path="/manager"
          element={
            <ProtectedRoute role="maintenance">
              <ManagerAttendanceTracker />
            </ProtectedRoute>
          }
        />

        <Route
          path="/manager/attendance"
          element={
            <ProtectedRoute role="maintenance">
              <ManagerDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/manager/employees"
          element={
            <ProtectedRoute role="maintenance">
              <EmployeeList />
            </ProtectedRoute>
          }
        />

        <Route
          path="/manager/profile"
          element={
            <ProtectedRoute role="maintenance">
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/manager/staged-employees"
          element={
            <ProtectedRoute role="maintenance">
              <ManagerStagedEmployees />
            </ProtectedRoute>
          }
        />

        <Route
          path="/manager/register"
          element={
            <ProtectedRoute role="maintenance">
              <RegisterEmployee />
            </ProtectedRoute>
          }
        />

        <Route
          path="/manager/edit"
          element={
            <ProtectedRoute role="maintenance">
              <EditEmployee />
            </ProtectedRoute>
          }
        />

        <Route path="/manager/leave-request" element={
          <ProtectedRoute role="maintenance"><LeaveRequest maintenance /></ProtectedRoute>
        } />
        <Route path="/manager/myleave" element={
          <ProtectedRoute role="maintenance"><MyLeave maintenance /></ProtectedRoute>
        } />

        <Route
          path="/manager/leave"
          element={
            <ProtectedRoute role="maintenance">
              <ManagerLeave />
            </ProtectedRoute>
          }
        />

        <Route
          path="/manager/leave-approval"
          element={
            <ProtectedRoute role="maintenance">
              <ManagerLeave />
            </ProtectedRoute>
          }
        />

        <Route
          path="/manager/edit-leave-counts"
          element={
            <ProtectedRoute role="maintenance">
              <LeaveCounts />
            </ProtectedRoute>
          }
        />


        {/* ================= HR ================= */}

        <Route
          path="/hr"
          element={<HRDashboard />}
        />

        <Route
          path="/hr/audit-trail"
          element={<HRAuditTrail />}
        />

        <Route
          path="/hr/profile"
          element={<HRAuditTrail />}
        />

        <Route
          path="/hr/register-employee"
          element={
            <ProtectedRoute role="hr">
              <RegisterEmployee />
            </ProtectedRoute>
          }
        />

        <Route
          path="/hr/register-manager"
          element={
            <ProtectedRoute role="hr">
              <RegisterManager />
            </ProtectedRoute>
          }
        />

        <Route
          path="/hr/edit-manager"
          element={
            <ProtectedRoute role="hr">
              <EditManager />
            </ProtectedRoute>
          }
        />

        <Route
          path="/hr/branch-settings"
          element={
            <ProtectedRoute role="hr">
              <BranchSettings />
            </ProtectedRoute>
          }
        />


        <Route
          path="/hr/devices"
          element={
            <ProtectedRoute role="hr">
              <DeviceManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/hr/shift-settings"
          element={
            <ProtectedRoute role="hr">
              <ShiftSettings />
            </ProtectedRoute>
          }
        />

        <Route
          path="/hr/staged-employees"
          element={
            <ProtectedRoute role="hr">
              <StagedEmployees />
            </ProtectedRoute>
          }
        />

        <Route
          path="/hr/staged-attendance"
          element={
            <ProtectedRoute role="hr">
              <StagedAttendance />
            </ProtectedRoute>
          }
        />

        <Route
          path="/hr/data-migration"
          element={
            <ProtectedRoute role="hr">
              <DataMigration />
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
      </Suspense>
    </BrowserRouter>
  );
}