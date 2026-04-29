#!/usr/bin/env node
/**
 * Fix remaining RPC function type mismatches
 * Directly fixes get_user_tasks and get_unread_notifications
 */

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function executeSQL(name, sql) {
  const client = await pool.connect();
  try {
    console.log(`\n[${name}] Executing...`);
    await client.query(sql);
    console.log(`✅ ${name} - SUCCESS`);
    return true;
  } catch (err) {
    console.error(`❌ ${name} - FAILED: ${err.message}`);
    return false;
  } finally {
    client.release();
  }
}

async function fixFunctions() {
  console.log(
    "🔧 Fixing remaining RPC function type mismatches...\n"
  );

  // Fix get_unread_notifications - ensure all column types match exactly
  const fixGetUnreadNotifications = `
DROP FUNCTION IF EXISTS public.get_unread_notifications(UUID, INTEGER);
CREATE OR REPLACE FUNCTION public.get_unread_notifications(
  p_user_id UUID,
  p_business_id INTEGER
)
RETURNS TABLE (
  notification_id INTEGER,
  title TEXT,
  message TEXT,
  type TEXT,
  action_url TEXT,
  created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id::INTEGER,
    n.title::TEXT,
    n.message::TEXT,
    n.type::TEXT,
    n.action_url::TEXT,
    n.created_at::TIMESTAMPTZ
  FROM public.notifications n
  WHERE n.user_id = p_user_id
    AND n.business_id = p_business_id
    AND n.is_read = false
    AND (n.expires_at IS NULL OR n.expires_at > NOW())
  ORDER BY n.created_at DESC
  LIMIT 10;
END;
$$;
`;

  // Fix get_user_tasks - ensure all column types match exactly
  const fixGetUserTasks = `
DROP FUNCTION IF EXISTS public.get_user_tasks(UUID, INTEGER, TEXT);
CREATE OR REPLACE FUNCTION public.get_user_tasks(
  p_user_id UUID,
  p_business_id INTEGER,
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
  task_id INTEGER,
  title TEXT,
  description TEXT,
  due_date DATE,
  priority TEXT,
  status TEXT,
  assigned_by_email TEXT,
  created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id::INTEGER,
    t.title::TEXT,
    t.description::TEXT,
    t.due_date::DATE,
    t.priority::TEXT,
    t.status::TEXT,
    COALESCE(u.email, '')::TEXT,
    t.created_at::TIMESTAMPTZ
  FROM public.employee_tasks t
  LEFT JOIN auth.users u ON u.id = t.assigned_by
  WHERE t.user_id = p_user_id
    AND t.business_id = p_business_id
    AND (p_status IS NULL OR t.status = p_status)
  ORDER BY
    CASE
      WHEN t.priority = 'URGENT' THEN 1
      WHEN t.priority = 'HIGH' THEN 2
      WHEN t.priority = 'NORMAL' THEN 3
      ELSE 4
    END,
    t.due_date ASC,
    t.created_at DESC;
END;
$$;
`;

  let success1 = await executeSQL(
    "Fix get_unread_notifications",
    fixGetUnreadNotifications
  );
  let success2 = await executeSQL(
    "Fix get_user_tasks",
    fixGetUserTasks
  );

  console.log(
    "\n════════════════════════════════════════════════════════════════"
  );
  if (success1 && success2) {
    console.log("✅ All fixes applied successfully!");

    // Now test them
    console.log("\n🧪 Testing fixed functions...\n");

    const TEST_USER_ID = "00000000-0000-0000-0000-000000000146";
    const TEST_BUSINESS_ID = 1;

    const client = await pool.connect();

    try {
      // Test get_unread_notifications
      console.log("Testing get_unread_notifications()...");
      const result1 = await client.query(
        `SELECT * FROM public.get_unread_notifications($1::uuid, $2::integer)`,
        [TEST_USER_ID, TEST_BUSINESS_ID]
      );
      console.log(`✅ Returned ${result1.rows.length} notification(s)`);

      // Test get_user_tasks
      console.log("\nTesting get_user_tasks()...");
      const result2 = await client.query(
        `SELECT * FROM public.get_user_tasks($1::uuid, $2::integer)`,
        [TEST_USER_ID, TEST_BUSINESS_ID]
      );
      console.log(`✅ Returned ${result2.rows.length} task(s)`);

      console.log("\n🎉 All functions working correctly!");
    } catch (err) {
      console.error("\n❌ Test failed:", err.message);
    } finally {
      client.release();
    }
  } else {
    console.log("❌ Some fixes failed. Check errors above.");
  }

  await pool.end();
}

fixFunctions();
