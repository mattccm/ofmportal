# Deploying to Railway

The app builds into a self-contained container (`output: "standalone"`) and is
served by `Dockerfile` on the port Railway assigns. Railway deploys from the
connected GitHub repo (`mattccm/ofmportal`).

## One-time setup

1. **Railway → New Project → Deploy from GitHub repo** → pick `ofmportal`.
   Railway reads `railway.json` and builds from the `Dockerfile` automatically.
2. **Add a domain** (Railway → Settings → Networking → Generate Domain, or add a
   custom domain e.g. `portal.of-m.com`).
3. **Set environment variables** (Railway → Variables). See the table below.
4. Deploy. Health check is `/api/health`.

## Required environment variables

| Variable | Value / notes |
|---|---|
| `DATABASE_URL` | Supabase **session pooler** string (port `5432`, `?sslmode=require`) |
| `NEXTAUTH_URL` | The deployed URL, e.g. `https://portal.of-m.com` (must match the real domain) |
| `NEXTAUTH_SECRET` | 32+ char random secret (`openssl rand -base64 32`) |
| `R2_ACCOUNT_ID` | Cloudflare account id |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 API token |
| `R2_BUCKET_NAME` | e.g. `of-m-portal` |
| `R2_PUBLIC_DOMAIN` | CDN domain for downloads, e.g. `assets.of-m.com` |
| `CRON_SECRET` | random secret; required so the cron endpoints reject public callers |
| `RESEND_API_KEY` / `EMAIL_FROM` | email sending |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | SMS (optional) |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | realtime |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | rate limiting (optional; in-memory fallback otherwise) |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `NEXT_PUBLIC_SENTRY_DSN` | error tracking (optional) |

Notes:
- **Do not** set `PORT` — Railway provides it and the standalone server reads it.
- Make sure the R2 vars are set in production so file storage uses R2, not the
  local-disk fallback (the container filesystem is ephemeral).
- Rotate the Supabase DB password before go-live and update `DATABASE_URL`.

## Database migration

The Supabase schema is managed with Prisma. After the first deploy (or when the
schema changes), run once against the production DB:

```
npx prisma db push
```

## Scheduled jobs (cron)

Railway has no built-in HTTP cron, so `.github/workflows/cron.yml` triggers the
four cron endpoints on schedule. In GitHub → repo → Settings → Secrets and
variables → Actions, add:

- `APP_URL` — the deployed URL (same as `NEXTAUTH_URL`)
- `CRON_SECRET` — same value as the app's `CRON_SECRET`

(Alternative: Railway's native cron, or an external scheduler like cron-job.org
hitting the same endpoints with the `Authorization: Bearer <CRON_SECRET>` header.)
