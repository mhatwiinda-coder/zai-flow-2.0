/**
 * Mobile Sidebar Toggle
 *
 * The shared .sidebar becomes an off-canvas drawer under 900px (see the
 * "MOBILE SIDEBAR" rules in style.css). This injects the hamburger button
 * and dimmed backdrop needed to open/close it - nothing else on the page
 * needs to change.
 *
 * Self-initializing. Safe to include on every page; does nothing if there's
 * no .sidebar element (e.g. login.html).
 */
(function mobileNav() {
  'use strict';

  function init() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    // SVG rather than the ☰ / ✕ glyphs, so the icon renders identically
    // across platforms and matches the rest of the icon set.
    const svg = (paths) =>
      `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
    const ICON_MENU  = svg('<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>');
    const ICON_CLOSE = svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>');

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'zf-sidebar-toggle';
    toggle.setAttribute('aria-label', 'Toggle navigation menu');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = ICON_MENU;

    const backdrop = document.createElement('div');
    backdrop.className = 'zf-sidebar-backdrop';

    document.body.appendChild(toggle);
    document.body.appendChild(backdrop);

    function open() {
      sidebar.classList.add('zf-sidebar-open');
      backdrop.classList.add('zf-sidebar-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.innerHTML = ICON_CLOSE;
    }

    function close() {
      sidebar.classList.remove('zf-sidebar-open');
      backdrop.classList.remove('zf-sidebar-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.innerHTML = ICON_MENU;
    }

    toggle.addEventListener('click', () => {
      sidebar.classList.contains('zf-sidebar-open') ? close() : open();
    });

    backdrop.addEventListener('click', close);

    // Tapping a nav link should navigate AND close the drawer - without this
    // the next page loads with the drawer already open.
    sidebar.addEventListener('click', (e) => {
      if (e.target.closest('a')) close();
    });

    // sidebar-manager.js rebuilds the sidebar's links after this runs (async
    // RPC-driven), which doesn't remove the toggle/backdrop - they're
    // siblings on <body>, not children of .sidebar - so no re-init needed.

    // Resizing past the breakpoint (e.g. rotating a tablet, or a desktop
    // window resize during dev) should reset to the normal open desktop state.
    window.addEventListener('resize', () => {
      if (window.innerWidth > 900) close();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
