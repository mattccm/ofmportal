# Product

<!-- impeccable:product-schema 1 -->

> Written 2026-10-24 without a live interview (no structured question tool in that session). Facts marked *(inferred)* come from the codebase and the owner's chat answers, not from a confirmed interview; confirm or correct them.

## Platform

web

## Users

- **Agency staff** (the owner and a few admins) who run creator content operations. They build content requests from templates, send them to creators, chase late work with reminders, review uploads field by field, approve or ask for revisions, and message creators. They use the staff dashboard on desktop through the working day *(inferred)*.
- **Creators** who receive those requests and upload photos and videos, mostly from a phone, often between other commitments. They need to see what is asked, upload reliably on mobile data, see what was approved or needs changes, and reply to staff *(inferred from the mobile-first creator portal and PWA)*.

## Product Purpose

CCM Portal replaces ContentSnare for one agency (Content Creation Management Pty Ltd). It turns "we need this content by Friday" into a structured request a creator can complete on their phone, and gives staff one place to see what is outstanding, what has arrived and what needs review. Success is creators delivering complete, correct content on time with fewer chasers, and staff never losing track of a request.

## Positioning

An internal tool for a single agency, not a SaaS. It is built around that agency's own request templates, creators and review workflow. It deliberately has no multi-tenant, billing or agency-onboarding features.

## Operating Context

- Content is explicit adult content. Request titles, previews and notifications must stay discreet: no request titles on lock screens, in SMS or in browser tab titles; creator originals are served through short-lived signed links; GPS is stripped from photos before upload.
- Creators use the portal on phones, often as an installed PWA, sometimes on poor connections; uploads can be multi-gigabyte videos.
- Staff work in long sessions on desktop and use reminders, bulk actions, templates and analytics *(inferred)*.

## Capabilities and Constraints

- Stack: Next.js 16 App Router, React 19, Tailwind v4 with design tokens in `src/app/globals.css`, shadcn/ui components, Prisma/Postgres, Cloudflare R2 uploads, Resend email, Twilio SMS, Sentry, Vercel.
- Staff features: requests (templates, bundles, recurring, batch), creator management, review of uploads, comments and messages, reminders, analytics/reports/exports, automations, media library, review sessions, webhooks. The owner keeps the optional features (automations, media library, review sessions, share links, webhooks) and wants them working rather than removed.
- Creator features: dashboard of requests, per-field uploads with resumable multipart, request detail, messages, calendar, settings, onboarding, invite setup.
- Admins handle creators and may edit email templates. Requests never include other performers (no release forms). HEIC originals are not needed.

## Brand Commitments

- Product name **CCM** / **CCM Portal**; legal name Content Creation Management Pty Ltd (`src/lib/brand.ts` is the source of truth).
- The logo (`public/ccm-logo.png`) is a solid black circular mark.
- **Owner preference (2026-10-24): a dark, "tech" interface.** The owner does not like the green (`#2f6a4a`) the app currently uses and prefers the darker tech style the app had before (warm-charcoal dark theme, dark sidebar, a slate login panel). The palette is open; the next visual world is being chosen through impeccable's direction round, with dark pinned.

## Evidence on Hand

- No testimonials, case studies, customer logos or statistics exist; never invent them.
- Production currently holds one agency with very little data, so designs must look right with small numbers and empty states.
- Mock screens may use clearly synthetic sample creators, requests and figures.

## Product Principles

1. Discretion first: nothing explicit leaks into titles, notifications, previews or URLs.
2. The creator's phone is the primary device for uploading; every creator step must work one-handed on mobile data.
3. Staff should always know what is outstanding, overdue and waiting for review, without hunting.
4. Fix and finish features rather than adding new ones.

## Accessibility & Inclusion

No product-specific standard established; follow WCAG 2.2 AA as the floor *(inferred)*.
