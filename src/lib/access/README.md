# Access: roles and permissions

Every staff member has exactly one role. A role is a set of permission keys
plus two scopes: **which creators** they see and **which team members** they
see. The server is the gate; the UI only hides what someone can't use.

| file | what |
|---|---|
| `catalogue.ts` | Every permission key (label, description, `dangerous`, `implies`), the areas, the Admin / Manager / Member presets, `summarize`, `roleWithin`. Client-safe. |
| `roles.ts` | Storage: v2 JSON inside the existing `CustomRole` columns, lazy preset rows, `loadRoles`, `loadRole`, `roleIdOf`, `holdersWhere`. Server only. |
| `server.ts` | `getAccess`, `getPageAccess`, `requireAccess`, `creatorWhere`, `requestWhere`, `uploadWhere`, `staffWhere`, `activityWhere`, `canSeeCreator`, `redactCreator`, `redactCreatorsIn`. |
| `client.tsx` | `AccessProvider` (mounted by the staff layout), `useAccess()`, `<Can>`. |
| `assign.ts` | `canGrant`, `changeMemberRole`: who may hand out which role. |
| `role-input.ts` | Request validation for the roles API. |

Owner is not a stored role: `User.role === "OWNER"` has every key and every
scope. Admin / Manager / Member are editable `CustomRole` rows (`isSystem`),
created per agency on first use; their defaults are `PRESETS` in the
catalogue and reproduce what each role could do before. A custom role sits on
`User.role = MEMBER` with `customRoleId` set. `User.permissionOverrides`,
`assignedCreatorIds` and `activityRestrictions` are no longer read.

Role ids used in URLs, team scopes and the API: `owner`, `admin`, `manager`,
`member`, or a custom role's id.

## 1. Guard an API route

```ts
import { requireAccess } from "@/lib/access/server";

export async function POST(req: NextRequest) {
  const gate = await requireAccess("review.approve");    // 401 / 403 JSON for you
  if (gate.error) return gate.error;
  const { access, session } = gate;
  // access.agencyId, access.userId, access.has("review.download") ...
}
```

- One key, an array (any of them is enough: `requireAccess(["messages.creators", "messages.team"])`),
  or `null` for "any signed-in staff member".
- For a second, conditional check inside the handler use `access.has(key)`
  and `return forbidden(key)` (also from `server.ts`), which answers
  `403 { error: "You don't have permission to …" }`.
- Replace every hand-written `role === "OWNER"` / `["OWNER","ADMIN"].includes(...)`
  with the key that names the action. Keep owner-only rules that are not
  permissions (delete all agency data, reset branding) as `access.isOwner`.
- Never trust `session.user.role` for access: it can be minutes stale.
  `getAccess` reads the role from the database.

## 2. Guard a server page

```tsx
import { getPageAccess } from "@/lib/access/server";
import { NoAccess } from "@/components/access/no-access";

export default async function Page() {
  const access = await getPageAccess();                 // redirects to /login when signed out; cached per render
  if (!access.has("calendar.view")) return <NoAccess what="the calendar" roleName={access.role.name} />;
  ...
}
```

A `"use client"` page has no server gate: add a small server `page.tsx` that
gates and renders the client component, or gate the client with
`useAccess()` and render `<NoAccess>` (it works in both). The data APIs it
calls must be guarded either way.

## 3. Scope list queries

Creators outside someone's creator scope are invisible everywhere: lists,
requests, messages, search, counts, exports, calendar.

```ts
import { creatorWhere, requestWhere, uploadWhere, staffWhere, canSeeCreator } from "@/lib/access/server";

db.creator.findMany({ where: { ...creatorWhere(access), archivedAt: null } });
db.contentRequest.findMany({ where: { ...requestWhere(access), status: "SUBMITTED" } });
db.upload.findMany({ where: { AND: [uploadWhere(access), { status: "PENDING" }] } });
db.contentRequest.count({ where: requestWhere(access) });               // counts too

// one object by id: combine with AND, then 404 when it's out of scope
const creator = await db.creator.findFirst({ where: { AND: [creatorWhere(access), { id }] } });
if (!creator) return NextResponse.json({ error: "Creator not found" }, { status: 404 });
```

