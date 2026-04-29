# Multi-Tenant SaaS Deployment Guide
## ZAI FLOW 2.0 - Phase 2.1 Implementation

---

## STEP 1: Database Migrations (In Supabase SQL Editor)

### 1.1 Run Schema Migration

**Location**: Supabase Dashboard → SQL Editor

1. **Create new query** in Supabase SQL Editor
2. **Copy entire content** from: `D:\mainza\ZAI FLOW 2.0\supabase-multi-tenant-schema.sql`
3. **Paste into SQL Editor**
4. **Click "Run"** button
5. **Wait for completion** (should take 30-60 seconds)

Expected output: No errors, all DDL commands executed

**What this does:**
- Creates 4 new tables (business_entities, branches, user_branch_access, business_settings)
- Adds branch_id column to 18 existing tables
- Migrates all existing data to DEFAULT_BUSINESS
- Creates performance indexes
- Creates helper functions

### 1.2 Verify Schema Migration

Run these verification queries in SQL Editor:

```sql
-- Check table counts
SELECT COUNT(*) as business_count FROM business_entities;
SELECT COUNT(*) as branch_count FROM branches;
SELECT COUNT(*) as user_access_count FROM user_branch_access;

-- Should return:
-- business_count: 1 (DEFAULT_BUSINESS)
-- branch_count: 1 (Main Branch)
-- user_access_count: 4 (all existing users)

-- Check data migration
SELECT COUNT(*) as sales_migrated FROM sales WHERE branch_id IS NOT NULL;
SELECT COUNT(*) as products_migrated FROM products WHERE branch_id IS NOT NULL;
SELECT COUNT(*) as suppliers_migrated FROM suppliers WHERE branch_id IS NOT NULL;

-- All should show correct counts from existing data
```

### 1.3 Run RLS Policies

1. **Create new query** in Supabase SQL Editor
2. **Copy entire content** from: `D:\mainza\ZAI FLOW 2.0\supabase-multi-tenant-rls.sql`
3. **Paste into SQL Editor**
4. **Click "Run"** button
5. **Wait for completion**

Expected output: No errors, all RLS policies created

**What this does:**
- Enables RLS on 20+ tables
- Creates branch isolation policies
- Ensures users only see their branch data

### 1.4 Test RLS Policies

```sql
-- This query should return the current user's branches
SELECT * FROM branches;
-- If RLS is working, only shows branches user has access to

-- Try to bypass RLS (should fail silently)
-- Switch to a different user, attempt cross-branch access
SELECT * FROM sales WHERE branch_id = 999;  
-- Should return 0 rows (RLS blocks it)
```

---

## STEP 2: Backend Authentication Updates

### 2.1 Modify Login Response

**Location**: Backend authentication service (usually in API/auth endpoint)

**Current Response:**
```json
{
  "id": 1,
  "name": "Cashier One",
  "email": "cashier@zai.com",
  "role": "cashier"
}
```

**New Response:**
```json
{
  "id": 1,
  "name": "Cashier One",
  "email": "cashier@zai.com",
  "role": "cashier",
  "branches": [
    {
      "branch_id": 1,
      "branch_name": "Main Branch",
      "business_id": 1,
      "business_name": "DEFAULT_BUSINESS",
      "role": "cashier",
      "is_primary": true
    }
  ],
  "current_branch_id": 1,
  "current_business_id": 1
}
```

**SQL Query to Build Response:**
```sql
-- Query to get user's branches
SELECT 
  u.id,
  u.name,
  u.email,
  u.role,
  json_agg(
    json_build_object(
      'branch_id', b.id,
      'branch_name', b.name,
      'business_id', be.id,
      'business_name', be.name,
      'role', uba.role,
      'is_primary', uba.is_primary_branch
    )
  ) as branches
FROM users u
LEFT JOIN user_branch_access uba ON u.id = uba.user_id AND uba.status = 'ACTIVE'
LEFT JOIN branches b ON uba.branch_id = b.id
LEFT JOIN business_entities be ON b.business_id = be.id
WHERE u.id = $1
GROUP BY u.id, u.name, u.email, u.role;

-- Set current_branch_id to the is_primary one
```

