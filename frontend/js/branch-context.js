// ============================================================================
// BRANCH CONTEXT UTILITY
// Multi-tenant branch management for ZAI FLOW 2.0
// ============================================================================

/**
 * Get current branch context from localStorage
 * @returns {Object|null} {branch_id, business_id, business_name, branch_name, user_id}
 */
function getBranchContext() {
  try {
    const user = JSON.parse(localStorage.getItem('user'));

    if (!user || !user.current_branch_id) {
      console.error('❌ No branch context found - user not logged in or branch not set');
      return null;
    }

    const branch = user.branches?.find(b => b.branch_id === user.current_branch_id);

    return {
      branch_id: user.current_branch_id,
      business_id: user.current_business_id,
      business_name: branch?.business_name || 'Unknown',
      branch_name: branch?.branch_name || 'Unknown',
      user_id: user.auth_id,
      user_role: user.role
    };
  } catch (err) {
    console.error('❌ Error getting branch context:', err);
    return null;
  }
}

/**
 * Add branch filtering to a Supabase query
 * Usage: withBranchFilter(supabase.from('sales').select('*'))
 * @param {Object} query - Supabase query builder
 * @returns {Object} Query with branch_id filter applied
 */
function withBranchFilter(query) {
  const context = getBranchContext();

  if (!context) {
    console.error('❌ Cannot apply branch filter - no branch context available');
    throw new Error('No branch context - user may not be logged in');
  }

  return query.eq('branch_id', context.branch_id);
}

/**
 * Check if user has a specific role in current branch
 * @param {String} requiredRole - Role to check (admin, manager, supervisor, cashier, inventory, staff)
 * @returns {Boolean}
 */
function hasRoleInBranch(requiredRole) {
  const user = JSON.parse(localStorage.getItem('user'));
  const branch = user?.branches?.find(b => b.branch_id === user?.current_branch_id);

  if (!branch) return false;

  const roles = {
    'admin': ['admin'],
    'manager': ['admin', 'manager'],
    'supervisor': ['admin', 'manager', 'supervisor'],
    'cashier': ['admin', 'manager', 'supervisor', 'cashier'],
    'inventory': ['admin', 'manager', 'inventory'],
    'staff': ['admin', 'manager', 'supervisor', 'cashier', 'inventory', 'staff']
  };

  const allowedRoles = roles[requiredRole] || [];
  return allowedRoles.includes(branch.role);
}

/**
 * Switch to a different branch
 * @param {Integer} branchId - Branch ID to switch to
 * @returns {Boolean} Success
 */
function switchBranch(branchId) {
  try {
    const user = JSON.parse(localStorage.getItem('user'));

    if (!user?.branches) {
      alert('❌ No branches found for user');
      return false;
    }

    const branch = user.branches.find(b => b.branch_id === parseInt(branchId));

    if (!branch) {
      alert('❌ You do not have access to this branch');
      return false;
    }

    // Update current branch
    user.current_branch_id = branch.branch_id;
    user.current_business_id = branch.business_id;

    // Save to localStorage
    localStorage.setItem('user', JSON.stringify(user));

    // Reload page to fetch branch-specific data
    console.log(`✅ Switched to branch: ${branch.branch_name} (Business: ${branch.business_name})`);
    location.reload();

    return true;
  } catch (err) {
    console.error('❌ Error switching branch:', err);
    alert('Error switching branch: ' + err.message);
    return false;
  }
}

/**
 * Initialize and populate branch selector dropdown
 * Call this in DOMContentLoaded on all pages
 */
function initBranchSelector() {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    const dropdown = document.getElementById('branchDropdown');

    if (!dropdown) {
      console.warn('⚠️  Branch dropdown element not found (branchDropdown)');
      return;
    }

    if (!user?.branches || user.branches.length === 0) {
      dropdown.innerHTML = '<option>No branches available</option>';
      return;
    }

    dropdown.innerHTML = '';

    // Add option for each branch
    user.branches.forEach(branch => {
      const option = document.createElement('option');
      option.value = branch.branch_id;
      option.textContent = `📍 ${branch.business_name} - ${branch.branch_name}`;
      option.selected = branch.branch_id === user.current_branch_id;
      dropdown.appendChild(option);
    });

    // Add change listener
    dropdown.removeEventListener('change', handleBranchChange); // Remove old listener
    dropdown.addEventListener('change', handleBranchChange);

    console.log('✅ Branch selector initialized with', user.branches.length, 'branches');
  } catch (err) {
    console.error('❌ Error initializing branch selector:', err);
  }
}

/**
 * Handle branch dropdown change
 */
function handleBranchChange(event) {
  const branchId = parseInt(event.target.value);
  if (!isNaN(branchId)) {
    switchBranch(branchId);
  }
}

/**
 * Display branch info in header/status area
 */
function displayBranchInfo() {
  const context = getBranchContext();
  const infoEl = document.getElementById('branchInfo');

  if (infoEl && context) {
    infoEl.innerHTML = `
      📍 <strong>${context.branch_name}</strong>
      (${context.business_name})
    `;
  }
}

/**
 * Verify user is logged in and has branch access
 * @returns {Boolean}
 */
function isUserAuthenticated() {
  const user = JSON.parse(localStorage.getItem('user'));
  return !!(user && user.id && user.current_branch_id);
}

/**
 * Redirect to login if not authenticated
 */
function requireAuthentication() {
  if (!isUserAuthenticated()) {
    console.warn('⚠️  User not authenticated, redirecting to login');
    window.location.href = 'login.html';
  }
}

/**
 * Get all branches for current user
 * @returns {Array}
 */
function getAllUserBranches() {
  const user = JSON.parse(localStorage.getItem('user'));
  return user?.branches || [];
}

/**
 * Get all businesses for current user (unique)
 * @returns {Array}
 */
function getAllUserBusinesses() {
  const user = JSON.parse(localStorage.getItem('user'));
  const businesses = new Map();

  user?.branches?.forEach(branch => {
    if (!businesses.has(branch.business_id)) {
      businesses.set(branch.business_id, {
        business_id: branch.business_id,
        business_name: branch.business_name,
        branch_count: 0
      });
    }
    const biz = businesses.get(branch.business_id);
    biz.branch_count++;
  });

  return Array.from(businesses.values());
}

// ============================================================================
// AUTO-INITIALIZE ON PAGE LOAD
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Check authentication
  if (!isUserAuthenticated()) {
    console.warn('⚠️  No authenticated user found');
  } else {
    // Initialize branch selector
    initBranchSelector();

    // Display branch info
    displayBranchInfo();

    // Log current context for debugging
    const context = getBranchContext();
    if (context) {
      console.log('✅ Branch context loaded:', {
        branch: context.branch_name,
        business: context.business_name,
        branch_id: context.branch_id,
        business_id: context.business_id
      });
    }
  }
});

// ============================================================================
// EXPORTS FOR USE IN OTHER MODULES
// ============================================================================
// All functions are globally available:
// - getBranchContext()
// - withBranchFilter()
// - switchBranch()
// - hasRoleInBranch()
// - initBranchSelector()
// - isUserAuthenticated()
// - getAllUserBranches()
// - getAllUserBusinesses()
