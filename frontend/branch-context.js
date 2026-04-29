// ============================================================================
// ZAI FLOW 2.0 - BRANCH CONTEXT MANAGEMENT
// Retrieves user context from localStorage and provides utility functions
// ============================================================================

// Get branch/business context from localStorage
function getBranchContext() {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      console.warn('⚠️ No user data in localStorage');
      return null;
    }

    const user = JSON.parse(userStr);

    return {
      user_id: user.id,
      user_name: user.name,
      user_email: user.email,
      user_role: user.role,
      business_id: user.current_business_id || user.business_id || 1,
      branch_id: user.current_branch_id || user.branch_id || 1,
      business_name: user.business_name || 'Default Business',
      branch_name: user.branch_name || 'Main Branch'
    };
  } catch (err) {
    console.error('❌ Error reading branch context:', err);
    return null;
  }
}

// Apply branch filter to Supabase queries
function withBranchFilter(query) {
  const context = getBranchContext();
  if (!context) {
    console.error('❌ No branch context available');
    return query;
  }

  // Filter by branch_id if it's a field in the table
  return query.eq('branch_id', context.branch_id);
}

// Check if user is logged in
function isLoggedIn() {
  const context = getBranchContext();
  return context && context.user_id;
}

// Get user role
function getUserRole() {
  const context = getBranchContext();
  return context ? context.user_role : null;
}

// Log out user
function logoutUser() {
  if (confirm('Are you sure you want to logout?')) {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('branch_context');
    window.location.href = 'login.html';
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  const context = getBranchContext();

  if (!context) {
    console.warn('⚠️ User not logged in, some features may not work');
    return;
  }

  console.log('✅ Branch context loaded:', {
    user: context.user_name,
    role: context.user_role,
    business: context.business_name,
    branch: context.branch_name
  });
});
