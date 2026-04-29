# 🚀 ZAI FLOW 2.0 - Netlify Deployment Checklist

## Pre-Deployment (5 min)

- [ ] Verify all Supabase RPC functions are deployed
- [ ] Verify HR schema migration SQL is deployed (if using HR module)
- [ ] Test app locally by opening `login.html` in browser
- [ ] Test at least one complete user flow (login → module access)
- [ ] Gather Supabase credentials:
  - [ ] Project URL: `https://[your-project-id].supabase.co`
  - [ ] Anon Key: `eyJ...`
  - [ ] Backend API URL (if applicable): `https://api.example.com`

---

## Deployment (15 min)

### Option A: GitHub + Netlify (Recommended)
- [ ] Create GitHub repository
- [ ] Push `frontend` folder to GitHub
- [ ] Go to https://app.netlify.com
- [ ] Click "New site from Git"
- [ ] Select your GitHub repository
- [ ] Set base directory: `frontend`
- [ ] Leave build command empty
- [ ] Click "Deploy site"
- [ ] Wait for deployment to complete (2-3 min)
- [ ] Get your Netlify URL: `https://your-site.netlify.app`

### Option B: Drag & Drop (5 min)
- [ ] Go to https://app.netlify.com
- [ ] Drag `frontend` folder into deploy area
- [ ] Wait for deployment

---

## Post-Deployment Configuration (10 min)

### Netlify Environment Variables
- [ ] Go to **Site Settings** → **Build & Deploy** → **Environment**
- [ ] Add variable: `SUPABASE_URL = https://[your-project-id].supabase.co`
- [ ] Add variable: `SUPABASE_ANON_KEY = your-key-here`
- [ ] Add variable: `API_BASE_URL = https://your-api.com` (if applicable)
- [ ] Save and redeploy site

### Update Supabase CORS
- [ ] Go to Supabase Dashboard → **Settings** → **API**
- [ ] Add to "CORS allowed origins":
  ```
  https://your-site.netlify.app
  https://your-custom-domain.com (if using custom domain)
  ```
- [ ] Save

### Update App Configuration (if needed)
- [ ] Edit `frontend/js/supabase-init.js`
- [ ] Update `SUPABASE_URL` with your actual project URL from Supabase dashboard
- [ ] Update `SUPABASE_ANON_KEY` with your anon key from Supabase dashboard
- [ ] Commit and push changes
- [ ] Netlify will auto-redeploy
- [ ] ⚠️ Never commit actual API keys to Git - use environment variables

---

## Testing (5 min)

### Functional Tests
- [ ] Visit `https://your-site.netlify.app`
- [ ] See ZAI FLOW login page
- [ ] Try logging in with test credentials
- [ ] Get redirected to employee landing page
- [ ] See accessible modules displayed
- [ ] Can navigate to at least one module

### Technical Tests
- [ ] Open browser DevTools (F12)
- [ ] Check Console tab - no red errors
- [ ] Check Network tab - all requests successful (200 status)
- [ ] Check that Supabase is initializing: `✅ Supabase initialized`

### Cross-Browser Tests
- [ ] Chrome
- [ ] Firefox
- [ ] Safari (mobile)
- [ ] Edge

---

## Optional: Custom Domain (10 min)

- [ ] Register domain (if not already done)
- [ ] In Netlify, go to **Domain Management**
- [ ] Click "Add custom domain"
- [ ] Enter your domain: `demo.yourdomain.com`
- [ ] Choose "I'll update my DNS records"
- [ ] Netlify shows you DNS records to add
- [ ] Add records to your domain registrar
- [ ] Wait 5-30 min for DNS propagation
- [ ] Visit your custom domain
- [ ] Verify HTTPS certificate is active

---

## Demo Access Troubleshooting

### Issue: Blank page / Loading forever
**Fix:**
1. Open DevTools (F12) → Console
2. Look for errors related to Supabase
3. Check that SUPABASE_URL and SUPABASE_ANON_KEY are correct
4. Hard refresh browser (Ctrl+Shift+R)

### Issue: "CORS policy: blocked request"
**Fix:**
1. Go to Supabase → Settings → API
2. Add your Netlify domain to CORS allowed origins
3. Wait 1-2 minutes for changes to take effect
4. Hard refresh browser

### Issue: Login fails with "Invalid email or password"
**Fix:**
1. Verify test user exists in Supabase users table
2. Check that password is correct
3. Verify API endpoint is responding:
   ```
   curl -X POST https://your-api.com/api/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password123"}'
   ```

### Issue: Modules not showing after login
**Fix:**
1. User must have role assigned in Supabase
2. Role must have functional modules assigned
3. Check `get_user_accessible_modules()` RPC returns data:
   ```sql
   SELECT * FROM get_user_accessible_modules(user_id, business_id);
   ```

---

## Performance Check

- [ ] Site loads in < 3 seconds
- [ ] No 404 errors in Network tab
- [ ] Assets are cached (Cache-Control headers)
- [ ] No console warnings

---

## Share with Demo Users

✅ **Demo URL:** `https://your-site.netlify.app`

**Test Credentials:**
- Email: `test@example.com`
- Password: `Test123!`

**Demo Features:**
- ✅ Employee authentication
- ✅ Dashboard
- ✅ Sales/POS
- ✅ Inventory
- ✅ Accounting
- ✅ HR Module
- ✅ Multi-tenancy (different users see different businesses)

---

## Maintenance

### Weekly
- [ ] Check Netlify deploy logs for errors
- [ ] Monitor user feedback on demo

### Monthly
- [ ] Review Netlify analytics
- [ ] Check for any error spikes in logs
- [ ] Update dependencies if needed

### Before Major Updates
- [ ] Test in preview deployment first
- [ ] Verify all modules still work
- [ ] Get approval before deploying to production

---

## Deployment Completed ✅

**Your ZAI FLOW 2.0 demo is now live!**

Share the URL with stakeholders and gather feedback.

**Next Steps:**
1. Promote demo to stakeholders
2. Gather feedback on features
3. Plan Phase 2 improvements
4. Schedule production deployment
