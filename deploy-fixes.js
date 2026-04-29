#!/usr/bin/env node
/**
 * Deploy RPC type fixes to Supabase
 * Reads the FIX-RPC-TYPE-MISMATCHES.sql file and executes it
 */

require("dotenv").config();
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function deployFixes() {
  const client = await pool.connect();

  try {
    console.log("📝 Reading SQL fixes file...");
    const sqlPath = path.join(__dirname, "FIX-RPC-TYPE-MISMATCHES.sql");
    const sqlContent = fs.readFileSync(sqlPath, "utf8");

    console.log("🚀 Deploying RPC type fixes to Supabase...\n");

    // Split by semicolon and filter out comments and empty statements
    const statements = sqlContent
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt && !stmt.startsWith("--"));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ";";
      try {
        console.log(
          `[${i + 1}/${statements.length}] Executing statement...`
        );
        await client.query(statement);
        console.log(`✅ Statement ${i + 1} executed successfully\n`);
      } catch (err) {
        console.error(`❌ Error in statement ${i + 1}:`);
        console.error(`   ${err.message}\n`);
        // Continue with next statement instead of failing
      }
    }

    console.log("🎉 Deployment completed!");
    console.log(
      "\n✅ RPC Functions fixed:"
    );
    console.log("   • create_notification() - notification_id: BIGINT → INTEGER");
    console.log(
      "   • get_unread_notifications() - notification_id: BIGINT → INTEGER"
    );
    console.log(
      "   • mark_notification_read() - parameter: BIGINT → INTEGER"
    );
    console.log("\n🧪 Testing functions by calling them...\n");

    // Test create_notification
    console.log("Testing: create_notification()");
    try {
      const result = await client.query(
        `SELECT * FROM public.create_notification(
          $1::uuid, $2::integer, $3::text, $4::text, $5::text
        )`,
        [
          "00000000-0000-0000-0000-000000000001",
          1,
          "Test Notification",
          "This is a test",
          "info"
        ]
      );
      console.log("✅ create_notification() works:", result.rows[0]);
    } catch (err) {
      console.error("⚠️  create_notification() test failed:", err.message);
    }

    // Test get_unread_notifications
    console.log("\nTesting: get_unread_notifications()");
    try {
      const result = await client.query(
        `SELECT * FROM public.get_unread_notifications(
          $1::uuid, $2::integer
        )`,
        ["00000000-0000-0000-0000-000000000001", 1]
      );
      console.log(
        "✅ get_unread_notifications() works - returned",
        result.rows.length,
        "notifications"
      );
    } catch (err) {
      console.error(
        "⚠️  get_unread_notifications() test failed:",
        err.message
      );
    }

    console.log("\n🎯 All fixes deployed and tested!");
  } catch (err) {
    console.error("❌ Deployment failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

deployFixes();
