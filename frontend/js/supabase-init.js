/**
 * Supabase Global Initialization
 *
 * This file initializes the Supabase client for use across all frontend modules.
 * It replaces the need for individual API calls to Express backend.
 *
 * Usage in other modules:
 *   const { data, error } = await supabase.rpc('create_sale', {params});
 *   const { data, error } = await supabase.from('sales').select('*');
 */

// Wait for Supabase library to be loaded
async function initializeSupabase() {
  if (!window.supabase || !window.supabase.createClient) {
    console.error('❌ Supabase library not loaded. Make sure the CDN script is loaded first.');
    return;
  }

  try {
    // Fetch Supabase credentials from backend API endpoint
    // Never hardcode credentials in source code
    const response = await fetch('/api/config');
    const config = await response.json();

    const SUPABASE_URL = config.supabase_url;
    const SUPABASE_ANON_KEY = config.supabase_anon_key;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('❌ Supabase configuration not available from server');
      return;
    }

    // Initialize Supabase client and make it globally accessible
    window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase initialized from server configuration');
  } catch (err) {
    console.error('❌ Failed to initialize Supabase:', err);
  }
}

// Initialize Supabase when document is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSupabase);
} else {
  initializeSupabase();
}
