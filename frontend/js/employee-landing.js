// ============================================================================
// ZAI FLOW 2.0 - EMPLOYEE LANDING PAGE DASHBOARD
// Clock in/out, task management, notifications, role-based module access
// ============================================================================

let context;
let clockUpdateInterval;
let dataRefreshInterval;

// Use window.supabase - already declared by supabase-init.js
// Don't declare it again to avoid conflicts

// ============================================================================
// MODAL FUNCTIONS - Global scope so onclick handlers can access them
// ============================================================================

function showClockInModal() {
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  document.getElementById('clock-in-time').value = timeString;
  document.getElementById('clock-in-notes').value = '';
  document.getElementById('clock-in-modal').classList.add('active');
}

function closeClockInModal() {
  document.getElementById('clock-in-modal').classList.remove('active');
}

// Last values seen from get_attendance_status. The clock-out modal needs to
// know how long the shift has run, and what counts as a full day, to decide
// whether to ask for an early-out reason. min_hours comes from the server
// (zf_min_shift_hours) so the prompt and the enforcement can't drift apart.
let currentElapsedMinutes = 0;
let minShiftHours = 8;

function showClockOutModal() {
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  document.getElementById('clock-out-time').value = timeString;
  document.getElementById('clock-out-notes').value = '';

  document.getElementById('lunch-taken').value = '';
  document.getElementById('lunch-minutes').value = '';
  document.getElementById('no-lunch-reason').value = '';
  document.getElementById('early-out-reason').value = '';
  document.getElementById('lunch-minutes-group').style.display = 'none';
  document.getElementById('no-lunch-reason-group').style.display = 'none';

  const hoursSoFar = currentElapsedMinutes / 60;
  const isEarly = hoursSoFar < minShiftHours;
  document.getElementById('early-out-group').style.display = isEarly ? 'block' : 'none';
  if (isEarly) {
    document.getElementById('early-out-label').textContent =
      `You have worked ${hoursSoFar.toFixed(2)}h of a ${minShiftHours}h day. Why are you clocking out early? *`;
  }

  document.getElementById('clock-out-modal').classList.add('active');
}

function onLunchTakenChange() {
  const value = document.getElementById('lunch-taken').value;
  document.getElementById('lunch-minutes-group').style.display = value === 'yes' ? 'block' : 'none';
  document.getElementById('no-lunch-reason-group').style.display = value === 'no' ? 'block' : 'none';
}

function closeClockOutModal() {
  document.getElementById('clock-out-modal').classList.remove('active');
}

async function performClockIn() {
  const notes = document.getElementById('clock-in-notes').value;
  if (!window.supabase || !context) {
    alert('System not initialized. Please refresh the page.');
    return;
  }

  try {
    const authUUID = getAuthUUID();
    if (!authUUID) {
      alert('User authentication not found. Please refresh the page.');
      return;
    }

    const { data, error } = await window.supabase.rpc('clock_in', {
      p_user_id: authUUID,
      p_business_id: context.business_id,
      p_notes: notes || null
    });

    if (error) throw error;
    const result = data[0];
    if (result.success) {
      alert('' + result.message);
      closeClockInModal();
      loadAttendanceStatus();
    } else {
      alert('' + result.message);
    }
  } catch (err) {
    console.error('Clock in error:', err);
    alert('Failed to clock in: ' + err.message);
  }
}

