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
  // The attendance tab is now a single-day board rather than a range, so it
  // has one #attendanceDate input. Guarded because this also runs on pages
  // where the element may not exist.
  const dateEl = document.getElementById("attendanceDate");
  if (dateEl) dateEl.valueAsDate = today;
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

      console.log(`📡 Loading employees for branch_id: ${context.branch_id}`);

      const { data: employees, error } = await window.supabase.rpc('get_business_employees', {
        p_branch_id: context.branch_id
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
        const deptName = emp.department_id ? `Dept #${emp.department_id}` : 'N/A';
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
              <button class="btn-view" onclick="viewEmployee(${emp.employee_id})">View</button>
              <button class="btn-edit" onclick="editEmployee(${emp.employee_id})">Edit</button>
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
  return new Promise((resolve) => {
    (async () => {
      try {
        const context = getBranchContext();
        if (!context) {
          console.warn("⚠️ No context for departments");
          resolve();
          return;
        }

        console.log(`📡 Loading departments for branch_id: ${context.branch_id}`);

        const { data: departments, error } = await window.supabase.rpc('get_business_departments', {
          p_branch_id: context.branch_id
        });

        if (error) {
          console.error("❌ Department RPC Error:", error);
          resolve();
          return;
        }

        if (Array.isArray(departments) && departments.length > 0) {
          let html = '<option value="">Select Department</option>';
          departments.forEach(dept => {
            html += `<option value="${dept.department_id}">${dept.name}</option>`;
          });
          document.getElementById("empDepartment").innerHTML = html;
          console.log(`✅ Loaded ${departments.length} departments`);
        } else {
          console.warn("⚠️ No departments found");
        }
        resolve();
      } catch (err) {
        console.error("❌ Department load error:", err);
        resolve();
      }
    })();
  });
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
      // Ensure departments are loaded first
      await loadDepartments();

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

/* "View" opens the full personnel file (performance, disciplinary, training,
   history, documents). "Edit" still opens the edit form - previously View just
   did the same thing as Edit, so there was nowhere to actually see an
   employee's record. */
function viewEmployee(empId) {
  openEmployeeProfile(empId);
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

        // NOTE: employees.business_id is NOT NULL in the live database (verified
        // via information_schema), even though supabase-schema-hr.sql omits it.
        // branch_id is what all scoping/queries filter on, but both are required.
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

      const dateEl = document.getElementById('attendanceDate');
      const theDate = dateEl && dateEl.value ? dateEl.value : new Date().toISOString().split('T')[0];
      if (dateEl && !dateEl.value) dateEl.value = theDate;

      // get_daily_attendance returns EVERY active employee for the branch, not
      // just those with a row - so people who never clocked in show up as
      // NOT_CLOCKED_IN rather than being silently absent from the list. It's
      // also branch-scoped server-side; the previous query read the attendance
      // table with no branch filter at all, which leaked across tenants.
      const { data, error } = await window.supabase.rpc('get_daily_attendance', {
        p_branch_id: context.branch_id,
        p_date: theDate
      });

      if (error) throw error;

      const tbody = document.getElementById('attendanceTable');
      const empty = document.getElementById('noAttendanceData');

      if (!Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
      }

      empty.style.display = 'none';
      tbody.innerHTML = data.map(r => {
        const statusClass = 'status-' + String(r.status || '').toLowerCase().replace(/_/g, '-');
        return [
          '<tr>',
          '<td><strong>' + esc(r.employee_code) + '</strong></td>',
          '<td>' + esc(r.full_name) + '</td>',
          '<td>' + esc(r.department) + '</td>',
          '<td><span class="status-badge ' + statusClass + '">' + esc(formatAttendanceStatus(r.status)) + '</span></td>',
          '<td>' + formatClockTime(r.clock_in) + '</td>',
          '<td>' + formatClockTime(r.clock_out) + '</td>',
          '<td>' + (r.hours_worked != null ? Number(r.hours_worked).toFixed(2) : '-') + '</td>',
          '<td class="action-buttons">',
          '<button class="btn-edit" onclick="amendAttendance(' + r.employee_id + ', \'' + theDate + '\')">Amend</button>',
          '<button class="btn-view" onclick="sendTaskToEmployee(' + r.employee_id + ')">Send task</button>',
          '</td>',
          '</tr>'
        ].join('');
      }).join('');
    } catch (err) {
      console.error('Attendance load error:', err);
      alert('Failed to load attendance: ' + err.message);
    }
  })();
}

function esc(v) {
  const d = document.createElement('div');
  d.textContent = v == null ? '' : String(v);
  return d.innerHTML;
}

