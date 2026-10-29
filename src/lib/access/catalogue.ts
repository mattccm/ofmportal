/**
 * The permission catalogue: the single source of truth for what a role can
 * do. Client-safe (no server imports).
 *
 * Every feature of the staff app has a key here. Keys are grouped by area in
 * nav order; each has a plain-language label and one-line description for the
 * role editor, an optional `dangerous` marker, and `implies` (turning a key on
 * turns these on too; the resolver applies the closure, so a stored role can
 * never hold "edit" without "view").
 *
 * Owner is not a role row: an owner has every key and every scope, always.
 * Admin, Manager and Member are editable presets whose defaults live in
 * PRESETS below and reproduce what each role could do before roles were real.
 */

export const AREAS = [
  { id: "overview", title: "Overview", description: "The home screen." },
  { id: "requests", title: "Requests", description: "Content requests sent to creators." },
  { id: "review", title: "Review", description: "Uploads waiting for review, and what happens to them." },
  { id: "creators", title: "Creators", description: "The creators the agency works with." },
  {
    id: "creatorInfo",
    title: "Creator information",
    description:
      "A creator's name and picture always show. Anything switched off here is hidden wherever creators appear: lists, requests, messages, search and exports.",
  },
  { id: "messages", title: "Messages", description: "Conversations with creators and between the team." },
  { id: "templates", title: "Templates", description: "Request templates and template groups." },
  { id: "recurring", title: "Recurring requests", description: "Requests that send themselves on a schedule." },
  { id: "bundles", title: "Bundles", description: "Sets of requests sent together." },
  { id: "reminders", title: "Reminders", description: "Reminders that chase creators about due work." },
  { id: "calendar", title: "Calendar", description: "Due dates on a calendar." },
  { id: "analytics", title: "Analytics and reports", description: "How the work is going, in numbers." },
  { id: "exports", title: "Exports", description: "Data taken out of the portal." },
  { id: "team", title: "Team", description: "The people who work in the portal." },
  { id: "roles", title: "Roles and permissions", description: "What each role can see and change." },
  { id: "settings", title: "Agency settings", description: "Settings that apply to everyone. Personal settings are always open to everyone." },
] as const;

export type AreaId = (typeof AREAS)[number]["id"];

export interface PermissionDef {
  key: string;
  area: AreaId;
  label: string;
  description: string;
  /** Short phrase for the plain-language summary ("see", "approve uploads") */
  short: string;
  dangerous?: true;
  implies?: string[];
}

const P = (
  key: string,
  label: string,
  description: string,
  short: string,
  extra: { dangerous?: true; implies?: string[] } = {}
): Omit<PermissionDef, "area"> => ({ key, label, description, short, ...extra });

