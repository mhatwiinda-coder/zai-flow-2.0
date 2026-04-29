# ZAI FLOW 2.0 - Netlify Deployment Guide

## Overview
ZAI FLOW 2.0 is a static HTML/CSS/JavaScript application that connects to Supabase backend. Deploying to Netlify is simple - just connect your Git repository or drag-and-drop files.

---

## Prerequisites

✅ Supabase project created and configured  
✅ Frontend files ready in `D:\mainza\ZAI FLOW 2.0\frontend`  
✅ All environment variables configured  
✅ Netlify account created

---

## Deployment Method 1: Connect Git Repository (Recommended)

### Step 1: Prepare Git Repository
```bash
cd "D:\mainza\ZAI FLOW 2.0"

# Initialize git if not already done
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial ZAI FLOW 2.0 commit"

# Add remote (use GitHub, GitLab, or Bitbucket)
git remote add origin https://github.com/YOUR_USERNAME/zai-flow-2.0.git
git branch -M main
git push -u origin main
```

### Step 2: Connect to Netlify
1. **Go to Netlify Dashboard** → https://app.netlify.com
2. **Click "New site from Git"**
3. **Choose your Git provider** (GitHub, GitLab, Bitbucket)
4. **Authorize Netlify** to access your repositories
5. **Select your repository** `zai-flow-2.0`
6. **Configure deployment:**
   - **Base directory:** `frontend`
   - **Build command:** (leave empty - no build needed)
   - **Publish directory:** `frontend`
7. **Click "Deploy site"**

### Step 3: Add Environment Variables
1. **In Netlify Dashboard**, go to **Site Settings** → **Build & Deploy** → **Environment**
2. **Click "Edit variables"** and add:
   ```
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   API_BASE_URL=https://your-api.example.com (if you have a backend)
   ```
3. **Save** and redeploy

---

## Deployment Method 2: Drag & Drop (Quick Demo)

1. **Go to Netlify Dashboard**
2. **Drag the `frontend` folder** into the deploy area
3. **Netlify will publish automatically**
4. ⚠️ **Limitation:** Environment variables must be set in Netlify Dashboard after deployment

---

## Deployment Method 3: Netlify CLI (Advanced)

### Step 1: Install Netlify CLI
```bash
npm install -g netlify-cli
```

### Step 2: Authenticate
```bash
netlify login
```

### Step 3: Deploy
```bash
cd "D:\mainza\ZAI FLOW 2.0\frontend"
netlify deploy --prod
```

### Step 4: Set Environment Variables
```bash
netlify env:set SUPABASE_URL "https://your-project-id.supabase.co"
netlify env:set SUPABASE_ANON_KEY "your-anon-key-here"
netlify env:set API_BASE_URL "https://your-api.example.com"
```

---

## Post-Deployment Configuration

### Update Supabase CORS Settings
Supabase blocks requests from unknown origins. Update your CORS settings:

1. **Go to Supabase Project** → **Settings** → **API**
2. **Under "CORS allowed origins"**, add:
   ```
   https://your-site.netlify.app
   https://your-custom-domain.com
   ```
3. **Save**

### Connect Custom Domain (Optional)
1. **In Netlify Dashboard**, go to **Domain Management**
2. **Add custom domain** (e.g., `demo.yourdomain.com`)
3. **Update your DNS records** with the values Netlify provides
4. **Wait for DNS propagation** (5-30 minutes)

---

## Update Supabase Configuration in App

The frontend loads Supabase configuration from `js/supabase-init.js`:

```javascript
const SUPABASE_URL = 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

Two options to configure this:

### Option A: Update the file directly
Edit `frontend/js/supabase-init.js` and replace with your actual values.

### Option B: Use environment variables (Recommended)
Update the file to read from environment:
```javascript
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key-here';
```

Then set variables in Netlify Dashboard.

---

## Testing Your Deployment

### Test 1: Access the App
```
https://your-site.netlify.app
```
You should see the ZAI FLOW login page.

### Test 2: Check Browser Console
Open DevTools (F12) and check console for:
- ✅ `Supabase initialized successfully`
- ❌ Any CORS errors (fix in Supabase settings)
- ❌ Any 404 errors (check file paths)

### Test 3: Test Login
1. Enter test credentials
2. Should redirect to employee landing page
3. Check console for module loading messages

---

## Troubleshooting

### Error: CORS Policy blocked request
**Solution:** Add Netlify domain to Supabase CORS settings
```
Go to Supabase → Settings → API → CORS allowed origins
Add: https://your-site.netlify.app
```

### Error: Cannot find module / 404 errors
**Solution:** Check that netlify.toml is in the `frontend` folder and publish directory is set to `frontend`

### Error: Blank page or redirect loop
**Solution:** 
1. Check browser console for errors
2. Ensure `_redirects` file exists in `frontend` folder
3. Clear browser cache (Ctrl+Shift+Delete)
4. Try incognito mode

### Error: Supabase not initializing
**Solution:** 
1. Check `SUPABASE_URL` and `SUPABASE_ANON_KEY` in Netlify environment variables
2. Verify values match your Supabase project
3. Ensure Supabase project is active

---

## File Structure for Deployment

Your `frontend` folder should look like:
```
frontend/
├── netlify.toml          ← Netlify configuration
├── _redirects            ← URL redirect rules
├── .env.example          ← Environment template
├── login.html            ← Entry point
├── employee-landing.html
├── dashboard.html
├── sales.html
├── inventory.html
├── accounting.html
├── hr.html
├── purchasing.html
├── bi.html
├── zra.html
├── admin-business.html
├── admin-roles.html
├── admin-user-management.html
├── style.css
├── js/
│   ├── supabase-init.js
│   ├── auth.js
│   ├── branch-context.js
│   ├── sales.js
│   ├── inventory.js
│   ├── accounting.js
│   ├── hr.js
│   ├── payroll.js
│   ├── admin-business.js
│   ├── sidebar-manager.js
│   └── ... (other JS files)
├── assets/
│   ├── logo.png
│   └── ... (other assets)
└── charts/
    └── ... (Chart.js files)
```

---

## Performance Optimization

Netlify automatically provides:
- ✅ CDN distribution (your site served from global edge servers)
- ✅ Gzip compression
- ✅ HTTP/2 support
- ✅ SSL/HTTPS (automatic)

Additional optimizations you can do:
1. **Image optimization:** Compress images, use WebP format
2. **Code splitting:** Separate module JS files for lazy loading
3. **Minification:** Minify CSS/JS files
4. **Caching:** Set appropriate cache headers (already in netlify.toml)

---

## Continuous Deployment

Once Git is connected:
1. **Push changes** to your repository
2. **Netlify automatically deploys** (takes 1-2 minutes)
3. **View deployment preview** before publishing
4. **Auto-rollback** if build fails

---

## Monitoring

**In Netlify Dashboard, you can:**
- View deployment history
- Check build logs
- Monitor site analytics
- Set up alerts for build failures
- View error logs in real-time

---

## Support & Additional Resources

- **Netlify Docs:** https://docs.netlify.com
- **Supabase Docs:** https://supabase.com/docs
- **Custom Domain Help:** https://docs.netlify.com/domains-https/custom-domains
- **Environment Variables:** https://docs.netlify.com/configure-builds/environment-variables

---

## Next Steps

1. ✅ Prepare Git repository
2. ✅ Connect to Netlify
3. ✅ Set environment variables
4. ✅ Update Supabase CORS settings
5. ✅ Test login and module loading
6. ✅ Set up custom domain (optional)
7. ✅ Share demo URL with users

**Your demo is now live! 🎉**
