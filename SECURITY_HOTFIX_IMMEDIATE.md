# 🚨 IMMEDIATE SECURITY HOTFIX - DEPLOY NOW
**Status:** 🔴 CRITICAL  
**Time to Deploy:** < 30 minutes  
**Impact:** Fixes CVE-level data exposure vulnerabilities

---

## ⚡ DO THIS RIGHT NOW (Next 15 Minutes)

### 1. Deploy RLS Policies
```bash
# Step 1: Copy entire contents of supabase-ar-rls-policies.sql
# Step 2: Open Supabase Dashboard > SQL Editor
# Step 3: Paste and execute
# Step 4: Verify all policies created (should see ~20 policies)
```

**Why:** Without RLS, ALL data is publicly accessible. This is CRITICAL.

---

### 2. Rotate Exposed Secrets
```bash
# IMMEDIATELY generate new JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Example output: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6

# Update .env file
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6

# Redeploy application
npm install && npm run deploy
# OR
netlify deploy --prod
```

**Why:** Current JWT secret is hardcoded and weak. Anyone can forge tokens.

---

### 3. Rotate Supabase Anon Key
```bash
# In Supabase Dashboard:
# 1. Go to: Settings > API > Project API Keys
# 2. Find "anon" key (the one that's exposed in code)
# 3. Click "Rotate" button
# 4. Confirm (this invalidates the old key immediately)
```

**Why:** The key is hardcoded in `frontend/js/supabase-init.js`. Rotation makes it useless.

---

### 4. Remove Hardcoded Key from Code
```bash
# Edit frontend/js/supabase-init.js

# FIND THIS:
# const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__ || 'sb_publishable_obO2dwFXoF6nOKZ9nCG0Hg_V-cenHsB';

# CHANGE TO:
# const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__;

# Commit and push
git add frontend/js/supabase-init.js
git commit -m "🔒 Remove hardcoded Supabase key (security fix)"
git push origin main
```

**Why:** Prevents exposing new key in git history.

---

### 5. Delete Test Endpoint
```bash
# Edit server.js

# DELETE LINES 38-60:
# app.get("/api/test-db", async (req, res) => { ... });

# Commit and push
git add server.js
git commit -m "🔒 Remove debug endpoint exposing passwords (security fix)"
git push origin main
netlify deploy --prod
```

**Why:** This endpoint returns password hashes. It has no production purpose.

---

## ✅ Verification (After Hotfix)

Run these commands to verify fixes:

```bash
# 1. Verify RLS is enabled in Supabase
# In Supabase SQL Editor:
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true;
# Should return 15+ tables with RLS enabled

# 2. Verify hardcoded key is removed
grep -r "sb_publishable_" --include="*.js" --include="*.html"
# Should return NO results

# 3. Verify test endpoint is removed
grep -n "test-db" server.js
# Should return NO results

# 4. Verify JWT secret is updated
echo $JWT_SECRET
# Should show new random secret, not "zai_flow_super_secret_key"
```

---

## 📋 Complete Security Checklist

After the hotfix above, complete these within 24 hours:

- [ ] RLS policies deployed
- [ ] JWT secret rotated
- [ ] Supabase anon key rotated
- [ ] Hardcoded key removed from code
- [ ] Test endpoint deleted
- [ ] Application redeployed with new secrets
- [ ] .env file verified NOT in git
- [ ] Git history checked for exposed secrets

---

## 🔍 What Gets Fixed

| Vulnerability | Status |
|---|---|
| 🔴 Tables publicly accessible | ✅ FIXED by RLS |
| 🔴 Hardcoded JWT secret | ✅ FIXED by rotation |
| 🔴 Hardcoded anon key | ✅ FIXED by rotation |
| 🔴 Test endpoint with passwords | ✅ FIXED by deletion |
| 🔴 Anon key in git history | ⏳ PARTIALLY (remove code reference) |

---

## ⚠️ What Still Needs Fixing (Within 1 Week)

- CORS restrictions (currently allows all origins)
- Password validation (minimum 12 chars, complexity)
- Rate limiting on login (prevent brute force)
- HTTPS enforcement (in production)
- Remove passwords from SELECT queries

See `SECURITY_AUDIT_REPORT_2026.md` for complete details and fixes.

---

## 🆘 If Something Goes Wrong

**RLS breaks queries?**
```sql
-- Temporarily disable RLS (emergency only)
ALTER TABLE public.sales_invoices DISABLE ROW LEVEL SECURITY;

-- Then fix the policy and re-enable
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
```

**Forgot to rotate anon key before deployment?**
```bash
# Go to Supabase Dashboard > Settings > API
# Rotate the anon key immediately
# Redeploy application
```

**Can't deploy?**
```bash
# Check for errors
npm run build
# Roll back to previous version
git revert HEAD
git push origin main
```

---

## ✨ After Hotfix

Once this hotfix is deployed:
1. ✅ Data is protected by RLS
2. ✅ Secrets are rotated
3. ✅ Exposed credentials are invalidated
4. ✅ Risk level drops from CRITICAL to HIGH

**Then**, work through the full remediation plan in `SECURITY_AUDIT_REPORT_2026.md`.

---

**Time Estimate:** 15 minutes to deploy hotfix  
**Risk During Deployment:** Low (RLS is backwards compatible, secrets rotation is immediate)  
**Expected Downtime:** < 1 minute (redeployment)  

**Status:** Ready to deploy  
**Next Step:** Execute steps 1-5 above