async function performClockOut() {
  const notes = document.getElementById('clock-out-notes').value;
  if (!window.supabase || !context) {
    alert('System not initialized. Please refresh the page.');
    return;
  }

  // Checked here for a quick, field-specific message; clock_out() enforces the
  // same rules server-side so calling the RPC directly can't skip them.
  const lunchChoice = document.getElementById('lunch-taken').value;
  if (!lunchChoice) {
    alert('Please say whether you took a lunch break.');
    return;
  }

  const lunchTaken = lunchChoice === 'yes';
  const lunchMinutes = parseInt(document.getElementById('lunch-minutes').value, 10);
  const noLunchReason = document.getElementById('no-lunch-reason').value.trim();
  const earlyReason = document.getElementById('early-out-reason').value.trim();

  if (lunchTaken && !(lunchMinutes > 0)) {
    alert('Please enter how many minutes your lunch break lasted.');
    return;
  }
  if (!lunchTaken && !noLunchReason) {
    alert('Please give a reason for not taking a lunch break.');
    return;
  }

  const isEarly = (currentElapsedMinutes / 60) < minShiftHours;
  if (isEarly && !earlyReason) {
    alert('Please give a reason for clocking out early.');
    return;
  }

  try {
    const authUUID = getAuthUUID();
    if (!authUUID) {
      alert('User authentication not found. Please refresh the page.');
      return;
    }

    const { data, error } = await window.supabase.rpc('clock_out', {
      p_user_id: authUUID,
      p_business_id: context.business_id,
      p_notes: notes || null,
      p_lunch_taken: lunchTaken,
      p_lunch_minutes: lunchTaken ? lunchMinutes : null,
      p_no_lunch_reason: lunchTaken ? null : noLunchReason,
      p_early_reason: isEarly ? earlyReason : null
    });

    if (error) throw error;
    const result = data[0];
    if (result.success) {
      alert(`${result.message}\nHours worked: ${result.hours_worked}`);
      closeClockOutModal();
      loadAttendanceStatus();
    } else {
      alert('' + result.message);
    }
  } catch (err) {
    console.error('Clock out error:', err);
    alert('Failed to clock out: ' + err.message);
  }
}

function showCreateTaskModal() {
  document.getElementById('task-title').value = '';
  document.getElementById('task-description').value = '';
  document.getElementById('task-due-date').value = '';
  document.getElementById('task-priority').value = 'NORMAL';
  document.getElementById('create-task-modal').classList.add('active');
}

function closeCreateTaskModal() {
  document.getElementById('create-task-modal').classList.remove('active');
}

async function performCreateTask() {
  const title = document.getElementById('task-title').value.trim();
  const description = document.getElementById('task-description').value.trim();
  const dueDate = document.getElementById('task-due-date').value;
  const priority = document.getElementById('task-priority').value;

  if (!title) {
    alert('Please enter a task title');
    return;
  }

  if (!window.supabase || !context) {
    alert('System not initialized. Please refresh the page.');
    return;
  }

  try {
    const authUUID = getAuthUUID();
    if (!authUUID) {
      alert('User authentication not found. Please refresh the page.');
      return;
    }

    const { data, error } = await window.supabase.rpc('create_task', {
      p_user_id: authUUID,
      p_business_id: context.business_id,
      p_title: title,
      p_description: description || null,
      p_due_date: dueDate || null,
      p_priority: priority,
      p_assigned_to: authUUID
    });

    if (error) throw error;
    const result = data[0];
    if (result.success) {
      alert('' + result.message);
      closeCreateTaskModal();
      loadUserTasks();
    } else {
      alert('Failed to create task');
    }
  } catch (err) {
    console.error('Create task error:', err);
    alert('Failed to create task: ' + err.message);
  }
}

function switchTaskTab(tabName) {
  // Hide all tab content divs and remove active class
  document.getElementById('task-tab-todo').style.display = 'none';
  document.getElementById('task-tab-in-progress').style.display = 'none';
  document.getElementById('task-tab-completed').style.display = 'none';

  // Remove active class from all tab buttons
  document.querySelectorAll('.task-tabs .tab-button').forEach(btn => {
    btn.classList.remove('active');
    btn.style.color = '#94a3b8';
    btn.style.fontWeight = '500';
    btn.style.borderBottomColor = 'transparent';
  });

  // Show selected tab content
  document.getElementById(`task-tab-${tabName}`).style.display = 'block';

  // Highlight clicked tab button
  if (event && event.target) {
    event.target.classList.add('active');
    event.target.style.color = '#3b82f6';
    event.target.style.fontWeight = '600';
    event.target.style.borderBottomColor = '#3b82f6';
  }
}

async function updateTaskStatus(taskId, newStatus) {
  if (!window.supabase) {
    alert('System not initialized. Please refresh the page.');
    return;
  }

  try {
    const { data, error } = await window.supabase.rpc('update_task_status', {
      p_task_id: taskId,
      p_status: newStatus
    });

    if (error) throw error;
    const result = data[0];
    if (result.success) {
      loadUserTasks();
    } else {
      alert('' + result.message);
    }
  } catch (err) {
    console.error('Update task error:', err);
    alert('Failed to update task: ' + err.message);
  }
}

