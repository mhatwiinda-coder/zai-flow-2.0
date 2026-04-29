#!/usr/bin/env node
/**
 * Verify all critical RPC functions are working correctly
 */

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Test UUID (matches what login endpoint returns)
const TEST_USER_ID = "00000000-0000-0000-0000-000000000146";
const TEST_BUSINESS_ID = 1;

async function testFunction(name, query, params) {
  const client = await pool.connect();
  try {
    console.log(`\n🧪 Testing: ${name}`);
    console.log(`   Query: ${query}`);
    const result = await client.query(query, params);
    console.log(`   ✅ SUCCESS - Returned ${result.rows.length} row(s)`);
    if (result.rows.length > 0) {
      console.log(`   Data:`, JSON.stringify(result.rows[0]));
    }
    return true;
  } catch (err) {
    console.error(`   ❌ FAILED - ${err.message}`);
    return false;
  } finally {
    client.release();
  }
}

async function verifyFunctions() {
  console.log("🔍 ZAI FLOW 2.0 - RPC Function Verification\n");
  console.log(`Using Test UUID: ${TEST_USER_ID}`);
  console.log(`Using Business ID: ${TEST_BUSINESS_ID}\n`);
  console.log(
    "════════════════════════════════════════════════════════════════"
  );

  let passed = 0;
  let failed = 0;

  // Test 1: get_user_accessible_modules
  if (
    await testFunction(
      "get_user_accessible_modules()",
      `SELECT * FROM public.get_user_accessible_modules($1::uuid, $2::integer)`,
      [TEST_USER_ID, TEST_BUSINESS_ID]
    )
  ) {
    passed++;
  } else {
    failed++;
  }

  // Test 2: check_function_access
  if (
    await testFunction(
      "check_function_access()",
      `SELECT * FROM public.check_function_access($1::uuid, $2::integer, $3::text)`,
      [TEST_USER_ID, TEST_BUSINESS_ID, "dashboard"]
    )
  ) {
    passed++;
  } else {
    failed++;
  }

  // Test 3: get_user_roles
  if (
    await testFunction(
      "get_user_roles()",
      `SELECT * FROM public.get_user_roles($1::uuid, $2::integer)`,
      [TEST_USER_ID, TEST_BUSINESS_ID]
    )
  ) {
    passed++;
  } else {
    failed++;
  }

  // Test 4: get_attendance_status
  if (
    await testFunction(
      "get_attendance_status()",
      `SELECT * FROM public.get_attendance_status($1::uuid, $2::integer)`,
      [TEST_USER_ID, TEST_BUSINESS_ID]
    )
  ) {
    passed++;
  } else {
    failed++;
  }

  // Test 5: get_user_tasks (CRITICAL)
  if (
    await testFunction(
      "get_user_tasks()",
      `SELECT * FROM public.get_user_tasks($1::uuid, $2::integer)`,
      [TEST_USER_ID, TEST_BUSINESS_ID]
    )
  ) {
    passed++;
  } else {
    failed++;
  }

  // Test 6: get_unread_notifications (FIXED - was BIGINT/INTEGER mismatch)
  if (
    await testFunction(
      "get_unread_notifications()",
      `SELECT * FROM public.get_unread_notifications($1::uuid, $2::integer)`,
      [TEST_USER_ID, TEST_BUSINESS_ID]
    )
  ) {
    passed++;
  } else {
    failed++;
  }

  // Test 7: clock_in
  if (
    await testFunction(
      "clock_in()",
      `SELECT * FROM public.clock_in($1::uuid, $2::integer, $3::text)`,
      [TEST_USER_ID, TEST_BUSINESS_ID, "Regular clock in"]
    )
  ) {
    passed++;
  } else {
    failed++;
  }

  // Test 8: create_notification (FIXED - was BIGINT/INTEGER mismatch)
  if (
    await testFunction(
      "create_notification()",
      `SELECT * FROM public.create_notification($1::uuid, $2::integer, $3::text, $4::text, $5::text)`,
      [
        TEST_USER_ID,
        TEST_BUSINESS_ID,
        "Test Notification",
        "This is a test notification",
        "info"
      ]
    )
  ) {
    passed++;
  } else {
    failed++;
  }

  console.log(
    "\n════════════════════════════════════════════════════════════════"
  );
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

  if (failed === 0) {
    console.log(
      "🎉 All RPC functions verified successfully! Employee landing page should now work.\n"
    );
  } else {
    console.log(
      `⚠️  ${failed} function(s) failed. Check the errors above.\n`
    );
  }

  await pool.end();
}

verifyFunctions();