- These helpers include `agencyId` and put their scope inside `AND`, so you
  may spread them next to your own fields. If your filter has its own `AND`,
  combine as `{ AND: [creatorWhere(access), yours] }`.
- Use 404 (not 403) for an out-of-scope object, so its existence is not
  revealed.
- Staff lists (Team page, assignee / watcher / mention pickers, chat member
  pickers, oversight, `/api/users/search`) use `staffWhere(access)`; it also
  removes creator pseudo-users (`.internal`). Activity feeds by staff use
  `activityWhere(access)`.

## 4. Redact creator information

Name and avatar always show. Email, phone, notes, time zone, preferences,
content library, last sign-in and invite details are permission keys under
`creatorInfo.*`. Redact **every** payload that carries creator data before
it leaves the server: creator APIs, requests, messages, overview, search,
exports, calendar, server-rendered props.

```ts
import { redactCreator, redactCreatorsIn } from "@/lib/access/server";

return NextResponse.json(redactCreator(access, creator));           // a creator or creator[]
return NextResponse.json(redactCreatorsIn(access, { requests }));   // creators under `creator` / `creators` keys, any depth
```

The field map is `CREATOR_FIELDS` in `server.ts`; `portalPassword`,
`sessionToken` and `sessionExpiry` are always removed. Exports and CSVs: drop
the hidden columns (`hiddenCreatorFields(access)`), don't blank them. Writes:
refuse to change a field the person can't see (for example `creators.edit`
without `creatorInfo.email` must not change the email).

## 5. Hide UI

```tsx
"use client";
import { useAccess, Can } from "@/lib/access/client";

const { can, canAny, isOwner, roleName } = useAccess();
{can("requests.create") && <Button>New request</Button>}
<Can perm="review.download"><DownloadButton /></Can>
<Can perm={["review.approve", "review.requestChanges"]}>…</Can>
```

Hide (don't disable) controls for actions someone can't take, unless hiding
breaks the layout. Server components use `access.has(key)` and pass booleans
down. The nav (`src/components/layout/staff-nav.ts`) filters by `perm`.

## 6. Checklist for each area

- [ ] Every route handler starts with `requireAccess(<key>)`; no `role ===` checks remain.
- [ ] Each method needs the key for its action (GET = view, POST = create, PATCH = edit, DELETE = delete, plus special actions).
- [ ] Every list, count and lookup of creators / requests / uploads / conversations is scoped (`creatorWhere` / `requestWhere` / `uploadWhere`); out-of-scope ids answer 404.
- [ ] Every staff list uses `staffWhere`.
- [ ] Every payload with creator data passes through `redactCreator` / `redactCreatorsIn`, including server-rendered props and exports.
- [ ] The page gates with `getPageAccess()` + `<NoAccess>` (or the client equivalent).
- [ ] Buttons for disallowed actions are hidden with `useAccess()` / `<Can>`.
- [ ] Owner still has everything; the Admin / Manager / Member presets keep today's behaviour.
- [ ] `npx tsc --noEmit`, eslint, and a check as a restricted role (see `scratchpad/localapp/e2e/` for the Reviewer flow).

## Adding a permission

Add it to the right area in `catalogue.ts` (label, description, `short`,
`implies` its view key, `dangerous` if it lets data leave or grants access),
decide whether each preset gets it (Admin gets everything automatically;
`ADMIN_ONLY` / `MANAGER_UP` decide Manager and Member), then guard the route
and hide the control. Stored roles simply don't have the new key until
someone switches it on, except presets reset with "Reset to default".

When a new key **splits an action out of an existing key** (the route used a
stand-in until now), roles saved earlier must keep what they could do: bump
`CATALOGUE_REV` and add the key to `SPLIT_FROM` with its stand-ins. A role
saved at an older revision then gets the new key when it held a stand-in; a
built-in role gets its preset's default instead (`upgradeKeys`, applied in
`rowToRole`). Saving the role stores the current revision.

## Notifications

Before creating a notification or mention about a creator, request or
message, pass the recipients through
`recipientsWhoCanSee(agencyId, userIds, { creatorId, keys })` (server.ts):
it keeps only staff whose role holds one of `keys` and can see that creator,
in three queries whatever the number of people.
