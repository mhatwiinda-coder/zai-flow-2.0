// HR & Payroll Module - Employee Management & Analytics
// Depends on: supabase-init.js, payroll.js

let employeeEditId = null;
let charts = {};

/* =====================================================
   INITIALIZE HR MODULE
===================================================== */
document.addEventListener("DOMContentLoaded", () => {
  initHR();
  setDefaultDates();
});

function initHR() {
  loadEmployeeList();
  loadDepartments();
  loadAttendanceData();
  loadLeaveRequests();
}

function setDefaultDates() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  document.getElementById("attendanceFromDate").valueAsDate = firstDay;
  document.getElementById("attendanceToDate").valueAsDate = today;
}

/* =====================================================
   EMPLOYEE MANAGEMENT
===================================================== */
function loadEmployeeList() {
  (async () => {
    try {
      const context = getBranchContext();
      if (!context) {
        console.error("❌ No branch context available");
        return;
      }

      console.log(`📡 Loading employees for business_id: ${context.business_id}`);

      const { data: employees, error } = await window.supabase.rpc('get_business_employees', {
        p_business_id: context.business_id
      });

      if (error) {
        console.error("❌ RPC Error:", error);
        throw error;
      }

      if (!Array.isArray(employees) || employees.length === 0) {
        console.warn("⚠️ No employees found for business");
        document.getElementById("employeeTable").innerHTML = '';
        document.getElementById("noEmployees").style.display = 'block';
        return;
      }

      console.log(`✅ Loaded ${employees.length} employees`);
      document.getElementById("noEmployees").style.display = 'none';
      let html = '';
      employees.forEach(emp => {
        const hireDate = new Date(emp.hire_date).toLocaleDateString('en-ZM');
        const deptName = emp.departments && emp.departments.name ? emp.departments.name : 'N/A';
        const statusClass = `status-${emp.status.toLowerCase()}`;

        html += `
          <tr>
            <td><strong>${emp.employee_code}</strong></td>
            <td>${emp.first_name} ${emp.last_name}</td>
            <td>${deptName}</td>
            <td>${emp.position}</td>
            <td><span class="status-badge ${statusClass}">${emp.status}</span></td>
            <td>${hireDate}</td>
            <td class="action-buttons">
              <button class="btn-view" onclick="viewEmployee(${emp.id})">View</button>
              <button class="btn-edit" onclick="editEmployee(${emp.id})">Edit</button>
            </td>
          </tr>
        `;
      });

      document.getElementById("employeeTable").innerHTML = html;
    } catch (err) {
      console.error("❌ Employee list error:", err);
      alert("Failed to load employees: " + err.message);
    }
  })();
}

function loadDepartments() {
  (async () => {
    try {
      const context = getBranchContext();
      if (!context) return;

      console.log(`📡 Loading departments for business_id: ${context.business_id}`);

      const { data: departments, error } = await window.supabase.rpc('get_business_departments', {
        p_business_id: context.business_id
      });

      if (error) {
        console.error("❌ Department RPC Error:", error);
        throw error;
      }

      if (Array.isArray(departments)) {
        let html = '<option value="">Select Department</option>';
        departments.forEach(dept => {
          html += `<option value="${dept.id}">${dept.name}</option>`;
        });
        document.getElementById("empDepartment").innerHTML = html;
        console.log(`✅ Loaded ${departments.length} departments`);
      }
    } catch (err) {
      console.error("❌ Department load error:", err);
    }
  })();
}

function filterEmployeeTable() {
  const searchText = document.getElementById("employeeSearch").value.toLowerCase();
  const statusFilter = document.getElementById("employeeStatusFilter").value;

  const rows = document.querySelectorAll("#employeeTable tr");
  let visibleCount = 0;

  rows.forEach(row => {
    const text = row.innerText.toLowerCase();
    const statusCell = row.cells[4]?.innerText || '';

    const matchesSearch = text.includes(searchText);
    const matchesStatus = !statusFilter || statusCell.includes(statusFilter);

    if (matchesSearch && matchesStatus) {
      row.style.display = '';
      visibleCount++;
    } else {
      row.style.display = 'none';
    }
  });

  document.getElementById("noEmployees").style.display = visibleCount === 0 ? 'block' : 'none';
}

