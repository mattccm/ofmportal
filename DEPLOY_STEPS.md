# Deploying to portal.of-m.com

## Step 1: Create GitHub Repository

```bash
# In the UploadPortal directory:
git init  # (already done)
git add .
git commit -m "Initial commit - OF-M Creator Portal"

# Create repo on GitHub (private recommended), then:
git remote add origin https://github.com/YOUR_USERNAME/of-m-portal.git
git branch -M main
git push -u origin main
```

---

## Step 2: Set Up Supabase Database

1. Go to [supabase.com](https://supabase.com) → New Project
2. **Project name**: `of-m-portal`
3. **Database password**: Generate a strong one, **SAVE IT**
4. **Region**: Choose closest to your creators (e.g., US East)
5. Wait for project to spin up (~2 min)

**Get your connection string:**
- Settings → Database → Connection string → URI
- It looks like: `postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres`
- Replace `[PASSWORD]` with your actual password

---

## Step 3: Set Up Cloudflare R2

Since you already have of-m.com on Cloudflare:

1. **Cloudflare Dashboard** → R2 (left sidebar)
2. **Create bucket**: `of-m-portal`
3. **Location hint**: Automatic (or choose region)

**Create API Token:**
1. R2 → Overview → **Manage R2 API Tokens**
2. Create API Token:
   - **Permissions**: Object Read & Write
   - **Specify bucket**: `of-m-portal`
3. **Copy and save**:
   - Access Key ID
   - Secret Access Key
   - Your Account ID (shown on R2 overview page)

**Configure CORS** (R2 → of-m-portal bucket → Settings → CORS):
```json
[
  {
    "AllowedOrigins": ["https://portal.of-m.com", "http://localhost:3001"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## Step 4: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → Add New → Project
2. Import your GitHub repository
3. **Framework Preset**: Next.js (auto-detected)
4. **Root Directory**: `./` (leave default)

**Add Environment Variables** (before deploying):

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres` |
| `NEXTAUTH_URL` | `https://portal.of-m.com` |
| `NEXTAUTH_SECRET` | Generate: `openssl rand -base64 32` |
| `R2_ACCOUNT_ID` | Your Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | Your R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | Your R2 API token secret |
| `R2_BUCKET_NAME` | `of-m-portal` |
| `APP_URL` | `https://portal.of-m.com` |
| `APP_NAME` | `OF-M Creator Portal` |

**Optional (add later):**
| Variable | Value |
|----------|-------|
| `RESEND_API_KEY` | Get from resend.com |
| `EMAIL_FROM` | `noreply@of-m.com` |

5. Click **Deploy**

---

## Step 5: Configure Subdomain

**In Vercel:**
1. Project → Settings → Domains
2. Add: `portal.of-m.com`
3. Vercel will show you DNS records to add

**In Cloudflare DNS** (of-m.com):
Add a CNAME record:
- **Type**: CNAME
- **Name**: portal
- **Target**: `cname.vercel-dns.com`
- **Proxy**: OFF (DNS only - grey cloud) ← Important for Vercel SSL

Wait 1-5 minutes for DNS to propagate.

---

## Step 6: Initialize Database

After first deployment succeeds:

**Option A: Via Vercel CLI**
```bash
npm i -g vercel
vercel login
vercel link  # Link to your project
vercel env pull  # Get production env vars locally
npx prisma db push  # Push schema to Supabase
```

**Option B: Via Supabase SQL Editor**
Run the Prisma migration SQL directly (I can generate this if needed).

---

## Step 7: Create Your First Agency Account

1. Go to `https://portal.of-m.com/register`
2. Fill in:
   - Your name
   - Email
   - Password
   - Agency name (e.g., "OF-M")
3. Register → Login

---

## Step 8: Test Everything

- [ ] Login to agency dashboard works
- [ ] Create a test creator
- [ ] Send invite email (or copy invite link)
- [ ] Creator can set password and login
- [ ] Creator can see their dashboard
- [ ] Upload a test file → Check it appears in R2
- [ ] Comments/messaging works

---

## Quick Reference: All Environment Variables

```env
# Required
DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres
NEXTAUTH_URL=https://portal.of-m.com
NEXTAUTH_SECRET=your-generated-secret-here
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=of-m-portal
APP_URL=https://portal.of-m.com
APP_NAME=OF-M Creator Portal

# Optional (for emails)
RESEND_API_KEY=re_xxxx
EMAIL_FROM=noreply@of-m.com
```

---

## Troubleshooting

**Build fails on Vercel:**
- Check DATABASE_URL is correct
- Ensure all required env vars are set

**Can't connect to database:**
- Supabase → Settings → Database → Connection Pooling → Enable
- Use the pooling connection string if having issues

**Uploads fail:**
- Check R2 CORS configuration
- Verify R2 API tokens have correct permissions

**Domain not working:**
- Ensure Cloudflare proxy is OFF (grey cloud)
- Wait for DNS propagation (up to 48h, usually minutes)

---

## Estimated Costs

| Service | Free Tier | Growth |
|---------|-----------|--------|
| Vercel | Generous | $20/mo |
| Supabase | 500MB DB | $25/mo |
| Cloudflare R2 | 10GB | ~$0.015/GB |
| Resend | 3k emails | $20/mo |
| **Total** | **$0** | **~$65/mo** |
