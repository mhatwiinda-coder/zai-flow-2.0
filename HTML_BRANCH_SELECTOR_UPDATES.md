# HTML Branch Selector Updates
## How to Add Branch Selector to All Pages

---

## Quick Summary

Each HTML file needs:
1. **Branch selector HTML** in the header (3 lines)
2. **Script include** for branch-context.js (1 line)

Total additions per file: ~4 lines of code

---

## Step 1: Add Branch Selector to Header

Add this code to the **top-right of your navbar/header** in each HTML file:

```html
<!-- Branch/Business Selector -->
<div style="display: inline-block; margin: 0 15px; vertical-align: middle;">
  <label for="branchDropdown" style="margin-right: 8px; color: #999; font-size: 12px;">📍 Branch:</label>
  <select id="branchDropdown" style="padding: 6px 12px; border-radius: 4px; border: 1px solid #667eea; background: #1e1e1e; color: #e0e0e0; cursor: pointer;">
    <!-- Populated by branch-context.js -->
  </select>
</div>
```

---

## Step 2: Add Script Include

Add this line **before the closing `</body>` tag** in each HTML file:

```html
<script src="js/branch-context.js"></script>
```

---

## Files to Update

### Priority: HIGH (Core Modules)

#### 1. **`/frontend/sales.html`** ⭐
**Location**: Find the header with user info, add branch selector next to it

Example current structure:
```html
<header>
  <h1>Point of Sale</h1>
  <div id="userInfo">User Name</div>
</header>
```

Update to:
```html
<header>
  <h1>Point of Sale</h1>
  <div style="display: flex; justify-content: space-between; align-items: center;">
    <div>
      <!-- Branch selector -->
      <label for="branchDropdown">📍 Branch:</label>
      <select id="branchDropdown"></select>
    </div>
    <div id="userInfo">User Name</div>
  </div>
</header>
```

Add before `</body>`:
```html
<script src="js/branch-context.js"></script>
```

---

#### 2. **`/frontend/dashboard.html`** ⭐
Same pattern as sales.html

---

#### 3. **`/frontend/accounting.html`** ⭐
Same pattern as sales.html

---

#### 4. **`/frontend/purchasing.html`** ⭐
Same pattern as sales.html

---

### Priority: MEDIUM (Supporting Modules)

#### 5. **`/frontend/inventory.html`**
#### 6. **`/frontend/hr.html`**
#### 7. **`/frontend/payroll.html`** (Future)
#### 8. **`/frontend/zra.html`**

All follow the same pattern above.

---

### Priority: LOW (Admin/Config)

#### 9. **`/frontend/suppliers.html`**
#### 10. **`/frontend/bi.html`** (BI Dashboard)

---

## Template: Copy-Paste Ready

### For files with **existing navbar/header**:

**FIND THIS:**
```html
<div id="userInfo">User Name</div>
```

**REPLACE WITH THIS:**
```html
<div style="display: flex; justify-content: space-between; align-items: center; gap: 20px;">
  <div>
    <label for="branchDropdown" style="margin-right: 8px;">📍 Branch:</label>
    <select id="branchDropdown" style="padding: 6px 12px; border-radius: 4px; border: 1px solid #667eea; background: #1e1e1e; color: #e0e0e0;"></select>
  </div>
  <div id="userInfo">User Name</div>
</div>
```

**FIND THIS:**
```html
</body>
</html>
```

**REPLACE WITH THIS:**
```html
  <script src="js/branch-context.js"></script>
</body>
</html>
```

---

## Example: Complete Update for accounting.html

### BEFORE:
```html
<!DOCTYPE html>
<html>
<head>
  <title>Accounting - ZAI FLOW</title>
</head>
<body>
  <header>
    <h1>General Ledger</h1>
    <div id="userInfo">Cashier One</div>
  </header>
  
  <!-- rest of page -->
  
  <script src="js/supabase-init.js"></script>
  <script src="js/accounting.js"></script>
</body>
</html>
```

### AFTER:
```html
<!DOCTYPE html>
<html>
<head>
  <title>Accounting - ZAI FLOW</title>
</head>
<body>
  <header>
    <h1>General Ledger</h1>
    <div style="display: flex; justify-content: space-between; align-items: center; gap: 20px;">
      <div>
        <label for="branchDropdown" style="margin-right: 8px;">📍 Branch:</label>
        <select id="branchDropdown" style="padding: 6px 12px; border-radius: 4px; border: 1px solid #667eea; background: #1e1e1e; color: #e0e0e0;"></select>
      </div>
      <div id="userInfo">Cashier One</div>
    </div>
  </header>
  
  <!-- rest of page -->
  
  <script src="js/supabase-init.js"></script>
  <script src="js/branch-context.js"></script>
  <script src="js/accounting.js"></script>
</body>
</html>
```

---

## Testing After Updates

1. **Load any page** (e.g., sales.html)
2. **Should see**: Branch dropdown in header with your branches listed
3. **Try switching**: Click dropdown → select different branch → page reloads with new branch data
4. **Verify isolation**: 
   - Branch A should only show Branch A data
   - Switching to Branch B should hide Branch A data

---

## Styling Customization

If you want a different look, adjust the styles:

```html
<!-- Minimal styling (just dropdown) -->
<select id="branchDropdown" style="padding: 8px; cursor: pointer;"></select>

<!-- Styled (matches dark theme) -->
<select id="branchDropdown" 
  style="padding: 6px 12px; 
         border-radius: 4px; 
         border: 1px solid #667eea; 
         background: #1e1e1e; 
         color: #e0e0e0; 
         cursor: pointer;">
</select>

<!-- Compact -->
<select id="branchDropdown" style="padding: 4px 8px; font-size: 12px;"></select>
```

---

## Troubleshooting

### Branch selector not appearing?
- [ ] Check that `id="branchDropdown"` is exactly correct
- [ ] Check that `branch-context.js` is loaded AFTER `supabase-init.js`
- [ ] Check browser console for errors (F12)

### "Cannot read property 'branches' error"
- [ ] User may not be logged in properly
- [ ] Login response may not include branches array (backend update needed)
- [ ] Check localStorage to see if user object has branches property

### Dropdown shows but selecting doesn't work
- [ ] Make sure page has `<script src="js/branch-context.js"></script>`
- [ ] Check console for JavaScript errors
- [ ] Clear browser cache and reload (Ctrl+Shift+R)

---

## Order of Script Includes

**IMPORTANT**: Script order matters!

```html
<body>
  <!-- Your content -->
  
  <!-- This order is CRITICAL: -->
  <script src="js/supabase-init.js"></script>    <!-- 1st: Initialize Supabase -->
  <script src="js/branch-context.js"></script>  <!-- 2nd: Load branch utilities -->
  <script src="js/sales.js"></script>           <!-- 3rd+: Your page-specific scripts -->
  
</body>
```

---

## Next Steps

1. ✅ Update all 10 HTML files with branch selector
2. ⬜ Update all JavaScript queries to filter by branch_id
3. ⬜ Update RPC functions to accept branch_id
4. ⬜ Test multi-branch functionality end-to-end

---

## Quick Checklist

For each file:
- [ ] Added branch dropdown to header
- [ ] Added `<script src="js/branch-context.js"></script>` before closing body
- [ ] Tested in browser - branch selector appears
- [ ] Tested switching branches - page reloads correctly

---

**Estimated Time**: 10-15 minutes for all 10 files  
**Difficulty**: ⭐ Easy (copy-paste)  
**Impact**: High - Enables multi-tenant UI
