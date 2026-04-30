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
  document.getElementById('clock-out-modal').classList.add('active');
}

function closeClockOutModal() {
  document.getElementById('clock-out-modal').classList.remove('active');
}

async function performClockIn() {
  const notes = document.getElementById('clock-in-notes').value;
  if (!window.supabase || !context) {
    alert('❌ System not initialized. Please refresh the page.');
    return;
  }

  try {
    const { data, error } = await window.supabase.rpc('clock_in', {
      p_user_id: context.user_id,
      p_business_id: context.business_id,
      p_notes: notes || null
    });

    if (error) throw error;
    const result = data[0];
    if (result.success) {
      alert('✅ ' + result.message);
      closeClockInModal();
      loadAttendanceStatus();
    } else {
      alert('❌ ' + result.message);
    }
  } catch (err) {
    console.error('Clock in error:', err);
    alert('Failed to clock in: ' + err.message);
  }
}

async function performClockOut() {
  const notes = document.getElementById('clock-out-notes').value;
  if (!window.supabase || !context) {
    alert('❌ System not initialized. Please refresh the page.');
    return;
  }

  try {
    const { data, error } = await supabase.rpc('clock_out', {
      p_user_id: context.user_id,
      p_business_id: context.business_id,
      p_notes: notes || null
    });

    if (error) throw error;
    const result = data[0];
    if (result.success) {
      alert(`✅ ${result.message}\nHours worked: ${result.hours_worked}`);
      closeClockOutModal();
      loadAttendanceStatus();
    } else {
      alert('❌ ' + result.message);
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
    alert('⚠️ Please enter a task title');
    return;
  }

  if (!window.supabase || !context) {
    alert('❌ System not initialized. Please refresh the page.');
    return;
  }

  try {
    const { data, error } = await supabase.rpc('create_task', {
      p_user_id: context.user_id,
      p_business_id: context.business_id,
      p_title: title,
      p_description: description || null,
      p_due_date: dueDate || null,
      p_priority: priority,
      p_assigned_to: context.user_id
    });

    if (error) throw error;
    const result = data[0];
    if (result.success) {
      alert('✅ ' + result.message);
      closeCreateTaskModal();
      loadUserTasks();
    } else {
      alert('❌ Failed to create task');
    }
  } catch (err) {
    console.error('Create task error:', err);
    alert('Failed to create task: ' + err.message);
  }
}

function switchTaskTab(tabName) {
  document.getElementById('task-tab-todo').classList.remove('active');
  document.getElementById('task-tab-in-progress').classList.remove('active');
  document.getElementById('task-tab-completed').classList.remove('active');
  document.querySelectorAll('.tabs .tab-button').forEach(btn => {
    btn.classList.remove('active');
  });
  document.getElementById(`task-tab-${tabName}`).classList.add('active');
  if (event && event.target) {
    event.target.classList.add('active');
  }
}

async function updateTaskStatus(taskId, newStatus) {
  if (!supabase) {
    alert('❌ System not initialized. Please refresh the page.');
    return;
  }

  try {
    const { data, error } = await supabase.rpc('update_task_status', {
      p_task_id: taskId,
      p_status: newStatus
    });

    if (error) throw error;
    const result = data[0];
    if (result.success) {
      loadUserTasks();
    } else {
      alert('❌ ' + result.message);
    }
  } catch (err) {
    console.error('Update task error:', err);
    alert('Failed to update task: ' + err.message);
  }
}

async function deleteTask(taskId) {
  if (!confirm('Are you sure you want to delete this task?')) return;
  if (!supabase) {
    alert('❌ System not initialized. Please refresh the page.');
    return;
  }

  try {
    const { data, error } = await supabase.rpc('update_task_status', {
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
  if (!supabase) {
    alert('❌ System not initialized. Please refresh the page.');
    return;
  }

  try {
    const { data, error } = await supabase.rpc('mark_notification_read', {
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
    alert('❌ System not initialized. Please refresh the page.');
    return;
  }

  try {
    const { data: notifications, error: getError } = await supabase.rpc('get_unread_notifications', {
      p_user_id: context.user_id,
      p_business_id: context.business_id
    });

    if (getError) throw getError;
    if (!notifications || notifications.length === 0) {
      alert('No unread notifications');
      return;
    }

    for (const notif of notifications) {
      const { error: markError } = await supabase.rpc('mark_notification_read', {
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
  if (!supabase || !context) return;

  const authUUID = getAuthUUID();
  if (!authUUID) return;

  try {
    const { data, error } = await supabase.rpc('get_attendance_status', {
      p_user_id: authUUID,
      p_business_id: context.business_id
    });

    if (error) throw error;

    if (data && data.length > 0) {
      const attendance = data[0];
      const isClockedIn = attendance.is_clocked_in;
      const elapsedMinutes = attendance.elapsed_minutes;

      const clockInBtn = document.getElementById('clock-in-btn');
      const clockOutBtn = document.getElementById('clock-out-btn');
      const statusBadge = document.getElementById('clock-status');
      const elapsedDisplay = document.getElementById('elapsed-time-display');
      const attendanceStatus = document.getElementById('attendance-status');

      if (isClockedIn) {
        clockInBtn.style.display = 'none';
        clockOutBtn.style.display = 'inline-block';
        statusBadge.textContent = '✅ Clocked In';
        statusBadge.className = 'status-badge clocked-in';
        attendanceStatus.textContent = 'Online';
        const hours = Math.floor(elapsedMinutes / 60);
        const minutes = elapsedMinutes % 60;
        elapsedDisplay.textContent = `Elapsed: ${hours}h ${minutes}m`;
      } else {
        clockInBtn.style.display = 'inline-block';
        clockOutBtn.style.display = 'none';
        statusBadge.textContent = '❌ Offline';
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
  if (!supabase || !context) return;

  const authUUID = getAuthUUID();
  if (!authUUID) return;

  try {
    const { data, error } = await supabase.rpc('get_user_tasks', {
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
  todoContainer.innerHTML = '<div class="empty-state"><p>No tasks yet! 🎉</p></div>';
  inProgressContainer.innerHTML = '<div class="empty-state"><p>No tasks in progress</p></div>';
  completedContainer.innerHTML = '<div class="empty-state"><p>No completed tasks yet</p></div>';
}

function renderTasksByStatus(tabSuffix, tasks) {
  const container = document.getElementById(`task-list-${tabSuffix}`);
  if (!tasks || tasks.length === 0) {
    const emoji = tabSuffix === 'todo' ? '🎉' : (tabSuffix === 'in-progress' ? '⏳' : '✅');
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
          ${isOverdue ? '<span style="color: #dc3545; font-weight: bold;">⚠️ OVERDUE</span> • ' : ''}
          Due: ${dueDateStr} • Created: ${new Date(task.created_at).toLocaleDateString()}
        </div>
        <div style="margin-top: 10px; display: flex; gap: 8px;">
          ${task.status !== 'COMPLETED' ? `<button class="btn btn-success" onclick="updateTaskStatus(${task.task_id}, 'COMPLETED')" style="font-size: 12px; padding: 6px 10px;">✓ Complete</button>` : ''}
          ${task.status === 'TODO' ? `<button class="btn btn-primary" onclick="updateTaskStatus(${task.task_id}, 'IN_PROGRESS')" style="font-size: 12px; padding: 6px 10px;">▶ Start</button>` : ''}
          <button class="btn btn-secondary" onclick="deleteTask(${task.task_id})" style="font-size: 12px; padding: 6px 10px;">🗑 Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

async function loadNotifications() {
  if (!supabase || !context) return;

  const authUUID = getAuthUUID();
  if (!authUUID) return;

  try {
    const { data, error } = await supabase.rpc('get_unread_notifications', {
      p_user_id: authUUID,
      p_business_id: context.business_id
    });

    if (error) throw error;
    document.getElementById('notification-count').textContent = (data && data.length) || 0;

    if (!data || data.length === 0) {
      document.getElementById('notification-list').innerHTML = `<div class="empty-state"><p>No notifications yet 🎉</p></div>`;
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
  if (!supabase || !currentContext) return;

  const authUUID = getAuthUUID();
  if (!authUUID) return;

  try {
    const { data, error } = await supabase.rpc('get_user_accessible_modules', {
      p_user_id: authUUID,
      p_business_id: currentContext.business_id
    });

    if (error) throw error;
    document.getElementById('module-count').textContent = (data && data.length) || 0;

    const moduleInfo = {
      'dashboard': { name: 'Dashboard', icon: '📊', url: 'dashboard.html' },
      'sales': { name: 'Sales', icon: '🛒', url: 'sales.html' },
      'inventory': { name: 'Inventory', icon: '📦', url: 'inventory.html' },
      'accounting': { name: 'Accounting', icon: '📋', url: 'accounting.html' },
      'hr_payroll': { name: 'HR & Payroll', icon: '👥', url: 'hr.html' },
      'purchasing': { name: 'Purchasing', icon: '📄', url: 'purchasing.html' }
    };

    let html = '';

    // Add Admin Dashboard link for admin users (show even if no other modules)
    if (currentContext && currentContext.user_role === 'admin') {
      html += `
        <a href="admin-business.html" class="quick-link" title="Admin Business">
          <div class="quick-link-icon">⚙️</div>
          <div class="quick-link-name">Admin Business</div>
        </a>
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
            <div class="empty-state-icon">🚫</div>
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
      const info = moduleInfo[moduleName] || { name: moduleName, icon: '📦', url: '#' };
      html += `
        <a href="${info.url}" class="quick-link" title="${info.name}">
          <div class="quick-link-icon">${info.icon}</div>
          <div class="quick-link-name">${info.name}</div>
        </a>
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
