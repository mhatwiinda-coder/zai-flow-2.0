/**
 * Admin User Management
 * Allows admins to assign roles to users in their business
 */

let allUsers = [];
let allRoles = [];
let userRoleMap = new Map(); // Map of user_id -> [role_ids]

async function loadAllUsers() {
  const context = getBranchContext();
  if (!context || context.user_role !== 'admin') {
    showError('⛔ You must be an admin to access this page');
    return;
  }

  try {
    // Get all users in the business
    const { data: users, error } = await window.supabase
      .from('users')
      .select('id, name, email, role')
      .eq('business_id', context.business_id);

    if (error) throw error;

    allUsers = users || [];

    // Get all roles
    const { data: roles, error: rolesError } = await window.supabase
      .from('roles')
      .select('id, code, name, hierarchy_level')
      .eq('is_active', true);

    if (rolesError) throw rolesError;

    allRoles = roles || [];

    // Get user role assignments
    await loadUserRoleAssignments(context.business_id);

    renderUsers(allUsers);
  } catch (err) {
    showError('Failed to load users: ' + err.message);
  }
}

async function loadUserRoleAssignments(businessId) {
  try {
    const { data: assignments, error } = await window.supabase
      .from('user_roles')
      .select('user_id, role_id')
      .eq('business_id', businessId)
      .eq('is_active', true);

    if (error) throw error;

    userRoleMap.clear();
    (assignments || []).forEach(assignment => {
      if (!userRoleMap.has(assignment.user_id)) {
        userRoleMap.set(assignment.user_id, []);
      }
      userRoleMap.get(assignment.user_id).push(assignment.role_id);
    });
  } catch (err) {
    console.error('Error loading user role assignments:', err);
  }
}

function renderUsers(users) {
  const container = document.getElementById('usersContainer');

  if (users.length === 0) {
    container.innerHTML = '<div class="empty-message">No users found</div>';
    return;
  }

  container.innerHTML = users
    .map(user => renderUserCard(user))
    .join('');

  // Attach event listeners
  users.forEach(user => {
    const assignBtn = document.getElementById(`assign-role-${user.id}`);
    const removeBtn = document.getElementById(`remove-role-${user.id}`);

    if (assignBtn) {
      assignBtn.addEventListener('click', () => assignRoleToUser(user));
    }
    if (removeBtn) {
      removeBtn.addEventListener('click', () => showRemoveRoleDialog(user));
    }
  });
}

function renderUserCard(user) {
  const userRoles = userRoleMap.get(user.id) || [];
  const roleNames = userRoles
    .map(roleId => {
      const role = allRoles.find(r => r.id === roleId);
      return role ? role.name : `Role ${roleId}`;
    })
    .join(', ');

  const rolesList = userRoles
    .map(roleId => {
      const role = allRoles.find(r => r.id === roleId);
      return `<div class="role-tag">
        ${role ? role.name : `Role ${roleId}`}
        <span class="remove-role" onclick="removeRoleFromUser(${user.id}, ${roleId})">×</span>
      </div>`;
    })
    .join('');

  return `
    <div class="user-card">
      <div class="user-header">
        <div class="user-info">
          <h3>${user.name}</h3>
          <div class="user-email">${user.email}</div>
          <div class="user-role-badge">${user.role || 'No Role'}</div>
        </div>
      </div>

      <div class="current-roles">
        <strong>Assigned Roles:</strong>
        <div class="roles-list">
          ${rolesList || '<span style="color: #999;">No roles assigned</span>'}
        </div>
      </div>

      <div class="role-selector">
        <label>Add Role:</label>
        <select id="role-select-${user.id}">
          <option value="">Select a role...</option>
          ${allRoles
            .map(role => `<option value="${role.id}">${role.name}</option>`)
            .join('')}
        </select>
      </div>

      <div class="role-actions">
        <button class="btn-assign" id="assign-role-${user.id}">✓ Assign Role</button>
        <button class="btn-remove" id="remove-role-${user.id}">✕ Remove All</button>
      </div>
    </div>
  `;
}

