/**
 * Supabase Global Initialization
 *
 * SECURITY: Credentials are loaded from environment variables or backend.
 * NEVER hardcode credentials in this file.
 *
 * Every other module in this app (hr.js, sales.js, accounting.js, payroll.js,
 * employee-landing.js, etc.) calls window.supabase.rpc()/.from() synchronously
 * as soon as its own script runs - none of them await window.supabaseReady.
 * That means this file MUST finish initializing window.supabase as the real
 * client before its own <script> tag finishes executing, or every later
 * script gets the raw un-initialized supabase-js library object instead
 * (which has .createClient but no .rpc/.from, causing "is not a function").
 *
 * A normal async fetch() cannot guarantee that ordering, so this uses a
 * synchronous XHR for the one-time config lookup. It blocks the main thread
 * briefly during initial page load only - the same tradeoff every page here
 * already implicitly relied on when the config used to be a hardcoded
 * constant instead of coming from the network.
 *
 * Configuration sources (tried in order):
 *   1. window.__SUPABASE_URL__ / window.__SUPABASE_ANON_KEY__ (build-time injection, if ever added)
 *   2. /.netlify/functions/config (Netlify static hosting - the deployed production path)
 *   3. /api/config (Express server.js - local `node server.js` dev only)
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

  function showConfigErrorBanner() {
    if (!document.body) return;
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#ff4444;color:white;padding:15px;text-align:center;z-index:99999;font-family:Arial,sans-serif;font-size:14px';
    errorDiv.textContent = '⚠️ Configuration error: Unable to connect to backend. Please refresh the page or contact support.';
    document.body.appendChild(errorDiv);
  }

  // Synchronous GET. Returns parsed JSON only if the response actually looks
  // like JSON (Netlify's catch-all SPA redirect serves login.html, 200 OK,
  // for any unmatched path - this keeps that from being mistaken for config).
  function fetchConfigSync(url) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, false); // false = synchronous
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.send(null);

      if (xhr.status < 200 || xhr.status >= 300) return null;

      const contentType = xhr.getResponseHeader('content-type') || '';
      if (!contentType.includes('application/json')) return null;

      const config = JSON.parse(xhr.responseText);
      if (!config.supabase_url || !config.supabase_anon_key) return null;
      return config;
    } catch (err) {
      console.warn(`⚠️ Config source ${url} failed:`, err.message);
      return null;
    }
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

  const sources = ['/.netlify/functions/config', '/api/config'];
  let config = null;

  for (const source of sources) {
    config = fetchConfigSync(source);
    if (config && isValidSupabaseUrl(config.supabase_url)) {
      window.supabase = createClient(config.supabase_url, config.supabase_anon_key);
      window.supabaseReady = Promise.resolve(window.supabase);
      console.log(`✅ Supabase initialized from ${source}`);
      return;
    }
    config = null;
  }

  console.error('❌ FATAL: Supabase initialization failed - no working config source found');
  showConfigErrorBanner();
  window.supabaseReady = Promise.reject(new Error('Unable to load Supabase configuration from any source'));
  window.supabaseReady.catch(() => {}); // prevent unhandled rejection noise
})();
