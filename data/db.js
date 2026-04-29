require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

/* =========================
   POSTGRESQL CONNECTION
========================= */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 20,
  ssl: (process.env.DATABASE_URL || '').includes('supabase') ||
       (process.env.DATABASE_URL || '').includes('neon') ||
       (process.env.DATABASE_URL || '').includes('render')
    ? { rejectUnauthorized: false }
    : false
});

/* =========================
   PLACEHOLDER CONVERTER
   SQLite ? → PostgreSQL $1, $2...
========================= */
function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/* =========================
   SQLITE-COMPATIBLE WRAPPER
   Keeps all controllers unchanged
========================= */
const db = {
  /** Fetch single row */
  get(sql, params, callback) {
    if (typeof params === 'function') { callback = params; params = []; }
    pool.query(toPg(sql), params)
      .then(r => callback(null, r.rows[0] || null))
      .catch(e => { console.error('db.get error:', e.message); callback(e, null); });
  },

  /** Fetch multiple rows */
  all(sql, params, callback) {
    if (typeof params === 'function') { callback = params; params = []; }
    pool.query(toPg(sql), params)
      .then(r => callback(null, r.rows))
      .catch(e => { console.error('db.all error:', e.message); callback(e, []); });
  },

  /** Execute (INSERT/UPDATE/DELETE). For INSERTs exposes this.lastID via RETURNING id */
  run(sql, params, callback) {
    if (typeof params === 'function') { callback = params; params = []; }
    const isInsert = /^\s*INSERT/i.test(sql);
    let pgSql = toPg(sql);
    if (isInsert && !/RETURNING/i.test(pgSql)) pgSql += ' RETURNING id';
    pool.query(pgSql, params)
      .then(r => {
        if (callback) {
          const lastID = isInsert && r.rows?.[0]?.id != null ? r.rows[0].id : null;
          callback.call({ lastID }, null);
        }
      })
      .catch(e => {
        console.error('db.run error:', e.message, '\nSQL:', sql);
        if (callback) callback.call({ lastID: null }, e);
      });
  },

  /** Raw promise-based query (for services) */
  query(sql, params) {
    return pool.query(toPg(sql), params || []);
  },

  /** Called by server.js after schema init */
  onReady(cb) { this._readyCallback = cb; },
  _readyCallback: null
};

