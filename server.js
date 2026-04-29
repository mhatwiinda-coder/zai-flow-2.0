require("dotenv").config();

const express = require("express");
const cors    = require("cors");
const path    = require("path");
const app     = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "frontend")));

console.log("✅ Server ready to serve frontend (Supabase-native mode)");

/* =========================
   ROUTES (Disabled - using Supabase RPC instead)
========================= */
// app.use("/api/auth",       require("./routes/auth.routes"));
// app.use("/api/inventory",  require("./routes/inventory.routes"));
// app.use("/api/sales",      require("./routes/sales.routes"));
// app.use("/api/accounting", require("./routes/accounting.routes"));
// app.use("/api/bi",         require("./routes/bi.routes"));
// app.use("/api/receipts",   require("./routes/receipts.routes"));
// app.use("/api/suppliers",  require("./routes/suppliers.routes"));
// app.use("/api/zra",        require("./routes/smartinvoice.routes"));

/* =========================
   CONFIG ENDPOINT — Supabase frontend config
========================= */
app.get("/api/config", (req, res) => {
  res.json({
    supabase_url: process.env.SUPABASE_URL,
    supabase_anon_key: process.env.SUPABASE_ANON_KEY
  });
});
app.get("/api/test-db", async (req, res) => {
  try {
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    const result = await pool.query("SELECT id, email, password FROM public.users WHERE email = 'admin@lodiachi-enterprises-ltd.local'");
    await pool.end();
    
    res.json({
      success: true,
      rowCount: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    res.json({
      success: false,
      error: err.message
    });
  }
});
/* =========================
   NO HARDCODED USERS - TRUE SAAS MULTI-TENANCY
   Users are auto-created when businesses are created
   Each business gets its own auto-generated admin account
========================= */
const mockUsers = [];

/* =========================
   LOGIN ENDPOINT — PostgreSQL or Mock (offline mode)
   MULTI-TENANT: Returns branches array for branch context
========================= */
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  console.log(`\n📧 Login attempt: ${email}`);

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password required" });
  }

  try {
    // Try PostgreSQL first
    try {
      const { Pool } = await import("pg");
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 2000
      });

      // Get user - BUSINESS SCOPED (users now have business_id)
      const userResult = await pool.query(
        "SELECT id, name, email, role, password, business_id FROM public.users WHERE email = $1 LIMIT 1",
        [email]
      );

      if (userResult.rows.length === 0) {
        console.log(`❌ User not found: ${email}`);
        await pool.end();
        return res.json({ success: false, message: "Invalid email or password" });
      }

      const user = userResult.rows[0];
      if (user.password !== password) {
        console.log(`❌ Password mismatch for ${email}`);
        await pool.end();
        return res.json({ success: false, message: "Invalid email or password" });
      }

      // Get user's branches - FILTERED TO ONLY THEIR ASSIGNED BUSINESS
      const branchesResult = await pool.query(`
        SELECT
          uba.branch_id,
          b.name as branch_name,
          b.business_id,
          be.name as business_name,
          uba.role,
          uba.is_primary_branch
        FROM public.user_branch_access uba
        JOIN public.branches b ON uba.branch_id = b.id
        JOIN public.business_entities be ON b.business_id = be.id
        WHERE uba.user_id = $1
          AND uba.status = 'ACTIVE'
          AND b.business_id = $2
        ORDER BY uba.is_primary_branch DESC, b.id ASC
      `, [user.id, user.business_id]);

      await pool.end();

      const branches = branchesResult.rows.map(row => ({
        branch_id: row.branch_id,
        branch_name: row.branch_name,
        business_id: row.business_id,
        business_name: row.business_name,
        role: row.role,
        is_primary: row.is_primary_branch
      }));

      // Default to first branch or primary branch
      const primaryBranch = branches.find(b => b.is_primary) || branches[0];
      const current_branch_id = primaryBranch ? primaryBranch.branch_id : null;
      const current_business_id = user.business_id;

      // Convert numeric user ID to UUID format for RPC functions
      // Format: 00000000-0000-0000-0000-000000XXXXXX
      const userIdAsUUID = `00000000-0000-0000-0000-${String(user.id).padStart(12, '0')}`;

      console.log(`✅ Login successful for ${email} (PostgreSQL) - Business: ${user.business_id}, ${branches.length} branches found`);
      return res.json({
        success: true,
        message: "Login successful",
        id: userIdAsUUID,
        name: user.name,
        email: user.email,
        role: user.role,
        business_id: user.business_id,
        branches: branches,
        current_branch_id: current_branch_id,
        current_business_id: current_business_id
      });
    } catch (dbErr) {
      // Fall back to mock users (offline mode)
      console.log(`⚠️  Database offline, using mock users. Error: ${dbErr.message}`);

      const user = mockUsers.find(u => u.email === email);

      if (!user) {
        console.log(`❌ User not found: ${email}`);
        return res.json({ success: false, message: "Invalid email or password" });
      }

      if (user.password !== password) {
        console.log(`❌ Password mismatch for ${email}`);
        return res.json({ success: false, message: "Invalid email or password" });
      }

      // In mock mode, return DEFAULT_BUSINESS branch for all users
      const mockBranches = [
        {
          branch_id: 1,
          branch_name: "Main Branch",
          business_id: 1,
          business_name: "DEFAULT_BUSINESS",
          role: user.role,
          is_primary: true
        }
      ];

      // Convert numeric user ID to UUID format for RPC functions
      // Format: 00000000-0000-0000-0000-000000XXXXXX
      const userIdAsUUID = `00000000-0000-0000-0000-${String(user.id).padStart(12, '0')}`;

      console.log(`✅ Login successful for ${email} (MOCK MODE - offline) - 1 branch (DEFAULT)`);
      return res.json({
        success: true,
        message: "Login successful (offline mode)",
        id: userIdAsUUID,
        name: user.name,
        email: user.email,
        role: user.role,
        business_id: user.business_id,
        branches: mockBranches,
        current_branch_id: 1,
        current_business_id: user.business_id
      });
    }
  } catch (err) {
    console.error("❌ Unexpected login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* =========================
   ROOT — redirect to app
========================= */
app.get("/", (req, res) => {
  res.redirect("/login.html");
});

/* =========================
   ERROR HANDLER
========================= */
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({ message: "Internal Server Error" });
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 ZAI Flow running on http://localhost:${PORT}`);
}).on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use.`);
  } else {
    console.error("Server error:", err);
  }
  process.exit(1);
});
