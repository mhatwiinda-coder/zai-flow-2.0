// Supabase Configuration (loaded from server)
// DO NOT hardcode credentials - they are loaded from /api/config endpoint

(async function() {
  try {
    const res = await fetch('/api/config');
    const config = await res.json();

    window.SUPABASE_CONFIG = {
      url: config.supabase_url,
      key: config.supabase_anon_key
    };

    console.log('✅ Supabase config loaded from server');
  } catch (err) {
    console.error('❌ Failed to load Supabase config:', err);
  }
})();
