# Netlify Function Setup - Auto User Creation

**Status**: Implemented. NOT deployed yet.

---

## Overview

A Netlify Function (`create-user`) has been implemented to automatically create users in both Supabase Auth and the database when admins create new users through the admin panel.

### How It Works

```
Admin Panel
  ↓
User submits new user form
  ↓
Admin Panel calls Netlify Function /.netlify/functions/create-user
  ↓
Function creates in Supabase Auth (gets UUID)
  ↓
Function creates in users table (with auth_id = UUID)
  ↓
Function creates in user_branch_access table
  ↓
User can now login immediately
```

---

## Files Modified

### Frontend Changes

**`frontend/js/admin-business.js` (createNewUser function)**

- **Before**: Direct database insert to `users` table (no Supabase Auth creation)
- **After**: Calls Netlify Function to create both Auth + Database users

```javascript
// Before:
const { data, error } = await window.supabase
  .from('users')
  .insert([{ name, email, password, ... }]);

// After:
const response = await fetch('/.netlify/functions/create-user', {
  method: 'POST',
  body: JSON.stringify({ email, password, name, role, business_id })
});
```

### Backend Changes

**`netlify/functions/create-user.js` (Updated)**

- Fixed: `auth_id` instead of `id` for database link
- Fixed: No password stored in database (security improvement)
- Added: Proper rollback if database insert fails
- Added: auth_id returned in response

```javascript
// Step 1: Create in Supabase Auth
const { data: authUser } = await supabase.auth.admin.createUser({
  email, password, email_confirm: true
});

// Step 2: Create in database with auth_id
const { data: dbUser } = await supabase
  .from('users')
  .insert({
    auth_id: authUser.user.id,  // Link via UUID
    email, name, role, business_id
  });

// Step 3: Create branch access
await supabase
  .from('user_branch_access')
  .insert({
    user_id: dbUser.id,  // Link via INTEGER id
    branch_id, role, is_primary_branch: true
  });
```

---

## Environment Variables Required

**On Netlify, set these in Settings > Build & deploy > Environment:**

```
SUPABASE_URL=https://jzhwlablyxaeupvtpdce.supabase.co
SUPABASE_ANON_KEY=sb_publishable_obO2dwFXoF6nOKZ9nCG0Hg_V-cenHsB
SUPABASE_ADMIN_KEY=<YOUR_SERVICE_ROLE_KEY>
```

### Where to Get SUPABASE_ADMIN_KEY

1. Go to Supabase Console > Project > Settings > API
2. Copy the **Service Role Key** (starts with `sbp_...`)
3. ⚠️ **NEVER** expose this in frontend code - only in Netlify env vars

### Why Service Role Key?

- Regular `ANON_KEY` can only create auth users via signup flow
- Service Role Key allows admin API access to create users directly
- This is server-side only (in Netlify Function), never sent to browser

---

## User Creation Flow

### Step 1: Admin Creates User
```
Admin fills form:
  - Name: "John Doe"
  - Email: "john@company.com"
  - Password: "SecurePass123"
  - Business: "My Business"
  - Branch: "Main Branch"
```

### Step 2: Frontend Validation
```javascript
// Validate fields
if (!name || !email || !password) {
  showMessage('Please fill all fields', 'error');
  return;
}
```

### Step 3: Netlify Function Execution
```javascript
POST /.netlify/functions/create-user
{
  "email": "john@company.com",
  "password": "SecurePass123",
  "name": "John Doe",
  "role": "employee",
  "business_id": 1
}
```

**Function returns:**
```json
{
  "success": true,
  "user": {
    "id": 52,
    "auth_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "email": "john@company.com",
    "name": "John Doe",
    "role": "employee",
    "business_id": 1
  },
  "message": "User john@company.com created with employee role"
}
```

### Step 4: Admin Panel Updates Branch Access
```javascript
// Function response includes user.id
// Admin panel now adds to user_branch_access
await supabase.from('user_branch_access').insert({
  user_id: result.user.id,      // From function
  branch_id: selectedBranch,
  role: 'employee',
  is_primary_branch: true
});
```

### Step 5: User Can Login
```
User opens login.html
  ↓
Enters email: john@company.com
Enters password: SecurePass123
  ↓
Supabase Auth validates (user exists in Auth)
  ↓
auth.js fetches profile from users table (by auth_id)
  ↓
Loads branch context from user_branch_access
  ↓
Redirects to employee-landing.html
✅ Successfully logged in!
```