### 2.2 Implementation (if using Node.js/Express)

**Example Backend (pseudocode):**
```javascript
// routes/auth.js
async function login(email, password) {
  // Verify password
  const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  if (!bcrypt.compare(password, user.password)) {
    throw new Error('Invalid credentials');
  }

  // Get user's branch access
  const branches = await db.query(`
    SELECT 
      b.id as branch_id,
      b.name as branch_name,
      be.id as business_id,
      be.name as business_name,
      uba.role,
      uba.is_primary_branch
    FROM user_branch_access uba
    JOIN branches b ON uba.branch_id = b.id
    JOIN business_entities be ON b.business_id = be.id
    WHERE uba.user_id = $1 AND uba.status = 'ACTIVE'
  `, [user.id]);

  // Find primary branch
  const primaryBranch = branches.find(b => b.is_primary_branch);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    branches: branches,
    current_branch_id: primaryBranch?.branch_id || branches[0]?.branch_id,
    current_business_id: primaryBranch?.business_id || branches[0]?.business_id
  };
}
```

---

## STEP 3: Frontend Session Enhancement

### 3.1 Update localStorage Structure

**File**: `/frontend/login.html` and auth handling code

**Current:**
```javascript
localStorage.setItem('user', JSON.stringify({
  id: 1,
  name: "Cashier One",
  email: "cashier@zai.com",
  role: "cashier"
}));
```

**New:**
```javascript
localStorage.setItem('user', JSON.stringify({
  id: 1,
  name: "Cashier One",
  email: "cashier@zai.com",
  role: "cashier",
  branches: [
    {
      branch_id: 1,
      branch_name: "Main Branch",
      business_id: 1,
      business_name: "DEFAULT_BUSINESS",
      role: "cashier",
      is_primary: true
    }
  ],
  current_branch_id: 1,
  current_business_id: 1
}));
```

### 3.2 Create Branch Context Utility

**Create new file**: `/frontend/js/branch-context.js`

```javascript
/**
 * Get current branch context from localStorage
 * @returns {Object} {branch_id, business_id, business_name, branch_name}
 */
function getBranchContext() {
  const user = JSON.parse(localStorage.getItem('user'));
  
  if (!user || !user.current_branch_id) {
    console.error('❌ No branch context found - user not logged in or branch not set');
    return null;
  }
  
  const branch = user.branches.find(b => b.branch_id === user.current_branch_id);
  
  return {
    branch_id: user.current_branch_id,
    business_id: user.current_business_id,
    business_name: branch?.business_name || 'Unknown',
    branch_name: branch?.branch_name || 'Unknown',
    user_id: user.id
  };
}

/**
 * Add branch filtering to a Supabase query
 * @param {Object} query - Supabase query builder
 * @returns {Object} Query with branch_id filter applied
 */
function withBranchFilter(query) {
  const context = getBranchContext();
  
  if (!context) {
    throw new Error('Cannot apply branch filter - no branch context available');
  }
  
  return query.eq('branch_id', context.branch_id);
}

/**
 * Switch to a different branch
 * @param {Integer} branchId - Branch ID to switch to
 */
function switchBranch(branchId) {
  const user = JSON.parse(localStorage.getItem('user'));
  const branch = user.branches.find(b => b.branch_id === branchId);
  
  if (!branch) {
    alert('❌ You do not have access to this branch');
    return false;
  }
  
  // Update current branch
  user.current_branch_id = branch.branch_id;
  user.current_business_id = branch.business_id;
  
  // Save to localStorage
  localStorage.setItem('user', JSON.stringify(user));
  
  // Reload page to fetch branch-specific data
  console.log(`🔄 Switched to branch: ${branch.branch_name}`);
  location.reload();
  
  return true;
}

/**
 * Display branch selector in header
 */
function initBranchSelector() {
  const user = JSON.parse(localStorage.getItem('user'));
  const dropdown = document.getElementById('branchDropdown');
  
  if (!dropdown || !user?.branches) return;

  dropdown.innerHTML = '';
  
  user.branches.forEach(branch => {
    const option = document.createElement('option');
    option.value = branch.branch_id;
    option.textContent = `${branch.business_name} - ${branch.branch_name}`;
    option.selected = branch.branch_id === user.current_branch_id;
    dropdown.appendChild(option);
  });
  
  // Add change listener
  dropdown.addEventListener('change', (e) => {
    switchBranch(parseInt(e.target.value));
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initBranchSelector();
});
```

