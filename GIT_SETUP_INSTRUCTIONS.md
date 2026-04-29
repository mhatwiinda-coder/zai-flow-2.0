# 🔗 ZAI FLOW 2.0 - Git Repository Setup

## Step 1: Create GitHub Repository

### 1a. Go to GitHub
- Visit https://github.com/new
- Sign in to your account

### 1b. Create New Repository
**Repository name:** `zai-flow-2.0`

**Settings:**
- ☐ Private or Public (your choice)
- ☐ Initialize with README (uncheck - we have our own)
- ☐ .gitignore (select "Node" if available)
- ☐ License (optional)

**Click "Create repository"**

---

## Step 2: Initialize Git Locally

Open Command Prompt/PowerShell and run:

```bash
cd "D:\mainza\ZAI FLOW 2.0"

# Initialize git
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial ZAI FLOW 2.0 - Full ERP System

- Dashboard with time tracking
- Sales/POS module
- Inventory management
- Accounting & GL
- HR & Payroll
- Purchasing module
- BI Analytics
- Multi-tenant RBAC"

# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/zai-flow-2.0.git

# Rename branch to main (if not already)
git branch -M main

# Push to GitHub
git push -u origin main
```

**That's it!** Your code is now on GitHub.

---

## Step 3: Verify GitHub Repository

1. Go to https://github.com/YOUR_USERNAME/zai-flow-2.0
2. You should see:
   - ✅ All folders (frontend, SQL files, documentation)
   - ✅ Files visible
   - ✅ Commit message showing
   - ✅ Green checkmark (or blue, depending on GitHub status)

---

## What Gets Pushed

```
zai-flow-2.0/
├── frontend/                    ← Netlify deploys this
│   ├── *.html (all pages)
│   ├── style.css
│   ├── js/ (all modules)
│   ├── assets/
│   ├── netlify.toml            ← Netlify config
│   ├── _redirects              ← URL routing
│   └── ...
├── supabase-*.sql              ← Documentation
├── NETLIFY_*.md
├── DEPLOYMENT_*.md
├── README.md
└── ... (other docs)
```

---

## Next Steps

After pushing to GitHub:
1. ✅ Go to Netlify
2. ✅ Create new site from this repository
3. ✅ Set base directory to "frontend"
4. ✅ Configure subdomain
5. ✅ Deploy!

See: NETLIFY_SUBDOMAIN_SETUP.md (next file)
