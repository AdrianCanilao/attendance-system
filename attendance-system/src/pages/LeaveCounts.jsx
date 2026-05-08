import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import ManagerLayout from "../layouts/ManagerLayout";
import { logAudit } from "../utils/auditLogger";

export default function LeaveCounts() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [search, setSearch] = useState("");

  const [leaveCounts, setLeaveCounts] = useState({
    sick_leave: 0,
    vacation_leave: 0,
    emergency_leave: 0,
    service_incentive_leave: 0,
    birthday_leave: 0,
    official_business: 0,
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
  const { data, error } = await supabase
    .from("employee_profiles")
    .select("*");

  console.log("EMPLOYEE DATA:", data);
  console.log("ERROR:", error);

  if (!error && data) {
    setEmployees(data);
  }
};

  const selectEmployee = (employee) => {
    setSelectedEmployee(employee);

    setLeaveCounts({
      sick_leave: employee.sick_leave || 0,
      vacation_leave: employee.vacation_leave || 0,
      emergency_leave: employee.emergency_leave || 0,
      service_incentive_leave:
        employee.service_incentive_leave || 0,
      birthday_leave: employee.birthday_leave || 0,
      official_business: employee.official_business || 0,
    });
  };

  const updateLeaveCounts = async () => {
    if (!selectedEmployee) return;

    const { error } = await supabase
      .from("employee_profiles")
      .update({
        sick_leave: leaveCounts.sick_leave,
        vacation_leave: leaveCounts.vacation_leave,
        emergency_leave: leaveCounts.emergency_leave,
        service_incentive_leave:
          leaveCounts.service_incentive_leave,
        birthday_leave: leaveCounts.birthday_leave,
        official_business: leaveCounts.official_business,
      })
      .eq("id", selectedEmployee.id);

    if (!error) {
      alert("Leave counts updated successfully");
      fetchEmployees();
    }
  };

  const filteredEmployees = employees.filter((emp) =>
    emp.full_name
      ?.toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <ManagerLayout>
      <div style={styles.container}>
        <h1 style={styles.pageTitle}>Edit Leave Counts</h1>

        <div style={styles.wrapper}>
          {/* LEFT SIDE */}
          <div style={styles.employeePanel}>
            <input
              type="text"
              placeholder="Search employee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.searchInput}
            />

            <div style={styles.employeeList}>
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((employee) => (
                  <div
                    key={employee.id}
                    style={{
                      ...styles.employeeCard,
                      ...(selectedEmployee?.id === employee.id
                        ? styles.activeEmployee
                        : {}),
                    }}
                    onClick={() => selectEmployee(employee)}
                  >
                    <div>
                      <div style={styles.employeeName}>
                        {employee.full_name}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={styles.noEmployees}>
                  No employees found
                </div>
              )}
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div style={styles.editPanel}>
            {selectedEmployee ? (
              <>
                <h2 style={styles.editTitle}>
                  {selectedEmployee.full_name}
                </h2>

                <div style={styles.grid}>
                  <InputField
                    label="Sick Leave"
                    value={leaveCounts.sick_leave}
                    onChange={(value) =>
                      setLeaveCounts({
                        ...leaveCounts,
                        sick_leave: value,
                      })
                    }
                  />

                  <InputField
                    label="Vacation Leave"
                    value={leaveCounts.vacation_leave}
                    onChange={(value) =>
                      setLeaveCounts({
                        ...leaveCounts,
                        vacation_leave: value,
                      })
                    }
                  />

                  <InputField
                    label="Emergency Leave"
                    value={leaveCounts.emergency_leave}
                    onChange={(value) =>
                      setLeaveCounts({
                        ...leaveCounts,
                        emergency_leave: value,
                      })
                    }
                  />

                  <InputField
                    label="Service Incentive Leave"
                    value={
                      leaveCounts.service_incentive_leave
                    }
                    onChange={(value) =>
                      setLeaveCounts({
                        ...leaveCounts,
                        service_incentive_leave: value,
                      })
                    }
                  />

                  <InputField
                    label="Birthday Leave"
                    value={leaveCounts.birthday_leave}
                    onChange={(value) =>
                      setLeaveCounts({
                        ...leaveCounts,
                        birthday_leave: value,
                      })
                    }
                  />

                  <InputField
                    label="Official Business"
                    value={leaveCounts.official_business}
                    onChange={(value) =>
                      setLeaveCounts({
                        ...leaveCounts,
                        official_business: value,
                      })
                    }
                  />
                </div>

                <button
                  style={styles.saveButton}
                  onClick={updateLeaveCounts}
                >
                  Save Changes
                </button>
              </>
            ) : (
              <div style={styles.emptyState}>
                Select an employee to edit leave counts
              </div>
            )}
          </div>
        </div>
      </div>
    </ManagerLayout>
  );
}

function InputField({ label, value, onChange }) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>

      <input
        type="number"
        value={value}
        onChange={(e) =>
          onChange(Number(e.target.value))
        }
        style={styles.input}
      />
    </div>
  );
}

const styles = {
  container: {
    padding: "30px",
  },

  title: {
    fontSize: "26px",
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: "24px",
  },

  wrapper: {
    display: "flex",
    gap: "24px",
  },

  employeePanel: {
    width: "320px",
    background: "#fff",
    borderRadius: "20px",
    padding: "20px",
    border: "1px solid #dbe2ea",
    height: "fit-content",
  },

  searchInput: {
    width: "100%",
    padding: "14px",
    borderRadius: "12px",
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    fontSize: "14px",
    marginBottom: "18px",
    outline: "none",
    boxSizing: "border-box",
  },

  employeeList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    maxHeight: "600px",
    overflowY: "auto",
  },

  employeeCard: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "14px",
    borderRadius: "14px",
    border: "1px solid #e5e7eb",
    cursor: "pointer",
    transition: "0.2s",
    background: "#fff",
  },

  activeEmployee: {
    border: "1px solid #f97316",
    background: "#fff7ed",
  },

  avatar: {
    width: "45px",
    height: "45px",
    borderRadius: "50%",
    background: "#f97316",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "700",
    fontSize: "18px",
    flexShrink: 0,
  },

  employeeName: {
    fontWeight: "600",
    color: "#111827",
    marginBottom: "4px",
  },

  employeeEmail: {
    fontSize: "13px",
    color: "#6b7280",
  },

  noEmployees: {
    textAlign: "center",
    padding: "20px",
    color: "#6b7280",
    fontSize: "14px",
  },

  editPanel: {
    flex: 1,
    background: "#fff",
    borderRadius: "20px",
    padding: "28px",
    border: "1px solid #dbe2ea",
  },

  editTitle: {
    fontSize: "32px",
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: "28px",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "20px",
  },

  field: {
    display: "flex",
    flexDirection: "column",
  },

  label: {
    marginBottom: "8px",
    fontWeight: "600",
    color: "#111827",
  },

  input: {
    padding: "14px",
    borderRadius: "12px",
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#111827",
    fontSize: "15px",
    outline: "none",
  },

  saveButton: {
    marginTop: "30px",
    padding: "14px 24px",
    border: "none",
    borderRadius: "12px",
    background: "#f97316",
    color: "#fff",
    fontWeight: "600",
    fontSize: "15px",
    cursor: "pointer",
  },

  emptyState: {
    color: "#6b7280",
    fontSize: "16px",
  },
  pageTitle: {
    fontSize: "25px",
    fontWeight: "650",
    color: "#111827",
    margin: "0 20px 0",
    padding: 0,
    letterSpacing: "-0.3px",
    lineHeight: "1.2",
  },
};