import EmployeeDashboard from "./EmployeeDashboard";
import ManagerLayout from "../layouts/ManagerLayout";

export default function ManagerDashboard() {
  return (
    <ManagerLayout>
      <EmployeeDashboard isManager={true} />
    </ManagerLayout>
  );
}