# 🚨 CRITICAL SECURITY AUDIT REPORT - ZAI FLOW 2.0
**Date:** May 17, 2026  
**Status:** 🔴 CRITICAL VULNERABILITIES DETECTED  
**Risk Level:** HIGH - Data exposure risk, unauthorized access possible

---

## Executive Summary

A comprehensive security audit of the ZAI FLOW 2.0 codebase and Supabase configuration has identified **15 critical and high-priority security vulnerabilities** that require immediate remediation. These vulnerabilities could expose customer data, financial records, and user credentials to unauthorized access.

**Immediate Actions Required:**
1. Enable Row-Level Security (RLS) on ALL tables
2. Rotate exposed secrets
3. Fix hardcoded credentials
4. Implement proper authentication checks

---

## CRITICAL VULNERABILITIES

### 1. 🔴 CRITICAL: Row-Level Security (RLS) NOT ENABLED

**Location:** Supabase Database  
**Severity:** CRITICAL  
**Vulnerability:** Tables are publicly accessible without RLS policies

**Affected Tables:**
- ❌ `customers` - NO RLS (customer data exposed)
- ❌ `customer_credit_terms` - NO RLS (credit limits exposed)
- ❌ `sales_invoices` - NO RLS (invoice data exposed)
- ❌ `ar_detail` - NO RLS (AR aging data exposed)
- ❌ `customer_payments` - NO RLS (payment records exposed)
- ❌ `payment_allocations` - NO RLS (transaction linking exposed)
- ❌ `chart_of_accounts` - NO RLS (GL structure exposed)
- ❌ `journal_entries` - NO RLS (financial records exposed)
- ❌ `journal_lines` - NO RLS (GL details exposed)
- ❌ `sales` - NO RLS (sales data exposed)
- ❌ `products` - NO RLS (pricing exposed)
- ❌ `suppliers` - NO RLS (vendor data exposed)

**Impact:** Anyone with your Supabase project URL and anon key can:
- Read all customer data
- View all financial records
- Access invoice and payment details
- Modify or delete any data

**Fix Required:** Enable RLS on all tables and create branch-scoped policies

---

### 2. 🔴 CRITICAL: Hardcoded JWT Secret

**Location:** `.env` (line 2)  
**Severity:** CRITICAL  
**Vulnerability:** JWT secret is weak and hardcoded

```
JWT_SECRET=zai_flow_super_secret_key
```

**Impact:**
- Attacker can forge JWT tokens
- Impersonate any user
- Bypass authentication entirely

**Fix Required:**
```bash
# Generate strong random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output example: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6

# Update .env
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6

# Rotate all existing JWTs - log out all users
```

---

### 3. 🔴 CRITICAL: Hardcoded Supabase Anon Key in Frontend

**Location:** `frontend/js/supabase-init.js` (line 17)  
**Severity:** CRITICAL  
**Vulnerability:** SUPABASE_ANON_KEY is hardcoded in JavaScript

```javascript
const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__ || 'sb_publishable_obO2dwFXoF6nOKZ9nCG0Hg_V-cenHsB';
```

**Impact:**
- Key is visible in browser dev tools
- Key is in git history (permanent exposure)
- Anyone can use this key to access Supabase API
- Combined with missing RLS = full database access

**Fix Required:**
1. Rotate the exposed key immediately in Supabase dashboard
2. Load key from `/api/config` endpoint (already exists)
3. Remove hardcoded key from code

```javascript
// CORRECT APPROACH (already in server.js)
const response = await fetch('/api/config');
const config = await response.json();
const SUPABASE_ANON_KEY = config.supabase_anon_key;
```

---

### 4. 🔴 CRITICAL: Hardcoded Admin Email in Test Endpoint

**Location:** `server.js` (line 46)  
**Severity:** HIGH  
**Vulnerability:** Test endpoint returns password hashes for hardcoded admin

```javascript
const result = await pool.query(
  "SELECT id, email, password FROM public.users WHERE email = 'admin@lodiachi-enterprises-ltd.local'"
);
```

**Impact:**
- Exposes password hash for specific admin
- Test endpoint is exposed in production
- Password field should never be selected

**Fix Required:**
```javascript
// REMOVE THIS ENDPOINT ENTIRELY
// It serves no production purpose and exposes sensitive data
app.get("/api/test-db", ...)  // DELETE THIS
```

---

