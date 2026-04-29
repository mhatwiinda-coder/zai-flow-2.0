// ============================================================================
// USER MANAGEMENT MODULE
// Create and manage business-specific users
// Enforces single-business isolation per user
// ============================================================================

let businessUsersData = [];
let currentBusinessId = null;
let availableBusinesses = [];

/* =====================================================
   INITIALIZE USER MANAGEMENT
===================================================== */
function initUserManagement() {
  // Load available businesses
  loadAvailableBusinesses();
}

/* =====================================================
   LOAD AVAILABLE BUSINESSES
   Populate dropdown for admin to select which business to manage users for
===================================================== */
async function loadAvailableBusinesses() {
  try {
    const { data, error } = await supabase
      .from('business_entities')
      .select('id, name, status')
      .eq('status', 'ACTIVE')
      .order('name');

    if (error) throw error;

    availableBusinesses = data || [];

    // Populate business dropdown
    const dropdown = document.getElementById('selectedBusinessId');
    if (!dropdown) return;

    dropdown.innerHTML = '<option value="">Select a business...</option>';
    availableBusinesses.forEach(biz => {
      const option = document.createElement('option');
      option.value = biz.id;
      option.textContent = biz.name;
      dropdown.appendChild(option);
    });

    // Auto-select first business if available
    if (availableBusinesses.length > 0) {
      dropdown.value = availableBusinesses[0].id;
      currentBusinessId = availableBusinesses[0].id;
      loadUsersForSelectedBusiness();
    }
  } catch (err) {
    console.error('Load businesses error:', err);
  }
}

/* =====================================================
   LOAD USERS FOR SELECTED BUSINESS
   Called when business dropdown changes
===================================================== */
function loadUsersForSelectedBusiness() {
  const dropdown = document.getElementById('selectedBusinessId');
  if (!dropdown) return;

  const selectedId = parseInt(dropdown.value);
  if (!selectedId) {
    document.getElementById('usersTableBody').innerHTML =
      '<tr><td colspan="5" style="text-align: center; color: #999; padding: 20px;">Select a business to view users</td></tr>';
    return;
  }

  currentBusinessId = selectedId;
  loadBusinessUsers();
}

/* =====================================================
   LOAD BUSINESS USERS
   Get all users for the current business
===================================================== */
async function loadBusinessUsers() {
  try {
    if (!currentBusinessId) {
      console.error('No business selected');
      return;
    }

    // Call RPC to get business users
    const { data, error } = await supabase.rpc('get_business_users', {
      p_business_id: currentBusinessId
    });

    if (error) {
      console.error('Load users error:', error);
      showMessage('Error loading users: ' + error.message, 'error');
      return;
    }

    businessUsersData = data || [];

    // Render users table
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (businessUsersData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #999; padding: 20px;">No users created yet</td></tr>';
      return;
    }

    const html = businessUsersData.map(user => `
      <tr style="border-bottom: 1px solid #333;">
        <td style="padding: 12px;"><strong>${user.name}</strong></td>
        <td style="padding: 12px;">${user.email}</td>
        <td style="padding: 12px;">
          <span class="badge" style="background: #667eea; padding: 4px 8px; border-radius: 3px; font-size: 11px; text-transform: capitalize;">
            ${user.role}
          </span>
        </td>
        <td style="padding: 12px;">${user.branch_count} branch(es)</td>
        <td style="padding: 12px;">
          <button onclick="editUser(${user.user_id})" style="background: #3498db; padding: 6px 12px; font-size: 12px; margin-right: 5px;">Edit</button>
          <button onclick="deleteUser(${user.user_id})" class="danger" style="padding: 6px 12px; font-size: 12px; background: #e74c3c;">Delete</button>
        </td>
      </tr>
    `).join('');

    tbody.innerHTML = html;
  } catch (err) {
    console.error('Load business users error:', err);
    showMessage('Error: ' + err.message, 'error');
  }
}

