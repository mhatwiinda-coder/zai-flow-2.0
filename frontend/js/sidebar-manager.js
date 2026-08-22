/**
 * Dynamic Sidebar Manager
 * Loads only modules the user has access to based on their role
 * Used by all ERP pages (dashboard.html, sales.html, inventory.html, etc.)
 */

/**
 * Inline stroke icons, 18px, currentColor - so they inherit link color and
 * highlight with the active state. Replaces the emoji labels that used to
 * prefix each nav item.
 */
// `var` not `const`: a page that accidentally includes this file twice would
// throw "Identifier 'ICONS' has already been declared" with const, and that
// SyntaxError aborts the whole file - taking the sidebar down with it. var
// redeclares harmlessly, so a duplicate include degrades to a no-op instead
// of breaking navigation.
var ICONS = ICONS || (() => {
  const w = (p) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  return {
    dashboard:  w('<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>'),
    sales:      w('<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>'),
    inventory:  w('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>'),
    purchasing: w('<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>'),
    accounting: w('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'),
    approvals:  w('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'),
    hr:         w('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    bi:         w('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'),
    admin:      w('<path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/>'),
    roles:      w('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
    logout:     w('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>')
  };
})();

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
    const authUUID = getAuthUUID();
    if (!authUUID) {
      console.error('❌ User auth UUID not found');
      return;
    }

    console.log(`📡 Calling RPC: get_user_accessible_modules for business ${context.business_id}`);

    const { data: modules, error } = await window.supabase.rpc(
      'get_user_accessible_modules',
      {
        p_user_id: authUUID,
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

  // Remove any previously-rendered nav scaffolding so re-runs don't stack up
  sidebar.querySelectorAll('.sidebar-group, .sidebar-group-label, .sidebar-user').forEach(el => el.remove());

  // Modules grouped into sections, matching the reference layout
  // (grouped nav with quiet uppercase section headings).
  const SECTIONS = [
    { label: null,        modules: ['dashboard'] },
    { label: 'Operations', modules: ['sales', 'inventory', 'purchasing'] },
    { label: 'Finance',    modules: ['accounting', 'approvals'] },
    { label: 'People',     modules: ['hr_payroll'] },
    { label: 'Analytics',  modules: ['bi'] }
  ];

  const MODULES = {
    dashboard:  { href: 'dashboard.html',  text: 'Dashboard',   icon: ICONS.dashboard },
    sales:      { href: 'sales.html',      text: 'Sales / POS', icon: ICONS.sales },
    inventory:  { href: 'inventory.html',  text: 'Inventory',   icon: ICONS.inventory },
    purchasing: { href: 'purchasing.html', text: 'Purchasing',  icon: ICONS.purchasing },
    accounting: { href: 'accounting.html', text: 'Accounting',  icon: ICONS.accounting },
    approvals:  { href: 'approvals.html',  text: 'Approvals',   icon: ICONS.approvals },
    hr_payroll: { href: 'hr.html',         text: 'HR & Payroll',icon: ICONS.hr },
    bi:         { href: 'bi.html',         text: 'BI Dashboard',icon: ICONS.bi }
  };

  // Compare pages by normalized basename. Hosts that serve "pretty" URLs give
  // a pathname of "/hr" rather than "/hr.html", so a raw string compare
  // against the link's "hr.html" never matched and the active state silently
  // never applied.
  const normalizePage = (p) =>
    (p || '').split('/').pop().split('?')[0].split('#')[0].replace(/\.html$/i, '').toLowerCase() || 'dashboard';

  const currentPage = normalizePage(location.pathname);

  function makeLink(cfg) {
    const a = document.createElement('a');
    a.href = cfg.href;
    a.className = 'sidebar-link';
    a.innerHTML = `<span class="sidebar-icon">${cfg.icon}</span><span class="sidebar-text">${cfg.text}</span>`;
    if (normalizePage(cfg.href) === currentPage) a.classList.add('active');
    return a;
  }

  let addedCount = 0;

  SECTIONS.forEach(section => {
    const available = section.modules.filter(m => moduleMap.has(m) && MODULES[m]);
    if (!available.length) return;

    const group = document.createElement('div');
    group.className = 'sidebar-group';

    if (section.label) {
      const label = document.createElement('div');
      label.className = 'sidebar-group-label';
      label.textContent = section.label;
      group.appendChild(label);
    }

    available.forEach(m => {
      group.appendChild(makeLink(MODULES[m]));
      addedCount++;
    });

    sidebar.appendChild(group);
  });

  // Admin section, only for admins
  if (context.user_role === 'admin') {
    const group = document.createElement('div');
    group.className = 'sidebar-group';

    const label = document.createElement('div');
    label.className = 'sidebar-group-label';
    label.textContent = 'Administration';
    group.appendChild(label);

    group.appendChild(makeLink({ href: 'admin-business.html', text: 'Admin Business', icon: ICONS.admin }));
    group.appendChild(makeLink({ href: 'admin-roles.html', text: 'Roles & Access', icon: ICONS.roles }));

    sidebar.appendChild(group);
  }

  // User card pinned to the bottom, as in the reference. Replaces the bare
  // "Logout" link - the logout action moves into this card.
  const user = getSidebarUser(context);
  const card = document.createElement('div');
  card.className = 'sidebar-user';
  card.innerHTML = `
    <div class="sidebar-user-avatar">${escapeSidebarHtml(user.initials)}</div>
    <div class="sidebar-user-meta">
      <div class="sidebar-user-name">${escapeSidebarHtml(user.name)}</div>
      <div class="sidebar-user-role">${escapeSidebarHtml(user.role)}</div>
    </div>
    <button type="button" class="sidebar-user-logout" title="Sign out" aria-label="Sign out">${ICONS.logout}</button>
  `;
  card.querySelector('.sidebar-user-logout').addEventListener('click', () => {
    if (typeof logout === 'function') return logout();
    if (typeof logoutUser === 'function') return logoutUser();
    ['token','user','session','branch_context'].forEach(k => localStorage.removeItem(k));
    window.location.href = 'login.html';
  });
  sidebar.appendChild(card);

  // The old markup had a plain Logout <a>; it's superseded by the card above.
  if (logoutLink) logoutLink.remove();

  console.log(`✅ Sidebar updated - ${addedCount} module(s) visible for user`);
}

function getSidebarUser(context) {
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem('user')) || {}; } catch (_) {}
  const name = stored.name || 'User';
  const initials = name.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase() || 'U';
  const role = context.user_role || stored.role || 'Member';
  return { name, initials, role: role.charAt(0).toUpperCase() + role.slice(1) };
}

function escapeSidebarHtml(str) {
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log("📄 Page loaded, initializing sidebar...");
  initializeDynamicSidebar();
});
