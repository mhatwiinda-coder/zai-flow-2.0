/**
 * Supabase Global Initialization
 *
 * SECURITY: Credentials are loaded from environment variables or backend.
 * NEVER hardcode credentials in this file.
 *
 * Configuration sources (tried in order):
 *   1. window.__SUPABASE_URL__ / window.__SUPABASE_ANON_KEY__ (build-time injection, if ever added)
 *   2. /.netlify/functions/config (Netlify static hosting - the deployed production path)
 *   3. /api/config (Express server.js - local `node server.js` dev only; Netlify's
 *      static hosting has no Express routes, so this 404s/redirects there)
 *
 * Usage:
 *   // Synchronous (only if env vars were injected at build time - not currently used):
 *   const { data } = await window.supabase.from('table').select('*');
 *
 *   // Async-safe (always works, this is the one actually used in this app):
 *   await window.supabaseReady;
 *   const { data } = await window.supabase.from('table').select('*');
 */

(function initSupabase() {
  if (!window.supabase || !window.supabase.createClient) {
    console.error('❌ Supabase library not loaded. Make sure the CDN script is loaded first.');
    return;
  }

  const createClient = window.supabase.createClient;

  function isValidSupabaseUrl(url) {
    return typeof url === 'string' && url.startsWith('https://') && url.includes('.supabase.co');
  }

  // Fetch a config endpoint, but only accept it if it actually returned JSON.
  // Netlify's catch-all SPA redirect serves login.html (200 OK, text/html) for
  // any unmatched path, so a naive fetch+.json() would crash trying to parse
  // that HTML as JSON. Checking content-type lets us fall through cleanly instead.
  async function tryFetchConfig(url) {
    const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
    const contentType = response.headers.get('content-type') || '';

    if (!response.ok || !contentType.includes('application/json')) {
      return null;
    }

    const config = await response.json();
    if (!config.supabase_url || !config.supabase_anon_key) {
      return null;
    }
    return config;
  }

  function showConfigErrorBanner() {
    if (!document.body) return;
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#ff4444;color:white;padding:15px;text-align:center;z-index:99999;font-family:Arial,sans-serif;font-size:14px';
    errorDiv.textContent = '⚠️ Configuration error: Unable to connect to backend. Please refresh the page or contact support.';
    document.body.appendChild(errorDiv);
  }

  // Try synchronous initialization with injected env vars, if a future build
  // step ever sets them. Not currently used by this deployment.
  const injectedUrl = window.__SUPABASE_URL__;
  const injectedKey = window.__SUPABASE_ANON_KEY__;

  if (isValidSupabaseUrl(injectedUrl) && injectedKey) {
    window.supabase = createClient(injectedUrl, injectedKey);
    window.supabaseReady = Promise.resolve(window.supabase);
    console.log('✅ Supabase initialized from injected environment');
    return;
  }

  window.supabaseReady = (async () => {
    const sources = ['/.netlify/functions/config', '/api/config'];

    for (const source of sources) {
      try {
        const config = await tryFetchConfig(source);
        if (config && isValidSupabaseUrl(config.supabase_url)) {
          window.supabase = createClient(config.supabase_url, config.supabase_anon_key);
          console.log(`✅ Supabase initialized from ${source}`);
          return window.supabase;
        }
      } catch (err) {
        console.warn(`⚠️ Config source ${source} failed:`, err.message);
      }
    }

    console.error('❌ FATAL: Supabase initialization failed - no working config source found');
    showConfigErrorBanner();
    throw new Error('Unable to load Supabase configuration from any source');
  })();
})();
