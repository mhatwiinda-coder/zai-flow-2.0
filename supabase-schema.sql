-- ===============================
-- ZAI FLOW 2.0 DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ===============================

-- ========== CORE TABLES ==========

CREATE TABLE IF NOT EXISTS users (
  id        SERIAL PRIMARY KEY,
  name      TEXT NOT NULL,
  email     TEXT UNIQUE NOT NULL,
  password  TEXT NOT NULL,
  role      TEXT NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  barcode      TEXT UNIQUE,
  sku          TEXT UNIQUE,
  price        NUMERIC(12,2) NOT NULL,
  cost_price   NUMERIC(12,2),
  stock        INTEGER DEFAULT 0,
  unspsc_code  TEXT,
  tax_category TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales (
  id            SERIAL PRIMARY KEY,
  total         NUMERIC(12,2) NOT NULL,
  payment_method TEXT,
  status        TEXT DEFAULT 'COMPLETED',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id         SERIAL PRIMARY KEY,
  sale_id    INTEGER NOT NULL REFERENCES sales(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity   INTEGER NOT NULL,
  price      NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id         SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  type       TEXT NOT NULL,
  quantity   INTEGER NOT NULL,
  reason     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cash_movements (
  id         SERIAL PRIMARY KEY,
  amount     NUMERIC(12,2) NOT NULL,
  type       TEXT NOT NULL,
  reason     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cash_drawer (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id),
  opening_balance  NUMERIC(12,2),
  declared_balance NUMERIC(12,2),
  difference       NUMERIC(12,2),
  opened_at        TIMESTAMPTZ,
  closed_at        TIMESTAMPTZ,
  status           TEXT DEFAULT 'OPEN'
);

CREATE TABLE IF NOT EXISTS suppliers (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  phone      TEXT,
  email      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========== ACCOUNTING TABLES ==========

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id            SERIAL PRIMARY KEY,
  account_code  TEXT UNIQUE NOT NULL,
  account_name  TEXT NOT NULL,
  account_type  TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id            SERIAL PRIMARY KEY,
  reference     TEXT,
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id         SERIAL PRIMARY KEY,
  journal_id INTEGER NOT NULL REFERENCES journal_entries(id),
  account_id INTEGER NOT NULL REFERENCES chart_of_accounts(id),
  debit      NUMERIC(12,2) DEFAULT 0,
  credit     NUMERIC(12,2) DEFAULT 0
);

-- ========== ZRA SMART INVOICE TABLES ==========

CREATE TABLE IF NOT EXISTS zra_config (
  id                SERIAL PRIMARY KEY,
  tpin              TEXT,
  bhf_id            TEXT,
  business_name     TEXT,
  business_address  TEXT,
  tax_type          TEXT,
  environment       TEXT DEFAULT 'sandbox',
  vsdc_url          TEXT,
  device_serial     TEXT,
  last_initialized  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fiscal_invoices (
  id                    SERIAL PRIMARY KEY,
  sale_id               INTEGER NOT NULL REFERENCES sales(id),
  internal_invoice_no   TEXT,
  zra_receipt_number    TEXT,
  fiscal_signature      TEXT,
  qr_data               TEXT,
  submission_status     TEXT DEFAULT 'PENDING',
  payload               JSONB,
  response              JSONB,
  error_message         TEXT,
  submitted_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS smart_invoice_queue (
  id         SERIAL PRIMARY KEY,
  sale_id    INTEGER NOT NULL REFERENCES sales(id),
  payload    JSONB,
  attempts   INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  status     TEXT DEFAULT 'PENDING',
  last_attempt TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================
-- SEED DATA
-- ===============================

-- Default Users
INSERT INTO users (name, email, password, role) VALUES
  ('Supervisor', 'supervisor@zai.com', '$2a$10$BCRYPTHASHEDPASSWORD1', 'supervisor'),
  ('Admin', 'admin@zai.com', '$2a$10$BCRYPTHASHEDPASSWORD2', 'admin'),
  ('Inventory Officer', 'inventory@zai.com', '$2a$10$BCRYPTHASHEDPASSWORD3', 'inventory'),
  ('Cashier One', 'cashier@zai.com', '$2a$10$BCRYPTHASHEDPASSWORD4', 'cashier')
ON CONFLICT (email) DO NOTHING;

-- Chart of Accounts
INSERT INTO chart_of_accounts (account_code, account_name, account_type) VALUES
  ('1000', 'Cash', 'ASSET'),
  ('1100', 'Bank', 'ASSET'),
  ('1200', 'Inventory', 'ASSET'),
  ('2000', 'Accounts Payable', 'LIABILITY'),
  ('3000', 'Owner Equity', 'EQUITY'),
  ('4000', 'Sales Revenue', 'REVENUE'),
  ('5000', 'Cost of Goods Sold', 'EXPENSE'),
  ('5100', 'Utilities Expense', 'EXPENSE'),
  ('5200', 'Till Variance', 'EXPENSE')
ON CONFLICT (account_code) DO NOTHING;

-- ===============================
-- INDEXES (for performance)
-- ===============================

CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_journal_entries_created_at ON journal_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_sale_id ON fiscal_invoices(sale_id);
CREATE INDEX IF NOT EXISTS idx_smart_invoice_queue_status ON smart_invoice_queue(status);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
