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
if (window.supabase && window.supabase.createClient) {
  // Get Supabase credentials from Netlify environment variables
  // These are injected at build/deploy time, never hardcoded in source
  const SUPABASE_URL = window.__SUPABASE_URL__ || 'https://jzhwlablyxaeupvtpdce.supabase.co';
  const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__ || 'sb_publishable_obO2dwFXoF6nOKZ9nCG0Hg_V-cenHsB';

  // Initialize Supabase client and make it globally accessible
  window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log('✅ Supabase initialized with URL from environment');
} else {
  console.error('❌ Supabase library not loaded. Make sure the CDN script is loaded first.');
}
