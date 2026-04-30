// ============================================================================
// DISPLAY BRANCH CONTEXT UTILITY
// Shows current branch/business in page header for all ERP pages
// ============================================================================

/**
 * Initialize and display branch context in the page header
 * Call this on page load to display "Working at: Business Name - Branch"
 */
function initializeBranchDisplay() {
  const user = JSON.parse(localStorage.getItem('user'));

  if (!user || !user.current_branch_id) {
    console.warn('⚠️ Branch context not available yet, retrying...');
    // Retry after 200ms
    setTimeout(() => initializeBranchDisplay(), 200);
    return false;
  }

  const context = getBranchContext();

  if (!context) {
    console.warn('⚠️ Branch context not available yet');
    return false;
  }

  // Update branch dropdown if it exists
  const branchDropdown = document.getElementById('branchDropdown');
  const user = JSON.parse(localStorage.getItem('user'));

  if (branchDropdown && user?.branches) {
    branchDropdown.innerHTML = '';

    user.branches.forEach(branch => {
      const option = document.createElement('option');
      option.value = branch.branch_id;
      option.textContent = `${branch.business_name} - ${branch.branch_name}`;
      option.selected = branch.branch_id === context.branch_id;
      branchDropdown.appendChild(option);
    });

    // Add change listener for branch switching
    branchDropdown.addEventListener('change', (e) => {
      switchBranch(e.target.value);
      location.reload();
    });
  }

  // Update user info section to show current working location
  const userInfo = document.getElementById('userInfo');
  if (userInfo) {
    userInfo.innerHTML = `
      <div style="text-align: right; font-size: 13px;">
        <div style="color: #999;">Working at</div>
        <div style="color: #00d4ff; font-weight: 500;">${context.business_name} - ${context.branch_name}</div>
        <div style="color: #999; font-size: 12px;">${context.user_role}</div>
      </div>
    `;
  }

  console.log('✅ Branch display initialized:', {
    business: context.business_name,
    branch: context.branch_name,
    role: context.user_role
  });

  return true;
}

/**
 * Update the page title to include branch info
 * Optional: adds branch name to browser tab title
 */
function updatePageTitle(pageName) {
  const context = getBranchContext();
  if (context) {
    document.title = `${pageName} - ${context.business_name} - ZAI Flow`;
  }
}
