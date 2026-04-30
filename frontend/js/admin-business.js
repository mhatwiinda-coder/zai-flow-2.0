/**
 * Admin Business Management
 * Comprehensive admin control panel for managing businesses, branches, and users with auto-suggested roles
 */

let allBusinesses = [];
let allBranches = [];
let allUsers = [];
let allRoles = [];
let allFunctions = [];
let selectedFunctionalRoles = [];
let deleteTarget = null;

// Role to Functional Modules Auto-Suggestion Map
const ROLE_SUGGESTIONS = {
  admin: ['dashboard', 'sales_pos', 'sales_reports', 'inventory_products', 'inventory_movements',
          'accounting_ledger', 'accounting_reports', 'accounting_journal',
          'hr_employees', 'hr_payroll', 'hr_attendance', 'hr_leave',
          'purchasing_po', 'purchasing_suppliers', 'purchasing_invoices', 'purchasing_payments'],
  manager: ['dashboard', 'sales_pos', 'sales_reports', 'inventory_products', 'inventory_movements',
            'accounting_ledger', 'accounting_reports', 'hr_employees', 'hr_attendance'],
  supervisor: ['dashboard', 'sales_pos', 'inventory_products', 'inventory_movements'],
  cashier: ['dashboard', 'sales_pos'],
  inventory_staff: ['dashboard', 'inventory_products', 'inventory_movements'],
  hr_staff: ['dashboard', 'hr_employees', 'hr_payroll', 'hr_attendance', 'hr_leave'],
  procurement_staff: ['dashboard', 'purchasing_po', 'purchasing_suppliers', 'purchasing_invoices', 'purchasing_payments'],
  employee: ['dashboard']
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  const context = getBranchContext();

  if (!context || context.user_role !== 'admin') {
    showMessage('⛔ Admin access required', 'error', 'businessMessage');
    setTimeout(() => window.location.href = 'employee-landing.html', 2000);
    return;
  }

  // Display user info
  document.getElementById('userInfo').textContent = `${context.user_name} (${context.user_role})`;

  // Setup tab click handlers
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Load all data
  await loadAllData();

  // Update timestamp
  document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
});

async function loadAllData() {
  try {
    await Promise.all([
      loadBusinesses(),
      loadBranches(),
      loadUsers(),
      loadRoles(),
      loadFunctions()
    ]);
  } catch (err) {
    console.error('Error loading data:', err);
  }
}

// ============================================================================
// DASHBOARD
// ============================================================================

function updateStats() {
  document.getElementById('stat-businesses').textContent = allBusinesses.length;
  document.getElementById('stat-branches').textContent = allBranches.length;
  document.getElementById('stat-users').textContent = allUsers.length;
  document.getElementById('stat-roles').textContent = allRoles.length;
}

// ============================================================================
// BUSINESSES
// ============================================================================

async function loadBusinesses() {
  try {
    const { data, error } = await window.supabase
      .from('business_entities')
      .select('id, name, created_at');

    if (error) throw error;

    allBusinesses = data || [];
    renderBusinesses();
    updateStats();
    populateBusinessSelects();
  } catch (err) {
    console.error('Error loading businesses:', err);
  }
}

function renderBusinesses() {
  const tbody = document.querySelector('#businessesTable tbody');

  if (allBusinesses.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No businesses yet</td></tr>';
    return;
  }

  tbody.innerHTML = allBusinesses.map(business => `
    <tr>
      <td>${business.id}</td>
      <td><strong>${business.name}</strong></td>
      <td>${new Date(business.created_at).toLocaleDateString()}</td>
      <td>
        <button onclick="editBusiness(${business.id})" style="background: #3498db; padding: 6px 12px; font-size: 12px; margin-right: 5px;">Edit</button>
        <button onclick="deleteBusiness(${business.id})" style="background: #e74c3c; padding: 6px 12px; font-size: 12px; color: white; border: none; border-radius: 4px; cursor: pointer;">Delete</button>
      </td>
    </tr>
  `).join('');

  // Also update the Create User business dropdown
  populateBusinessDropdownForUser();
}

async function createBusiness() {
  const name = document.getElementById('businessName').value.trim();

  if (!name) {
    showMessage('Business name is required', 'error', 'businessMessage');
    return;
  }

  try {
    const { data, error } = await window.supabase
      .from('business_entities')
      .insert([{ name }])
      .select();

    if (error) throw error;

    showMessage('✅ Business created successfully', 'success', 'businessMessage');
    document.getElementById('businessName').value = '';
    document.getElementById('createBusinessModal').classList.remove('show');
    await loadBusinesses();
  } catch (err) {
    showMessage('Error creating business: ' + err.message, 'error', 'businessMessage');
  }
}