### 5. 🔴 CRITICAL: Missing RLS Policies for New AR Tables

**Location:** `supabase-schema-accounting-extensions.sql`  
**Severity:** CRITICAL  
**Issue:** New AR tables (customers, sales_invoices, ar_detail, etc.) have NO RLS policies

**All 6 new AR tables need policies:**
```sql
-- MISSING for customers, customer_credit_terms, sales_invoices, 
-- ar_detail, customer_payments, payment_allocations
```

**Impact:** These tables are completely public-accessible

**Fix Required:** Create RLS policies (see Remediation section below)

---

## HIGH-PRIORITY VULNERABILITIES

### 6. 🟠 HIGH: Database Connection String in Environment

**Location:** `.env` (line 10)  
**Severity:** HIGH  
**Issue:** DATABASE_URL contains postgres credentials

**Impact:**
- If .env is committed, credentials are exposed
- Direct database access is possible
- Bypasses all application security

**Fix:** 
```bash
# Verify .env is in .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore

# Check if already committed
git log --all --source -- .env | head -5

# If committed, you must:
# 1. Rotate Supabase database password
# 2. Create new credentials
# 3. Force push (rewrites history) - LAST RESORT
```

---

### 7. 🟠 HIGH: CORS Enabled for All Origins

**Location:** `server.js` (line 11)  
**Severity:** HIGH  
**Issue:** CORS is enabled without restriction

```javascript
app.use(cors());  // Allows ANY origin
```

**Impact:**
- Browser-based attacks from any website
- Cross-site request forgery possible
- API accessible from malicious sites

**Fix:**
```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

---

### 8. 🟠 HIGH: Passwords Selected in User Queries

**Location:** `server.js` (multiple lines)  
**Severity:** HIGH  
**Issue:** Password fields are returned in API responses

```javascript
// BAD - password is selected
"SELECT id, name, email, role, password, business_id FROM public.users WHERE email = $1"

// GOOD - password is NOT selected
"SELECT id, name, email, role, business_id FROM public.users WHERE email = $1"
```

**Impact:** Password hashes could be exposed in logs, errors, API responses

**Fix:** Remove `password` from all SELECT statements

---

### 9. 🟠 HIGH: SQL Injection Risk in Auth Queries

**Location:** `server.js` (line 93)  
**Severity:** LOW-MEDIUM (using parameterized queries, but pattern is fragile)  
**Issue:** Complex dynamic SQL with multiple parameters

```javascript
// Better to use Supabase client library instead of raw SQL
const userResult = await pool.query(
  "SELECT id, name, email, role, business_id FROM public.users WHERE email = $1 LIMIT 1",
  [email]
);
```

**Impact:** If this pattern is followed elsewhere without parameterization, SQL injection is possible

**Recommendation:** Use Supabase client library (`@supabase/supabase-js`) instead of direct SQL

---

### 10. 🟠 HIGH: No Input Validation on Password Fields

**Location:** `frontend/js/admin-users.js`, `frontend/js/auth.js`  
**Severity:** MEDIUM  
**Issue:** No password strength validation

```javascript
const password = document.getElementById('userPassword').value;
// No check for: length, complexity, entropy
```

**Impact:**
- Users can set weak passwords (e.g., "123456")
- Credential stuffing attacks easier
- Brute force attacks more successful

**Fix:**
```javascript
function validatePassword(password) {
  if (password.length < 12) return 'Password must be at least 12 characters';
  if (!/[A-Z]/.test(password)) return 'Must contain uppercase letter';
  if (!/[0-9]/.test(password)) return 'Must contain number';
  if (!/[!@#$%^&*]/.test(password)) return 'Must contain special character';
  return null;
}
```

---

## MEDIUM-PRIORITY VULNERABILITIES

### 11. 🟡 MEDIUM: No Rate Limiting on Login Endpoint

**Location:** `server.js` (line 72)  
**Severity:** MEDIUM  
**Issue:** No rate limiting on `/api/login`

**Impact:**
- Brute force attacks possible
- Credential stuffing attacks possible
- No DDoS protection

**Fix:**
```javascript
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per IP
  message: 'Too many login attempts, please try again later'
});

