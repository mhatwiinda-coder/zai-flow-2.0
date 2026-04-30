// ============================================================================
// ZAI FLOW 2.0 - ADMIN ROLE MANAGEMENT
// Manage user roles and permissions
// ============================================================================

let supabase;
let context;
let allUsers = [];
let allRoles = [];
let selectedUserForRemoval = null;
let selectedRoleForRemoval = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Get branch context
  context = getBranchContext();

  if (!context || !context.user_id) {
    console.error('❌ No user context found - redirecting to login');
    window.location.href = 'login.html';
    return;
  }

  // Initialize Supabase
  if (typeof window.supabase !== 'undefined') {
    supabase = window.supabase;
  } else {
    console.error('❌ Supabase client not found');
    return;
  }

  // Verify user is admin (case-insensitive check)
  const userRole = (context.user_role || '').toLowerCase();
  if (userRole !== 'admin' && userRole !== 'administrator') {
    alert('❌ You do not have permission to access this page. Only administrators can manage roles.');
    window.location.href = 'employee-landing.html';
    return;
  }

  console.log('✅ Admin roles panel initialized');

  // Load initial data
  loadUsers();
  loadRoles();
  loadPermissionsMatrixRoles();

  // Setup event listeners
  document.getElementById('logout-link').addEventListener('click', (e) => {
    e.preventDefault();
    logout();
  });
});

// ============================================================================
// TAB SWITCHING
// ============================================================================

function switchAdminTab(tabName) {
  // Hide all tabs
  document.getElementById('tab-users').classList.remove('active');
  document.getElementById('tab-roles').classList.remove('active');
  document.getElementById('tab-permissions').classList.remove('active');

  // Deactivate all buttons
  document.querySelectorAll('.tabs .tab-button').forEach(btn => {
    btn.classList.remove('active');
  });

  // Show selected tab
  document.getElementById(`tab-${tabName}`).classList.add('active');

  // Activate button
  event.target.classList.add('active');

  // Refresh data if needed
  if (tabName === 'users') {
    loadUsers();
  } else if (tabName === 'roles') {
    loadRoles();
  } else if (tabName === 'permissions') {
    document.getElementById('permissions-matrix-content').innerHTML = `
      <div class="empty-state">Select a role to view permissions</div>
    `;
  }
}

// ============================================================================
// USERS & ROLES TAB
// ============================================================================