async function deleteTask(taskId) {
  if (!confirm('Are you sure you want to delete this task?')) return;
  if (!window.supabase) {
    alert('System not initialized. Please refresh the page.');
    return;
  }

  try {
    const { data, error } = await window.supabase.rpc('update_task_status', {
      p_task_id: taskId,
      p_status: 'CANCELLED'
    });

    if (error) throw error;
    loadUserTasks();
  } catch (err) {
    console.error('Delete task error:', err);
    alert('Failed to delete task: ' + err.message);
  }
}

async function markNotificationRead(notificationId) {
  if (!window.supabase) {
    alert('System not initialized. Please refresh the page.');
    return;
  }

  try {
    const { data, error } = await window.supabase.rpc('mark_notification_read', {
      p_notification_id: notificationId
    });

    if (error) throw error;
    loadNotifications();
  } catch (err) {
    console.error('Mark notification read error:', err);
  }
}

async function markAllNotificationsRead() {
  if (!window.supabase || !context) {
    alert('System not initialized. Please refresh the page.');
    return;
  }

  try {
    const authUUID = getAuthUUID();
    if (!authUUID) {
      alert('User authentication not found. Please refresh the page.');
      return;
    }

    const { data: notifications, error: getError } = await window.supabase.rpc('get_unread_notifications', {
      p_user_id: authUUID,
      p_business_id: context.business_id
    });

    if (getError) throw getError;
    if (!notifications || notifications.length === 0) {
      alert('No unread notifications');
      return;
    }

    for (const notif of notifications) {
      const { error: markError } = await window.supabase.rpc('mark_notification_read', {
        p_notification_id: notif.notification_id
      });
      if (markError) {
        console.error('Error marking notification read:', markError);
      }
    }

    loadNotifications();
  } catch (err) {
    console.error('Mark all read error:', err);
  }
}

function logout() {
  if (confirm('Are you sure you want to logout?')) {
    if (clockUpdateInterval) clearInterval(clockUpdateInterval);
    if (dataRefreshInterval) clearInterval(dataRefreshInterval);
    localStorage.removeItem('user');
    localStorage.removeItem('session');
    localStorage.removeItem('branch_context');
    window.location.href = 'login.html';
  }
}

// ============================================================================
// LOAD FUNCTIONS - Can be called from DOMContentLoaded
// ============================================================================

function updateWelcomeSection() {
  if (!context) return;
  const firstName = context.user_name ? context.user_name.split(' ')[0] : 'User';
  document.getElementById('user-name').textContent = firstName;
  document.getElementById('business-name').textContent = `Working at: ${context.business_name || 'N/A'}`;
  document.getElementById('user-role').textContent = context.user_role || 'Employee';
}

async function loadAttendanceStatus() {
  if (!window.supabase || !context) return;

  const authUUID = getAuthUUID();
  if (!authUUID) return;

  try {
    const { data, error } = await window.supabase.rpc('get_attendance_status', {
      p_user_id: authUUID,
      p_business_id: context.business_id
    });

    if (error) throw error;

    if (data && data.length > 0) {
      const attendance = data[0];
      const isClockedIn = attendance.is_clocked_in;
      const elapsedMinutes = attendance.elapsed_minutes;

      currentElapsedMinutes = elapsedMinutes || 0;
      if (attendance.min_hours != null) minShiftHours = Number(attendance.min_hours);

      const clockInBtn = document.getElementById('clock-in-btn');
      const clockOutBtn = document.getElementById('clock-out-btn');
      const statusBadge = document.getElementById('clock-status');
      const elapsedDisplay = document.getElementById('elapsed-time-display');
      const attendanceStatus = document.getElementById('attendance-status');

      if (isClockedIn) {
        clockInBtn.style.display = 'none';
        clockOutBtn.style.display = 'inline-block';
        statusBadge.textContent = 'Clocked In';
        statusBadge.className = 'status-badge clocked-in';
        attendanceStatus.textContent = 'Online';
        const hours = Math.floor(elapsedMinutes / 60);
        const minutes = elapsedMinutes % 60;
        elapsedDisplay.textContent = `Elapsed: ${hours}h ${minutes}m`;
      } else {
        clockInBtn.style.display = 'inline-block';
        clockOutBtn.style.display = 'none';
        statusBadge.textContent = 'Offline';
        statusBadge.className = 'status-badge clocked-out';
        attendanceStatus.textContent = 'Offline';
        elapsedDisplay.textContent = 'Not clocked in';
      }
    }
  } catch (err) {
    console.error('Load attendance error:', err);
  }
}

