/**
 * Session Inactivity Timeout
 *
 * Warns at 4 minutes of inactivity, signs the user out at 5.
 *
 * Loaded on every authenticated page. Self-initialising - no setup call needed.
 * Activity is shared across browser tabs via localStorage, so working in one
 * tab keeps the others alive rather than logging you out behind your back.
 */

(function sessionTimeout() {
  'use strict';

  const WARN_AFTER_MS   = 4 * 60 * 1000;  // show countdown at 4 minutes
  const LOGOUT_AFTER_MS = 5 * 60 * 1000;  // sign out at 5 minutes
  const ACTIVITY_KEY    = 'zaiflow_last_activity';
  const TICK_MS         = 1000;
  const WRITE_THROTTLE_MS = 1000;         // don't hammer localStorage on mousemove

  // Never run on the login page - there's no session to expire.
  if (/login\.html$/i.test(window.location.pathname)) return;

  let lastWriteAt = 0;
  let warningEl = null;

  function now() { return Date.now(); }

  function getLastActivity() {
    const stored = parseInt(localStorage.getItem(ACTIVITY_KEY), 10);
    return Number.isFinite(stored) ? stored : now();
  }

  function recordActivity() {
    const t = now();
    // Throttle writes, but always allow one through while the warning is up so
    // that clicking "Stay signed in" registers immediately.
    if (!warningEl && t - lastWriteAt < WRITE_THROTTLE_MS) return;
    lastWriteAt = t;
    localStorage.setItem(ACTIVITY_KEY, String(t));
    if (warningEl) dismissWarning();
  }

  function clearSession() {
    ['token', 'user', 'session', 'branch_context', ACTIVITY_KEY]
      .forEach(k => localStorage.removeItem(k));
  }

  function signOut() {
    clearSession();

    // Flag the reason in sessionStorage rather than relying on a query string.
    // Some static hosts rewrite "/login.html" to "/login" and drop the query
    // in the process, which would silently swallow the explanation.
    try { sessionStorage.setItem('zaiflow_signout_reason', 'timeout'); } catch (_) { /* ignore */ }

    // Best effort - don't block the redirect if Supabase auth isn't ready.
    try {
      if (window.supabase && window.supabase.auth && window.supabase.auth.signOut) {
        window.supabase.auth.signOut();
      }
    } catch (_) { /* ignore */ }

    window.location.replace('login.html?reason=timeout');
  }

  function dismissWarning() {
    if (!warningEl) return;
    warningEl.remove();
    warningEl = null;
  }

  function showWarning() {
    if (warningEl) return;

    warningEl = document.createElement('div');
    warningEl.setAttribute('role', 'alertdialog');
    warningEl.setAttribute('aria-live', 'assertive');
    warningEl.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483647',
      'display:flex', 'align-items:center', 'justify-content:center',
      'background:rgba(2,6,23,0.72)', 'backdrop-filter:blur(4px)',
      'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif'
    ].join(';');

    warningEl.innerHTML = `
      <div style="background:#0f172a;color:#e2e8f0;border:1px solid rgba(148,163,184,0.25);
                  border-radius:16px;padding:28px;max-width:min(420px,calc(100vw - 32px));
                  width:100%;text-align:center;box-shadow:0 24px 48px rgba(0,0,0,0.45)">
        <div style="font-size:40px;line-height:1;margin-bottom:12px">⏳</div>
        <h2 style="margin:0 0 8px;font-size:19px;font-weight:700;color:#f8fafc">
          Still there?
        </h2>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#94a3b8">
          You'll be signed out in
          <strong id="zf-timeout-count" style="color:#f8fafc">60</strong> seconds
          because of inactivity.
        </p>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button type="button" id="zf-stay"
            style="flex:1 1 140px;padding:12px 16px;border:0;border-radius:10px;cursor:pointer;
                   background:#3b82f6;color:#fff;font-size:14px;font-weight:600">
            Stay signed in
          </button>
          <button type="button" id="zf-signout"
            style="flex:1 1 120px;padding:12px 16px;border-radius:10px;cursor:pointer;
                   background:transparent;color:#cbd5e1;font-size:14px;font-weight:600;
                   border:1px solid rgba(148,163,184,0.35)">
            Sign out now
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(warningEl);
    warningEl.querySelector('#zf-stay').addEventListener('click', recordActivity);
    warningEl.querySelector('#zf-signout').addEventListener('click', signOut);
  }

  function tick() {
    const idleFor = now() - getLastActivity();

    if (idleFor >= LOGOUT_AFTER_MS) {
      signOut();
      return;
    }

    if (idleFor >= WARN_AFTER_MS) {
      showWarning();
      const remaining = Math.max(0, Math.ceil((LOGOUT_AFTER_MS - idleFor) / 1000));
      const counter = document.getElementById('zf-timeout-count');
      if (counter) counter.textContent = remaining;
    } else if (warningEl) {
      // Another tab registered activity - stand down.
      dismissWarning();
    }
  }

  // Passive listeners so scrolling stays smooth.
  ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
    .forEach(evt => document.addEventListener(evt, recordActivity, { passive: true }));

  // Returning from a sleeping laptop or a background tab: re-check at once
  // rather than waiting for the next tick.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tick();
  });
  window.addEventListener('focus', tick);

  localStorage.setItem(ACTIVITY_KEY, String(now()));
  setInterval(tick, TICK_MS);
})();
