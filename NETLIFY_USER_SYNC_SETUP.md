# Netlify User Sync Setup - Automated User Creation & Authentication

## Overview

This setup enables **fully automated user creation** with automatic syncing between:
- **Supabase Auth** (authentication system)
- **Database** (user profiles & roles)

All existing users in the database are migrated to Supabase Auth, and future user creation happens automatically in both systems.

---

## Step 1: Add Environment Variables to Netlify

Your Supabase Admin Key needs to be stored securely in Netlify as an environment variable.

### Add to Netlify:

1. Go to **https://app.netlify.com**
2. Click your site: `zaiflow`
3. Go to **Site Settings** → **Build & Deploy** → **Environment**
4. Click **"Edit variables"**
5. Add these environment variables:

```
SUPABASE_URL = https://[your-project-id].supabase.co
SUPABASE_ADMIN_KEY = [Your-Service-Role-Key-from-Supabase]
SYNC_AUTH_TOKEN = [Your-Strong-Random-Token]
```

**Get these values:**
- **SUPABASE_URL**: From Supabase Settings → API → Project URL
- **SUPABASE_ADMIN_KEY**: From Supabase Settings → API → Secret keys section (the one labeled "default")
- **SYNC_AUTH_TOKEN**: Generate a random strong string (e.g., using `openssl rand -base64 32`)

6. Click **"Save"**
7. Netlify will automatically redeploy with these variables

---

## Step 2: Deploy the Netlify Functions

The functions are ready in `/netlify/functions/`. When you push to GitHub, Netlify will automatically detect and deploy them.

**Check deployment:**
1. Go to Netlify → **Deploys** tab
2. Wait for new deploy to complete
3. Check **Functions** tab - you should see:
   - `create-user`
   - `sync-users-to-auth`

---

## Step 3: Sync Existing Users to Supabase Auth

This migrates all users from the database to Supabase Auth.

### Option A: Using curl (Command Line)

```bash
curl -X POST https://zaiflow.netlify.app/.netlify/functions/sync-users-to-auth \
  -H "Authorization: Bearer your-secret-sync-token-123" \
  -H "Content-Type: application/json"
```

**Result:** You should see a response like:
```json
{
  "success": true,
  "results": {
    "total": 7,
    "created": 7,
    "skipped": 0,
    "errors": []
  }
}
```

### Option B: Using Browser Console

Go to the Netlify URL and run in console (F12):
```javascript
fetch('/.netlify/functions/sync-users-to-auth', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-secret-sync-token-123',
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(d => console.log(JSON.stringify(d, null, 2)))
```

---

## Step 4: Test User Login

Once sync completes, existing users should be able to login:

1. Go to **https://zaiflow.netlify.app** (or your custom domain)
2. Enter credentials:
   - Email: `admin@zai.com`
   - Password: `Admin@1234`
3. Should login successfully ✅

---

## Step 5: Create New Users in the App

Users can now be created through the admin panel:

1. Login as admin
2. Go to **Admin** → **User Management**
3. Click "Add User"
4. Fill in:
   - Email
   - Password
   - Name
   - Role
   - Business
5. Click "Create User"
6. User is automatically created in **both** Supabase Auth and Database ✅

---

## How It Works

### User Creation Flow:

```
User submits form
       ↓
Frontend calls Netlify Function
       ↓
Function creates in Supabase Auth (with bcrypt hashing)
       ↓
Function creates in Database (linked to Auth user ID)
       ↓
Function creates default branch access
       ↓
Return success to frontend
```

### Sync Flow:

```
All database users
       ↓
Sync function reads each user
       ↓
Check if exists in Supabase Auth
       ↓
If not: Create in Auth with stored password
       ↓
Link Auth user ID to database record
       ↓
Success: User can now login
```

---

## Security Notes

⚠️ **Important:**

1. **SUPABASE_ADMIN_KEY** is sensitive - never commit to Git or share publicly
2. **SYNC_AUTH_TOKEN** - create a strong random token, use only once for sync
3. Netlify environment variables are **encrypted at rest**
4. Passwords in database are for reference - actual auth is handled by Supabase

---

## Troubleshooting

### "Function not found" error

- Check Netlify Deploy logs for build errors
- Verify environment variables are set
- Wait 2-3 minutes after deploy completes
- Refresh the page

### "Unauthorized" when calling sync

- Verify SYNC_AUTH_TOKEN matches in both the function call and Netlify env vars
- Check Authorization header format: `Bearer YOUR_TOKEN`

### Users can't login after sync

- Check browser console for specific error
- Verify users appear in Supabase → Authentication → Users
- Ensure user email is confirmed in Supabase Auth

### "Invalid login credentials"

- User doesn't exist in Supabase Auth yet
- Run sync function again
- Or create user manually via admin panel

---

## Next Steps

✅ Add environment variables to Netlify  
✅ Push code to GitHub (Netlify auto-deploys)  
✅ Run sync function to migrate existing users  
✅ Test login with existing credentials  
✅ Test creating new users through admin panel  
✅ Verify users appear in both Auth and Database  

---

**You're done! User creation and authentication is now fully automated.** 🎉