const DEFS: Record<AreaId, Omit<PermissionDef, "area">[]> = {
  overview: [
    P("overview.view", "See the overview", "The home screen with the most urgent request and the shelves of work.", "see the overview"),
    P("activity.view", "See the activity feed", "What teammates and creators did, newest first, for the creators and teammates they can see.", "see the activity feed"),
  ],
  requests: [
    P("requests.view", "See requests", "The request list and each request's page, brief, uploads list and history.", "see requests"),
    P("requests.create", "Create requests", "Send new requests to creators, one at a time or as a batch.", "create", { implies: ["requests.view"] }),
    P("requests.edit", "Edit requests", "Change a request's fields, brief, due date and urgency, and who watches it.", "edit", { implies: ["requests.view"] }),
    P("requests.upload", "Upload for a creator", "Add files to a request on the creator's behalf.", "upload for creators", { implies: ["requests.view"] }),
    P("requests.watchers", "Take people off watching", "Remove other teammates from a request's watchers. Anyone who can edit a request can add watchers.", "manage watchers", { implies: ["requests.edit"] }),
    P("requests.comment", "Comment on requests", "Write on a request's thread, including replies the creator sees.", "comment", { implies: ["requests.view"] }),
    P("requests.remind", "Remind from a request", "Send the creator a reminder from the request's page.", "remind", { implies: ["requests.view"] }),
    P("requests.archive", "Archive requests", "Move requests out of the list, and bring them back.", "archive", { implies: ["requests.view"] }),
    P("requests.delete", "Delete requests", "Remove requests for good, with their uploads and comments.", "delete", { dangerous: true, implies: ["requests.view"] }),
    P("requests.bulk", "Bulk actions", "Change, archive or remind many requests at once, and undo bulk changes.", "use bulk actions", { implies: ["requests.view"] }),
    P("requests.export", "Export requests", "Download request lists and their details as a spreadsheet.", "export", { implies: ["requests.view"] }),
  ],
  review: [
    P("review.view", "See uploads", "Uploaded files in review and on the Uploads page. Previews stay hidden until revealed.", "see uploads", { implies: ["requests.view"] }),
    P("review.reveal", "Reveal previews", "Show an upload's picture or video. Without this they see the file's kind and size only.", "reveal previews", { implies: ["review.view"] }),
    P("review.approve", "Approve uploads", "Mark uploads and fields as approved.", "approve", { implies: ["review.view"] }),
    P("review.requestChanges", "Ask for changes", "Send an upload back to the creator with notes on what to change.", "ask for changes", { implies: ["review.view"] }),
    P("review.restore", "Restore earlier versions", "Make an earlier version of an upload the current one again.", "restore versions", { implies: ["review.view"] }),
    P("review.delete", "Delete uploads", "Remove uploaded files for good.", "delete uploads", { dangerous: true, implies: ["review.view"] }),
    P("review.download", "Download originals", "Download full-quality files, one at a time or in bulk. The files leave the portal.", "download originals", { dangerous: true, implies: ["review.view"] }),
    P("review.share", "Make share links", "Links that let someone outside the portal see or download content.", "make share links", { dangerous: true, implies: ["review.view"] }),
    P("review.shareManage", "Turn off anyone's share links", "Switch off share links other teammates made. Everyone can switch off their own.", "turn off anyone's share links", { implies: ["review.share"] }),
  ],
  creators: [
    P("creators.view", "See creators", "The creator list and creator profiles.", "see creators"),
    P("creators.invite", "Add and invite creators", "Add creators and make or send their invite links.", "add and invite", { implies: ["creators.view"] }),
    P("creators.edit", "Edit creators", "Change a creator's profile, contact details, tags and notes.", "edit", { implies: ["creators.view"] }),
    P("creators.groups", "Manage creator groups", "Create groups and choose who is in them.", "manage groups", { implies: ["creators.view"] }),
    P("creators.assign", "Assign creators to teammates", "Choose which teammates look after a creator. Someone whose role sees only their assigned creators sees just those.", "assign to teammates", { implies: ["creators.view"] }),
    P("creators.import", "Import creators", "Add many creators at once from a spreadsheet.", "import", { implies: ["creators.view"] }),
    P("creators.pauseReminders", "Pause a creator's reminders", "Turn a creator's reminders off, and set their quiet hours and reminder settings.", "pause reminders", { implies: ["creators.view"] }),
    P("creators.resetAccess", "Reset creator access", "Send a password reset or a new invite link so a creator can sign in again.", "reset access", { dangerous: true, implies: ["creators.view"] }),
    P("creators.delete", "Archive and delete creators", "Archive creators, or delete them with all their requests and uploads.", "archive and delete", { dangerous: true, implies: ["creators.view"] }),
    P("notes.moderate", "Delete anyone's notes", "Remove notes other teammates wrote about creators, requests and uploads. Everyone can delete their own.", "delete anyone's notes"),
  ],
  creatorInfo: [
    P("creatorInfo.email", "Email address", "The creator's email address.", "email"),
    P("creatorInfo.phone", "Phone number", "The creator's phone number.", "phone"),
    P("creatorInfo.notes", "Private notes", "The team's private notes about the creator.", "notes"),
    P("creatorInfo.location", "Time zone and location", "Where the creator is and their local time.", "time zone"),
    P("creatorInfo.preferences", "Content and contact preferences", "What they will and won't shoot, and how they like to be contacted.", "preferences"),
    P("creatorInfo.content", "Their content library", "Everything the creator has uploaded, on their profile.", "content library"),
    P("creatorInfo.activity", "Last sign-in and activity", "When the creator last signed in and what they did.", "last sign-in"),
    P("creatorInfo.invite", "Invite status and links", "Whether the creator has joined, and their invite link.", "invite status"),
  ],
  messages: [
    P("messages.creators", "See creator conversations", "Messages between the agency and creators.", "see creator conversations"),
    P("messages.reply", "Message creators", "Reply to creators and start new conversations with them.", "message creators", { implies: ["messages.creators"] }),
    P("messages.email", "Email creators", "Send emails to creators from the portal.", "email creators"),
    P("messages.team", "See team chats", "Chats between staff, and writing in them.", "use team chats"),
    P("messages.groups", "Create group chats", "Start a chat with several teammates.", "create group chats", { implies: ["messages.team"] }),
  ],
  templates: [
    P("templates.view", "See templates", "The template library, to build requests from.", "see templates"),
    P("templates.create", "Create templates", "Make new templates, or copy existing ones.", "create", { implies: ["templates.view"] }),
    P("templates.edit", "Edit templates", "Change a template's fields and wording.", "edit", { implies: ["templates.view"] }),
    P("templates.delete", "Delete templates", "Remove templates. Requests already sent keep their fields.", "delete", { implies: ["templates.view"] }),
    P("templates.groups", "Manage template groups", "Group templates and choose who can send them.", "manage groups", { implies: ["templates.view"] }),
  ],
  recurring: [
    P("recurring.view", "See recurring requests", "Requests that send themselves on a schedule, and what they sent.", "see schedules"),
    P("recurring.create", "Create recurring requests", "Set up a new schedule.", "create", { implies: ["recurring.view"] }),
    P("recurring.edit", "Edit recurring requests", "Change a schedule's creators, template and timing, or run it now.", "edit", { implies: ["recurring.view"] }),
    P("recurring.pause", "Pause and resume", "Stop a schedule for a while and start it again.", "pause", { implies: ["recurring.view"] }),
    P("recurring.delete", "Delete recurring requests", "Remove a schedule. Requests it already sent stay.", "delete", { implies: ["recurring.view"] }),
  ],
  bundles: [
    P("bundles.view", "See bundles", "Sets of requests that are sent together.", "see bundles"),
    P("bundles.edit", "Create and edit bundles", "Make bundles and change what is in them.", "create and edit", { implies: ["bundles.view"] }),
    P("bundles.run", "Send bundles", "Send every request in a bundle at once.", "send", { implies: ["bundles.view"] }),
  ],
  reminders: [
    P("reminders.view", "See reminders", "The Reminders page: what went out and what is scheduled.", "see reminders"),
    P("reminders.send", "Send reminders by hand", "Send reminders now, to one creator or many, and send test reminders.", "send by hand", { implies: ["reminders.view"] }),
    P("reminders.edit", "Reschedule reminders", "Move a scheduled reminder to another time.", "reschedule", { implies: ["reminders.view"] }),
    P("reminders.delete", "Cancel reminders", "Stop a scheduled reminder from going out.", "cancel", { implies: ["reminders.view"] }),
    P("reminders.templates", "Edit message wording", "Reminders > Wording: what every creator email and text says.", "edit wording", { implies: ["reminders.view"] }),
    P("reminders.rules", "Edit reminder rules", "When reminders go out and how often, and which messages are emailed or texted.", "edit rules", { implies: ["reminders.view"] }),
  ],
  calendar: [P("calendar.view", "See the calendar", "Due dates and scheduled work on a calendar.", "see the calendar")],
  analytics: [
    P("analytics.view", "See analytics", "Charts of turnaround, approvals and response times.", "see analytics"),
    P("reports.view", "See reports", "Saved and built reports.", "see reports"),
    P("reports.export", "Export reports", "Download reports as files.", "export reports", { implies: ["reports.view"] }),
  ],
  exports: [P("exports.data", "Export data", "Make spreadsheet and archive exports of creators, requests and uploads.", "export data", { dangerous: true })],
  team: [
    P("team.view", "See the team page", "Teammates, their roles and when they were last active.", "see the team"),
    P("team.invite", "Invite teammates", "Make invite links for new staff. They can only hand out roles with no more access than their own.", "invite", { implies: ["team.view"] }),
    P("team.changeRoles", "Change teammates' roles", "Move people between roles. Without Manage roles, only to roles with no more access than their own.", "change roles", { dangerous: true, implies: ["team.view"] }),
    P("team.remove", "Remove teammates", "Take someone off the team. They are signed out at once.", "remove people", { dangerous: true, implies: ["team.view"] }),
  ],
  roles: [
    P("roles.manage", "Manage roles and permissions", "Create, change and delete roles, including their own. Anyone with this can give themselves more access.", "manage roles", { dangerous: true }),
  ],
  settings: [
    P("settings.branding", "Agency branding", "Agency name, logos and the email sender.", "branding"),
    P("settings.emailTemplates", "Email wording", "Also opens Reminders > Wording: what every creator email and text says.", "email wording"),
    P("settings.notifications", "Notification defaults", "What the team is notified about unless they choose otherwise.", "notification defaults"),
    P("settings.announcements", "Announcements", "Banners shown across the portal.", "announcements"),
    P("settings.duplicates", "Duplicate detection", "Catch the same file uploaded twice, and allow known repeats.", "duplicate detection"),
    P("settings.automations", "Automations", "Rules that act on requests by themselves.", "automations"),
    P("settings.reviewSessions", "Review sessions", "Live sessions where the team reviews uploads together.", "review sessions"),
    P("settings.mediaLibrary", "Media library", "The agency's shared folders of approved content.", "media library"),
    P("settings.integrations", "Integrations and webhooks", "Connections that send portal events to other services.", "integrations"),
    P("settings.sms", "Text messages (SMS)", "Reminders > Text setup: the sender name, which countries texts can go to, and test texts. Every text costs money.", "text message settings", { dangerous: true }),
    P("settings.oversight", "Oversight", "What each teammate is working on and how fast they respond.", "oversight"),
    P("settings.oversightKeywords", "Oversight keywords", "The words that raise an alert when they appear in conversations.", "oversight keywords", { implies: ["settings.oversight"] }),
    P("settings.auditLog", "Audit log", "Every action taken by staff, newest first.", "audit log"),
    P("settings.feedback", "Feedback inbox", "Bug reports and ideas sent from the app.", "feedback"),
    P("settings.data", "Data and storage", "Storage, retention, clean-ups and full data exports. Deleting all data stays with the owner.", "data and storage", { dangerous: true }),
  ],
};

