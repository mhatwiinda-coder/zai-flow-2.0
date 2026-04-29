# ⚡ ZAI FLOW 2.0 - Subdomain Deployment Quick Start

**Get live on demo.zai-digital-studio.com in 20 minutes**

---

## 🎯 Your Goals

✅ Deploy ZAI FLOW 2.0 to Netlify  
✅ Make it accessible via demo.zai-digital-studio.com  
✅ Keep it separate from your main website  
✅ Auto-deploy on Git push  

---

## 📋 The 5-Step Process

### Step 1️⃣: Push Code to GitHub (5 min)

```bash
cd "D:\mainza\ZAI FLOW 2.0"

git init
git add .
git commit -m "Initial ZAI FLOW 2.0"
git remote add origin https://github.com/YOUR_USERNAME/zai-flow-2.0.git
git branch -M main
git push -u origin main
```

**What it does:** Uploads your code to GitHub  
**Time:** 5 minutes

---

### Step 2️⃣: Create Netlify Site (5 min)

1. Go to https://app.netlify.com
2. Click **"New site from Git"**
3. Select **GitHub** → Select **zai-flow-2.0** repo
4. Set **Base directory:** `frontend`
5. Leave **Build command:** empty
6. Click **"Deploy site"**

**What it does:** Creates new Netlify site for ZAI FLOW  
**Time:** 5 minutes

---

### Step 3️⃣: Get Netlify Details (1 min)

After deployment completes:

- Copy your **Netlify URL:** `https://zai-flow-2-0.netlify.app` (or whatever it generates)
- In **Site Settings** → **Domain Management**
- Click **"Add custom domain"**
- Enter: `demo.zai-digital-studio.com`
- Click **"Verify"**

Netlify will show you DNS records to add.

**Copy these:**
```
CNAME Name: demo
CNAME Value: [something].netlify.app
```

**Time:** 1 minute

---

### Step 4️⃣: Update DNS Records (3 min)

Go to your domain registrar (where you manage zai-digital-studio.com):
- GoDaddy, Namecheap, Google Domains, etc.

Add DNS record:
```
Type:  CNAME
Name:  demo
Value: [paste from Netlify above]
TTL:   3600
```

Click **"Save"**

**What it does:** Points demo.zai-digital-studio.com to Netlify  
**Time:** 3 minutes  
**Wait:** 5-30 minutes for DNS propagation

---

### Step 5️⃣: Update Supabase CORS (2 min)

Go to Supabase Dashboard:
1. **Settings** → **API**
2. Add to **"CORS allowed origins":**
   ```
   https://demo.zai-digital-studio.com
   ```
3. Click **"Save"**

**What it does:** Allows requests from your domain  
**Time:** 2 minutes

---

## ✅ Verification

After ~10 minutes (DNS propagation), test:

```
Visit: https://demo.zai-digital-studio.com
```

You should see:
- ✅ ZAI FLOW login page loads
- ✅ 🔒 Lock icon (SSL/HTTPS)
- ✅ No console errors (F12 → Console)
- ✅ Can login with test credentials

---

## 📊 Deployment Timeline

| Step | Time | What Happens |
|------|------|--------------|
| 1. Push to GitHub | 5 min | Code uploaded |
| 2. Create Netlify site | 5 min | Site created + deployed |
| 3. Get Netlify details | 1 min | Get DNS info |
| 4. Update DNS | 3 min | DNS records added |
| **Wait for DNS** | **10 min** | **Propagating...** |
| 5. Update CORS | 2 min | Supabase configured |
| **Total** | **~25 min** | ✅ **Live!** |

---

## 🚀 After Deployment

### Your Setup Now:

```
GitHub
  ↓ (you push code)
  ↓
Netlify (zai-flow-2-0 site)
  ↓ (auto-builds & deploys)
  ↓
demo.zai-digital-studio.com
  ↓ (users visit here)
  ↓
ZAI FLOW 2.0 App
```

### Making Updates

Push to GitHub and Netlify auto-deploys:

```bash
# Make changes
git add .
git commit -m "Update: Feature X"
git push origin main

# Netlify automatically deploys (1-2 minutes)
# No manual deployment!
```

---

## 🔐 Optional: Block Direct Netlify URL

To prevent access via `zai-flow-2-0.netlify.app`, edit `frontend/netlify.toml`:

```toml
[[redirects]]
  from = "/*"
  to = "https://demo.zai-digital-studio.com"
  status = 301
  conditions = { Host = ["zai-flow-2-0.netlify.app"] }
```

This redirects the Netlify URL to your domain.

---

## 📱 Test on Mobile

After live, test on phone/tablet:
```
https://demo.zai-digital-studio.com
```

Should work perfectly on all devices.

---

## 🎉 You're Done!

Your ZAI FLOW 2.0 demo is now:
- ✅ Live on your domain
- ✅ Professional appearance
- ✅ Auto-deploying on Git push
- ✅ SSL/HTTPS secured
- ✅ Ready to share

---

## 📖 Detailed Docs

For more details, see:
- `GIT_SETUP_INSTRUCTIONS.md` - GitHub setup
- `NETLIFY_SUBDOMAIN_SETUP.md` - Full Netlify guide
- `NETLIFY_DEPLOYMENT_CHECKLIST.md` - Verification steps

---

## 🆘 Need Help?

### DNS not working?
- Wait 15-30 minutes (DNS propagation takes time)
- Check registrar DNS settings are saved
- Use: `nslookup demo.zai-digital-studio.com`

### Supabase errors?
- Verify CORS setting is added
- Check browser console (F12) for specific errors
- Ensure Supabase project is active

### Netlify issues?
- Check deploy logs in Netlify dashboard
- Verify base directory is `frontend`
- Ensure `netlify.toml` exists in frontend folder

---

**Ready? Follow the 5 steps above and you're live in 20 minutes! 🚀**