app.post("/api/login", loginLimiter, async (req, res) => { ... });
```

---

### 12. 🟡 MEDIUM: No HTTPS Enforcement

**Location:** All endpoints  
**Severity:** MEDIUM  
**Issue:** No enforcement of HTTPS/TLS

**Impact:**
- Man-in-the-middle attacks possible
- Credentials transmitted in plaintext over HTTP
- Session tokens exposed

**Fix:**
```javascript
// In production (Netlify, Vercel, etc.)
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.header('x-forwarded-proto') !== 'https') {
    return res.redirect(`https://${req.header('host')}${req.url}`);
  }
  next();
});
```

---

### 13. 🟡 MEDIUM: No CSRF Protection

**Location:** All POST/PUT/DELETE endpoints  
**Severity:** MEDIUM  
**Issue:** No CSRF tokens on state-changing operations

**Impact:**
- Cross-site request forgery attacks possible
- Attacker can trick user into performing actions

**Fix:**
```javascript
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: false });

app.post('/api/login', csrfProtection, (req, res) => { ... });
```

---

### 14. 🟡 MEDIUM: Sensitive Data in Logs

**Location:** `server.js` (line 75)  
**Severity:** MEDIUM  
**Issue:** Email addresses logged to console in production

```javascript
console.log(`📧 Login attempt: ${email}`);  // Logs to production logs
```

**Impact:**
- User emails visible in server logs
- Could leak PII in log aggregation services

**Fix:**
```javascript
// Don't log sensitive data
if (process.env.NODE_ENV === 'development') {
  console.log(`📧 Login attempt: ${email}`);
}
```

---

### 15. 🟡 MEDIUM: No API Key Validation

**Location:** `frontend/js/supabase-init.js`  
**Severity:** MEDIUM  
**Issue:** Supabase anon key not validated on client

**Impact:**
- Invalid keys could cause silent failures
- No security warnings if key is compromised

**Fix:**
```javascript
const validateSupabaseConfig = async () => {
  try {
    const response = await fetch('/api/config');
    const config = await response.json();
    
    if (!config.supabase_url || !config.supabase_anon_key) {
      console.error('❌ CRITICAL: Invalid Supabase configuration');
      throw new Error('Missing required Supabase config');
    }
    
    return config;
  } catch (err) {
    console.error('❌ Configuration error:', err);
    throw err;
  }
};
```

---

## REMEDIATION PLAN

### Phase 1: IMMEDIATE (Within 24 Hours)

**Priority 1: Enable RLS on All Tables**

Create and deploy `supabase-ar-rls-policies.sql`:

```sql
-- ============================================================================
-- ENABLE RLS ON ALL AR/AP TABLES
-- ============================================================================

-- 1. Enable RLS on customers (global table)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- 2. Enable RLS on branch-scoped AR tables
ALTER TABLE public.customer_credit_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_detail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE RLS POLICIES
-- ============================================================================

-- CUSTOMERS: Branch managers can see all customers
CREATE POLICY customers_visibility ON customers
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM user_branch_access WHERE status = 'ACTIVE'
    )
  );

-- CUSTOMER_CREDIT_TERMS: Branch-scoped access
CREATE POLICY customer_credit_terms_visibility ON customer_credit_terms
  FOR SELECT USING (
    branch_id IN (
      SELECT branch_id FROM user_branch_access 
      WHERE user_id = auth.uid() AND status = 'ACTIVE'
    )
  );

CREATE POLICY customer_credit_terms_modify ON customer_credit_terms
  FOR INSERT, UPDATE, DELETE USING (
    branch_id IN (
      SELECT branch_id FROM user_branch_access 
      WHERE user_id = auth.uid() AND status = 'ACTIVE' AND role IN ('admin', 'manager')
    )
  );

-- SALES_INVOICES: Branch-scoped access
CREATE POLICY sales_invoices_visibility ON sales_invoices
  FOR SELECT USING (
    branch_id IN (
      SELECT branch_id FROM user_branch_access 
      WHERE user_id = auth.uid() AND status = 'ACTIVE'
    )
  );

CREATE POLICY sales_invoices_modify ON sales_invoices
  FOR INSERT, UPDATE, DELETE USING (
    branch_id IN (
      SELECT branch_id FROM user_branch_access 
      WHERE user_id = auth.uid() AND status = 'ACTIVE' AND role IN ('admin', 'manager', 'cashier')
    )
  );

-- AR_DETAIL: Branch-scoped, read-only for visibility
CREATE POLICY ar_detail_visibility ON ar_detail
  FOR SELECT USING (
    branch_id IN (
      SELECT branch_id FROM user_branch_access 
      WHERE user_id = auth.uid() AND status = 'ACTIVE'
    )
  );