async function loadUserTasks() {
  if (!window.supabase || !context) return;

  const authUUID = getAuthUUID();
  if (!authUUID) return;

  try {
    const { data, error } = await window.supabase.rpc('get_user_tasks', {
      p_user_id: authUUID,
      p_business_id: context.business_id,
      p_status: null
    });

    if (error) throw error;

    if (!data || data.length === 0) {
      displayEmptyTasks();
      document.getElementById('task-count').textContent = '0';
      return;
    }

    const tasksByStatus = { 'TODO': [], 'IN_PROGRESS': [], 'COMPLETED': [], 'CANCELLED': [] };
    data.forEach(task => {
      if (tasksByStatus[task.status]) {
        tasksByStatus[task.status].push(task);
      }
    });

    const today = new Date().toISOString().split('T')[0];
    const dueTodayCount = data.filter(task => task.due_date === today && task.status !== 'COMPLETED').length;
    document.getElementById('task-count').textContent = dueTodayCount;

    renderTasksByStatus('todo', tasksByStatus['TODO']);
    renderTasksByStatus('in-progress', tasksByStatus['IN_PROGRESS']);
    renderTasksByStatus('completed', tasksByStatus['COMPLETED']);
  } catch (err) {
    console.error('Load tasks error:', err);
    displayEmptyTasks();
  }
}

function displayEmptyTasks() {
  const todoContainer = document.getElementById('task-list-todo');
  const inProgressContainer = document.getElementById('task-list-in-progress');
  const completedContainer = document.getElementById('task-list-completed');
  todoContainer.innerHTML = '<div class="empty-state"><p>No tasks yet! </p></div>';
  inProgressContainer.innerHTML = '<div class="empty-state"><p>No tasks in progress</p></div>';
  completedContainer.innerHTML = '<div class="empty-state"><p>No completed tasks yet</p></div>';
}