export const PERMISSIONS: PermissionDef[] = AREAS.flatMap((a) => DEFS[a.id].map((d) => ({ ...d, area: a.id })));

export type PermissionKey = string;

export const PERMISSION_KEYS: string[] = PERMISSIONS.map((p) => p.key);
const KEY_SET = new Set(PERMISSION_KEYS);
export const PERMISSION_BY_KEY: Record<string, PermissionDef> = Object.fromEntries(PERMISSIONS.map((p) => [p.key, p]));

export function isPermissionKey(k: unknown): k is PermissionKey {
  return typeof k === "string" && KEY_SET.has(k);
}

export function permissionsInArea(area: AreaId): PermissionDef[] {
  return PERMISSIONS.filter((p) => p.area === area);
}

/** Keys plus everything they imply (transitively); unknown keys are dropped. */
export function withImplied(keys: Iterable<string>): Set<string> {
  const out = new Set<string>();
  const stack = [...keys].filter(isPermissionKey);
  while (stack.length) {
    const k = stack.pop()!;
    if (out.has(k)) continue;
    out.add(k);
    for (const i of PERMISSION_BY_KEY[k]?.implies ?? []) stack.push(i);
  }
  return out;
}

/** Keys that would have to go off if `key` goes off (they imply it). */
export function dependentsOf(key: string): string[] {
  return PERMISSIONS.filter((p) => p.key !== key && withImplied([p.key]).has(key)).map((p) => p.key);
}

