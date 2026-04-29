import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Admin client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAdminKey = process.env.SUPABASE_ADMIN_KEY;

const supabase = createClient(supabaseUrl, supabaseAdminKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Netlify Function: Sync Existing Database Users to Supabase Auth
 * One-time migration to bring all database users into Supabase Auth
 */
export default async (req, event) => {
  // Require POST request with auth header
  if (req.method !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  // Simple auth check (you should update this with proper security)
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.SYNC_AUTH_TOKEN}`) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }

  try {
    console.log("🔄 Starting user sync from database to Supabase Auth...");

    // Step 1: Get all users from database that don't have Auth entries yet
    const { data: dbUsers, error: fetchError } = await supabase
      .from("users")
      .select("id, email, password, name, role, business_id")
      .order("id");

    if (fetchError) {
      throw new Error(`Failed to fetch users: ${fetchError.message}`);
    }

    console.log(`📋 Found ${dbUsers.length} users in database`);

    // Step 2: Get existing Auth users
    const { data: authUsers, error: authFetchError } =
      await supabase.auth.admin.listUsers();

    if (authFetchError) {
      throw new Error(`Failed to fetch auth users: ${authFetchError.message}`);
    }

    const authEmails = new Set(authUsers.users.map((u) => u.email));
    console.log(`👤 Found ${authUsers.users.length} users in Supabase Auth`);

    // Step 3: Create auth entries for users that don't have them
    const results = {
      total: dbUsers.length,
      created: 0,
      skipped: 0,
      errors: [],
    };

    for (const user of dbUsers) {
      try {
        // Skip if user already exists in Auth
        if (authEmails.has(user.email)) {
          console.log(`⏭️  Skipping ${user.email} (already in Auth)`);
          results.skipped++;
          continue;
        }

        // Create user in Supabase Auth
        const { data: newAuthUser, error: createError } =
          await supabase.auth.admin.createUser({
            email: user.email,
            password: user.password || "TempPassword123!", // Use stored password or temp
            email_confirm: true,
          });

        if (createError) {
          console.error(`❌ Failed to create auth for ${user.email}:`, createError.message);
          results.errors.push({
            email: user.email,
            error: createError.message,
          });
          continue;
        }

        // Update database user ID to match Auth user ID (if different)
        if (newAuthUser.user.id !== user.id) {
          await supabase
            .from("users")
            .update({ id: newAuthUser.user.id })
            .eq("id", user.id);
        }

        console.log(`✅ Created auth user for ${user.email}`);
        results.created++;
      } catch (err) {
        console.error(`❌ Error processing ${user.email}:`, err.message);
        results.errors.push({
          email: user.email,
          error: err.message,
        });
      }
    }

    console.log(`\n📊 Sync Summary:`);
    console.log(`   Total users: ${results.total}`);
    console.log(`   Created: ${results.created}`);
    console.log(`   Skipped: ${results.skipped}`);
    console.log(`   Errors: ${results.errors.length}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "User sync completed",
        results: results,
      }),
    };
  } catch (error) {
    console.error("❌ Sync error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: `Sync failed: ${error.message}`,
      }),
    };
  }
};
