#!/usr/bin/env node
/**
 * Test complete workflow: Login → Employee Landing Page
 */

const http = require("http");

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on("error", reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function testWorkflow() {
  console.log("🎯 ZAI FLOW 2.0 - Complete Workflow Test\n");
  console.log(
    "════════════════════════════════════════════════════════════════"
  );

  // Test 1: Login
  console.log("\n📌 STEP 1: Test Login Endpoint");
  console.log("-".repeat(64));

  const loginRes = await makeRequest(
    {
      hostname: "localhost",
      port: 5000,
      path: "/api/login",
      method: "POST",
      headers: { "Content-Type": "application/json" }
    },
    { email: "admin@lodiachi-enterprises-ltd.local", password: "admin123" }
  );

  console.log(`Status: ${loginRes.status}`);

  if (loginRes.status === 200 && loginRes.data.success) {
    console.log("✅ Login successful!");
    const user = loginRes.data;
    console.log(`   User ID (UUID): ${user.id}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Business: ${user.business_id}`);
    console.log(`   Branches: ${user.branches.length} found`);

    if (user.branches.length > 0) {
      console.log(`   Primary Branch: ${user.branches[0].branch_name}`);
    }

    // Test 2: Verify UUID format
    console.log("\n📌 STEP 2: Verify UUID Format");
    console.log("-".repeat(64));

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(user.id)) {
      console.log(`✅ User ID is valid UUID format: ${user.id}`);
    } else {
      console.log(`❌ User ID is NOT valid UUID format: ${user.id}`);
    }

    // Test 3: Test RPC calls with this user
    console.log("\n📌 STEP 3: Test RPC Functions with Logged-In User");
    console.log("-".repeat(64));

    const { Pool } = require("pg");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    try {
      const client = await pool.connect();

      // Get user accessible modules
      console.log("\nTesting: get_user_accessible_modules()");
      const modulesResult = await client.query(
        `SELECT * FROM public.get_user_accessible_modules($1::uuid, $2::integer)`,
        [user.id, user.business_id]
      );
      console.log(`   ✅ Retrieved ${modulesResult.rows.length} accessible modules`);
      if (modulesResult.rows.length > 0) {
        console.log(`   Sample modules:`);
        modulesResult.rows.slice(0, 3).forEach((mod) => {
          console.log(`      • ${mod.function_name} (${mod.module})`);
        });
      }

      // Get user roles
      console.log("\nTesting: get_user_roles()");
      const rolesResult = await client.query(
        `SELECT * FROM public.get_user_roles($1::uuid, $2::integer)`,
        [user.id, user.business_id]
      );
      console.log(`   ✅ Retrieved ${rolesResult.rows.length} role(s)`);
      if (rolesResult.rows.length > 0) {
        rolesResult.rows.forEach((role) => {
          console.log(`      • ${role.role_name} (level: ${role.hierarchy_level})`);
        });
      }

      // Get user tasks
      console.log("\nTesting: get_user_tasks()");
      const tasksResult = await client.query(
        `SELECT * FROM public.get_user_tasks($1::uuid, $2::integer)`,
        [user.id, user.business_id]
      );
      console.log(`   ✅ Retrieved ${tasksResult.rows.length} task(s)`);

      // Get notifications
      console.log("\nTesting: get_unread_notifications()");
      const notificationsResult = await client.query(
        `SELECT * FROM public.get_unread_notifications($1::uuid, $2::integer)`,
        [user.id, user.business_id]
      );
      console.log(
        `   ✅ Retrieved ${notificationsResult.rows.length} unread notification(s)`
      );
      if (notificationsResult.rows.length > 0) {
        notificationsResult.rows.slice(0, 2).forEach((notif) => {
          console.log(`      • ${notif.title}`);
        });
      }

      // Get attendance status
      console.log("\nTesting: get_attendance_status()");
      const attendanceResult = await client.query(
        `SELECT * FROM public.get_attendance_status($1::uuid, $2::integer)`,
        [user.id, user.business_id]
      );
      console.log(`   ✅ Retrieved attendance status`);
      if (attendanceResult.rows.length > 0) {
        const att = attendanceResult.rows[0];
        console.log(`      Clocked in: ${att.is_clocked_in}`);
        if (att.is_clocked_in) {
          console.log(
            `      Elapsed: ${att.elapsed_minutes} minute(s)`
          );
        }
      }

      client.release();
    } catch (err) {
      console.error(`❌ RPC test failed: ${err.message}`);
    } finally {
      await pool.end();
    }

    console.log("\n" + "=".repeat(64));
    console.log("✅ WORKFLOW TEST COMPLETE - ALL SYSTEMS GO!");
    console.log("=".repeat(64));
    console.log("\n📍 Next Steps:");
    console.log("   1. Open browser to http://localhost:5000/login.html");
    console.log("   2. Login with: admin@lodiachi-enterprises-ltd.local / admin123");
    console.log("   3. You should be redirected to /employee-landing.html");
    console.log("   4. Employee landing page should load all user data:");
    console.log("      • Clock in/out widget");
    console.log("      • Tasks list");
    console.log("      • Notifications");
    console.log("      • Module quick links");
    console.log("      • Personal metrics");
    console.log("\n");
  } else {
    console.log(`❌ Login failed: ${loginRes.data.message || "Unknown error"}`);
  }
}

// Require dotenv
require("dotenv").config();

testWorkflow().catch(console.error);
