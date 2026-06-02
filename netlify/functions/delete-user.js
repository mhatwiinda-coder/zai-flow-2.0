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
 * REQUIRES: Valid Authorization header with admin token
 */
export default async (req, context) => {
  const jsonResponse = (data, status = 200) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    // SECURITY: Verify authorization - only admins can delete users
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized: Missing or invalid authorization" }, 401);
    }

    const token = authHeader.slice(7);
    const expectedAdminToken = process.env.ADMIN_API_TOKEN;

    if (!expectedAdminToken || token !== expectedAdminToken) {
      return jsonResponse({ error: "Unauthorized: Invalid credentials" }, 401);
    }

    const { auth_id, user_id } = JSON.parse(req.body);

    if (!auth_id || !user_id) {
      return jsonResponse(
        { error: "Missing required fields: auth_id, user_id" },
        400
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

    // Step 2: Call RPC function to delete all related records (employees, branch access, etc)
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "delete_user_complete",
      { p_user_id: user_id }
    );

    if (rpcError) {
      console.warn("⚠️ RPC deletion warning:", rpcError.message);

      // Fallback: Delete manually if RPC not available
      const { error: branchError } = await supabase
        .from("user_branch_access")
        .delete()
        .eq("user_id", user_id);

      if (branchError) {
        console.warn("⚠️ Branch access deletion warning:", branchError.message);
      }

      const { error: dbError } = await supabase
        .from("users")
        .delete()
        .eq("id", user_id);

      if (dbError) {
        return jsonResponse(
          { error: "Failed to delete database user" },
          400
        );
      }
    } else {
      console.log(`✅ RPC deletion result:`, rpcResult);
    }

    console.log(`✅ User ${user_id} deleted successfully`);

    return jsonResponse(
      {
        success: true,
        message: `User deleted successfully`,
      },
      200
    );
  } catch (error) {
    console.error("❌ Error:", error.message);
    return jsonResponse(
      { error: "Server error" },
      500
    );
  }
};