---

## Error Handling

### Scenario 1: Auth User Created, Database Fails
```javascript
// Function detects database error
if (dbError) {
  // Rollback: Delete the auth user
  await supabase.auth.admin.deleteUser(authUser.user.id);
  
  // Return error
  return { error: 'Failed to create database user' };
}
```

**Result**: No orphaned auth users, clean state

### Scenario 2: Missing Environment Variable
```
Error: SUPABASE_ADMIN_KEY not set
```

**Fix**: Add to Netlify Environment variables

### Scenario 3: Invalid Password
```
Error: 'Password should be minimum 6 characters'
```

**Fix**: Client validates before sending, function validates again

---

## Database Schema Requirements

Ensure these columns exist:

**users table:**
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  auth_id UUID UNIQUE NOT NULL,  -- Links to Supabase Auth
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  role TEXT,
  business_id INTEGER NOT NULL
);
```

**user_branch_access table:**
```sql
CREATE TABLE user_branch_access (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  branch_id INTEGER NOT NULL,
  role TEXT,
  is_primary_branch BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'ACTIVE',
  assigned_at TIMESTAMP DEFAULT NOW()
);
```

---

## Security Considerations

### ✅ Implemented Security

1. **No Password Stored in Database**
   - Only in Supabase Auth (bcrypt hashed)
   - Database has no password column

2. **Service Role Key Protected**
   - Only in Netlify environment (server-side)
   - Never sent to browser
   - Users cannot see/modify it

3. **Automatic Email Confirmation**
   - `email_confirm: true` auto-verifies user
   - No email confirmation email sent
   - User can login immediately

4. **Rollback on Failure**
   - If DB create fails, Auth user deleted
   - No orphaned users

5. **Function Authentication**
   - Only POST allowed
   - Accessible from browser (trusted Netlify domain)

### ⚠️ Consider Adding

1. **Rate Limiting**
   - Prevent admin from creating 1000 users/second
   - Add timeout between requests

2. **Admin API Token Auth**
   - Only admin users can call function
   - Currently: Anyone with access to website can call

3. **Audit Logging**
   - Log who created which users
   - When users were created
   - From which IP

4. **Email Notification**
   - Send created users temporary password
   - Require password change on first login

---

## Testing the Function

### Local Test (Before Deployment)

```bash
# 1. Start Netlify Functions locally
netlify functions:serve

# 2. Test the function
curl -X POST http://localhost:8888/.netlify/functions/create-user \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123",
    "name": "Test User",
    "role": "employee",
    "business_id": 1
  }'
```

### Production Test (After Deployment)

```javascript
// Open browser console on live site
fetch('/.netlify/functions/create-user', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'testuser@company.com',
    password: 'TestPass123',
    name: 'Test User',
    role: 'employee',
    business_id: 1
  })
})
.then(r => r.json())
.then(data => console.log(data));
```

---

## Deployment Checklist

- [ ] Add SUPABASE_ADMIN_KEY to Netlify Environment
- [ ] Verify create-user.js function is updated
- [ ] Verify admin-business.js calls Netlify function
- [ ] Test user creation via admin panel
- [ ] Verify created user can login
- [ ] Test branch assignment works
- [ ] Test error scenarios (duplicate email, invalid password)

---

## Troubleshooting

### "Function not found" Error
- Check: `netlify/functions/create-user.js` exists
- Check: Netlify functions directory configured in `netlify.toml`
- Try: Redeploy

### "SUPABASE_ADMIN_KEY is undefined"
- Check: Environment variable set on Netlify
- Check: Correct value copied (starts with `sbp_`)
- Wait: Environment variables can take 1-2 minutes to apply

### "User already exists"
- Check: Email not already in Supabase Auth
- Check: Email not in users table
- Solution: Use different email address

### "Invalid password" Error
- Check: Password is at least 6 characters
- Check: Password contains letters and numbers
- Solution: User strong passwords

---

## Success Indicators

After deployment, you should see:

1. ✅ Admin can create user via admin panel
2. ✅ No errors in browser console
3. ✅ User appears in Supabase Auth console
4. ✅ User appears in users table with auth_id
5. ✅ User appears in user_branch_access
6. ✅ User can login immediately
7. ✅ Correct branch displays after login
8. ✅ Correct modules visible based on role