// ---------- catalogue revisions ----------

/**
 * Stored with every role (`permissions.rev`). Revision 2 split these actions
 * out of the keys that stood in for them. A role saved before that keeps
 * exactly what it could do: it gets each new key when it held any of the
 * stand-ins (a built-in role gets its preset's default instead).
 */
export const CATALOGUE_REV = 4;
export const SPLIT_FROM: Record<string, string[]> = {
  "activity.view": ["overview.view", "requests.view", "creators.view", "review.view"],
  "requests.upload": ["requests.edit"],
  "requests.watchers": ["requests.edit"],
  "review.restore": ["review.approve"],
  "review.delete": ["requests.delete"],
  "review.shareManage": ["settings.data"],
  "notes.moderate": ["creators.delete"],
  "reminders.edit": ["reminders.send"],
  "reminders.delete": ["reminders.send"],
  "reminders.templates": ["reminders.rules"],
  "settings.oversightKeywords": ["settings.oversight"],
  "settings.sms": ["settings.integrations"],
  "creators.assign": ["creators.edit"],
};

/** Keys a role saved at an older catalogue revision should also hold */
export function upgradeKeys(keys: string[], rev: number, presetKeys?: string[]): string[] {
  if (rev >= CATALOGUE_REV) return keys;
  const have = new Set(keys);
  const preset = presetKeys ? new Set(presetKeys) : null;
  for (const [key, from] of Object.entries(SPLIT_FROM)) {
    if (have.has(key)) continue;
    if (preset ? preset.has(key) : from.some((k) => have.has(k))) have.add(key);
  }
  return [...have];
}

