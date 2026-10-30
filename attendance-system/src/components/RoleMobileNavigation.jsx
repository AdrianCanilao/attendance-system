import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaBars, FaTimes, FaLaptop, FaChartBar, FaUsers, FaUser, FaHistory, FaClipboardList, FaSignOutAlt, FaChevronDown, FaChevronRight } from "react-icons/fa";

const menus = {
  hr: [
    { label: "Device Management", path: "/hr/devices", icon: FaLaptop },
    { label: "Audit Trail", path: "/hr/audit-trail", icon: FaChartBar },
    { label: "Employee Management", icon: FaUsers, children: [
      ["Register Maintenance Specialist", "/hr/register-manager"],
      ["Edit Maintenance Specialist", "/hr/edit-manager"],
      ["Branch Settings", "/hr/branch-settings"],
      ["Shift Settings", "/hr/shift-settings"],
      ["Data Migration", "/hr/data-migration"],
      ["Staged Employees", "/hr/staged-employees"],
      ["Staged Attendance", "/hr/staged-attendance"],
    ] },
  ],
  maintenance: [
    { label: "Profile", path: "/manager/profile", icon: FaUser },
    { label: "Attendance Log", path: "/manager/attendance", icon: FaChartBar },
    { label: "Attendance Tracker", path: "/manager", icon: FaHistory },
    { label: "Employee Management", icon: FaUsers, children: [
      ["Staged Employees", "/manager/staged-employees"],
      ["Register Employee", "/manager/register"],
      ["Edit Employee", "/manager/edit"],
      ["Employee List", "/manager/employees"],
    ] },
    { label: "Leave Management", icon: FaClipboardList, children: [
      ["Leave Approval", "/manager/leave"],
      ["Edit Leave Counts", "/manager/edit-leave-counts"],
    ] },
  ],
  employee: [
    { label: "Profile", path: "/employee/profile", icon: FaUser },
    { label: "Attendance Log", path: "/employee", icon: FaChartBar },
    { label: "Leave Overview", icon: FaClipboardList, children: [
      ["Leave Request", "/employee/leave-request"],
      ["Leave Records", "/employee/myleave"],
    ] },
  ],
};

export default function RoleMobileNavigation({ role, onLogout }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const items = menus[role] || [];
  const [expanded, setExpanded] = useState(() => items.find(item => item.children?.some(([, path]) => path === location.pathname))?.label || null);

  useEffect(() => {
    setOpen(false);
    setExpanded(items.find(item => item.children?.some(([, path]) => path === location.pathname))?.label || null);
  }, [location.pathname, role]);

  const go = (path) => { setOpen(false); navigate(path); };
  return (
    <>
      <button type="button" className="cibo-role-menu-toggle" aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={open} aria-controls={`cibo-${role}-mobile-nav`} onClick={() => setOpen(value => !value)}>
        {open ? <FaTimes /> : <FaBars />}
      </button>
      <nav id={`cibo-${role}-mobile-nav`} className={`cibo-role-mobile-nav ${open ? "is-open" : ""}`}
        aria-label={role === "hr" ? "HR mobile navigation" : role === "employee" ? "Employee mobile navigation" : "Branch Supervisor mobile navigation"}>
        {items.map(item => {
          const Icon = item.icon;
          if (!item.children) return (
            <button type="button" className="cibo-role-nav-primary" key={item.path} aria-current={location.pathname === item.path ? "page" : undefined}
              onClick={() => go(item.path)}><Icon aria-hidden="true" /> <span>{item.label}</span></button>
          );
          const isExpanded = expanded === item.label;
          return (
            <div className="cibo-role-nav-group" key={item.label}>
              <button type="button" className="cibo-role-nav-group-toggle" aria-expanded={isExpanded}
                onClick={() => setExpanded(isExpanded ? null : item.label)}>
                <Icon aria-hidden="true" /><span>{item.label}</span>{isExpanded ? <FaChevronDown aria-hidden="true" /> : <FaChevronRight aria-hidden="true" />}
              </button>
              {isExpanded && <div className="cibo-role-nav-submenu">
                {item.children.map(([label, path]) => (
                  <button type="button" key={path} aria-current={location.pathname === path ? "page" : undefined}
                    onClick={() => go(path)}>{label}</button>
                ))}
              </div>}
            </div>
          );
        })}
        <button type="button" className="cibo-role-nav-primary" onClick={onLogout}><FaSignOutAlt aria-hidden="true" /><span>Logout</span></button>
      </nav>
    </>
  );
}