/* =====================================================
   CREATE BUSINESS USER
   Create a new user tied to the current business
===================================================== */
async function createBusinessUser(event) {
  event.preventDefault();

  try {
    const name = document.getElementById('userName').value;
    const email = document.getElementById('userEmail').value;
    const password = document.getElementById('userPassword').value;
    const role = document.getElementById('userRole').value;

    if (!name || !email || !password || !role) {
      showMessage('All fields are required', 'error');
      return;
    }

    if (password.length < 8) {
      showMessage('Password must be at least 8 characters', 'error');
      return;
    }

    if (!currentBusinessId) {
      showMessage('No business selected', 'error');
      return;
    }

    // Call RPC to create user
    const { data, error } = await supabase.rpc('create_business_user', {
      p_business_id: currentBusinessId,
      p_email: email,
      p_password: password,
      p_name: name,
      p_role: role
    });

    if (error) {
      console.error('Create user error:', error);
      showMessage('Error: ' + (error.message || 'Failed to create user'), 'error');
      return;
    }

    if (data && data[0] && data[0].success) {
      showMessage('✅ User created successfully!', 'success');

      // Clear form and close modal
      document.getElementById('userName').value = '';
      document.getElementById('userEmail').value = '';
      document.getElementById('userPassword').value = '';
      document.getElementById('userRole').value = '';
      closeModal('createUserModal');

      // Reload users
      loadBusinessUsers();
    } else if (data && data[0]) {
      showMessage('Error: ' + data[0].message, 'error');
    }
  } catch (err) {
    console.error('Create business user error:', err);
    showMessage('Error: ' + err.message, 'error');
  }
}

/* =====================================================
   EDIT USER (placeholder - shows role update)
===================================================== */
function editUser(userId) {
  const user = businessUsersData.find(u => u.user_id === userId);
  if (!user) return;

  const newRole = prompt(`Change role for ${user.name}:\n\nCurrent: ${user.role}\n\nEnter new role (cashier/inventory/supervisor/manager/admin):`, user.role);

  if (newRole && newRole !== user.role) {
    updateUserRole(userId, newRole);
  }
}

/* =====================================================
   UPDATE USER ROLE
===================================================== */
async function updateUserRole(userId, newRole) {
  try {
    const { data, error } = await supabase.rpc('update_user_role', {
      p_user_id: userId,
      p_new_role: newRole
    });

    if (error) throw error;

    if (data && data[0] && data[0].success) {
      showMessage('✅ Role updated successfully!', 'success');
      loadBusinessUsers();
    } else {
      showMessage('Error updating role', 'error');
    }
  } catch (err) {
    console.error('Update user role error:', err);
    showMessage('Error: ' + err.message, 'error');
  }
}

/* =====================================================
   DELETE BUSINESS USER
===================================================== */
async function deleteUser(userId) {
  const user = businessUsersData.find(u => u.user_id === userId);
  if (!user) return;

  if (!confirm(`Delete user "${user.name}" (${user.email})?\n\nThis action cannot be undone.`)) {
    return;
  }

  try {
    const { data, error } = await supabase.rpc('delete_business_user', {
      p_user_id: userId
    });

    if (error) throw error;

    if (data && data[0] && data[0].success) {
      showMessage('✅ User deleted successfully!', 'success');
      loadBusinessUsers();
    } else {
      showMessage('Error deleting user', 'error');
    }
  } catch (err) {
    console.error('Delete user error:', err);
    showMessage('Error: ' + err.message, 'error');
  }
}

/* =====================================================
   MODAL UTILITIES
===================================================== */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'block';
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'none';
}

function showMessage(message, type = 'info') {
  // Show at top of page or in a notification area
  console.log(`[${type.toUpperCase()}] ${message}`);

  // Simple alert for now (could be enhanced with toast notifications)
  if (type === 'error') {
    console.error(message);
  } else if (type === 'success') {
    console.log('%c✅ ' + message, 'color: green; font-weight: bold;');
  }
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', () => {
  initUserManagement();
});
