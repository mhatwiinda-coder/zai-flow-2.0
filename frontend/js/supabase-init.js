/**
 * Supabase Global Initialization
 *
 * SECURITY: Credentials are loaded from environment variables or backend.
 * NEVER hardcode credentials in this file.
 *
 * Configuration sources (in priority order):
 *   1. window.__SUPABASE_URL__ / window.__SUPABASE_ANON_KEY__ (Netlify injection)
 *   2. /api/config endpoint (backend reads from process.env)
 *
 * Usage:
 *   // Synchronous (if env vars injected):
 *   const { data } = await window.supabase.from('table').select('*');
 *
 *   // Async-safe (works in all cases):
 *   await window.supabaseReady;
 *   const { data } = await window.supabase.from('table').select('*');
 */

(function initSupabase() {
  if (!window.supabase || !window.supabase.createClient) {
    console.error('❌ Supabase library not loaded. Make sure the CDN script is loaded first.');
    return;
  }

  const createClient = window.supabase.createClient;

  // Try synchronous initialization with injected env vars (production/Netlify)
  const injectedUrl = window.__SUPABASE_URL__;
  const injectedKey = window.__SUPABASE_ANON_KEY__;

  if (injectedUrl && injectedKey) {
    // Validate URL format
    if (!injectedUrl.startsWith('https://') || !injectedUrl.includes('.supabase.co')) {
      console.error('❌ Invalid Supabase URL format');
      return;
    }

    window.supabase = createClient(injectedUrl, injectedKey);
    window.supabaseReady = Promise.resolve(window.supabase);
    console.log('✅ Supabase initialized from injected environment');
    return;
  }

  // Fallback: Load from backend /api/config (dev/SSR mode)
  console.log('⏳ Loading Supabase config from /api/config...');

  window.supabaseReady = (async () => {
    try {
      const response = await fetch('/api/config', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Config endpoint returned ${response.status}`);
      }

      const config = await response.json();
      const supabaseUrl = config.supabase_url;
      const supabaseAnonKey = config.supabase_anon_key;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Backend did not return Supabase credentials. Check server env vars.');
      }

      if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
        throw new Error('Invalid Supabase URL format');
      }

      window.supabase = createClient(supabaseUrl, supabaseAnonKey);
      console.log('✅ Supabase initialized from /api/config');
      return window.supabase;

    } catch (err) {
      console.error('❌ FATAL: Supabase initialization failed:', err.message);

      // Show user-friendly error banner
      if (document.body) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#ff4444;color:white;padding:15px;text-align:center;z-index:99999;font-family:Arial,sans-serif;font-size:14px';
        errorDiv.textContent = '⚠️ Configuration error: Unable to connect to backend. Please refresh the page or contact support.';
        document.body.appendChild(errorDiv);
      }

      throw err;
    }
  })();
})();