function openEmployeeModal() {
  employeeEditId = null;
  document.getElementById("empCode").value = '';
  document.getElementById("empFirstName").value = '';
  document.getElementById("empLastName").value = '';
  document.getElementById("empEmail").value = '';
  document.getElementById("empPhone").value = '';
  document.getElementById("empDepartment").value = '';
  document.getElementById("empPosition").value = '';
  document.getElementById("empHireDate").value = '';
  document.getElementById("empBasicSalary").value = '';
  document.getElementById("empStatus").value = 'ACTIVE';
  document.getElementById("employeeModal").style.display = 'flex';
}

function editEmployee(empId) {
  (async () => {
    try {
      const { data: employee, error } = await supabase
        .from('employees')
        .select('*, salary_structures(*)')
        .eq('id', empId)
        .limit(1);

      if (error) throw error;
      if (!employee || employee.length === 0) return;

      const emp = employee[0];
      const latestSalary = emp.salary_structures && emp.salary_structures.length > 0
        ? emp.salary_structures[0]
        : null;

      employeeEditId = empId;
      document.getElementById("empCode").value = emp.employee_code;
      document.getElementById("empFirstName").value = emp.first_name;
      document.getElementById("empLastName").value = emp.last_name;
      document.getElementById("empEmail").value = emp.email || '';
      document.getElementById("empPhone").value = emp.phone || '';
      document.getElementById("empDepartment").value = emp.department_id || '';
      document.getElementById("empPosition").value = emp.position;
      document.getElementById("empHireDate").value = emp.hire_date;
      document.getElementById("empBasicSalary").value = latestSalary ? latestSalary.basic_salary : '';
      document.getElementById("empStatus").value = emp.status;
      document.getElementById("employeeModal").style.display = 'flex';
    } catch (err) {
      console.error("Edit employee error:", err);
      alert("Failed to load employee details: " + err.message);
    }
  })();
}

function viewEmployee(empId) {
  editEmployee(empId);
}

function saveEmployee() {
  (async () => {
    try {
      const code = document.getElementById("empCode").value.trim();
      const firstName = document.getElementById("empFirstName").value.trim();
      const lastName = document.getElementById("empLastName").value.trim();
      const email = document.getElementById("empEmail").value.trim();
      const phone = document.getElementById("empPhone").value.trim();
      const deptId = document.getElementById("empDepartment").value;
      const position = document.getElementById("empPosition").value.trim();
      const hireDate = document.getElementById("empHireDate").value;
      const basicSalary = parseFloat(document.getElementById("empBasicSalary").value);
      const status = document.getElementById("empStatus").value;

      if (!code || !firstName || !lastName || !position || !hireDate || !basicSalary || !deptId) {
        alert("Please fill in all required fields (marked with *)");
        return;
      }

      if (employeeEditId) {
        // Update existing employee
        const { error: empError } = await supabase
          .from('employees')
          .update({
            employee_code: code,
            first_name: firstName,
            last_name: lastName,
            email: email || null,
            phone: phone || null,
            department_id: deptId,
            position: position,
            hire_date: hireDate,
            status: status
          })
          .eq('id', employeeEditId);

        if (empError) throw empError;

        // Update or create salary structure
        const { data: existingSalaries } = await supabase
          .from('salary_structures')
          .select('id')
          .eq('employee_id', employeeEditId)
          .order('effective_date', { ascending: false })
          .limit(1);

        if (existingSalaries && existingSalaries.length > 0) {
          const { error: salError } = await supabase
            .from('salary_structures')
            .update({ basic_salary: basicSalary })
            .eq('id', existingSalaries[0].id);
          if (salError) throw salError;
        } else {
          const { error: salError } = await supabase
            .from('salary_structures')
            .insert({
              employee_id: employeeEditId,
              basic_salary: basicSalary,
              effective_date: new Date().toISOString().split('T')[0]
            });
          if (salError) throw salError;
        }

        alert("Employee updated successfully");
      } else {
        // Create new employee
        const context = getBranchContext();
        if (!context) {
          alert("No branch context available");
          return;
        }

        console.log(`📝 Creating employee for business_id: ${context.business_id}, branch_id: ${context.branch_id}`);

        const { data: newEmp, error: empError } = await window.supabase
          .from('employees')
          .insert({
            business_id: context.business_id,
            branch_id: context.branch_id,
            employee_code: code,
            first_name: firstName,
            last_name: lastName,
            email: email || null,
            phone: phone || null,
            department_id: deptId,
            position: position,
            hire_date: hireDate,
            status: 'ACTIVE'
          })
          .select()
          .limit(1);

        if (empError) throw empError;

        const empId = newEmp[0].id;

        // Create salary structure
        const { error: salError } = await window.supabase
          .from('salary_structures')
          .insert({
            employee_id: empId,
            basic_salary: basicSalary,
            effective_date: new Date().toISOString().split('T')[0]
          });

        if (salError) throw salError;
        console.log(`✅ Employee created successfully with ID: ${empId}`);
        alert("Employee created successfully");
      }

      document.getElementById("employeeModal").style.display = 'none';
      loadEmployeeList();
    } catch (err) {
      console.error("Save employee error:", err);
      alert("Failed to save employee: " + err.message);
    }
  })();
}