### 3.3 Add Branch Selector to All HTML Files

**Update all HTML files** (accounting.html, dashboard.html, sales.html, etc.):

Add this to the header/navbar:

```html
<!-- Branch Selector (after user info) -->
<div style="display: inline-block; margin-left: 20px;">
  <label for="branchDropdown" style="margin-right: 8px;">📍 Branch:</label>
  <select id="branchDropdown" style="padding: 6px 10px; border-radius: 4px; border: 1px solid #ccc;">
    <!-- Populated by branch-context.js -->
  </select>
</div>
```

### 3.4 Include branch-context.js in All HTML Files

Add before closing `</body>` tag:

```html
<script src="js/branch-context.js"></script>
```

---

## STEP 4: Update All Frontend Queries

### 4.1 Pattern Change

**Before (Global):**
```javascript
const { data, error } = await supabase
  .from('sales')
  .select('*')
  .order('created_at', { ascending: false });
```

**After (Branch-Filtered):**
```javascript
const { data, error } = withBranchFilter(supabase.from('sales').select('*'))
  .order('created_at', { ascending: false });

// OR manual approach:
const context = getBranchContext();
const { data, error } = await supabase
  .from('sales')
  .select('*')
  .eq('branch_id', context.branch_id)
  .order('created_at', { ascending: false });
```

### 4.2 Files to Update

**Priority Order** (highest impact first):

1. `/frontend/js/sales.js` - ~30 queries
2. `/frontend/js/dashboard.js` - ~15 queries
3. `/frontend/js/purchasing.js` - ~15 queries
4. `/frontend/js/accounting.js` - ~10 queries
5. `/frontend/js/inventory.js` - ~8 queries
6. `/frontend/js/payroll.js` - ~10 queries (when implemented)
7. `/frontend/js/hr.js` - ~10 queries (when implemented)
8. All other JS files with queries

### 4.3 Quick Find & Replace

Use your editor's find & replace to speed up:

**Find:**
```
.select('*')
```

**Replace with:**
```
.select('*')
.eq('branch_id', getBranchContext().branch_id)
```

Then manually review each replacement for edge cases.

---

## STEP 5: Update RPC Functions

### 5.1 Example: Update create_purchase_order

**File**: `D:\mainza\ZAI FLOW 2.0\supabase-purchasing-functions.sql`

**Before:**
```sql
CREATE OR REPLACE FUNCTION create_purchase_order(
  p_supplier_id INTEGER,
  p_items JSONB,
  p_expected_delivery_date DATE,
  p_notes TEXT
)
```