async function assignRoleToUser(user) {
  const roleSelect = document.getElementById(`role-select-${user.id}`);
  const roleId = parseInt(roleSelect.value);

  if (!roleId) {
    showError('Please select a role first');
    return;
  }

  const context = getBranchContext();
  const userUUID = convertToUUID(user.id);

  try {
    // Use RPC function to assign role
    const { data, error } = await window.supabase.rpc('assign_user_role', {
      p_user_id: userUUID,
      p_assigned_by: getAuthUUID(),
      p_business_id: context.business_id,
      p_role_id: roleId
    });

    if (error) throw error;

    if (data && data[0].success) {
      showSuccess(`✅ Role assigned to ${user.name}`);
      await loadUserRoleAssignments(context.business_id);
      renderUsers(allUsers);
    } else {
      showError(data[0].message || 'Failed to assign role');
    }
  } catch (err) {
    showError('Error assigning role: ' + err.message);
  }
}

async function removeRoleFromUser(userId, roleId) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;

  const role = allRoles.find(r => r.id === roleId);
  const roleName = role ? role.name : `Role ${roleId}`;

  if (!confirm(`Remove role "${roleName}" from ${user.name}?`)) {
    return;
  }

  const context = getBranchContext();
  const userUUID = convertToUUID(userId);

  try {
    const { data, error } = await window.supabase.rpc('remove_user_role', {
      p_user_id: userUUID,
      p_business_id: context.business_id,
      p_role_id: roleId
    });

    if (error) throw error;

    if (data && data[0].success) {
      showSuccess(`✅ Role removed from ${user.name}`);
      await loadUserRoleAssignments(context.business_id);
      renderUsers(allUsers);
    }
  } catch (err) {
    showError('Error removing role: ' + err.message);
  }
}

async function showRemoveRoleDialog(user) {
  const userRoles = userRoleMap.get(user.id) || [];

  if (userRoles.length === 0) {
    showError('User has no roles assigned');
    return;
  }

  if (confirm(`Remove all roles from ${user.name}?`)) {
    const context = getBranchContext();
    const userUUID = convertToUUID(user.id);

    try {
      for (const roleId of userRoles) {
        await window.supabase.rpc('remove_user_role', {
          p_user_id: userUUID,
          p_business_id: context.business_id,
          p_role_id: roleId
        });
      }

      showSuccess(`✅ All roles removed from ${user.name}`);
      await loadUserRoleAssignments(context.business_id);
      renderUsers(allUsers);
    } catch (err) {
      showError('Error removing roles: ' + err.message);
    }
  }
}

function searchUsersFunction() {
  const searchTerm = document.getElementById('searchUsers').value.toLowerCase();

  if (!searchTerm) {
    renderUsers(allUsers);
    return;
  }

  const filtered = allUsers.filter(user =>
    user.name.toLowerCase().includes(searchTerm) ||
    user.email.toLowerCase().includes(searchTerm)
  );

  renderUsers(filtered);
}

function showSuccess(message) {
  const msgEl = document.getElementById('successMessage');
  msgEl.textContent = message;
  msgEl.style.display = 'block';
  document.getElementById('errorMessage').style.display = 'none';

  setTimeout(() => {
    msgEl.style.display = 'none';
  }, 4000);
}

function showError(message) {
  const msgEl = document.getElementById('errorMessage');
  msgEl.textContent = message;
  msgEl.style.display = 'block';
  document.getElementById('successMessage').style.display = 'none';

  setTimeout(() => {
    msgEl.style.display = 'none';
  }, 4000);
}

function convertToUUID(numericId) {
  return `00000000-0000-0000-0000-${String(numericId).padStart(12, '0')}`;
}

// Setup logout
document.addEventListener('DOMContentLoaded', () => {
  const logoutLink = document.getElementById('logout-link');
  if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      logoutUser();
    });
  }

  // Check if user is admin
  const context = getBranchContext();
  if (!context || context.user_role !== 'admin') {
    showError('⛔ Admin access required');
    setTimeout(() => {
      window.location.href = 'employee-landing.html';
    }, 2000);
    return;
  }

  loadAllUsers();
});
