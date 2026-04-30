import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAdminKey = process.env.SUPABASE_ADMIN_KEY;

const supabase = createClient(supabaseUrl, supabaseAdminKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Netlify Function: Delete User from Auth and Database
 * Deletes user from Supabase auth and all database records
 */
export default async (req, context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { auth_id, user_id } = JSON.parse(req.body);

    if (!auth_id || !user_id) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: auth_id, user_id",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(`🗑️ Deleting user: auth_id=${auth_id}, user_id=${user_id}`);

    // Step 1: Delete from Supabase Auth
    const { error: authError } = await supabase.auth.admin.deleteUser(auth_id);

    if (authError) {
      console.warn("⚠️ Auth deletion warning:", authError.message);
      // Don't fail completely, auth user might not exist
    } else {
      console.log(`✅ Auth user deleted: ${auth_id}`);
    }

    // Step 2: Delete user_branch_access records
    const { error: branchError } = await supabase
      .from("user_branch_access")
      .delete()
      .eq("user_id", user_id);

    if (branchError) {
      console.warn("⚠️ Branch access deletion warning:", branchError.message);
    }

    // Step 3: Delete user from database
    const { error: dbError } = await supabase
      .from("users")
      .delete()
      .eq("id", user_id);

    if (dbError) {
      return new Response(
        JSON.stringify({
          error: `Failed to delete database user: ${dbError.message}`,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(`✅ User ${user_id} deleted successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `User deleted successfully`,
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