async function loadUsers() {
  try {
    // Get all users (this would typically come from auth.users table or a custom users table)
    // For now, we'll query the user_roles table to get all users with roles
    const { data: userRolesData, error: userRolesError } = await supabase
      .from('user_roles')
      .select('user_id, role_id, is_active, roles(code, name)')
      .eq('business_id', context.business_id);

    if (userRolesError) throw userRolesError;

    // Get unique users
    const uniqueUsers = {};
    if (userRolesData) {
      userRolesData.forEach(ur => {
        if (!uniqueUsers[ur.user_id]) {
          uniqueUsers[ur.user_id] = {
            user_id: ur.user_id,
            roles: []
          };
        }
        if (ur.roles) {
          uniqueUsers[ur.user_id].roles.push(ur.roles);
        }
      });
    }

    allUsers = Object.values(uniqueUsers);

    if (allUsers.length === 0) {
      document.getElementById('users-tbody').innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">
            <p>No users with roles assigned yet. Use the quick assignment form below.</p>
          </td>
        </tr>
      `;
      return;
    }

    // Render users table
    renderUsersTable(allUsers);

    // Populate user select dropdowns
    populateUserSelects();

  } catch (err) {
    console.error('Load users error:', err);
    document.getElementById('users-tbody').innerHTML = `
      <tr>
        <td colspan="5" style="color: red; text-align: center;">Error loading users: ${err.message}</td>
      </tr>
    `;
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('users-tbody');

  if (!users || users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state"><p>No users found</p></td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = users.map(user => {
    const rolesHtml = user.roles && user.roles.length > 0
      ? user.roles.map(role => `<span class="badge primary">${role.name}</span>`).join('')
      : '<span style="color: #999;">No roles assigned</span>';

    const displayEmail = user.email || 'N/A';
    const displayName = user.name || user.user_id.substring(0, 8);

    return `
      <tr>
        <td>${displayName}</td>
        <td>${displayEmail}</td>
        <td>${rolesHtml}</td>
        <td>
          <span class="status-badge ${user.is_active !== false ? 'active' : 'inactive'}">
            ${user.is_active !== false ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="openAssignRoleModal('${user.user_id}')">
            ➕ Add Role
          </button>
          ${user.roles && user.roles.length > 0 ? `
            <button class="btn btn-sm btn-danger" onclick="openRemoveRoleModal('${user.user_id}')">
              ✕ Remove
            </button>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

function populateUserSelects() {
  // Get all unique users from auth.users table
  // For MVP, we'll just populate from current user roles
  const userSelect = document.getElementById('user-select');
  const modalUserSelect = document.getElementById('modal-user-select');

  let html = '<option value="">Choose a user...</option>';
  allUsers.forEach(user => {
    const name = user.name || user.user_id.substring(0, 8);
    html += `<option value="${user.user_id}">${name} (${user.user_id.substring(0, 8)})</option>`;
  });

  userSelect.innerHTML = html;
  modalUserSelect.innerHTML = html;
}

async function loadRoles() {
  try {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .order('hierarchy_level', { ascending: true });

    if (error) throw error;

    allRoles = data || [];

    if (allRoles.length === 0) {
      document.getElementById('roles-list').innerHTML = `
        <div class="empty-state"><p>No roles found</p></div>
      `;
      return;
    }

    renderRolesList(allRoles);

  } catch (err) {
    console.error('Load roles error:', err);
  }
}

function renderRolesList(roles) {
  const container = document.getElementById('roles-list');

  container.innerHTML = roles.map(role => {
    const hierarchyLabel = role.hierarchy_level === 0 ? '👑 Admin' :
                          role.hierarchy_level < 30 ? '💼 Manager' :
                          role.hierarchy_level < 60 ? '📋 Supervisor' : '👤 Staff';

    return `
      <div class="role-card" onclick="selectRoleForDetails(${role.id}, '${role.name}', '${role.description || ''}')">
        <div class="role-card-header">
          <div class="role-card-name">${role.name}</div>
          <div class="role-card-level">${hierarchyLabel}</div>
        </div>
        <div class="role-card-desc">${role.description || 'No description'}</div>
        <div class="role-card-stats">
          Level: ${role.hierarchy_level} • ID: ${role.id} • ${role.is_active ? '✅ Active' : '❌ Inactive'}
        </div>
      </div>
    `;
  }).join('');
}

function selectRoleForDetails(roleId, roleName, description) {
  // Show role details
  const detailsDiv = document.getElementById('role-details');
  const detailsContent = document.getElementById('role-details-content');
  document.getElementById('role-details-name').textContent = roleName;

  detailsContent.innerHTML = `
    <div style="padding: 20px;">
      <p><strong>Description:</strong> ${description || 'No description'}</p>
      <p><strong>Role ID:</strong> ${roleId}</p>
      <p><strong>Status:</strong> Active</p>
      <button class="btn btn-secondary" onclick="closeRoleDetails()">Close</button>
    </div>
  `;

  detailsDiv.style.display = 'block';
}

function closeRoleDetails() {
  document.getElementById('role-details').style.display = 'none';
}

// ============================================================================
// ASSIGN ROLE
// ============================================================================

function openAssignRoleModal(userId) {
  selectedUserForRemoval = userId;
  const user = allUsers.find(u => u.user_id === userId);
  const userName = user ? (user.name || userId.substring(0, 8)) : userId;

  document.getElementById('modal-user-select').value = userId;
  document.getElementById('modal-role-select').value = '';

  // Populate role select
  populateRoleSelect();

  document.getElementById('assign-role-modal').classList.add('active');
}

function closeAssignRoleModal() {
  document.getElementById('assign-role-modal').classList.remove('active');
}

function assignRoleToUser() {
  const userId = document.getElementById('user-select').value;
  const roleId = document.getElementById('role-select').value;

  if (!userId || !roleId) {
    alert('⚠️ Please select both a user and a role');
    return;
  }

  openAssignRoleModal(userId);
}

async function confirmAssignRole() {
  const userId = document.getElementById('modal-user-select').value;
  const roleId = document.getElementById('modal-role-select').value;

  if (!userId || !roleId) {
    alert('⚠️ Please select both a user and a role');
    return;
  }

  try {
    const { data, error } = await supabase.rpc('assign_user_role', {
      p_user_id: userId,
      p_assigned_by: context.user_id,
      p_business_id: context.business_id,
      p_role_id: parseInt(roleId)
    });

    if (error) throw error;

    const result = data[0];
    if (result.success) {
      alert('✅ ' + result.message);
      closeAssignRoleModal();
      loadUsers();
      loadRoles();
    } else {
      alert('❌ ' + result.message);
    }
  } catch (err) {
    console.error('Assign role error:', err);
    alert('Failed to assign role: ' + err.message);
  }
}

function populateRoleSelect() {
  const select = document.getElementById('modal-role-select');
  let html = '<option value="">Choose a role...</option>';
  allRoles.forEach(role => {
    html += `<option value="${role.id}">${role.name}</option>`;
  });
  select.innerHTML = html;
}

// ============================================================================
// REMOVE ROLE
// ============================================================================

async function openRemoveRoleModal(userId) {
  const user = allUsers.find(u => u.user_id === userId);
  const userName = user ? (user.name || userId.substring(0, 8)) : userId;
  const rolesList = user && user.roles ? user.roles.map(r => r.name).join(', ') : 'N/A';

  selectedUserForRemoval = userId;

  document.getElementById('remove-role-message').textContent =
    `Are you sure you want to remove all roles from ${userName}? Their roles: ${rolesList}`;

  document.getElementById('remove-role-modal').classList.add('active');
}

function closeRemoveRoleModal() {
  document.getElementById('remove-role-modal').classList.remove('active');
}

async function confirmRemoveRole() {
  if (!selectedUserForRemoval) {
    alert('⚠️ No user selected');
    return;
  }

  try {
    const user = allUsers.find(u => u.user_id === selectedUserForRemoval);
    if (!user || !user.roles || user.roles.length === 0) {
      alert('⚠️ User has no roles to remove');
      return;
    }

    // Remove all roles for this user
    for (const role of user.roles) {
      const { error } = await supabase.rpc('remove_user_role', {
        p_user_id: selectedUserForRemoval,
        p_business_id: context.business_id,
        p_role_id: role.id
      });

      if (error) throw error;
    }

    alert('✅ Roles removed successfully');
    closeRemoveRoleModal();
    loadUsers();
    loadRoles();

  } catch (err) {
    console.error('Remove role error:', err);
    alert('Failed to remove roles: ' + err.message);
  }
}

// ============================================================================
// PERMISSIONS MATRIX
// ============================================================================

function loadPermissionsMatrixRoles() {
  const select = document.getElementById('matrix-role-select');
  let html = '<option value="">Select a role to view permissions...</option>';
  allRoles.forEach(role => {
    html += `<option value="${role.id}">${role.name}</option>`;
  });
  select.innerHTML = html;
}

async function loadPermissionsMatrix() {
  const roleId = document.getElementById('matrix-role-select').value;

  if (!roleId) {
    document.getElementById('permissions-matrix-content').innerHTML = `
      <div class="empty-state">Select a role to view permissions</div>
    `;
    return;
  }

  try {
    // Get role details
    const role = allRoles.find(r => r.id === parseInt(roleId));
    if (!role) {
      alert('❌ Role not found');
      return;
    }

    // Get role-function mappings
    const { data: roleFunctions, error: rfError } = await supabase
      .from('role_functions')
      .select('function_id, functions(code, name, module)')
      .eq('role_id', roleId);

    if (rfError) throw rfError;

    // Get role-function-actions mappings
    const { data: roleActions, error: raError } = await supabase
      .from('role_function_actions')
      .select('function_id, action_id, allowed, function_actions(action)')
      .eq('role_id', roleId);

    if (raError) throw raError;

    // Organize data by module
    const moduleMap = {};
    if (roleFunctions) {
      roleFunctions.forEach(rf => {
        const module = rf.functions?.module || 'Other';
        if (!moduleMap[module]) {
          moduleMap[module] = [];
        }
        moduleMap[module].push({
          function_id: rf.function_id,
          function_name: rf.functions?.name,
          function_code: rf.functions?.code,
          actions: []
        });
      });
    }

    // Add actions to functions
    if (roleActions) {
      roleActions.forEach(ra => {
        Object.values(moduleMap).forEach(functions => {
          functions.forEach(func => {
            if (func.function_id === ra.function_id) {
              func.actions.push({
                action: ra.function_actions?.action,
                allowed: ra.allowed
              });
            }
          });
        });
      });
    }

    // Render matrix
    renderPermissionsMatrix(role.name, moduleMap);

  } catch (err) {
    console.error('Load permissions matrix error:', err);
    document.getElementById('permissions-matrix-content').innerHTML = `
      <div style="color: red;">Error loading permissions: ${err.message}</div>
    `;
  }
}

function renderPermissionsMatrix(roleName, moduleMap) {
  let html = '';

  if (Object.keys(moduleMap).length === 0) {
    html = '<div class="empty-state"><p>No modules assigned to this role</p></div>';
  } else {
    Object.entries(moduleMap).forEach(([module, functions]) => {
      html += `
        <div class="permission-section">
          <h4>📦 ${module}</h4>
          <div class="permission-grid">
      `;

      functions.forEach(func => {
        const actions = func.actions.length > 0
          ? func.actions.map(a => `${a.action}${a.allowed ? '✅' : '❌'}`).join(', ')
          : 'No specific actions';

        html += `
          <div style="background: white; padding: 10px; border-radius: 4px; border: 1px solid #e9ecef;">
            <div style="font-weight: bold; font-size: 12px; margin-bottom: 5px;">${func.function_name}</div>
            <div style="font-size: 11px; color: #666;">${actions}</div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });
  }

  document.getElementById('permissions-matrix-content').innerHTML = html;
}

// ============================================================================
// SEARCH
// ============================================================================

function searchUsers() {
  const searchTerm = document.getElementById('search-users').value.toLowerCase();

  if (!searchTerm) {
    renderUsersTable(allUsers);
    return;
  }

  const filtered = allUsers.filter(user => {
    const name = (user.name || '').toLowerCase();
    const email = (user.email || '').toLowerCase();
    return name.includes(searchTerm) || email.includes(searchTerm);
  });

  renderUsersTable(filtered);
}

// ============================================================================
// LOGOUT
// ============================================================================

function logout() {
  if (confirm('Are you sure you want to logout?')) {
    // Clear localStorage
    localStorage.removeItem('user');
    localStorage.removeItem('session');
    localStorage.removeItem('branch_context');

    // Redirect to login
    window.location.href = 'login.html';
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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