// ---------- scopes ----------

export type CreatorScope =
  | { type: "all" }
  | { type: "groups"; groupIds: string[] }
  | { type: "creators"; creatorIds: string[] }
  /** Each person sees the creators assigned to them (User.assignedCreatorIds); resolved to "creators" in their Access */
  | { type: "assigned" };

/**
 * Team scope. Role ids are preset ids ("owner", "admin", "manager", "member")
 * or custom role ids. A person always sees themselves.
 */
export type TeamScope =
  | { type: "all" }
  | { type: "roles"; roleIds: string[] }
  | { type: "members"; memberIds: string[] }
  | { type: "self" };

export const ALL_CREATORS: CreatorScope = { type: "all" };
export const EVERYONE: TeamScope = { type: "all" };

// ---------- presets ----------

export type PresetId = "admin" | "manager" | "member";
export const PRESET_IDS: PresetId[] = ["admin", "manager", "member"];
/** Role ids of the built-in roles, as used in team scopes and URLs */
export const BUILT_IN_ROLE_IDS = ["owner", "admin", "manager", "member"] as const;
export type BuiltInRoleId = (typeof BUILT_IN_ROLE_IDS)[number];

export const ENUM_FOR_BUILT_IN: Record<BuiltInRoleId, "OWNER" | "ADMIN" | "MANAGER" | "MEMBER"> = {
  owner: "OWNER",
  admin: "ADMIN",
  manager: "MANAGER",
  member: "MEMBER",
};
export const BUILT_IN_FOR_ENUM: Record<string, BuiltInRoleId> = {
  OWNER: "owner",
  ADMIN: "admin",
  MANAGER: "manager",
  MEMBER: "member",
};

