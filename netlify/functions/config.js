/**
 * Netlify Function: Frontend Config
 *
 * Serves Supabase URL + anon key to the browser at runtime, read from
 * Netlify's environment variables (Site Settings > Environment Variables).
 * This exists because Netlify's static hosting has no access to server.js's
 * Express routes - only Netlify Functions are reachable in production.
 *
 * The anon key is meant to be public (it's the "publishable" key, protected
 * by RLS on the database side), so serving it here is safe.
 */
export default async (req) => {
  const jsonResponse = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabase_url = process.env.SUPABASE_URL;
  const supabase_anon_key = process.env.SUPABASE_ANON_KEY;

  if (!supabase_url || !supabase_anon_key) {
    return jsonResponse(
      { error: "Supabase environment variables not configured on this deployment" },
      500
    );
  }

  return jsonResponse({ supabase_url, supabase_anon_key });
};