function formatClockTime(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleTimeString('en-ZM', { hour: '2-digit', minute: '2-digit' });
}

function formatAttendanceStatus(s) {
  if (!s) return '-';
  return String(s).replace(/_/g, ' ');
}

/* HR amends someone's day - the "or amend if employee is sick or absent"
   half of your workflow. */
function amendAttendance(employeeId, theDate) {
  const status = prompt('Set status (PRESENT, ABSENT, LEAVE, SICK, LATE, HALF_DAY):');
  if (!status) return;
  const notes = prompt('Note (optional):') || null;

  (async () => {
    try {
      const context = getBranchContext();
      const { data, error } = await window.supabase.rpc('set_attendance_status', {
        p_branch_id: context.branch_id,
        p_employee_id: employeeId,
        p_date: theDate,
        p_status: status.trim().toUpperCase(),
        p_notes: notes
      });
      if (error) throw error;
      const res = data[0];
      alert((res.success ? '' : 'Could not amend: ') + res.message);
      if (res.success) loadAttendanceData();
    } catch (err) {
      console.error('Amend attendance error:', err);
      alert('Failed to amend: ' + err.message);
    }
  })();
}

/* Sends a task into the employee's in-tray on their landing page - the
   "send the task to the employee's in tray" half of the workflow. */
function sendTaskToEmployee(employeeId) {
  const title = prompt('Task title:');
  if (!title) return;
  const description = prompt('Details (optional):') || null;
  const dueDate = prompt('Due date (YYYY-MM-DD, optional):') || null;

  (async () => {
    try {
      const context = getBranchContext();
      const { data, error } = await window.supabase.rpc('send_task_to_employee', {
        p_branch_id: context.branch_id,
        p_employee_id: employeeId,
        p_title: title,
        p_description: description,
        p_due_date: dueDate || null,
        p_priority: 'NORMAL',
        p_assigned_by: getAuthUUID()
      });
      if (error) throw error;
      const res = data[0];
      alert((res.success ? '' : 'Not sent: ') + res.message);
    } catch (err) {
      console.error('Send task error:', err);
      alert('Failed to send task: ' + err.message);
    }
  })();
}

/* Notifies HR and the employee's department manager about anyone who hasn't
   clocked in and hasn't already been excused. Idempotent per employee/day. */
function checkMissedClockIns() {
  (async () => {
    try {
      const context = getBranchContext();
      const dateEl = document.getElementById('attendanceDate');
      const theDate = dateEl && dateEl.value ? dateEl.value : new Date().toISOString().split('T')[0];

      const { data, error } = await window.supabase.rpc('raise_missed_clockin_alerts', {
        p_branch_id: context.branch_id,
        p_date: theDate
      });
      if (error) throw error;
      alert(data[0].message);
    } catch (err) {
      console.error('Missed clock-in check error:', err);
      alert('Failed to run check: ' + err.message);
    }
  })();
}


/* =====================================================
   LEAVE MANAGEMENT
===================================================== */
function loadLeaveRequests() {
  (async () => {
    try {
      const context = getBranchContext();
      if (!context) return;

      console.log(`📡 Loading leave requests for branch_id: ${context.branch_id}`);

      let query = supabase
        .from('leave_requests')
        .select('*, employees(first_name, last_name), leave_types(name)')
        .eq('branch_id', context.branch_id)
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
      const context = getBranchContext();
      if (!context) {
        alert('Branch context not available');
        return;
      }
      const { data, error } = await window.supabase.rpc('approve_leave', {
        p_leave_request_id: leaveRequestId,
        p_branch_id: context.branch_id,
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
      const context = getBranchContext();
      if (!context) {
        alert('Branch context not available');
        return;
      }
      const { data, error } = await window.supabase.rpc('reject_leave', {
        p_leave_request_id: leaveRequestId,
        p_branch_id: context.branch_id,
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
        .eq('branch_id', context.branch_id);

      const active = allEmp ? allEmp.filter(e => e.status === 'ACTIVE').length : 0;
      const total = allEmp ? allEmp.length : 0;

      // Check today's attendance/leave
      const today = new Date().toISOString().split('T')[0];
      const { data: todayAttendance } = await supabase
        .from('attendance')
        .select('status')
        .eq('branch_id', context.branch_id)
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
        .eq('branch_id', context.branch_id)
        .eq('status', 'TERMINATED')
        .gte('termination_date', `${currentYear}-01-01`);

      const { data: allActive } = await supabase
        .from('employees')
        .select('hire_date')
        .eq('branch_id', context.branch_id)
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
        .eq('branch_id', context.branch_id)
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
          .eq('branch_id', context.branch_id)
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