function editBusiness(id) {
  showMessage('Edit functionality coming soon', 'success', 'businessMessage');
}

function deleteBusiness(businessId) {
  const business = allBusinesses.find(b => b.id === businessId);
  deleteTarget = { type: 'business', id: businessId };
  document.getElementById('deleteMessage').textContent = `Delete business "${business.name}"? This cannot be undone.`;
  document.getElementById('deleteModal').classList.add('show');
}

function populateBusinessSelects() {
  document.getElementById('branchBusiness').innerHTML =
    '<option value="">Select a business...</option>' +
    allBusinesses.map(b => `<option value="${b.id}">${b.name}</option>`).join('');

  const branchBusinessModal = document.getElementById('branchBusinessModal');
  if (branchBusinessModal) {
    branchBusinessModal.innerHTML =
      '<option value="">Select a business...</option>' +
      allBusinesses.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
  }
}

// ============================================================================
// BRANCHES
// ============================================================================

async function loadBranches() {
  try {
    const { data, error } = await window.supabase
      .from('branches')
      .select('id, name, location_code, address, business_id, created_at')
      .order('business_id');

    if (error) throw error;

    allBranches = data || [];
    renderBranches();
    updateStats();
  } catch (err) {
    console.error('Error loading branches:', err);
  }
}

