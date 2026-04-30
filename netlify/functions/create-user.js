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
 * Netlify Function: Create User in Both Auth and Database
 * Handles user creation with automatic Supabase Auth + Database sync
 */
export default async (req, context) => {
  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    console.log(`📥 Request body:`, req.body);
    console.log(`📥 SUPABASE_URL:`, supabaseUrl ? "SET" : "MISSING");
    console.log(`📥 SUPABASE_ADMIN_KEY:`, supabaseAdminKey ? "SET" : "MISSING");

    const { email, password, name, role, business_id } = JSON.parse(req.body);

    // Validate required fields
    if (!email || !password || !name || !role || !business_id) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: email, password, name, role, business_id",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({
          error: "Password must be at least 8 characters",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(`🔄 Creating user: ${email}`);

    // Step 1: Create user in Supabase Auth
    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true, // Auto-confirm email
      });

    if (authError) {
      console.error("❌ Auth creation failed:", authError);
      return new Response(
        JSON.stringify({
          error: `Failed to create auth user: ${authError.message}`,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(`✅ Auth user created: ${authUser.user.id}`);

    // Step 2: Create user in database (auth_id links to Supabase Auth UUID)
    const { data: dbUser, error: dbError } = await supabase
      .from("users")
      .insert({
        auth_id: authUser.user.id, // Link to Auth user UUID
        email: email,
        name: name,
        role: role,
        business_id: business_id
        // Do NOT store password in database
      })
      .select()
      .single();

    if (dbError) {
      console.error("❌ Database creation failed:", dbError);
      // Rollback: delete the auth user since database insert failed
      await supabase.auth.admin.deleteUser(authUser.user.id);
      return new Response(
        JSON.stringify({
          error: `Failed to create database user: ${dbError.message}. Auth user rolled back.`,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(`✅ Database user created: ${dbUser.id} (auth_id: ${authUser.user.id})`);

    // Step 3: Create default branch access
    const { data: branches } = await supabase
      .from("branches")
      .select("id")
      .eq("business_id", business_id)
      .limit(1);

    if (branches && branches.length > 0) {
      const { error: branchError } = await supabase
        .from("user_branch_access")
        .insert({
          user_id: dbUser.id,
          branch_id: branches[0].id,
          role: role,
          is_primary_branch: true,
          status: "ACTIVE",
        });

      if (branchError) {
        console.warn("⚠️ Branch access creation warning:", branchError);
        // Don't fail the entire request for this
      }
    }

    console.log(`✅ User ${email} created successfully with ID ${dbUser.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: dbUser.id,
          auth_id: authUser.user.id,
          email: dbUser.email,
          name: dbUser.name,
          role: dbUser.role,
          business_id: dbUser.business_id,
        },
        message: `User ${email} created successfully with ${role} role and automatic Supabase Auth setup`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({
        error: `Server error: ${error.message}`,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
