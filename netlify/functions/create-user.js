import { createClient } from "@supabase/supabase-js";

/**
 * Netlify Function: Create User in Both Auth and Database
 * Handles user creation with automatic Supabase Auth + Database sync
 */
export default async (req, context) => {
  // Ensure all responses return JSON, even on errors
  const jsonResponse = (data, status = 200) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    // Initialize Supabase inside function for better error handling
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAdminKey = process.env.SUPABASE_ADMIN_KEY;

    console.log(`📥 SUPABASE_URL:`, supabaseUrl ? "SET" : "MISSING");
    console.log(`📥 SUPABASE_ADMIN_KEY:`, supabaseAdminKey ? `SET (${supabaseAdminKey.length} chars)` : "MISSING");

    if (!supabaseUrl || !supabaseAdminKey) {
      return jsonResponse({ error: "Missing Supabase environment variables" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseAdminKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log(`✅ Supabase client initialized`);

    // Parse request
    let requestData;
    try {
      requestData = JSON.parse(req.body);
      console.log(`📥 Request parsed: email=${requestData.email}`);
    } catch (e) {
      console.error(`❌ JSON parse error:`, e.message);
      return jsonResponse({ error: `Invalid JSON: ${e.message}` }, 400);
    }

    const { email, password, name, role, business_id } = requestData;

    // Validate required fields
    if (!email || !password || !name || !role || !business_id) {
      return jsonResponse(
        { error: "Missing required fields: email, password, name, role, business_id" },
        400
      );
    }

    if (password.length < 8) {
      return jsonResponse({ error: "Password must be at least 8 characters" }, 400);
    }

    console.log(`🔄 Creating user: ${email}`);

    // Step 1: Create user in Supabase Auth
    console.log(`📍 Step 1: Creating auth user...`);
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error(`❌ Auth error:`, authError);
      return jsonResponse({ error: `Auth error: ${authError.message}` }, 400);
    }

    console.log(`✅ Auth user created: ${authUser.user.id}`);

    // Step 2: Create database user
    console.log(`📍 Step 2: Creating database user...`);
    const { data: dbUser, error: dbError } = await supabase
      .from("users")
      .insert({
        auth_id: authUser.user.id,
        email,
        name,
        role,
        business_id: parseInt(business_id),
      })
      .select()
      .single();

    if (dbError) {
      console.error(`❌ Database error:`, dbError);
      await supabase.auth.admin.deleteUser(authUser.user.id);
      return jsonResponse(
        { error: `Database error: ${dbError.message}. Auth user rolled back.` },
        400
      );
    }

    console.log(`✅ Database user created: ${dbUser.id}`);

    // Step 3: Create branch access
    console.log(`📍 Step 3: Creating branch access...`);
    const { data: branches } = await supabase
      .from("branches")
      .select("id")
      .eq("business_id", parseInt(business_id))
      .limit(1);

    if (branches && branches.length > 0) {
      const { error: branchError } = await supabase
        .from("user_branch_access")
        .insert({
          user_id: dbUser.id,
          branch_id: branches[0].id,
          role,
          is_primary_branch: true,
          status: "ACTIVE",
        });

      if (branchError) {
        console.warn(`⚠️ Branch error:`, branchError);
      } else {
        console.log(`✅ Branch access created`);
      }
    }

    console.log(`✅ User creation complete: ${email}`);

    return jsonResponse(
      {
        success: true,
        user: {
          id: dbUser.id,
          auth_id: authUser.user.id,
          email: dbUser.email,
          name: dbUser.name,
          role: dbUser.role,
          business_id: dbUser.business_id,
        },
        message: `User ${email} created successfully`,
      },
      200
    );
  } catch (error) {
    console.error(`❌ UNHANDLED ERROR:`, error);
    console.error(`Stack:`, error.stack);
    return jsonResponse(
      {
        error: `Server error: ${error.message}`,
        details: error.stack,
      },
      500
    );
  }
};