function renderTasksByStatus(tabSuffix, tasks) {
  const container = document.getElementById(`task-list-${tabSuffix}`);
  if (!tasks || tasks.length === 0) {
    const emoji = tabSuffix === 'todo' ? '' : (tabSuffix === 'in-progress' ? '⏳' : '');
    container.innerHTML = `<div class="empty-state"><p>No tasks ${emoji}</p></div>`;
    return;
  }

  container.innerHTML = tasks.map(task => {
    const dueDateObj = task.due_date ? new Date(task.due_date) : null;
    const dueDateStr = dueDateObj ? dueDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No due date';
    const isOverdue = dueDateObj && dueDateObj < new Date() && task.status !== 'COMPLETED';
    return `
      <div class="task-item ${task.priority.toLowerCase()}">
        <div class="task-header">
          <div class="task-title">${escapeHtml(task.title)}</div>
          <span class="task-priority ${task.priority}">${task.priority}</span>
        </div>
        ${task.description ? `<div style="color: #666; font-size: 13px; margin: 8px 0;">${escapeHtml(task.description)}</div>` : ''}
        <div class="task-meta">
          ${isOverdue ? '<span style="color: #dc3545; font-weight: bold;">OVERDUE</span> • ' : ''}
          Due: ${dueDateStr} • Created: ${new Date(task.created_at).toLocaleDateString()}
        </div>
        <div style="margin-top: 10px; display: flex; gap: 8px;">
          ${task.status !== 'COMPLETED' ? `<button class="btn btn-success" onclick="updateTaskStatus(${task.task_id}, 'COMPLETED')" style="font-size: 12px; padding: 6px 10px;">Complete</button>` : ''}
          ${task.status === 'TODO' ? `<button class="btn btn-primary" onclick="updateTaskStatus(${task.task_id}, 'IN_PROGRESS')" style="font-size: 12px; padding: 6px 10px;">▶ Start</button>` : ''}
          <button class="btn btn-secondary" onclick="deleteTask(${task.task_id})" style="font-size: 12px; padding: 6px 10px;">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

async function loadNotifications() {
  if (!window.supabase || !context) return;

  const authUUID = getAuthUUID();
  if (!authUUID) return;

  try {
    const { data, error } = await window.supabase.rpc('get_unread_notifications', {
      p_user_id: authUUID,
      p_business_id: context.business_id
    });

    if (error) throw error;
    document.getElementById('notification-count').textContent = (data && data.length) || 0;

    if (!data || data.length === 0) {
      document.getElementById('notification-list').innerHTML = `<div class="empty-state"><p>No notifications yet </p></div>`;
      return;
    }

    const notificationHtml = data.map(notif => {
      const createdDate = new Date(notif.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      return `
        <div class="notification-item ${notif.type}">
          <div class="notification-content">
            <div class="notification-title">${escapeHtml(notif.title)}</div>
            <div class="notification-message">${escapeHtml(notif.message || '')}</div>
            <div style="font-size: 11px; color: #999; margin-top: 5px;">${createdDate}</div>
          </div>
          <button class="notification-close" onclick="markNotificationRead(${notif.notification_id})">×</button>
        </div>
      `;
    }).join('');
    document.getElementById('notification-list').innerHTML = notificationHtml;
  } catch (err) {
    console.error('Load notifications error:', err);
  }
}

async function loadUserAccessibleModules() {
  const currentContext = getBranchContext();
  if (!window.supabase || !currentContext) return;

  const authUUID = getAuthUUID();
  if (!authUUID) return;

  try {
    const { data, error } = await window.supabase.rpc('get_user_accessible_modules', {
      p_user_id: authUUID,
      p_business_id: currentContext.business_id
    });

    if (error) throw error;
    document.getElementById('module-count').textContent = (data && data.length) || 0;

    // Must cover every module get_user_accessible_modules can return, or the
    // fallback below renders the raw key as the label ("approvals") pointing at
    // a dead "#" link. Keep in step with MODULES in sidebar-manager.js.
    const moduleInfo = {
      'dashboard': { name: 'Dashboard', url: 'dashboard.html' },
      'sales': { name: 'Sales', url: 'sales.html' },
      'inventory': { name: 'Inventory', url: 'inventory.html' },
      'accounting': { name: 'Accounting', url: 'accounting.html' },
      'approvals': { name: 'Approvals', url: 'approvals.html' },
      'hr_payroll': { name: 'HR & Payroll', url: 'hr.html' },
      'purchasing': { name: 'Purchasing', url: 'purchasing.html' },
      'bi': { name: 'BI Dashboard', url: 'bi.html' }
    };

    let html = '';

    // Add Admin Dashboard link for admin users (show even if no other modules)
    if (currentContext && currentContext.user_role === 'admin') {
      html += `
        <a href="admin-business.html" class="module-link" title="Admin Business">Admin Business</a>
      `;
    }

    // Add regular module links
    if (!data || data.length === 0) {
      // If no modules but is admin, show admin link only
      if (html) {
        document.getElementById('quick-links-container').innerHTML = html;
      } else {
        // Not admin and no modules
        document.getElementById('quick-links-container').innerHTML = `
          <div class="empty-state" style="grid-column: 1/-1;">
            <div class="empty-state-icon"></div>
            <p>No modules accessible yet. Contact your admin.</p>
          </div>
        `;
      }
      return;
    }

    const moduleMap = {};
    data.forEach(func => {
      if (!moduleMap[func.module]) {
        moduleMap[func.module] = { module: func.module, functions: [] };
      }
      moduleMap[func.module].functions.push(func);
    });

    Object.keys(moduleMap).forEach(moduleName => {
      const info = moduleInfo[moduleName] || { name: moduleName, icon: '', url: '#' };
      html += `
        <a href="${info.url}" class="module-link" title="${info.name}">${info.name}</a>
      `;
    });

    document.getElementById('quick-links-container').innerHTML = html;
  } catch (err) {
    console.error('Load modules error:', err);
  }
}

function startClockDisplay() {
  updateClockDisplay();
  clockUpdateInterval = setInterval(updateClockDisplay, 1000);
}

function updateClockDisplay() {
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  const timeElement = document.getElementById('current-time');
  if (timeElement) {
    timeElement.textContent = timeString;
  }
}

function startDataRefresh() {
  dataRefreshInterval = setInterval(() => {
    loadAttendanceStatus();
    loadUserTasks();
    loadNotifications();
  }, 30000);
}

function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// ============================================================================
// LEAVE
// ============================================================================

// Balances keyed by leave_type_id, so the modal can show what a request would
// leave without another round trip.
let leaveBalances = [];

async function loadLeaveData() {
  if (!window.supabase || !context) return;
  const authUUID = getAuthUUID();
  if (!authUUID) return;

  try {
    const [balanceRes, requestRes] = await Promise.all([
      window.supabase.rpc('get_my_leave_balance', {
        p_user_id: authUUID,
        p_business_id: context.business_id
      }),
      window.supabase.rpc('get_my_leave_requests', {
        p_user_id: authUUID,
        p_business_id: context.business_id
      })
    ]);

    if (balanceRes.error) throw balanceRes.error;
    if (requestRes.error) throw requestRes.error;

    leaveBalances = balanceRes.data || [];
    renderLeaveBalances(leaveBalances);
    renderMyLeaveRequests(requestRes.data || []);
  } catch (err) {
    console.error('Load leave error:', err);
    if (isMissingFunctionError(err)) {
      document.getElementById('leave-balance-list').innerHTML =
        '<div class="empty-state"><p>Leave is not enabled yet - run ADD_LEAVE_TYPES_AND_BALANCES.sql.</p></div>';
    }
  }
}

function renderLeaveBalances(rows) {
  const el = document.getElementById('leave-balance-list');

  // Unpaid leave has no entitlement to report a balance against, so showing it
  // here as "0 of 0 left" would read as an error rather than as uncapped.
  const withEntitlement = rows.filter(r => Number(r.days_entitled) > 0);

  if (!withEntitlement.length) {
    el.innerHTML = '<div class="empty-state"><p>No leave entitlement on record</p></div>';
    return;
  }

  el.innerHTML = withEntitlement.map(r => {
    const remaining = Number(r.days_remaining);
    const colour = remaining <= 0 ? '#ea5455' : remaining <= 3 ? '#ff9f43' : 'var(--zf-text)';
    const pending = Number(r.days_pending) > 0
      ? ` <span style="color:#ff9f43;">(${Number(r.days_pending)} pending)</span>`
      : '';
    return `
      <div style="display:flex; justify-content:space-between; align-items:baseline; padding:8px 0; border-bottom:1px solid var(--zf-border-soft);">
        <span style="font-size:13px; color:var(--zf-text-muted);">${escapeHtml(r.leave_type)}</span>
        <span style="font-size:13px; font-weight:600; color:${colour};">
          ${remaining} of ${Number(r.days_entitled)} left${pending}
        </span>
      </div>`;
  }).join('');
}

function renderMyLeaveRequests(rows) {
  const el = document.getElementById('my-leave-list');
  if (!rows.length) {
    el.innerHTML = '<div class="empty-state"><p>No leave requests yet</p></div>';
    return;
  }

  const colours = { APPROVED: '#28c76f', REJECTED: '#ea5455', CANCELLED: 'rgba(255,255,255,0.4)' };

  el.innerHTML = rows.map(r => {
    const colour = colours[r.status] || '#ff9f43';
    // A rejection without its reason just leaves the employee guessing.
    const reason = r.rejection_reason
      ? `<div style="font-size:11px; color:rgba(255,255,255,0.6); margin-top:4px;">Reason: ${escapeHtml(r.rejection_reason)}</div>`
      : '';
    return `
      <div style="padding:10px 0; border-bottom:1px solid var(--zf-border-soft);">
        <div style="display:flex; justify-content:space-between; align-items:baseline;">
          <span style="font-size:13px;">${escapeHtml(r.leave_type)} - ${r.days_requested} day(s)</span>
          <span style="font-size:11px; font-weight:600; color:${colour};">${escapeHtml(r.status)}</span>
        </div>
        <div style="font-size:11px; color:var(--zf-text-muted); margin-top:2px;">
          ${new Date(r.start_date).toLocaleDateString('en-ZM')} to ${new Date(r.end_date).toLocaleDateString('en-ZM')}
        </div>
        ${reason}
      </div>`;
  }).join('');
}

function showLeaveModal() {
  const select = document.getElementById('leave-type');
  select.innerHTML = '<option value="">Select...</option>' +
    leaveBalances.map(r => {
      // Unpaid leave is uncapped, so a remaining count would be meaningless.
      const suffix = Number(r.days_entitled) > 0 ? ` (${Number(r.days_remaining)} left)` : '';
      return `<option value="${r.leave_type_id}">${escapeHtml(r.leave_type)}${suffix}</option>`;
    }).join('');

  document.getElementById('leave-start').value = '';
  document.getElementById('leave-end').value = '';
  document.getElementById('leave-notes').value = '';
  document.getElementById('leave-days-note').style.display = 'none';
  document.getElementById('leave-modal').classList.add('active');
}

function closeLeaveModal() {
  document.getElementById('leave-modal').classList.remove('active');
}

function updateLeaveDaysNote() {
  const note = document.getElementById('leave-days-note');
  const typeId = document.getElementById('leave-type').value;
  const start = document.getElementById('leave-start').value;
  const end = document.getElementById('leave-end').value;

  if (!typeId || !start || !end) {
    note.style.display = 'none';
    return;
  }

  const startDate = new Date(start);
  const endDate = new Date(end);
  if (endDate < startDate) {
    note.style.display = 'block';
    note.style.background = 'rgba(234,84,85,0.15)';
    note.style.color = '#ea5455';
    note.textContent = 'The end date cannot be before the start date.';
    return;
  }

  // Calendar days inclusive - matches how request_leave_for_user counts them.
  const days = Math.round((endDate - startDate) / 86400000) + 1;
  const balance = leaveBalances.find(r => String(r.leave_type_id) === String(typeId));
  const entitled = balance ? Number(balance.days_entitled) : 0;
  const remaining = balance ? Number(balance.days_remaining) : 0;

  note.style.display = 'block';
  if (entitled > 0 && days > remaining) {
    note.style.background = 'rgba(234,84,85,0.15)';
    note.style.color = '#ea5455';
    note.textContent = `${days} day(s) requested, but only ${remaining} day(s) remaining.`;
  } else {
    note.style.background = 'rgba(255,255,255,0.05)';
    note.style.color = 'var(--zf-text-muted)';
    note.textContent = entitled > 0
      ? `${days} day(s) requested. ${remaining - days} day(s) would remain.`
      : `${days} day(s) requested (uncapped).`;
  }
}

async function submitLeaveRequest() {
  const typeId = document.getElementById('leave-type').value;
  const start = document.getElementById('leave-start').value;
  const end = document.getElementById('leave-end').value;
  const notes = document.getElementById('leave-notes').value.trim();

  if (!typeId) return alert('Please choose a leave type.');
  if (!start || !end) return alert('Please choose both a start and an end date.');

  try {
    const authUUID = getAuthUUID();
    if (!authUUID) return alert('User authentication not found. Please refresh the page.');

    const { data, error } = await window.supabase.rpc('request_leave_for_user', {
      p_user_id: authUUID,
      p_business_id: context.business_id,
      p_leave_type_id: parseInt(typeId, 10),
      p_start_date: start,
      p_end_date: end,
      p_notes: notes || null
    });

    if (error) throw error;
    const result = data[0];
    alert(result.message);
    if (result.success) {
      closeLeaveModal();
      loadLeaveData();
    }
  } catch (err) {
    console.error('Request leave error:', err);
    alert('Failed to request leave: ' + err.message);
  }
}

// ============================================================================
// INITIALIZATION - Runs once on page load
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  context = getBranchContext();

  if (!context || !context.user_id) {
    console.error('❌ No user context found - redirecting to login');
    window.location.href = 'login.html';
    return;
  }

  if (typeof window.supabase === 'undefined') {
    console.error('❌ Supabase client not found');
    return;
  }
  console.log('✅ Supabase client available');

  console.log('✅ Employee landing initialized for:', context.user_id);

  updateWelcomeSection();
  loadUserAccessibleModules();
  loadAttendanceStatus();
  loadUserTasks();
  loadNotifications();
  loadLeaveData();

  startClockDisplay();
  startDataRefresh();

  if (document.getElementById('logout-link')) {
    document.getElementById('logout-link').addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.getElementById('clock-in-modal').classList.remove('active');
      document.getElementById('clock-out-modal').classList.remove('active');
      document.getElementById('create-task-modal').classList.remove('active');
    }
  });
});