CREATE POLICY ar_detail_modify ON ar_detail
  FOR UPDATE USING (
    branch_id IN (
      SELECT branch_id FROM user_branch_access 
      WHERE user_id = auth.uid() AND status = 'ACTIVE' AND role IN ('admin', 'manager')
    )
  );

-- CUSTOMER_PAYMENTS: Branch-scoped access
CREATE POLICY customer_payments_visibility ON customer_payments
  FOR SELECT USING (
    branch_id IN (
      SELECT branch_id FROM user_branch_access 
      WHERE user_id = auth.uid() AND status = 'ACTIVE'
    )
  );

CREATE POLICY customer_payments_modify ON customer_payments
  FOR INSERT, UPDATE USING (
    branch_id IN (
      SELECT branch_id FROM user_branch_access 
      WHERE user_id = auth.uid() AND status = 'ACTIVE' AND role IN ('admin', 'manager', 'cashier')
    )
  );

-- PAYMENT_ALLOCATIONS: Branch-scoped access
CREATE POLICY payment_allocations_visibility ON payment_allocations
  FOR SELECT USING (
    payment_id IN (
      SELECT id FROM customer_payments 
      WHERE branch_id IN (
        SELECT branch_id FROM user_branch_access 
        WHERE user_id = auth.uid() AND status = 'ACTIVE'
      )
    )
  );

CREATE POLICY payment_allocations_modify ON payment_allocations
  FOR INSERT, UPDATE, DELETE USING (
    payment_id IN (
      SELECT id FROM customer_payments 
      WHERE branch_id IN (
        SELECT branch_id FROM user_branch_access 
        WHERE user_id = auth.uid() AND status = 'ACTIVE' AND role IN ('admin', 'manager')
      )
    )
  );
```

**Priority 2: Rotate Exposed Secrets**

```bash
# 1. Generate new JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. Update .env with new secret
JWT_SECRET=<NEW_RANDOM_SECRET>

# 3. Rotate Supabase anon key (in Supabase dashboard)
# Go to: Settings > API > Anon Key > Rotate

# 4. Update server.env and redeploy
```

**Priority 3: Remove Hardcoded Secrets**

```bash
# Remove hardcoded key from supabase-init.js
git rm --cached frontend/js/supabase-init.js
# (manually edit file to remove hardcoded key)
git add frontend/js/supabase-init.js
git commit -m "Remove hardcoded Supabase key - security fix"
```

**Priority 4: Delete Test Endpoint**

```javascript
// DELETE from server.js (lines 38-60)
app.get("/api/test-db", async (req, res) => { ... });  // REMOVE ENTIRE FUNCTION
```

---

### Phase 2: SHORT-TERM (Within 1 Week)

- ✅ Implement password validation
- ✅ Add CORS restrictions
- ✅ Remove password from SELECT queries
- ✅ Add rate limiting to login
- ✅ Implement HTTPS enforcement
- ✅ Add CSRF protection
- ✅ Remove sensitive data from logs

### Phase 3: LONG-TERM (Within 1 Month)

- ✅ Move away from direct SQL to Supabase client library
- ✅ Implement comprehensive audit logging
- ✅ Add security headers (CSP, X-Frame-Options, etc.)
- ✅ Implement request signing for sensitive operations
- ✅ Add security scanning to CI/CD pipeline

---

## VERIFICATION CHECKLIST

After remediation, verify:

```sql
-- Check RLS is enabled
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true;
-- Should show: customers, customer_credit_terms, sales_invoices, ar_detail, etc.

-- Check policies exist
SELECT schemaname, tablename, policyname, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('customers', 'sales_invoices', 'ar_detail');
-- Should show multiple policies per table

-- Verify anon user CANNOT access data
SELECT * FROM customers;  -- Should fail with RLS error
```

---

## SUMMARY

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 5 | ⚠️ Requires immediate action |
| 🟠 HIGH | 5 | ⚠️ Fix within 24-48 hours |
| 🟡 MEDIUM | 5 | ⚠️ Fix within 1 week |
| **TOTAL** | **15** | **URGENT** |

**Next Step:** Deploy RLS policies immediately, then rotate secrets.

---

**Report Generated:** 2026-05-17  
**Audit Completed By:** Claude Code Security Scanner  
**Status:** 🔴 AWAITING REMEDIATION