/* =====================================================
   ATTENDANCE MANAGEMENT
===================================================== */
function loadAttendanceData() {
  (async () => {
    try {
      const context = getBranchContext();
      if (!context) return;

      const fromDate = document.getElementById("attendanceFromDate").value;
      const toDate = document.getElementById("attendanceToDate").value;

      if (!fromDate || !toDate) {
        document.getElementById("attendanceTable").innerHTML = '';
        document.getElementById("noAttendanceData").style.display = 'block';
        return;
      }

      console.log(`📡 Loading attendance for business_id: ${context.business_id}, dates: ${fromDate} to ${toDate}`);

      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('id, employee_code, first_name, last_name')
        .eq('business_id', context.business_id)
        .eq('status', 'ACTIVE')
        .order('employee_code', { ascending: true });

      if (empError) throw empError;

      if (!Array.isArray(employees) || employees.length === 0) {
        document.getElementById("noAttendanceData").style.display = 'block';
        return;
      }

      // Get attendance records for the date range
      const { data: attendanceRecords } = await window.supabase
        .from('attendance')
        .select('employee_id, status, hours_worked')
        .gte('attendance_date', fromDate)
        .lte('attendance_date', toDate);

      const attendanceMap = {};
      if (Array.isArray(attendanceRecords)) {
        attendanceRecords.forEach(record => {
          if (!attendanceMap[record.employee_id]) {
            attendanceMap[record.employee_id] = [];
          }
          attendanceMap[record.employee_id].push(record);
        });
      }

      document.getElementById("noAttendanceData").style.display = 'none';
      let html = '';
      employees.forEach(emp => {
        const records = attendanceMap[emp.id] || [];
        const statuses = records.map(r => r.status);
        const mostCommon = statuses.length > 0
          ? statuses.reduce((a, b, i, arr) => arr.filter(v => v === a).length > arr.filter(v => v === b).length ? a : b)
          : 'PRESENT';
        const hours = records.reduce((sum, r) => sum + (r.hours_worked || 8), 0) / Math.max(records.length, 1);

        html += `
          <tr>
            <td><strong>${emp.employee_code}</strong></td>
            <td>${emp.first_name} ${emp.last_name}</td>
            <td>
              <select class="attendance-status" data-emp-id="${emp.id}" value="${mostCommon}">
                <option value="PRESENT">Present</option>
                <option value="ABSENT">Absent</option>
                <option value="LEAVE">Leave</option>
                <option value="SICK">Sick</option>
              </select>
            </td>
            <td><input type="number" class="attendance-hours" data-emp-id="${emp.id}" value="${hours.toFixed(1)}" min="0" max="24"></td>
            <td><input type="text" class="attendance-notes" data-emp-id="${emp.id}" placeholder="Notes..."></td>
            <td><button onclick="saveAttendance(${emp.id})" class="btn-edit">Save</button></td>
          </tr>
        `;
      });

      document.getElementById("attendanceTable").innerHTML = html;
    } catch (err) {
      console.error("Attendance data error:", err);
      alert("Failed to load attendance: " + err.message);
    }
  })();
}

function saveAttendance(empId) {
  (async () => {
    try {
      const context = getBranchContext();
      if (!context) {
        alert("No branch context available");
        return;
      }

      const fromDate = document.getElementById("attendanceFromDate").value;
      const toDate = document.getElementById("attendanceToDate").value;
      const statusEl = document.querySelector(`.attendance-status[data-emp-id="${empId}"]`);
      const hoursEl = document.querySelector(`.attendance-hours[data-emp-id="${empId}"]`);
      const status = statusEl.value;
      const hours = parseFloat(hoursEl.value) || 8;

      // Save attendance for each day in the range
      const currentDate = new Date(fromDate);
      const endDate = new Date(toDate);

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];

        const { error } = await supabase
          .from('attendance')
          .upsert({
            employee_id: empId,
            business_id: context.business_id,
            attendance_date: dateStr,
            status: status,
            hours_worked: hours
          }, { onConflict: 'employee_id,attendance_date' });

        if (error) throw error;
        currentDate.setDate(currentDate.getDate() + 1);
      }

      alert("Attendance saved successfully");
    } catch (err) {
      console.error("Save attendance error:", err);
      alert("Failed to save attendance: " + err.message);
    }
  })();
}

