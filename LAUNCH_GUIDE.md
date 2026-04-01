# Upload Portal - Production Launch Guide

## Why Upload Speed & Experience Matter

For creators uploading 500MB-5GB video files, the upload experience is make-or-break. Your current architecture is well-designed:

- **Direct Upload**: Files go straight to Cloudflare R2, bypassing your server entirely
- **Presigned URLs**: Secure, time-limited upload permissions
- **Progress Tracking**: Real-time speed, ETA, and percentage
- **Retry Logic**: Auto-retry with max 3 attempts
- **Concurrent Uploads**: Up to 3 files simultaneously
- **Local Fallback**: Works even without R2 configured (for dev)

---

## Infrastructure Recommendations

### Storage: Cloudflare R2 (Recommended)

**Why R2 over AWS S3:**
- **No egress fees** - You don't pay for downloads (huge for video content)
- **S3-compatible** - Your existing code works unchanged
- **Global edge network** - Fast uploads from anywhere
- **Cost**: ~$0.015/GB/month storage, $0.36/million requests

**Setup:**
1. Create Cloudflare account → R2 → Create bucket: `upload-portal`
2. Create API token with R2 read/write permissions
3. Note your Account ID from the dashboard

```env
R2_ACCOUNT_ID="your-account-id"
R2_ACCESS_KEY_ID="your-api-token-access-key"
R2_SECRET_ACCESS_KEY="your-api-token-secret-key"
R2_BUCKET_NAME="upload-portal"
```

### Database: Supabase PostgreSQL (Recommended)

**Why Supabase:**
- Free tier generous (500MB database, 1GB file storage)
- Managed PostgreSQL with connection pooling
- Built-in auth (if you want to switch later)
- Real-time subscriptions available

**Setup:**
1. Create project at supabase.com
2. Get connection string from Settings → Database

```env
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"
```

### Hosting: Vercel (Recommended)

**Why Vercel:**
- Built for Next.js
- Edge functions for fast API responses
- Automatic HTTPS
- Preview deployments for every PR

**Setup:**
1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy

---

## Production Environment Variables

Create these in Vercel (Settings → Environment Variables):

```env
# Database
DATABASE_URL="postgresql://..."

# Auth
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="openssl rand -base64 32"  # Generate this!

# Storage (Cloudflare R2)
R2_ACCOUNT_ID="..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="upload-portal"

# Email (Resend - $0 for 3k emails/month)
RESEND_API_KEY="re_..."
EMAIL_FROM="noreply@yourdomain.com"

# App
APP_URL="https://yourdomain.com"
APP_NAME="Your Portal Name"
```

---

## Pre-Launch Checklist

### Critical (Must Have)

- [ ] **Database**: Set up Supabase and run `npx prisma db push`
- [ ] **Storage**: Configure Cloudflare R2 bucket with CORS
- [ ] **Auth Secret**: Generate strong NEXTAUTH_SECRET
- [ ] **Domain**: Point your domain to Vercel
- [ ] **HTTPS**: Automatic with Vercel

### Important (Should Have)

- [ ] **Email**: Set up Resend for notifications
- [ ] **Error Tracking**: Add Sentry for production errors
- [ ] **Analytics**: Add PostHog or similar
- [ ] **Backups**: Enable database backups in Supabase

### Nice to Have

- [ ] **SMS**: Set up Twilio for SMS notifications
- [ ] **CDN**: R2 includes CDN, but consider Cloudflare CDN for the app
- [ ] **Custom Domain**: Add custom domain in Vercel

---

## R2 Bucket CORS Configuration

In Cloudflare Dashboard → R2 → your bucket → Settings → CORS:

```json
[
  {
    "AllowedOrigins": ["https://yourdomain.com"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## Database Migration

After setting up Supabase:

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# (Optional) Seed with test data
npx prisma db seed
```

---

## Deployment Steps

### 1. Prepare Repository

```bash
# Make sure everything builds
npm run build

# Push to GitHub
git add .
git commit -m "Prepare for production deployment"
git push origin main
```

### 2. Deploy to Vercel

1. Go to vercel.com
2. Import your GitHub repository
3. Add all environment variables
4. Deploy

### 3. Post-Deployment

1. Run database migration: Connect to Vercel console and run `npx prisma db push`
2. Create first agency user (via database or signup flow)
3. Test creator portal login flow
4. Test file upload to R2
5. Verify emails are sending

---

## Cost Estimates (Monthly)

| Service | Free Tier | Paid Estimate |
|---------|-----------|---------------|
| Vercel | Generous free tier | $20/mo Pro |
| Supabase | 500MB DB, 1GB storage | $25/mo Pro |
| Cloudflare R2 | 10GB storage, 10M requests | ~$5-50 depending on usage |
| Resend | 3,000 emails/mo | $20/mo for 50k |
| **Total** | **$0 to start** | **~$70-100/mo at scale** |

---

## Upload Performance Tips

Your current setup is already optimized for performance:

1. **Direct Upload to R2**: Files bypass your server entirely
2. **Presigned URLs**: 1-hour validity, secure
3. **Concurrent Uploads**: 3 files at once
4. **Progress Tracking**: Speed, ETA, percentage
5. **Auto-retry**: Up to 3 attempts on failure

For even better performance:
- Consider R2's Super Slurper for very large files (100GB+)
- Enable Cloudflare's Argo for faster routing (adds cost)

---

## Security Checklist

- [x] Session tokens with 30-day sliding expiry
- [x] Presigned URLs expire after 1 hour
- [x] Creator isolation (can only see their own requests)
- [x] CSRF protection via NextAuth
- [ ] Rate limiting on login endpoints (TODO)
- [ ] Input validation on all endpoints (mostly done)

---

## Monitoring (Post-Launch)

Add these for production visibility:

1. **Sentry** - Error tracking
2. **Vercel Analytics** - Performance metrics
3. **PostHog** - User analytics
4. **UptimeRobot** - Uptime monitoring (free)

---

## Support & Maintenance

### Regular Tasks
- Monitor Supabase dashboard for slow queries
- Check R2 usage to avoid surprise bills
- Review error logs in Sentry
- Keep dependencies updated (`npm audit`)

### Scaling Considerations
- Supabase Pro for connection pooling at scale
- R2 handles scale automatically
- Vercel Pro for more serverless function invocations

---

## Quick Start Commands

```bash
# Local development
npm run dev

# Build for production
npm run build

# Run production build locally
npm start

# Database commands
npx prisma studio      # Visual DB editor
npx prisma db push     # Push schema changes
npx prisma generate    # Regenerate client
```

---

## Getting Help

- Vercel Docs: vercel.com/docs
- Supabase Docs: supabase.com/docs
- Cloudflare R2 Docs: developers.cloudflare.com/r2
- Prisma Docs: prisma.io/docs
