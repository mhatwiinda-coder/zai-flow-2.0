/**
 * Dynamic Sidebar Manager
 * Loads only modules the user has access to based on their role
 * Used by all ERP pages (dashboard.html, sales.html, inventory.html, etc.)
 */

async function initializeDynamicSidebar() {
  console.log("🔄 Initializing dynamic sidebar...");

  const context = getBranchContext();
  console.log("📍 Context:", context);

  if (!context) {
    console.error("❌ No user context available");
    return;
  }

  try {
    // Get user's accessible modules
    console.log(`📡 Calling RPC: get_user_accessible_modules for user ${context.user_id} in business ${context.business_id}`);

    const { data: modules, error } = await window.supabase.rpc(
      'get_user_accessible_modules',
      {
        p_user_id: context.user_id,
        p_business_id: context.business_id
      }
    );

    if (error) {
      console.error("❌ RPC Error:", error);
      console.error("Error details:", error.message, error.code, error.details);
      return;
    }

    console.log("📦 Modules returned:", modules);

    if (!modules || modules.length === 0) {
      console.warn("⚠️ No modules returned from RPC");
      return;
    }

    // Build module map for quick lookup
    const moduleMap = new Map();
    modules.forEach(mod => {
      if (!moduleMap.has(mod.module)) {
        moduleMap.set(mod.module, []);
      }
      moduleMap.get(mod.module).push(mod);
    });

    console.log("🗺️ Module Map:", Array.from(moduleMap.keys()));

    // Update sidebar with accessible modules only
    updateSidebar(moduleMap, context);

  } catch (err) {
    console.error("❌ Failed to initialize sidebar:", err);
  }
}

function updateSidebar(moduleMap, context) {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) {
    console.warn("⚠️ Sidebar element not found");
    return;
  }

  console.log("🧹 Clearing sidebar links...");

  // Find the logout link (keep it at the bottom)
  const logoutLink = Array.from(sidebar.querySelectorAll('a')).find(a =>
    a.textContent.toLowerCase().includes('logout')
  );

  // Clear ALL existing nav links (including those hardcoded in HTML)
  sidebar.querySelectorAll('a:not([href*="logout"])').forEach(link => {
    link.remove();
  });

  // Also remove any dividers that were added
  sidebar.querySelectorAll('div').forEach(div => {
    if (div.style.borderTop) {
      div.remove();
    }
  });

  // Module order for consistent display
  const moduleOrder = ['dashboard', 'sales', 'inventory', 'accounting', 'purchasing', 'hr_payroll', 'bi'];

  console.log("➕ Adding accessible modules...");

  // Add accessible modules in order
  let addedCount = 0;
  moduleOrder.forEach(moduleType => {
    if (moduleMap.has(moduleType)) {
      addedCount++;
      const moduleFunctions = moduleMap.get(moduleType);

      const moduleConfig = {
        dashboard: { href: 'dashboard.html', text: '📊 Dashboard' },
        sales: { href: 'sales.html', text: '🛒 Sales / POS' },
        inventory: { href: 'inventory.html', text: '📦 Inventory' },
        accounting: { href: 'accounting.html', text: '📋 Accounting' },
        purchasing: { href: 'purchasing.html', text: '🏢 Purchasing' },
        hr_payroll: { href: 'hr.html', text: '👥 HR & Payroll' },
        bi: { href: 'bi.html', text: '📈 BI Dashboard' }
      };

      if (moduleConfig[moduleType]) {
        const link = document.createElement('a');
        link.href = moduleConfig[moduleType].href;
        link.textContent = moduleConfig[moduleType].text;
        link.className = 'sidebar-link';
        sidebar.appendChild(link);
        console.log(`  ✅ Added: ${moduleConfig[moduleType].text}`);
      }
    }
  });

  console.log(`📊 Total modules added: ${addedCount}`);

  // Add admin section if user is admin
  if (context.user_role === 'admin') {
    console.log("🔐 User is admin - adding admin section");
    const divider = document.createElement('div');
    divider.style.borderTop = '1px solid #444';
    divider.style.margin = '10px 0';
    sidebar.appendChild(divider);

    const adminDashLink = document.createElement('a');
    adminDashLink.href = 'admin-business.html';
    adminDashLink.textContent = '⚙️ Admin Business';
    adminDashLink.className = 'sidebar-link';
    sidebar.appendChild(adminDashLink);
  }

  // Add logout link at the end
  if (logoutLink) {
    sidebar.appendChild(logoutLink);
  } else {
    const newLogoutLink = document.createElement('a');
    newLogoutLink.href = '#';
    newLogoutLink.textContent = 'Logout';
    newLogoutLink.onclick = (e) => {
      e.preventDefault();
      logoutUser();
    };
    newLogoutLink.className = 'sidebar-link';
    sidebar.appendChild(newLogoutLink);
  }

  // Highlight current page
  const currentPage = location.pathname.split("/").pop() || 'dashboard.html';
  document.querySelectorAll('.sidebar a').forEach(link => {
    if (link.getAttribute("href") === currentPage) {
      link.classList.add("active");
    }
  });

  console.log(`✅ Sidebar updated - ${addedCount} module(s) visible for user`);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log("📄 Page loaded, initializing sidebar...");
  initializeDynamicSidebar();
});
