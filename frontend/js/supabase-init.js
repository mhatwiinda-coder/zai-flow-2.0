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
  // Configure with your Supabase project credentials
  // Get these from: https://supabase.com → Project Settings → API
  const SUPABASE_URL = 'https://[your-project-id].supabase.co';
  const SUPABASE_ANON_KEY = '[your-anon-key-here]';

  // Initialize Supabase client and make it globally accessible
  window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log('✅ Supabase initialized:', SUPABASE_URL);
} else {
  console.error('❌ Supabase library not loaded. Make sure the CDN script is loaded first.');
}
