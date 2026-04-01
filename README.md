# Content Upload Portal

A custom content collection portal built to replace ContentSnare for OnlyFans management agencies. Features include content requests, automated reminders, large file uploads (5GB+), and approval workflows.

## Features

- **Agency Dashboard**: Manage creators, requests, and uploads
- **Creator Portal**: Simple upload interface for creators
- **Content Requests**: Create requests with templates, due dates, and custom fields
- **Large File Uploads**: Up to 5GB per file with resumable uploads via Cloudflare R2
- **Automated Reminders**: Email and SMS notifications at configurable intervals
- **Review Workflow**: Approve, reject, or request revisions with comments
- **Bulk Downloads**: Download all files from a request as a ZIP
- **2FA Support**: Optional two-factor authentication for agency users

## Tech Stack

- **Frontend**: Next.js 16+ (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Database**: PostgreSQL (via Prisma ORM 7)
- **Authentication**: NextAuth.js with 2FA support
- **File Storage**: Cloudflare R2 (S3-compatible) / MinIO for local dev
- **Email**: Resend
- **SMS**: Twilio

## Local Development Setup

### Prerequisites

- Node.js 18+
- Docker Desktop (for local PostgreSQL and MinIO)

### 1. Clone and Install

```bash
cd UploadPortal
npm install
```

### 2. Start Docker Services

Open Docker Desktop, then run:

```bash
docker compose up -d
```

This starts:
- PostgreSQL on port 5432 (user: postgres, password: postgres)
- MinIO on port 9000 (web console on 9001, user: minioadmin, password: minioadmin)

### 3. Set Up Database

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Seed with test data
npm run db:seed
```

Or use the shortcut:
```bash
npm run setup:db
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the portal.

### Test Accounts

After seeding, you can log in with:

**Agency Dashboard** (http://localhost:3000/login):
- Email: `admin@demo-agency.com`
- Password: `password123`

**Creator Portal** (http://localhost:3000/portal/login):
- Email: `creator1@example.com` (or creator2, creator3)
- Password: `creator123`

### Local Services

- **MinIO Console**: http://localhost:9001 (minioadmin / minioadmin)
  - View uploaded files in the `upload-portal` bucket

### Mock Mode

When external services aren't configured:
- **Emails**: Logged to console with `[MOCK EMAIL]` prefix
- **SMS**: Logged to console with `[MOCK SMS]` prefix

## Production Deployment

### Prerequisites

- PostgreSQL database (Supabase recommended)
- Cloudflare R2 bucket
- Resend account (for emails)
- Twilio account (optional, for SMS)

### Environment Variables

Copy `.env` and update with production values:

Required:
- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`: Cloudflare R2 credentials
- `RESEND_API_KEY`: For sending emails

Optional:
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`: For SMS

### Setting Up External Services

#### Supabase (Database)

1. Create a project at [supabase.com](https://supabase.com)
2. Go to Settings > Database > Connection string
3. Copy the URI and add to `DATABASE_URL`

#### Cloudflare R2 (File Storage)

1. Log into [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Go to R2 > Create Bucket
3. Create an API token with R2 read/write permissions
4. Add credentials to environment variables

#### Resend (Email)

1. Sign up at [resend.com](https://resend.com)
2. Get your API key from the dashboard
3. Add to `RESEND_API_KEY`
4. Verify your sending domain

#### Twilio (SMS - Optional)

1. Sign up at [twilio.com](https://twilio.com)
2. Get your Account SID, Auth Token, and phone number
3. Add to environment variables

### Vercel Deployment (Recommended)

1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy

The `vercel.json` includes a cron job that runs daily at 9 AM to send reminders.

### Other Platforms

Works on any platform supporting Next.js:
- Railway
- Render
- DigitalOcean App Platform
- Self-hosted with Docker

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login/Register pages
│   ├── (dashboard)/     # Agency dashboard
│   ├── portal/          # Creator portal
│   └── api/             # API routes
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── uploads/         # Upload components
│   └── ...
├── lib/
│   ├── auth.ts          # Authentication config
│   ├── db.ts            # Database client
│   ├── email.ts         # Email service
│   ├── sms.ts           # SMS service
│   ├── storage.ts       # R2 storage helpers
│   └── reminders.ts     # Reminder processing
└── types/
    └── next-auth.d.ts   # Type extensions
```

## API Routes

### Agency (Authenticated)
- `POST /api/auth/register` - Register agency
- `GET/POST /api/creators` - List/create creators
- `GET/POST /api/requests` - List/create content requests
- `POST /api/uploads/approve` - Approve uploads
- `POST /api/uploads/reject` - Reject uploads
- `GET /api/requests/[id]/download` - Download all files as ZIP

### Creator Portal
- `POST /api/portal/login` - Creator login
- `GET /api/portal/requests` - Get creator's requests
- `POST /api/portal/requests/[id]/submit` - Submit content for review

### Uploads
- `POST /api/uploads/presign` - Get presigned upload URL
- `POST /api/uploads/complete` - Mark upload complete

## Cost Estimate

| Service | Estimated Monthly Cost |
|---------|----------------------|
| Vercel (Hosting) | $0-20 |
| Supabase (Database) | $0-25 |
| Cloudflare R2 (Storage) | ~$15/100GB |
| Resend (Email) | $0-20 |
| Twilio (SMS) | ~$0.0075/SMS |
| **Total** | **$20-80/month** |

Significantly cheaper than ContentSnare ($59-99/month) with no per-creator limits.

## License

Private - All rights reserved