export interface PresetDef {
  id: PresetId;
  name: string;
  description: string;
  color: string;
  keys: string[];
  creatorScope: CreatorScope;
  teamScope: TeamScope;
}

const ALL = PERMISSION_KEYS;
const without = (drop: string[]) => ALL.filter((k) => !drop.includes(k));

/** Only owners and admins could do these before roles were enforced */
const ADMIN_ONLY = [
  "creators.delete",
  "creators.resetAccess",
  "notes.moderate",
  "review.shareManage",
  "templates.groups",
  "reminders.rules",
  "team.invite",
  "team.changeRoles",
  "team.remove",
  "roles.manage",
  "settings.branding",
  "settings.emailTemplates",
  "settings.notifications",
  "settings.announcements",
  "settings.duplicates",
  "settings.integrations",
  "settings.sms",
  "settings.auditLog",
  "settings.feedback",
  "settings.data",
  "settings.oversightKeywords",
];

/** Owners, admins and managers could do these; members could not */
const MANAGER_UP = [
  "creators.invite",
  "creators.edit",
  "creators.assign",
  "creators.import",
  "creators.pauseReminders",
  "requests.watchers",
  "review.restore",
  "reminders.templates",
  "messages.email",
  "reminders.send",
  "exports.data",
  "settings.automations",
  "settings.oversight",
];

export const PRESETS: Record<PresetId, PresetDef> = {
  admin: {
    id: "admin",
    name: "Admin",
    description: "Everything, including the team, roles and agency settings.",
    color: "#9db4d8",
    keys: [...ALL],
    creatorScope: ALL_CREATORS,
    teamScope: EVERYONE,
  },
  manager: {
    id: "manager",
    name: "Manager",
    description: "Runs creators, requests, review and reminders. No team, roles or agency settings.",
    color: "#e0c49a",
    keys: without(ADMIN_ONLY),
    creatorScope: ALL_CREATORS,
    teamScope: EVERYONE,
  },
  member: {
    id: "member",
    name: "Member",
    description: "Works on requests and review. Can't invite or edit creators, send reminders by hand or export data.",
    color: "#a6aab3",
    keys: without([...ADMIN_ONLY, ...MANAGER_UP]),
    creatorScope: ALL_CREATORS,
    teamScope: EVERYONE,
  },
};

export const OWNER_ROLE = {
  id: "owner" as const,
  name: "Owner",
  description: "Everything, always. This role can't be changed, and the last owner can't be removed.",
  color: "#eceef2",
};

/**
 * Identity colours for roles: a small dot beside the name. Muted on purpose,
 * away from the accent yellow and the field-state hues.
 */
export const ROLE_COLORS = [
  { name: "Paper", value: "#eceef2" },
  { name: "Silver", value: "#a6aab3" },
  { name: "Slate blue", value: "#9db4d8" },
  { name: "Sand", value: "#e0c49a" },
  { name: "Lilac", value: "#c3a9e6" },
  { name: "Rose", value: "#e6a9c0" },
  { name: "Sea", value: "#9fd3cf" },
] as const;

// ---------- plain-language summary ----------