**After:**
```sql
CREATE OR REPLACE FUNCTION create_purchase_order(
  p_branch_id INTEGER,  -- ← NEW PARAMETER
  p_supplier_id INTEGER,
  p_items JSONB,
  p_expected_delivery_date DATE,
  p_notes TEXT
)
RETURNS TABLE (po_id INTEGER, po_number TEXT, total_amount NUMERIC, status TEXT) AS $$
DECLARE
  v_po_id INTEGER;
  -- ... rest of variables
BEGIN
  -- Validate branch exists
  IF NOT EXISTS (SELECT 1 FROM branches WHERE id = p_branch_id) THEN
    RAISE EXCEPTION 'Branch ID % does not exist', p_branch_id;
  END IF;
  
  -- Validate supplier belongs to branch
  IF NOT EXISTS (SELECT 1 FROM suppliers WHERE id = p_supplier_id AND branch_id = p_branch_id) THEN
    RAISE EXCEPTION 'Supplier does not belong to this branch';
  END IF;

  -- Insert with branch_id
  INSERT INTO purchase_orders (branch_id, po_number, supplier_id, ...)
  VALUES (p_branch_id, v_po_number, p_supplier_id, ...);
  
  -- ... rest of function
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 5.2 Update Frontend RPC Call

**File**: `/frontend/js/purchasing.js`

**Before:**
```javascript
const { data, error } = await supabase.rpc('create_purchase_order', {
  p_supplier_id: supplierId,
  p_items: poItems,
  p_expected_delivery_date: deliveryDate,
  p_notes: notes
});
```

**After:**
```javascript
const context = getBranchContext();
const { data, error } = await supabase.rpc('create_purchase_order', {
  p_branch_id: context.branch_id,  // ← NEW PARAMETER
  p_supplier_id: supplierId,
  p_items: poItems,
  p_expected_delivery_date: deliveryDate,
  p_notes: notes
});
```

### 5.3 RPC Functions to Update

- supabase-purchasing-functions.sql:
  - `create_purchase_order` 
  - `receive_purchase_order`
  - `record_purchase_invoice`
  - `process_purchase_payment`

- supabase-rpc-functions.sql:
  - `open_cash_drawer`
  - `complete_sale`
  - Any other RPC functions

---

## STEP 6: Testing Multi-Tenant Setup

### 6.1 Verify Data Isolation

**Scenario**: Create two branches and switch between them

1. **Log in to Supabase** as an admin
2. **Create new business** via SQL:
   ```sql
   SELECT create_business('TEST_BUSINESS_2', 'Downtown Location', 1);
   -- Returns: business_id = 2, branch_id = 2
   ```

3. **Create test data** in branch 2:
   ```sql
   INSERT INTO products (branch_id, name, sku, price, stock)
   VALUES (2, 'Test Product Branch 2', 'TEST-B2-001', 100, 50);
   ```

4. **Switch branches** in frontend and verify:
   - Branch 1 products don't show on branch 2
   - Sales from branch 1 don't appear in branch 2
   - GL entries are separate per branch

### 6.2 Test Access Control

**Scenario**: Create users with different branch access

```sql
-- Create test user
INSERT INTO users (name, email, password, role)
VALUES ('Test Cashier 2', 'cashier2@zai.com', 'hashed_password', 'cashier');

-- Grant access only to branch 1
SELECT grant_branch_access(5, 1, 'cashier', 1);
-- Returns: success = true

-- Try to grant access to non-existent branch (should fail)
SELECT grant_branch_access(5, 999, 'cashier', 1);
-- Should return error
```

### 6.3 Verify RLS Enforcement

```sql
-- Query as admin (should see all branches)
SELECT * FROM branches;  -- Returns all

-- Query as regular user (should see only assigned branches)
-- (This requires proper JWT token configuration)
SELECT * FROM branches;  -- Returns only user's branches
```

---

## TROUBLESHOOTING

### Issue: "Column branch_id does not exist"
**Solution**: Verify schema migration ran successfully
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'sales' AND column_name = 'branch_id';
-- Should return: branch_id
```

### Issue: "RLS policy violation"
**Solution**: User doesn't have access to that branch
- Check `user_branch_access` table
- Grant user access with: `SELECT grant_branch_access(...)`

### Issue: "Data showing from other branches"
**Solution**: Query not filtering by branch_id
- Add `.eq('branch_id', context.branch_id)` to query
- Or use `withBranchFilter()` helper

### Issue: "Queries work in SQL Editor but not in frontend"
**Solution**: RLS policies might be blocking PostgREST access
- Check that auth.uid() is being passed correctly
- Verify JWT token is valid

---

## NEXT STEPS

After deployment:

1. ✅ **Database Migrations Complete** (Steps 1-3)
2. ⬜ **Frontend Query Updates** (Step 4) - Add branch filtering to 20+ files
3. ⬜ **RPC Function Updates** (Step 5) - Update purchasing & payroll functions
4. ⬜ **Business Management UI** (Step 6) - Create admin panel

---

## Estimated Timeline

- Step 1: 30 minutes (run SQL migrations)
- Step 2: 1 hour (backend auth updates)
- Step 3: 30 minutes (frontend session setup)
- Step 4: 4-6 hours (update all queries)
- Step 5: 2-3 hours (update RPC functions)
- Step 6: 2-3 hours (business management UI)

**Total: 10-14 hours**

---

**Status**: Ready to Execute
**Last Updated**: 2026-04-27