function markAllPresent() {
  document.querySelectorAll('.attendance-status').forEach(el => {
    el.value = 'PRESENT';
  });
}

function markAllAbsent() {
  document.querySelectorAll('.attendance-status').forEach(el => {
    el.value = 'ABSENT';
  });
}

/* =====================================================
   LEAVE MANAGEMENT
===================================================== */
function loadLeaveRequests() {
  (async () => {
    try {
      const context = getBranchContext();
      if (!context) return;

      console.log(`📡 Loading leave requests for business_id: ${context.business_id}`);

      let query = supabase
        .from('leave_requests')
        .select('*, employees(first_name, last_name, business_id), leave_types(name)')
        .order('created_at', { ascending: false });

      const statusFilter = document.getElementById("leaveStatusFilter")?.value;
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data: leaves, error } = await query;

      if (error) throw error;

      if (!Array.isArray(leaves) || leaves.length === 0) {
        document.getElementById("leaveTable").innerHTML = '';
        document.getElementById("noLeaveData").style.display = 'block';
        return;
      }

      document.getElementById("noLeaveData").style.display = 'none';
      let html = '';
      leaves.forEach(leave => {
        const empName = leave.employees ? `${leave.employees.first_name} ${leave.employees.last_name}` : 'N/A';
        const leaveType = leave.leave_types ? leave.leave_types.name : 'N/A';
        const startDate = new Date(leave.start_date).toLocaleDateString('en-ZM');
        const endDate = new Date(leave.end_date).toLocaleDateString('en-ZM');
        const statusClass = `status-${leave.status.toLowerCase()}`;

        let actions = '';
        if (leave.status === 'PENDING') {
          actions = `
            <button class="btn-approve" onclick="approveLeave(${leave.id})">Approve</button>
            <button class="btn-reject" onclick="rejectLeave(${leave.id})">Reject</button>
          `;
        } else {
          actions = `<span class="status-badge ${statusClass}">${leave.status}</span>`;
        }

        html += `
          <tr>
            <td>${empName}</td>
            <td>${leaveType}</td>
            <td>${startDate}</td>
            <td>${endDate}</td>
            <td>${leave.days_requested}</td>
            <td><span class="status-badge ${statusClass}">${leave.status}</span></td>
            <td class="action-buttons">${actions}</td>
          </tr>
        `;
      });

      document.getElementById("leaveTable").innerHTML = html;
    } catch (err) {
      console.error("Leave requests error:", err);
      alert("Failed to load leave requests: " + err.message);
    }
  })();
}

function approveLeave(leaveRequestId) {
  (async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      const { data, error } = await window.supabase.rpc('approve_leave', {
        p_leave_request_id: leaveRequestId,
        p_approved_by: user.id
      });

      if (error) throw error;
      alert("Leave request approved");
      loadLeaveRequests();
    } catch (err) {
      console.error("Approve leave error:", err);
      alert("Failed to approve leave: " + err.message);
    }
  })();
}

function rejectLeave(leaveRequestId) {
  (async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      const { data, error } = await window.supabase.rpc('reject_leave', {
        p_leave_request_id: leaveRequestId,
        p_approved_by: user.id
      });

      if (error) throw error;
      alert("Leave request rejected");
      loadLeaveRequests();
    } catch (err) {
      console.error("Reject leave error:", err);
      alert("Failed to reject leave: " + err.message);
    }
  })();
}

/* =====================================================
   HR ANALYTICS & METRICS
===================================================== */
function loadHRAnalytics() {
  (async () => {
    try {
      // Load all metrics
      loadHeadcountMetrics();
      loadAttendanceMetrics();
      loadTurnoverMetrics();
      loadDepartmentChart();
      loadAttendanceChart();
    } catch (err) {
      console.error("Analytics error:", err);
    }
  })();
}