function joinWords(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

export interface SummaryNames {
  groups?: Record<string, string>;
  creators?: Record<string, string>;
  roles?: Record<string, string>;
  members?: Record<string, string>;
}

function names(ids: string[], map: Record<string, string> | undefined, noun: string): string {
  const known = ids.map((id) => map?.[id]).filter(Boolean) as string[];
  if (known.length === 0) return `no ${noun}s yet`;
  if (known.length <= 3) return joinWords(known);
  return `${known.slice(0, 2).join(", ")} and ${known.length - 2} more`;
}

export function creatorScopeSentence(scope: CreatorScope, n: SummaryNames = {}): string {
  if (scope.type === "all") return "Sees every creator.";
  if (scope.type === "assigned") return "Sees only the creators assigned to them.";
  if (scope.type === "groups") {
    return scope.groupIds.length === 0
      ? "Sees no creators: no group is chosen yet."
      : `Sees only creators in ${names(scope.groupIds, n.groups, "group")}.`;
  }
  return scope.creatorIds.length === 0
    ? "Sees no creators: none is chosen yet."
    : `Sees only ${names(scope.creatorIds, n.creators, "creator")}.`;
}

export function teamScopeSentence(scope: TeamScope, n: SummaryNames = {}): string {
  if (scope.type === "all") return "Sees everyone on the team.";
  if (scope.type === "self") return "Sees only themselves on the team.";
  if (scope.type === "roles") {
    return scope.roleIds.length === 0
      ? "Sees only themselves on the team: no role is chosen yet."
      : `Sees themselves and people who are ${names(scope.roleIds, n.roles, "role")}.`;
  }
  return scope.memberIds.length === 0
    ? "Sees only themselves on the team: nobody is chosen yet."
    : `Sees themselves and ${names(scope.memberIds, n.members, "teammate")}.`;
}

export interface SummaryLine {
  area: AreaId;
  title: string;
  text: string;
}

/** "What this role can do", area by area, in words. Areas with nothing on are left out. */
export function summarize(keys: Iterable<string>): { lines: SummaryLine[]; hiddenInfo: string[]; none: string[] } {
  const on = withImplied(keys);
  const lines: SummaryLine[] = [];
  const none: string[] = [];
  for (const a of AREAS) {
    if (a.id === "creatorInfo") continue;
    const defs = permissionsInArea(a.id);
    const have = defs.filter((d) => on.has(d.key));
    if (have.length === 0) {
      none.push(a.title);
      continue;
    }
    const text = have.length === defs.length && defs.length > 1 ? "everything" : joinWords(have.map((d) => d.short));
    lines.push({ area: a.id, title: a.title, text });
  }
  const hiddenInfo = permissionsInArea("creatorInfo")
    .filter((d) => !on.has(d.key))
    .map((d) => d.short);
  return { lines, hiddenInfo, none };
}

// ---------- comparing roles ----------

export interface RoleShape {
  keys: Iterable<string>;
  creatorScope: CreatorScope;
  teamScope: TeamScope;
}

function subset(a: string[], b: string[]) {
  const s = new Set(b);
  return a.every((x) => s.has(x));
}

/**
 * True when `role` gives no more than `actor` has: every key, and creator and
 * team scopes no wider. Used to stop people handing out more access than they
 * hold (invites and role changes) unless they can manage roles.
 */
export function roleWithin(role: RoleShape, actor: RoleShape): boolean {
  const actorKeys = withImplied(actor.keys);
  for (const k of withImplied(role.keys)) if (!actorKeys.has(k)) return false;

  const ac = actor.creatorScope;
  const rc = role.creatorScope;
  // "Assigned to them" is bounded by assignments, which only reach creators the assigner can see
  if (ac.type !== "all" && rc.type !== "assigned") {
    if (rc.type === "all") return false;
    if (rc.type !== ac.type) return false;
    if (rc.type === "groups" && ac.type === "groups" && !subset(rc.groupIds, ac.groupIds)) return false;
    if (rc.type === "creators" && ac.type === "creators" && !subset(rc.creatorIds, ac.creatorIds)) return false;
  }

  const at = actor.teamScope;
  const rt = role.teamScope;
  if (at.type !== "all" && rt.type !== "self") {
    if (rt.type === "all") return false;
    if (at.type === "self") return false;
    if (rt.type !== at.type) return false;
    if (rt.type === "roles" && at.type === "roles" && !subset(rt.roleIds, at.roleIds)) return false;
    if (rt.type === "members" && at.type === "members" && !subset(rt.memberIds, at.memberIds)) return false;
  }
  return true;
}
