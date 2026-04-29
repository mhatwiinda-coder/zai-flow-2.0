# 🌐 ZAI FLOW 2.0 - Netlify Subdomain Setup

## Overview

You'll create a **NEW Netlify site** for ZAI FLOW 2.0 and connect it to **demo.zai-digital-studio.com**

Your existing **zai-digital-studio.com** site stays unchanged.

---

## Step 1: Create New Netlify Site from GitHub

### 1a. Go to Netlify
- Visit https://app.netlify.com
- Sign in to your Netlify account

### 1b. Create New Site
- Click **"New site from Git"** (top right or dashboard)
- Select **GitHub** as your Git provider
- **Authorize Netlify** to access your GitHub account (first time only)

### 1c. Select Repository
- Search for: `zai-flow-2.0`
- Click on your repository

### 1d. Configure Deployment

**Basic build settings:**

| Setting | Value |
|---------|-------|
| Base directory | `frontend` |
| Build command | *(leave empty)* |
| Publish directory | `frontend` |

**Click "Deploy site"**

---

## Step 2: Netlify Will Deploy (2-3 minutes)

You'll see:
```
Building... 
Deploying... 
✅ Site is live!
```

Your temporary URL will be something like:
```
https://zai-flow-2-0.netlify.app
```

**Save this URL** - we'll use it soon.

---

## Step 3: Configure Custom Domain in Netlify

### 3a. Go to Netlify Site Settings
- In Netlify dashboard, click on your new ZAI FLOW site
- Go to **Site Settings** (top menu)
- Click **Domain Management** (left sidebar)

### 3b. Add Custom Domain
- Click **"Add custom domain"**
- Enter: `demo.zai-digital-studio.com`
- Click **"Verify"**

Netlify will check if the domain is available. It should say:
```
"demo.zai-digital-studio.com is managed externally"
```

This is expected - you manage the DNS yourself.

### 3c. Get Netlify's DNS Configuration

After clicking "Add custom domain", you'll see instructions:

```
Netlify assigned IP address: [IP ADDRESS]
CNAME target: [RANDOM-NAME].netlify.app
```

**Copy these values** - you'll need them for DNS setup.

---

## Step 4: Update Your Domain DNS Records

You need to add DNS records pointing `demo.zai-digital-studio.com` to Netlify.

### 4a. Where to Update DNS

Go to your domain registrar (wherever you registered zai-digital-studio.com):
- GoDaddy
- Namecheap
- Google Domains
- AWS Route 53
- Etc.

Look for: **DNS Settings** or **DNS Management**

### 4b. Add DNS Records

You need to add ONE of these (Netlify recommends CNAME):

#### Option 1: CNAME Record (Recommended)
```
Type:  CNAME
Name:  demo
Value: [copy from Netlify - the random-name.netlify.app]
TTL:   3600 or Auto
```

#### Option 2: A Record (if CNAME doesn't work)
```
Type:  A
Name:  demo
Value: [copy from Netlify - the IP address]
TTL:   3600 or Auto
```

### 4c. Save DNS Changes

Click **"Save"** or **"Update"** in your registrar.

---

## Step 5: Wait for DNS Propagation

DNS changes take **5-30 minutes** to propagate globally.

**Check status in Netlify:**
1. Go back to Netlify Site Settings → Domain Management
2. Look for your custom domain
3. Status will change from:
   - 🟡 **Pending verification** → ✅ **Verified**

**You can also test:**
```bash
# In Command Prompt, run:
nslookup demo.zai-digital-studio.com

# Should show Netlify's IP/CNAME in results
```

---

## Step 6: Verify Everything Works

### Check 1: Visit Your Subdomain
```
https://demo.zai-digital-studio.com
```

You should see the ZAI FLOW login page.

### Check 2: Check SSL Certificate
- Look for **🔒 lock icon** in browser address bar
- Should show: "Secure"
- SSL certificate is automatic from Netlify

### Check 3: Browser Console (F12)
- Should show: ✅ `Supabase initialized`
- No CORS errors
- No 404 errors

### Check 4: Test Login
- Enter test credentials
- Should login and see dashboard

---

## Step 7: Configure Environment Variables (Optional)

If you're using your own Supabase project:

1. In Netlify, go to **Site Settings** → **Build & Deploy** → **Environment**
2. Click **"Edit variables"**
3. Add:
   ```
   SUPABASE_URL = https://[your-project-id].supabase.co
   SUPABASE_ANON_KEY = [your-anon-key-here]
   ```
4. Save and redeploy

---

## Step 8: Update Supabase CORS (Important!)

Your Supabase project must allow requests from your new domain.

**Go to Supabase:**
1. Project Settings → **API**
2. Scroll to **"CORS allowed origins"**
3. Add:
   ```
   https://demo.zai-digital-studio.com
   ```
4. Save

---

## Step 9: Block Direct Netlify URL (Optional Security)

To prevent people from accessing via the temporary Netlify URL:

### Option A: Redirect (Recommended)

Add to `frontend/netlify.toml`:
```toml
[[redirects]]
  from = "/*"
  to = "https://demo.zai-digital-studio.com"
  status = 301
  conditions = { Host = ["zai-flow-2-0.netlify.app"] }
```

This redirects the Netlify URL to your custom domain.

### Option B: Block via Netlify

In Netlify Site Settings → Build & Deploy → Post processing:
- Set HTTP Basic Auth (optional)
- Or use access control rules

---

## Quick Reference: What Happens

```
User visits: demo.zai-digital-studio.com
                    ↓
Netlify redirects to: zai-flow-2-0.netlify.app
                    ↓
Browser loads: login.html
                    ↓
JavaScript initializes Supabase
                    ↓
User can login and access ERP
```

---

## Troubleshooting

### Issue: Domain not connecting
**Solution:**
1. Verify DNS records are correct in your registrar
2. Wait 10-15 minutes (DNS propagation)
3. Clear browser cache (Ctrl+Shift+Delete)
4. Try incognito mode

### Issue: SSL certificate error
**Solution:**
1. Wait 24 hours for certificate to be issued
2. Check that Netlify recognized your domain (should show ✅)
3. Clear browser cache

### Issue: CORS errors in console
**Solution:**
1. Add `demo.zai-digital-studio.com` to Supabase CORS settings
2. Wait 2-3 minutes for changes to take effect
3. Hard refresh browser (Ctrl+Shift+R)

### Issue: Blank page / 404 errors
**Solution:**
1. Check that "Base directory" is set to `frontend` in Netlify
2. Verify `netlify.toml` exists in frontend folder
3. Check browser console (F12) for errors
4. Check Netlify deploy logs for build errors

---

## Deployment Complete! ✅

Your ZAI FLOW 2.0 is now:
- ✅ Live on GitHub
- ✅ Deployed to Netlify
- ✅ Accessible via `demo.zai-digital-studio.com`
- ✅ SSL/HTTPS enabled
- ✅ Auto-deploys on Git push

---

## Continuous Deployment

Now, whenever you push changes to GitHub:

```bash
# Make changes to code
git add .
git commit -m "Fix: Update HR module"
git push origin main

# Netlify automatically deploys (1-2 minutes)
# No manual deployment needed!
```

---

## Next Steps

1. ✅ Test demo with team members
2. ✅ Update Supabase with test data
3. ✅ Create test users and businesses
4. ✅ Share demo URL: `https://demo.zai-digital-studio.com`
5. ✅ Gather feedback for improvements

**Your demo is live! 🎉**
