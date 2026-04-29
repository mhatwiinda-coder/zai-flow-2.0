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
export default async (req, event) => {
  // Only allow POST requests
  if (req.method !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { email, password, name, role, business_id } = JSON.parse(req.body);

    // Validate required fields
    if (!email || !password || !name || !role || !business_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Missing required fields: email, password, name, role, business_id",
        }),
      };
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
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: `Failed to create auth user: ${authError.message}`,
        }),
      };
    }

    console.log(`✅ Auth user created: ${authUser.user.id}`);

    // Step 2: Create user in database
    const { data: dbUser, error: dbError } = await supabase
      .from("users")
      .insert({
        id: authUser.user.id, // Link to Auth user
        email: email,
        name: name,
        role: role,
        business_id: business_id,
        password: password, // Store for reference (should ideally not be stored)
      })
      .select()
      .single();

    if (dbError) {
      console.error("❌ Database creation failed:", dbError);
      // Rollback: delete the auth user since database insert failed
      await supabase.auth.admin.deleteUser(authUser.user.id);
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: `Failed to create database user: ${dbError.message}. Auth user rolled back.`,
        }),
      };
    }

    console.log(`✅ Database user created: ${dbUser.id}`);

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

    console.log(`✅ User ${email} created successfully`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        user: {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          role: dbUser.role,
          business_id: dbUser.business_id,
        },
        message: `User ${email} created successfully with ${role} role`,
      }),
    };
  } catch (error) {
    console.error("❌ Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: `Server error: ${error.message}`,
      }),
    };
  }
};