function loadHeadcountMetrics() {
  (async () => {
    try {
      const context = getBranchContext();
      if (!context) return;

      const { data: allEmp } = await supabase
        .from('employees')
        .select('id, status')
        .eq('business_id', context.business_id);

      const active = allEmp ? allEmp.filter(e => e.status === 'ACTIVE').length : 0;
      const total = allEmp ? allEmp.length : 0;

      // Check today's attendance/leave
      const today = new Date().toISOString().split('T')[0];
      const { data: todayAttendance } = await supabase
        .from('attendance')
        .select('status')
        .eq('business_id', context.business_id)
        .eq('attendance_date', today);

      const onLeave = todayAttendance ? todayAttendance.filter(a => a.status === 'LEAVE').length : 0;
      const absent = todayAttendance ? todayAttendance.filter(a => a.status === 'ABSENT').length : 0;

      document.getElementById("totalHeadcount").innerText = total;
      document.getElementById("activeEmployees").innerText = active;
      document.getElementById("onLeaveToday").innerText = onLeave;
      document.getElementById("absentToday").innerText = absent;
    } catch (err) {
      console.error("Headcount metrics error:", err);
    }
  })();
}

function loadAttendanceMetrics() {
  // Calculated in loadAttendanceChart
}

function loadTurnoverMetrics() {
  (async () => {
    try {
      const context = getBranchContext();
      if (!context) return;

      const currentYear = new Date().getFullYear();
      const { data: terminated } = await supabase
        .from('employees')
        .select('hire_date')
        .eq('business_id', context.business_id)
        .eq('status', 'TERMINATED')
        .gte('termination_date', `${currentYear}-01-01`);

      const { data: allActive } = await supabase
        .from('employees')
        .select('hire_date')
        .eq('business_id', context.business_id)
        .eq('status', 'ACTIVE');

      const terminationCount = terminated ? terminated.length : 0;

      // Calculate average tenure
      let totalMonths = 0;
      let empCount = 0;
      if (allActive) {
        const today = new Date();
        allActive.forEach(emp => {
          const hireDate = new Date(emp.hire_date);
          const months = (today.getFullYear() - hireDate.getFullYear()) * 12 + (today.getMonth() - hireDate.getMonth());
          totalMonths += months;
          empCount++;
        });
      }

      const avgTenure = empCount > 0 ? (totalMonths / empCount).toFixed(1) : 0;

      document.getElementById("terminationsYear").innerText = terminationCount;
      document.getElementById("avgTenure").innerText = avgTenure;
    } catch (err) {
      console.error("Turnover metrics error:", err);
    }
  })();
}

function loadDepartmentChart() {
  (async () => {
    try {
      const context = getBranchContext();
      if (!context) return;

      const { data: employees } = await supabase
        .from('employees')
        .select('departments(name)')
        .eq('business_id', context.business_id)
        .eq('status', 'ACTIVE');

      const deptCounts = {};
      if (Array.isArray(employees)) {
        employees.forEach(emp => {
          const deptName = emp.departments ? emp.departments.name : 'Unassigned';
          deptCounts[deptName] = (deptCounts[deptName] || 0) + 1;
        });
      }

      const labels = Object.keys(deptCounts);
      const data = Object.values(deptCounts);
      const colors = ['#00bcd4', '#7367f0', '#ff9f43', '#28c76f', '#ea5455', '#64a4ff'];

      if (charts.department) charts.department.destroy();

      const ctx = document.getElementById("departmentChart");
      charts.department = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: colors.slice(0, labels.length),
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: 'rgba(255,255,255,0.7)', padding: 15 }
            }
          }
        }
      });
    } catch (err) {
      console.error("Department chart error:", err);
    }
  })();
}

function loadAttendanceChart() {
  (async () => {
    try {
      const context = getBranchContext();
      if (!context) return;

      // Get last 30 days attendance data
      const dates = [];
      const presentCounts = [];

      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dates.push(dateStr.slice(5));

        const { data: attendance } = await window.supabase
          .from('attendance')
          .select('status')
          .eq('business_id', context.business_id)
          .eq('attendance_date', dateStr);

        const present = attendance ? attendance.filter(a => a.status === 'PRESENT').length : 0;
        presentCounts.push(present);
      }

      if (charts.attendance) charts.attendance.destroy();

      const ctx = document.getElementById("attendanceChart");
      charts.attendance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: dates,
          datasets: [{
            label: 'Present',
            data: presentCounts,
            borderColor: '#28c76f',
            backgroundColor: 'rgba(40,199,111,0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { color: 'rgba(255,255,255,0.7)' },
              grid: { color: 'rgba(255,255,255,0.05)' }
            },
            x: {
              ticks: { color: 'rgba(255,255,255,0.7)' },
              grid: { color: 'rgba(255,255,255,0.05)' }
            }
          }
        }
      });
    } catch (err) {
      console.error("Attendance chart error:", err);
    }
  })();
}

/* Cleanup on page unload */
window.addEventListener('beforeunload', () => {
  Object.values(charts).forEach(chart => {
    if (chart) chart.destroy();
  });
});