/* =========================
   SCHEMA INITIALISATION
========================= */
async function initDB() {
  const client = await pool.connect();
  try {
    console.log('Initializing ZAI Flow database...');

    /* ---- CORE TABLES ---- */
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id        SERIAL PRIMARY KEY,
        name      TEXT NOT NULL,
        email     TEXT UNIQUE NOT NULL,
        password  TEXT NOT NULL,
        role      TEXT NOT NULL DEFAULT 'staff',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id           SERIAL PRIMARY KEY,
        name         TEXT NOT NULL,
        barcode      TEXT UNIQUE,
        sku          TEXT UNIQUE,
        price        REAL NOT NULL,
        stock        INTEGER NOT NULL DEFAULT 0,
        cost_price   REAL DEFAULT 0,
        unspsc_code  TEXT DEFAULT '10000000',
        tax_category TEXT DEFAULT 'A',
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id             SERIAL PRIMARY KEY,
        total          REAL NOT NULL,
        payment_method TEXT NOT NULL,
        status         TEXT DEFAULT 'COMPLETED',
        created_at     TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id         SERIAL PRIMARY KEY,
        sale_id    INTEGER REFERENCES sales(id),
        product_id INTEGER REFERENCES products(id),
        quantity   INTEGER NOT NULL,
        price      REAL NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_movements (
        id         SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id),
        type       TEXT NOT NULL,
        quantity   INTEGER NOT NULL,
        reason     TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS cash_movements (
        id         SERIAL PRIMARY KEY,
        amount     REAL NOT NULL,
        type       TEXT NOT NULL,
        reason     TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS cash_drawer (
        id               SERIAL PRIMARY KEY,
        user_id          INTEGER NOT NULL REFERENCES users(id),
        opening_balance  REAL NOT NULL,
        expected_balance REAL DEFAULT 0,
        declared_balance REAL,
        difference       REAL,
        opened_at        TIMESTAMPTZ DEFAULT NOW(),
        closed_at        TIMESTAMPTZ,
        status           TEXT DEFAULT 'OPEN'
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id         SERIAL PRIMARY KEY,
        name       TEXT NOT NULL,
        phone      TEXT,
        email      TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    /* ---- ACCOUNTING TABLES ---- */
    await client.query(`
      CREATE TABLE IF NOT EXISTS chart_of_accounts (
        id           SERIAL PRIMARY KEY,
        account_code TEXT UNIQUE,
        account_name TEXT NOT NULL,
        account_type TEXT CHECK(
          account_type IN ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')
        ) NOT NULL,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id          SERIAL PRIMARY KEY,
        reference   TEXT,
        description TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS journal_lines (
        id         SERIAL PRIMARY KEY,
        journal_id INTEGER REFERENCES journal_entries(id),
        account_id INTEGER REFERENCES chart_of_accounts(id),
        debit      REAL DEFAULT 0,
        credit     REAL DEFAULT 0
      )
    `);

    /* ---- ZRA SMART INVOICE TABLES ---- */
    await client.query(`
      CREATE TABLE IF NOT EXISTS zra_config (
        id                 SERIAL PRIMARY KEY,
        tpin               TEXT NOT NULL,
        bhf_id             TEXT DEFAULT '000',
        business_name      TEXT,
        business_address   TEXT,
        tax_type           TEXT DEFAULT 'VAT',
        environment        TEXT DEFAULT 'sandbox',
        vsdc_url           TEXT,
        device_serial      TEXT,
        last_initialized   TIMESTAMPTZ,
        created_at         TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS fiscal_invoices (
        id                  SERIAL PRIMARY KEY,
        sale_id             INTEGER REFERENCES sales(id),
        internal_invoice_no TEXT UNIQUE,
        zra_receipt_number  TEXT,
        fiscal_signature    TEXT,
        qr_data             TEXT,
        submission_status   TEXT DEFAULT 'PENDING',
        submitted_at        TIMESTAMPTZ,
        error_message       TEXT,
        payload             JSONB,
        response            JSONB,
        created_at          TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS smart_invoice_queue (
        id            SERIAL PRIMARY KEY,
        sale_id       INTEGER REFERENCES sales(id),
        payload       JSONB NOT NULL,
        attempts      INTEGER DEFAULT 0,
        max_attempts  INTEGER DEFAULT 3,
        status        TEXT DEFAULT 'PENDING',
        last_attempt  TIMESTAMPTZ,
        error_message TEXT,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    /* ---- SEED: CHART OF ACCOUNTS ---- */
    await client.query(`
      INSERT INTO chart_of_accounts (account_code, account_name, account_type) VALUES
        ('1000','Cash','ASSET'),
        ('1100','Bank','ASSET'),
        ('1200','Inventory','ASSET'),
        ('2000','Accounts Payable','LIABILITY'),
        ('3000','Owner Equity','EQUITY'),
        ('4000','Sales Revenue','REVENUE'),
        ('5000','Cost of Goods Sold','EXPENSE'),
        ('5100','Utilities Expense','EXPENSE')
      ON CONFLICT (account_code) DO NOTHING
    `);

    /* ---- SEED: DEFAULT USERS (once only) ---- */
    const supervisorHash = bcrypt.hashSync('SupervisorPass@123', 10);
    const adminHash      = bcrypt.hashSync('AdminPass@456',      10);
    const inventoryHash  = bcrypt.hashSync('InventoryPass@789',  10);
    const cashierHash    = bcrypt.hashSync('CashierPass@101',    10);

    await client.query(`
      INSERT INTO users (name, email, password, role) VALUES
        ('Supervisor',        'super@zai.com',     $1, 'supervisor'),
        ('Admin User',        'admin@zai.com',      $2, 'admin'),
        ('Inventory Officer', 'inventory@zai.com',  $3, 'inventory'),
        ('Cashier One',       'cashier@zai.com',    $4, 'cashier')
      ON CONFLICT (email) DO NOTHING
    `, [supervisorHash, adminHash, inventoryHash, cashierHash]);

    console.log('✅ Database schema and users initialized');
    if (db._readyCallback) db._readyCallback();
  } catch (err) {
    console.error('❌ Database init error:', err.message);
    // Still signal ready so server starts (useful during dev)
    if (db._readyCallback) db._readyCallback();
  } finally {
    client.release();
  }
}

/* =========================
   CONNECT & INIT
========================= */
async function connectDB() {
  let retries = 3;
  while (retries > 0) {
    try {
      const client = await pool.connect();
      client.release();
      console.log('✅ Connected to PostgreSQL');
      return initDB();
    } catch (err) {
      retries--;
      console.error(`❌ PostgreSQL connection failed: ${err.message}`);
      if (retries > 0) {
        console.log(`   → Retrying in 2 seconds... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.error('   → Check DATABASE_URL in your .env file');
        console.error('   → Verify your internet connection');
        console.error('   → Ensure Supabase database is accessible');
      }
    }
  }
}

connectDB();

module.exports = db;
