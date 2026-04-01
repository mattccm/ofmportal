# CCM Upload Portal - Debloat Review

## Overview
This document outlines features that can be removed or simplified for CCM's internal use only. The goal is to reduce complexity, maintenance burden, and codebase size while keeping essential functionality.

---

## FEATURES TO KEEP (Per User Request)

- **Creator Portal** - Creators need to login and use the portal (simplify onboarding, keep access)
- **SMS Reminders** - Keep Twilio/SMS integration for reminders
- **Chat System** - Keep internal messaging/chat
- **Recurring Requests** - Keep ability to create recurring content requests
- **Calendar View** - Keep calendar for scheduling/viewing deadlines
- **Duplicate Detection** - Keep for content management

---

## PRIORITY 1: REMOVE IMMEDIATELY

### 1. Whitelabel/Multi-Tenant Features
**Current:** Full branding customization (custom logos, colors, domains, subdomains)
**Recommendation:** Remove. Use hardcoded CCM branding.
**Status:** ✅ Partially done - CCM branding set as default

**Files to remove/simplify:**
- `src/app/(dashboard)/dashboard/settings/branding/` - Remove settings page (keep basic logo display)
- `src/components/settings/branding-form.tsx` - Remove complex form
- Custom domain/subdomain logic

### 2. Public Pages (Non-Portal)
**Files to remove:**
- `src/app/help/` - Public help center (internal team uses docs)
- `src/app/status/` - Public status page (not needed internally)
- `src/app/share/` - Public share links (keep internal download)

### 3. Complex Onboarding Wizards
**Current:** Multi-step onboarding with tours, tooltips, checklists
**Recommendation:** Simplify to basic first-login setup. Remove feature tours.

**Files to remove:**
- `src/components/onboarding/agency-onboarding.tsx` - Remove agency wizard
- `src/components/onboarding/feature-tour.tsx` - Remove tours
- `src/components/onboarding/tooltip-tour.tsx` - Remove tooltip tours
- `src/app/(dashboard)/dashboard/getting-started/` - Remove getting started page
- `src/components/hints/` - Remove contextual hints

**Keep:** Basic creator portal onboarding (simplified)

### 4. External Integrations (Except SMS)
**Remove:**
- Slack integration
- Discord integration
- Webhook configuration UI
- Third-party calendar sync

**Keep:**
- SMS/Twilio for reminders
- Email notifications

**Files to simplify:**
- `src/app/(dashboard)/dashboard/settings/integrations/` - Remove or simplify to SMS only
- `src/components/integrations/` - Remove Slack/Discord components

### 5. Creator Scoring & Leaderboards
**Current:** Complex scoring system with badges, rankings, performance metrics
**Recommendation:** Remove. Not needed for internal management.

**Files to remove:**
- `src/lib/creator-scoring.ts` - Remove scoring logic
- `src/components/analytics/creator-leaderboard.tsx` - Remove leaderboard
- Badge/ranking display components

### 6. Collections & Favorites
**Recommendation:** Remove. Use filters instead.

**Files to remove:**
- `src/app/(dashboard)/dashboard/collections/`
- `src/app/(dashboard)/dashboard/favorites/`
- `src/components/collections/`
- `src/components/favorites/`

### 7. Compliance/GDPR Exports
**Recommendation:** Remove. Not needed for internal use.

**Files to remove:**
- `src/components/compliance/` - GDPR export components
- `src/lib/compliance-export.ts` - Export logic

---

## PRIORITY 2: SIMPLIFY

### 8. Analytics Dashboard
**Current:** Complex analytics with heatmaps, SLA tracking, trends
**Recommendation:** Keep basic stats (counts, percentages). Remove advanced visualizations.

**Simplify:**
- Remove `src/components/analytics/activity-heatmap.tsx`
- Remove `src/components/analytics/sla-indicator.tsx`
- Keep basic request/upload counts and approval rates

### 9. Bulk Operations
**Simplify to:**
- Bulk approve/reject uploads
- Bulk assign creators

**Remove:**
- Complex batch email operations
- Automation builders

### 10. Reports Page
**Simplify:** Keep basic CSV exports, remove complex report builder

---

## FEATURES TO KEEP AS-IS

| Feature | Reason |
|---------|--------|
| Creator Portal | Creators need login access |
| Chat/Messaging | Team communication |
| SMS Reminders | Creator notifications |
| Recurring Requests | Workflow automation |
| Calendar View | Deadline management |
| Duplicate Detection | Content quality |
| Templates | Request standardization |
| Team Management | Role-based access |
| Basic Notifications | Email alerts |

---

## IMPLEMENTATION PHASES

### Phase 1: Quick Wins (Low Risk)
1. ✅ Set CCM branding as default
2. Remove public pages (help, status, share)
3. Remove creator scoring/leaderboards
4. Remove collections/favorites

### Phase 2: Simplification
1. Simplify onboarding (remove tours, keep basic setup)
2. Remove external integrations except SMS
3. Simplify analytics to basic metrics
4. Remove compliance exports

### Phase 3: Cleanup
1. Remove unused components
2. Clean up unused API routes
3. Remove unused database fields
4. Update documentation

---

## Estimated Impact

| Category | Current | After Debloat |
|----------|---------|---------------|
| Pages | ~50 | ~35 |
| Components | ~200 | ~140 |
| API Routes | ~60 | ~45 |
| Complexity | High | Medium |

---

## Files Safe to Delete (Summary)

```
# Public pages
src/app/help/
src/app/status/
src/app/share/

# Onboarding extras
src/components/onboarding/agency-onboarding.tsx
src/components/onboarding/feature-tour.tsx
src/components/onboarding/tooltip-tour.tsx
src/components/hints/
src/app/(dashboard)/dashboard/getting-started/

# Integrations (except SMS)
src/components/integrations/slack/
src/components/integrations/discord/

# Scoring & Collections
src/lib/creator-scoring.ts
src/components/analytics/creator-leaderboard.tsx
src/app/(dashboard)/dashboard/collections/
src/app/(dashboard)/dashboard/favorites/
src/components/collections/
src/components/favorites/

# Compliance
src/components/compliance/
src/lib/compliance-export.ts

# Advanced analytics
src/components/analytics/activity-heatmap.tsx
src/components/analytics/sla-indicator.tsx
```

---

## Quick Reference - Login Credentials

**Admin Dashboard:**
- Email: `admin@agency.com`
- Password: `Password123`

**Creator Portal:**
- Email: `sarah@example.com` or `mike@example.com`
- Password: `Creator123`

**Note:** Run `npm run db:seed` after database reset to ensure credentials work.
