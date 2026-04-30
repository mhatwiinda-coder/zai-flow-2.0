// ============================================================================
// DISPLAY BRANCH CONTEXT UTILITY
// Shows current branch/business in page header for all ERP pages
// ============================================================================

/**
 * Initialize and display branch context in the page header
 * Fetches fresh data from Supabase instead of relying on localStorage
 * Call this on page load to display "Working at: Business Name - Branch"
 */
async function initializeBranchDisplay() {
  try {
    const context = await getBranchContext();

    if (!context) {
      console.warn('⚠️ Branch context not available');
      return false;
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
  } catch (err) {
    console.error('❌ Error initializing branch display:', err);
    return false;
  }
}

/**
 * Update the page title to include branch info
 * Optional: adds branch name to browser tab title
 */
async function updatePageTitle(pageName) {
  try {
    const context = await getBranchContext();
    if (context) {
      document.title = `${pageName} - ${context.business_name} - ZAI Flow`;
    }
  } catch (err) {
    console.error('❌ Error updating page title:', err);
  }
}