function renderBranches() {
  const tbody = document.querySelector('#branchesTable tbody');

  if (allBranches.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No branches yet</td></tr>';
    return;
  }

  tbody.innerHTML = allBranches.map(branch => {
    const business = allBusinesses.find(b => b.id === branch.business_id);
    const location = branch.address || branch.location_code || '--';
    return `
      <tr>
        <td>${branch.id}</td>
        <td><strong>${branch.name}</strong></td>
        <td>${business?.name || 'Unknown'}</td>
        <td>${location}</td>
        <td>${branch.phone || '--'}</td>
        <td>
          <button onclick="editBranch(${branch.id})" style="background: #3498db; padding: 6px 12px; font-size: 12px; margin-right: 5px;">Edit</button>
          <button onclick="deleteBranch(${branch.id})" style="background: #e74c3c; padding: 6px 12px; font-size: 12px; color: white; border: none; border-radius: 4px; cursor: pointer;">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function createBranch() {
  const businessId = document.getElementById('branchBusiness').value;
  const name = document.getElementById('branchName').value.trim();
  const address = document.getElementById('branchLocation').value.trim();
  const phone = document.getElementById('branchContact').value.trim();

  if (!businessId || !name) {
    showMessage('Business and branch name are required', 'error', 'branchMessage');
    return;
  }

  try {
    const { data, error } = await window.supabase
      .from('branches')
      .insert([{ business_id: businessId, name, address, phone, status: 'ACTIVE' }])
      .select();

    if (error) throw error;

    showMessage('✅ Branch created successfully', 'success', 'branchMessage');
    document.getElementById('branchName').value = '';
    document.getElementById('branchLocation').value = '';
    document.getElementById('branchContact').value = '';
    await loadBranches();
  } catch (err) {
    showMessage('Error creating branch: ' + err.message, 'error', 'branchMessage');
  }
}

async function createBranchModal() {
  const businessId = document.getElementById('branchBusinessModal').value;
  const name = document.getElementById('branchNameModal').value.trim();
  const address = document.getElementById('branchLocationModal').value.trim();
  const phone = document.getElementById('branchContactModal').value.trim();

  if (!businessId || !name) {
    showMessage('Business and branch name are required', 'error', 'branchMessage');
    return;
  }

  try {
    const { data, error } = await window.supabase
      .from('branches')
      .insert([{ business_id: businessId, name, address, phone, status: 'ACTIVE' }])
      .select();

    if (error) throw error;

    showMessage('✅ Branch created successfully', 'success', 'branchMessage');
    document.getElementById('branchBusinessModal').value = '';
    document.getElementById('branchNameModal').value = '';
    document.getElementById('branchLocationModal').value = '';
    document.getElementById('branchContactModal').value = '';
    document.getElementById('createBranchModal').classList.remove('show');
    await loadBranches();
  } catch (err) {
    showMessage('Error creating branch: ' + err.message, 'error', 'branchMessage');
  }
}

function editBranch(id) {
  showMessage('Edit functionality coming soon', 'success', 'branchMessage');
}

function deleteBranch(branchId) {
  const branch = allBranches.find(b => b.id === branchId);
  deleteTarget = { type: 'branch', id: branchId };
  document.getElementById('deleteMessage').textContent = `Delete branch "${branch.name}"? This cannot be undone.`;
  document.getElementById('deleteModal').classList.add('show');
}

// ============================================================================
// USERS & ROLES MANAGEMENT
// ============================================================================

async function loadBranchesForUser() {
  const businessId = document.getElementById('newUserBusiness').value;
  const branchSelect = document.getElementById('newUserBranch');

  if (!businessId) {
    branchSelect.innerHTML = '<option value="">Select a branch...</option>';
    return;
  }

  try {
    const { data, error } = await window.supabase
      .from('branches')
      .select('id, name')
      .eq('business_id', businessId)
      .order('name');

    if (error) throw error;

    branchSelect.innerHTML = '<option value="">Select a branch...</option>';
    (data || []).forEach(branch => {
      const option = document.createElement('option');
      option.value = branch.id;
      option.textContent = branch.name;
      branchSelect.appendChild(option);
    });
  } catch (err) {
    console.error('Load branches error:', err);
  }
}

function populateBusinessDropdownForUser() {
  const select = document.getElementById('newUserBusiness');
  if (!select) return;

  select.innerHTML = '<option value="">Select a business...</option>';
  allBusinesses.forEach(business => {
    const option = document.createElement('option');
    option.value = business.id;
    option.textContent = business.name;
    select.appendChild(option);
  });
}

async function createNewUser() {
  const businessId = document.getElementById('newUserBusiness').value;
  const branchId = document.getElementById('newUserBranch').value;
  const name = document.getElementById('newUserName').value.trim();
  const email = document.getElementById('newUserEmail').value.trim();
  const password = document.getElementById('newUserPassword').value.trim();

  if (!businessId || !name || !email || !password) {
    showMessage('Business, name, email, and password are required', 'error', 'userMessage');
    return;
  }

  if (password.length < 8) {
    showMessage('Password must be at least 8 characters', 'error', 'userMessage');
    return;
  }

  try {
    // Call Netlify function to create user (handles Auth + Database)
    const response = await fetch('/.netlify/functions/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        password: password,
        name: name,
        role: 'employee',
        business_id: parseInt(businessId)
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create user');
    }

    const result = await response.json();
    const createdUser = result.user;

    const business = allBusinesses.find(b => b.id === parseInt(businessId));
    let successMsg = `✅ User "${name}" created successfully in "${business.name}"`;

    // If branch was selected, assign user to branch access
    if (branchId && createdUser) {
      const branch = allBranches.find(br => br.id === parseInt(branchId));
      successMsg += ` (${branch.name})`;

      // Assign branch access
      try {
        await window.supabase
          .from('user_branch_access')
          .insert([{
            user_id: createdUser.id,
            branch_id: parseInt(branchId),
            role: 'employee',
            is_primary_branch: true,
            status: 'ACTIVE'
          }]);
      } catch (err) {
        console.warn('Branch assignment error:', err.message);
        successMsg += ' (⚠️ branch assignment pending)';
      }
    }

    // Auto-create employee record for the user
    try {
      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || firstName;

      // Generate employee code (format: EMP-YYYYMMDD-XXXXX for uniqueness)
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(5, '0');
      const employeeCode = `EMP-${today}-${randomSuffix}`;

      const { error: empError } = await window.supabase
        .from('employees')
        .insert({
          business_id: parseInt(businessId),
          branch_id: branchId ? parseInt(branchId) : null,
          employee_code: employeeCode,
          first_name: firstName,
          last_name: lastName,
          email: email,
          position: 'employee',
          hire_date: new Date().toISOString().split('T')[0],
          status: 'ACTIVE'
        });

      if (empError) {
        console.warn('Employee auto-creation warning:', empError.message);
        successMsg += ' (⚠️ HR record pending manual setup)';
      } else {
        successMsg += ' + HR record created';
      }
    } catch (err) {
      console.warn('Employee auto-creation error:', err.message);
      successMsg += ' (⚠️ HR record needs manual setup)';
    }

    showMessage(successMsg + ' - User can now login!', 'success', 'userMessage');

    // Clear form
    document.getElementById('newUserBusiness').value = '';
    document.getElementById('newUserBranch').value = '';
    document.getElementById('newUserName').value = '';
    document.getElementById('newUserEmail').value = '';
    document.getElementById('newUserPassword').value = '';
    document.getElementById('createUserModal').classList.remove('show');

    // Reload users
    await loadUsers();
  } catch (err) {
    console.error('Create user error:', err);
    showMessage('Error creating user: ' + err.message, 'error', 'userMessage');
  }
}

async function loadUsers() {
  try {
    const { data, error } = await window.supabase
      .from('users')
      .select('id, name, email, role, business_id')
      .order('name');

    if (error) throw error;

    allUsers = data || [];
    renderUsers();
    populateUserSelect();
    updateStats();
  } catch (err) {
    console.error('Error loading users:', err);
  }
}

function populateUserSelect() {
  const select = document.getElementById('userSelect');

  select.innerHTML = '<option value="">Choose a user...</option>' +
    allUsers.map(user => `
      <option value="${user.id}">${user.name} (${user.email})</option>
    `).join('');
}

function populateRoleSelect() {
  const select = document.getElementById('roleSelect');

  select.innerHTML = '<option value="">Choose a role...</option>' +
    allRoles.map(role => `
      <option value="${role.code}">${role.name} (Level: ${role.hierarchy_level})</option>
    `).join('');
}

function onUserChange() {
  selectedFunctionalRoles = [];
  updateSelectedRolesDisplay();
}

function onRoleChange() {
  const roleCode = document.getElementById('roleSelect').value;

  if (!roleCode) {
    document.getElementById('suggestionBox').style.display = 'none';
    return;
  }

  // Get suggested functional roles
  const suggested = ROLE_SUGGESTIONS[roleCode] || [];
  const suggestedFunctions = allFunctions.filter(f => suggested.includes(f.code));

  // Display suggestions
  const suggestionBox = document.getElementById('suggestionBox');
  const suggestedRolesDiv = document.getElementById('suggestedRoles');

  if (suggestedFunctions.length > 0) {
    suggestedRolesDiv.innerHTML = suggestedFunctions
      .map(fn => `
        <div class="suggested-role" onclick="toggleFunctionRole(${fn.id}, '${fn.code}')" style="padding: 8px 12px; background: #1e1e2e; border: 1px solid #667eea; border-radius: 4px; cursor: pointer; color: #e0e0e0; white-space: nowrap;">
          ${fn.icon} ${fn.name}
        </div>
      `)
      .join('');

    // Auto-select all suggested roles
    selectedFunctionalRoles = suggestedFunctions.map(f => f.id);
    updateSelectedRolesDisplay();

    suggestionBox.style.display = 'block';
  } else {
    suggestionBox.style.display = 'none';
  }
}

function toggleFunctionRole(functionId, functionCode) {
  if (selectedFunctionalRoles.includes(functionId)) {
    selectedFunctionalRoles = selectedFunctionalRoles.filter(id => id !== functionId);
  } else {
    selectedFunctionalRoles.push(functionId);
  }
  updateSelectedRolesDisplay();
}

function updateSelectedRolesDisplay() {
  const display = document.getElementById('selectedRolesDisplay');

  if (selectedFunctionalRoles.length === 0) {
    display.innerHTML = '<span style="color: #666;">No roles selected yet</span>';
    return;
  }

  const selectedFns = allFunctions.filter(f => selectedFunctionalRoles.includes(f.id));
  display.innerHTML = selectedFns.map(fn => `
    <span style="display: inline-block; padding: 6px 12px; background: #667eea; color: white; border-radius: 4px; margin-right: 8px; margin-bottom: 8px;">
      ${fn.icon} ${fn.name}
      <span style="cursor: pointer; margin-left: 8px;" onclick="toggleFunctionRole(${fn.id}, '${fn.code}')">×</span>
    </span>
  `).join('');
}

async function assignRolesToUser() {
  const userId = document.getElementById('userSelect').value;
  const roleCode = document.getElementById('roleSelect').value;

  if (!userId || !roleCode || selectedFunctionalRoles.length === 0) {
    showMessage('Please select user, role, and at least one functional role', 'error', 'userMessage');
    return;
  }

  try {
    const context = getBranchContext();
    const user = allUsers.find(u => u.id === parseInt(userId));
    const userUUID = convertToUUID(userId);
    const role = allRoles.find(r => r.code === roleCode);

    // Assign main role
    const { data, error } = await window.supabase.rpc('assign_user_role', {
      p_user_id: userUUID,
      p_assigned_by: getAuthUUID(),
      p_business_id: context.business_id,
      p_role_id: role.id
    });

    if (error) throw error;

    showMessage(`✅ Role "${role.name}" assigned to ${user.name}`, 'success', 'userMessage');
    document.getElementById('userSelect').value = '';
    document.getElementById('roleSelect').value = '';
    selectedFunctionalRoles = [];
    updateSelectedRolesDisplay();
    await loadUsers();
  } catch (err) {
    showMessage('Error assigning role: ' + err.message, 'error', 'userMessage');
  }
}

function renderUsers() {
  const tbody = document.querySelector('#usersTable tbody');

  if (allUsers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No users yet</td></tr>';
    return;
  }

  tbody.innerHTML = allUsers.map(user => {
    const business = allBusinesses.find(b => b.id === user.business_id);
    return `
      <tr>
        <td>${user.name}</td>
        <td>${user.email}</td>
        <td><span class="badge badge-success">${user.role}</span></td>
        <td>${business?.name || 'Unknown'}</td>
        <td>
          <button onclick="editUserRole(${user.id})" style="background: #3498db; padding: 6px 12px; font-size: 12px; margin-right: 5px;">Assign</button>
        </td>
      </tr>
    `;
  }).join('');
}

function editUserRole(id) {
  const user = allUsers.find(u => u.id === id);
  if (user) {
    document.getElementById('userSelect').value = id;
    showTab('users');
  }
}

// ============================================================================
// ROLES CONFIGURATION
// ============================================================================

async function loadRoles() {
  try {
    const { data, error } = await window.supabase
      .from('roles')
      .select('id, code, name, hierarchy_level, description')
      .eq('is_active', true)
      .order('hierarchy_level');

    if (error) throw error;

    allRoles = data || [];
    populateRoleSelect();
    renderRolesConfig();
    updateStats();
  } catch (err) {
    console.error('Error loading roles:', err);
  }
}

async function loadFunctions() {
  try {
    const { data, error } = await window.supabase
      .from('functions')
      .select('id, code, name, module, icon')
      .eq('is_active', true);

    if (error) throw error;

    allFunctions = data || [];
  } catch (err) {
    console.error('Error loading functions:', err);
  }
}

function renderRolesConfig() {
  const tbody = document.querySelector('#rolesTable tbody');

  tbody.innerHTML = allRoles.map(role => {
    const roleFunctions = allFunctions.filter(f => {
      const suggested = ROLE_SUGGESTIONS[role.code] || [];
      return suggested.includes(f.code);
    });

    return `
      <tr>
        <td><strong>${role.name}</strong></td>
        <td><span class="badge">${role.hierarchy_level}</span></td>
        <td>${role.description || '--'}</td>
        <td>
          ${roleFunctions.map(f => `<small>${f.icon} ${f.name}</small>`).join('<br>')}
        </td>
      </tr>
    `;
  }).join('');
}

// ============================================================================
// TAB SWITCHING
// ============================================================================

function showTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  const tab = document.getElementById(tabName);
  if (tab) {
    tab.classList.add('active');
  }
}

// ============================================================================
// MODALS & DELETION
// ============================================================================

function closeDeleteModal() {
  document.getElementById('deleteModal').classList.remove('show');
  deleteTarget = null;
}

async function confirmDelete() {
  if (!deleteTarget) return;

  try {
    if (deleteTarget.type === 'business') {
      const { error } = await window.supabase
        .from('business_entities')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) throw error;

      showMessage('✅ Business deleted', 'success', 'businessMessage');
      await loadBusinesses();
    } else if (deleteTarget.type === 'branch') {
      const { error } = await window.supabase
        .from('branches')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) throw error;

      showMessage('✅ Branch deleted', 'success', 'branchMessage');
      await loadBranches();
    }

    closeDeleteModal();
  } catch (err) {
    showMessage('Error deleting: ' + err.message, 'error', 'businessMessage');
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function convertToUUID(numericId) {
  return `00000000-0000-0000-0000-${String(numericId).padStart(12, '0')}`;
}

function showMessage(message, type, elementId) {
  const el = document.getElementById(elementId || 'messageBox');
  if (!el) return;

  el.textContent = message;
  el.className = `message ${type}`;
  el.style.display = 'block';

  setTimeout(() => {
    el.style.display = 'none';
  }, 4000);
}

function logout() {
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  window.location.href = 'login.html';
}
