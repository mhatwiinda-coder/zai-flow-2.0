# 🎯 START HERE - Deploy to demo.zai-digital-studio.com

**Everything is ready. Follow these exact steps.**

---

## 📌 What You're Doing

Deploying ZAI FLOW 2.0 to a **new Netlify site** accessible via **demo.zai-digital-studio.com**

Your main website (**zai-digital-studio.com**) stays separate and unchanged.

---

## ⚡ Quick Command (Copy & Paste)

Open PowerShell and run these exact commands:

```powershell
# Navigate to project
cd "D:\mainza\ZAI FLOW 2.0"

# Initialize git
git init

# Add all files
git add .

# Create commit
git commit -m "Initial ZAI FLOW 2.0 - Full ERP System with multi-tenancy"

# Add GitHub remote (REPLACE YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/zai-flow-2.0.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Expected output:** 
```
Creating new branch 'main'...
Enumerating objects...
Writing objects...
To https://github.com/YOUR_USERNAME/zai-flow-2.0.git
 * [new branch]      main -> main
Branch 'main' set up to track remote tracking branch 'main' from 'origin'.
```

---

## 📋 After Git Push - Netlify Setup (Do This Next)

### 1. Create New Netlify Site

1. Go to **https://app.netlify.com**
2. Click **"New site from Git"** (top right)
3. Select **GitHub**
4. Search and select: `zai-flow-2.0`
5. **Configure:**
   - Base directory: `frontend`
   - Build command: *(leave empty)*
   - Publish directory: `frontend`
6. Click **"Deploy site"**
7. **Wait 2-3 minutes for deployment**

### 2. Add Custom Domain

1. In Netlify, go to **Site Settings** → **Domain Management**
2. Click **"Add custom domain"**
3. Enter: `demo.zai-digital-studio.com`
4. Click **"Verify"**
5. **Netlify shows:** 
   ```
   CNAME Name: demo
   CNAME Value: something-random.netlify.app
   ```
6. **Copy these values** ← You'll need them

### 3. Update Your Domain DNS

**Go to your domain registrar** (GoDaddy, Namecheap, Google Domains, etc.)

**Find DNS Settings** and add this record:

```
Type:  CNAME
Name:  demo
Value: [paste the value from Netlify]
TTL:   3600 (or Auto)
```

Click **"Save"**

### 4. Update Supabase CORS

1. Go to **https://supabase.com** → Your Project
2. **Settings** → **API**
3. Find **"CORS allowed origins"**
4. Add: `https://demo.zai-digital-studio.com`
5. Click **"Save"**

### 5. Wait & Test

**Wait 10-15 minutes** for DNS to propagate, then visit:

```
https://demo.zai-digital-studio.com
```

You should see the ZAI FLOW login page.

---

## 📁 Important Files

**Configuration Files (already created):**
- ✅ `frontend/netlify.toml` - Netlify config
- ✅ `frontend/_redirects` - URL routing
- ✅ `frontend/js/supabase-init.js` - Supabase connection

**Documentation (in root folder):**
- 📖 `SUBDOMAIN_DEPLOYMENT_QUICKSTART.md` - Quick reference
- 📖 `GIT_SETUP_INSTRUCTIONS.md` - Detailed Git setup
- 📖 `NETLIFY_SUBDOMAIN_SETUP.md` - Detailed Netlify setup
- 📖 `NETLIFY_DEPLOYMENT_CHECKLIST.md` - Verification steps

---

## 🔍 Verify It Works

After DNS propagates (10-15 min), check:

### ✅ Test 1: Visit your subdomain
```
https://demo.zai-digital-studio.com
```
Should show ZAI FLOW login page

### ✅ Test 2: Check SSL
- Look for 🔒 lock icon in browser
- Click it → should show "Secure"

### ✅ Test 3: Browser Console
- Press F12
- Click "Console" tab
- Should show: `✅ Supabase initialized`
- No red errors

### ✅ Test 4: Test Login
- Use test credentials from your Supabase
- Should redirect to dashboard

---

## 🚀 After Going Live

### To Make Updates:

```bash
# Make changes to code
# Then:

git add .
git commit -m "Update: Description of change"
git push origin main

# Netlify automatically deploys (1-2 minutes)
```

### To Customize Supabase Credentials:

Edit `frontend/js/supabase-init.js`:

```javascript
const SUPABASE_URL = 'https://[your-project-id].supabase.co';
const SUPABASE_ANON_KEY = '[your-anon-key-here]';
```

Then push to Git (Netlify auto-deploys).

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Domain not found" | Wait 15-30 min for DNS propagation |
| "CORS blocked" request | Add domain to Supabase CORS settings, wait 2 min, refresh |
| Blank page / 404 | Check browser console (F12) for errors |
| Login fails | Verify test user exists in Supabase |
| "Cannot reach Supabase" | Check SUPABASE_URL and SUPABASE_ANON_KEY in supabase-init.js |

---

## 📊 What Gets Deployed

```
demo.zai-digital-studio.com
  ├── Login page
  ├── Employee dashboard
  ├── Sales/POS
  ├── Inventory
  ├── Accounting
  ├── HR & Payroll
  ├── Purchasing
  └── BI Analytics
```

All connected to your Supabase backend.

---

## ✨ Final Checklist

Before sharing with others:

- [ ] Pushed to GitHub
- [ ] Created Netlify site
- [ ] Added custom domain (demo.zai-digital-studio.com)
- [ ] Updated DNS records
- [ ] Updated Supabase CORS
- [ ] DNS propagated (10-15 min wait)
- [ ] Visit URL - shows login page
- [ ] Check console - no errors
- [ ] Test login works
- [ ] SSL lock icon shows

---

## 🎉 You're Done!

Your ZAI FLOW 2.0 is live at:

```
https://demo.zai-digital-studio.com
```

Share this URL with anyone who wants to see your ERP demo.

---

## 📖 Need More Details?

- **Git issues?** → `GIT_SETUP_INSTRUCTIONS.md`
- **Netlify issues?** → `NETLIFY_SUBDOMAIN_SETUP.md`
- **DNS issues?** → Check your registrar's DNS settings
- **Supabase issues?** → `DEPLOYMENT_HR_MULTI_TENANT_FIX.md`

---

**Questions? Read the detailed docs or check your browser console for error messages.**

**Good luck! 🚀**
