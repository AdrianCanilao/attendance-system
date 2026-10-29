import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaBars, FaTimes } from "react-icons/fa";

const links = {
  hr: [
    ["Device Management", "/hr/devices"],
    ["Audit Trail", "/hr/audit-trail"],
    ["Register Maintenance Specialist", "/hr/register-manager"],
    ["Edit Maintenance Specialist", "/hr/edit-manager"],
    ["Branch Settings", "/hr/branch-settings"],
    ["Shift Settings", "/hr/shift-settings"],
    ["Data Migration", "/hr/data-migration"],
    ["Staged Employees", "/hr/staged-employees"],
    ["Staged Attendance", "/hr/staged-attendance"],
  ],
  maintenance: [
    ["Profile", "/manager/profile"],
    ["Attendance Log", "/manager/attendance"],
    ["Attendance Tracker", "/manager"],
    ["Staged Employees", "/manager/staged-employees"],
    ["Register Employee", "/manager/register"],
    ["Edit Employee", "/manager/edit"],
    ["Employee List", "/manager/employees"],
    ["Leave Approval", "/manager/leave"],
    ["Edit Leave Counts", "/manager/edit-leave-counts"],
  ],
};

export default function RoleMobileNavigation({ role, onLogout }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => { setOpen(false); }, [location.pathname]);

  return (
    <>
      <button type="button" className="cibo-role-menu-toggle"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={open} aria-controls={`cibo-${role}-mobile-nav`}
        onClick={() => setOpen(value => !value)}>
        {open ? <FaTimes /> : <FaBars />}
      </button>
      <nav id={`cibo-${role}-mobile-nav`}
        className={`cibo-role-mobile-nav ${open ? "is-open" : ""}`}
        aria-label={role === "hr" ? "HR mobile navigation" : "Branch Supervisor mobile navigation"}>
        {(links[role] || []).map(([label, path]) => (
          <button type="button" key={path}
            aria-current={location.pathname === path ? "page" : undefined}
            onClick={() => { setOpen(false); navigate(path); }}>
            {label}
          </button>
        ))}
        <button type="button" onClick={onLogout}>Logout</button>
      </nav>
    </>
  );
}
