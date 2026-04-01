// Permission Actions
export type PermissionAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "approve"
  | "reject"
  | "export"
  | "download"
  | "assign"
  | "invite"
  | "remove";

// Permission Resources
export type PermissionResource =
  | "creators"
  | "requests"
  | "uploads"
  | "templates"
  | "reports"
  | "settings"
  | "team"
  | "billing"
  | "integrations"
  | "audit_log"
  | "analytics";

// Permission categories for UI grouping
export type PermissionCategory =
  | "creators"
  | "requests"
  | "uploads"
  | "team"
  | "settings"
  | "analytics";

// Category configuration for UI
export interface PermissionCategoryConfig {
  id: PermissionCategory;
  label: string;
  description: string;
  icon: string;
  resources: PermissionResource[];
  actions: {
    action: PermissionAction;
    label: string;
    description: string;
    resourceSpecific?: PermissionResource[];
  }[];
}

// Define permission categories with their available actions
export const PERMISSION_CATEGORIES: PermissionCategoryConfig[] = [
  {
    id: "creators",
    label: "Creators",
    description: "Manage creator profiles and assignments",
    icon: "Users",
    resources: ["creators"],
    actions: [
      { action: "view", label: "View", description: "View creator profiles and details" },
      { action: "edit", label: "Edit", description: "Edit creator information" },
      { action: "delete", label: "Delete", description: "Delete creator profiles" },
      { action: "assign", label: "Assign", description: "Assign creators to team members" },
    ],
  },
  {
    id: "requests",
    label: "Requests",
    description: "Content requests and workflows",
    icon: "FileText",
    resources: ["requests", "templates"],
    actions: [
      { action: "view", label: "View", description: "View content requests" },
      { action: "create", label: "Create", description: "Create new content requests" },
      { action: "edit", label: "Edit", description: "Edit existing requests" },
      { action: "delete", label: "Delete", description: "Delete requests" },
      { action: "approve", label: "Approve", description: "Approve submitted requests" },
    ],
  },
  {
    id: "uploads",
    label: "Uploads",
    description: "Content uploads and media management",
    icon: "Upload",
    resources: ["uploads"],
    actions: [
      { action: "view", label: "View", description: "View uploaded content" },
      { action: "approve", label: "Approve", description: "Approve uploaded content" },
      { action: "reject", label: "Reject", description: "Reject uploaded content" },
      { action: "download", label: "Download", description: "Download content files" },
    ],
  },
  {
    id: "team",
    label: "Team",
    description: "Team member management",
    icon: "UserPlus",
    resources: ["team"],
    actions: [
      { action: "view", label: "View", description: "View team members" },
      { action: "invite", label: "Invite", description: "Invite new team members" },
      { action: "edit", label: "Edit", description: "Edit team member roles" },
      { action: "remove", label: "Remove", description: "Remove team members" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    description: "Agency and billing settings",
    icon: "Settings",
    resources: ["settings", "billing", "integrations"],
    actions: [
      { action: "view", label: "View", description: "View agency settings" },
      { action: "edit", label: "Edit Billing", description: "Manage billing and subscription", resourceSpecific: ["billing"] },
      { action: "edit", label: "Edit Agency", description: "Edit agency settings", resourceSpecific: ["settings"] },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    description: "Reports and data analytics",
    icon: "BarChart2",
    resources: ["reports", "analytics", "audit_log"],
    actions: [
      { action: "view", label: "View", description: "View analytics and reports" },
      { action: "export", label: "Export", description: "Export analytics data" },
    ],
  },
];

// Individual Permission
export interface Permission {
  resource: PermissionResource;
  actions: PermissionAction[];
}

// Creator Visibility - Controls which creators a team member can see
export interface CreatorVisibility {
  type: "all" | "assigned" | "groups" | "specific";
  creatorIds?: string[]; // If type is "specific"
  groupIds?: string[]; // If type is "groups"
}

// Data Field Visibility - Controls which fields team members can see
export interface DataFieldVisibility {
  // Which fields team members can see for creators
  creatorFields: {
    email: boolean;
    phone: boolean;
    earnings: boolean;
    personalNotes: boolean;
    contracts: boolean;
    paymentInfo: boolean;
  };
  // Which fields team members can see for requests
  requestFields: {
    internalNotes: boolean;
    creatorCompensation: boolean;
  };
}

// Team Member Visibility - Controls what team members can see about other members
export interface TeamMemberVisibility {
  canSeeOtherMembers: boolean;
  canSeeOtherMemberActivity: boolean;
  canSeeMemberEarnings: boolean;
  visibleMemberIds?: string[]; // Specific members they can see
}

// Role Definition
export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  creatorVisibility: CreatorVisibility;
  dataFieldVisibility: DataFieldVisibility;
  teamMemberVisibility: TeamMemberVisibility;
  isSystem: boolean; // Built-in roles can't be deleted
  color?: string; // Color for UI badges
  createdAt: Date;
  updatedAt: Date;
}

// Template Visibility - Controls which templates/requests a team member can see
export interface TemplateVisibility {
  type: "all" | "include" | "exclude";
  templateIds?: string[]; // Templates to include or exclude based on type
}

// Team Member with Role
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  roleId: string;
  role?: Role;
  // Per-member permission overrides
  permissionOverrides?: PermissionOverride[];
  // Specific creators assigned to this member
  assignedCreatorIds?: string[];
  // Template visibility settings
  templateVisibility?: TemplateVisibility;
  // Activity restrictions
  activityRestrictions?: ActivityRestrictions;
  createdAt: Date;
  updatedAt: Date;
}

// Permission Override - Allows customizing permissions for specific members
export interface PermissionOverride {
  resource: PermissionResource;
  actions: PermissionAction[];
  type: "grant" | "revoke"; // Grant additional permissions or revoke existing ones
}

// Activity Restrictions - Time-based or IP-based restrictions
export interface ActivityRestrictions {
  // Time-based restrictions
  allowedHours?: {
    start: number; // 0-23
    end: number; // 0-23
    timezone: string;
  };
  allowedDays?: number[]; // 0-6 (Sunday-Saturday)
  // IP restrictions
  allowedIPs?: string[];
  // Feature restrictions
  canBulkEdit?: boolean;
  canExport?: boolean;
  canDelete?: boolean;
  maxDailyActions?: number;
}

// All available permission actions mapped to their descriptions
export const PERMISSION_ACTIONS: Record<PermissionAction, { label: string; description: string }> = {
  view: { label: "View", description: "Can view and read data" },
  create: { label: "Create", description: "Can create new items" },
  edit: { label: "Edit", description: "Can modify existing items" },
  delete: { label: "Delete", description: "Can remove items" },
  approve: { label: "Approve", description: "Can approve items" },
  reject: { label: "Reject", description: "Can reject items" },
  export: { label: "Export", description: "Can export data" },
  download: { label: "Download", description: "Can download files" },
  assign: { label: "Assign", description: "Can assign items to others" },
  invite: { label: "Invite", description: "Can invite new users" },
  remove: { label: "Remove", description: "Can remove users" },
};

// All available resources mapped to their descriptions
export const PERMISSION_RESOURCES: Record<PermissionResource, { label: string; description: string; icon: string; category: PermissionCategory }> = {
  creators: { label: "Creators", description: "Manage creator profiles and information", icon: "Users", category: "creators" },
  requests: { label: "Requests", description: "Content requests and assignments", icon: "FileText", category: "requests" },
  uploads: { label: "Uploads", description: "Uploaded content and media files", icon: "Upload", category: "uploads" },
  templates: { label: "Templates", description: "Request templates and presets", icon: "Layout", category: "requests" },
  reports: { label: "Reports", description: "Analytics and reporting", icon: "BarChart2", category: "analytics" },
  settings: { label: "Settings", description: "Agency and system settings", icon: "Settings", category: "settings" },
  team: { label: "Team", description: "Team members and invitations", icon: "UserPlus", category: "team" },
  billing: { label: "Billing", description: "Subscription and payment information", icon: "CreditCard", category: "settings" },
  integrations: { label: "Integrations", description: "Third-party service connections", icon: "Plug", category: "settings" },
  audit_log: { label: "Audit Log", description: "Activity logs and history", icon: "History", category: "analytics" },
  analytics: { label: "Analytics", description: "Dashboard analytics and metrics", icon: "TrendingUp", category: "analytics" },
};

// Default field visibility for creators
export const DEFAULT_CREATOR_FIELD_VISIBILITY: DataFieldVisibility["creatorFields"] = {
  email: true,
  phone: false,
  earnings: false,
  personalNotes: false,
  contracts: false,
  paymentInfo: false,
};

// Default field visibility for requests
export const DEFAULT_REQUEST_FIELD_VISIBILITY: DataFieldVisibility["requestFields"] = {
  internalNotes: false,
  creatorCompensation: false,
};

// Default team member visibility
export const DEFAULT_TEAM_MEMBER_VISIBILITY: TeamMemberVisibility = {
  canSeeOtherMembers: true,
  canSeeOtherMemberActivity: false,
  canSeeMemberEarnings: false,
};

// Full permissions for all resources
const FULL_PERMISSIONS: Permission[] = Object.keys(PERMISSION_RESOURCES).map((resource) => ({
  resource: resource as PermissionResource,
  actions: Object.keys(PERMISSION_ACTIONS) as PermissionAction[],
}));

// View-only permissions for all resources
const VIEW_ONLY_PERMISSIONS: Permission[] = Object.keys(PERMISSION_RESOURCES).map((resource) => ({
  resource: resource as PermissionResource,
  actions: ["view"] as PermissionAction[],
}));

// Admin permissions (everything except billing management and some settings)
const ADMIN_PERMISSIONS: Permission[] = [
  { resource: "creators", actions: ["view", "create", "edit", "delete", "export", "assign"] },
  { resource: "requests", actions: ["view", "create", "edit", "delete", "approve", "export"] },
  { resource: "uploads", actions: ["view", "create", "edit", "delete", "approve", "reject", "download", "export"] },
  { resource: "templates", actions: ["view", "create", "edit", "delete"] },
  { resource: "reports", actions: ["view", "export"] },
  { resource: "analytics", actions: ["view", "export"] },
  { resource: "settings", actions: ["view", "edit"] },
  { resource: "team", actions: ["view", "invite", "edit", "remove"] },
  { resource: "billing", actions: ["view"] },
  { resource: "integrations", actions: ["view", "edit"] },
  { resource: "audit_log", actions: ["view"] },
];

// Manager permissions
const MANAGER_PERMISSIONS: Permission[] = [
  { resource: "creators", actions: ["view", "create", "edit", "export", "assign"] },
  { resource: "requests", actions: ["view", "create", "edit", "approve", "export"] },
  { resource: "uploads", actions: ["view", "approve", "reject", "download", "export"] },
  { resource: "templates", actions: ["view", "create", "edit"] },
  { resource: "reports", actions: ["view", "export"] },
  { resource: "analytics", actions: ["view", "export"] },
  { resource: "settings", actions: ["view"] },
  { resource: "team", actions: ["view"] },
  { resource: "billing", actions: [] },
  { resource: "integrations", actions: ["view"] },
  { resource: "audit_log", actions: ["view"] },
];

// Editor permissions
const EDITOR_PERMISSIONS: Permission[] = [
  { resource: "creators", actions: ["view", "edit"] },
  { resource: "requests", actions: ["view", "create", "edit"] },
  { resource: "uploads", actions: ["view", "download"] },
  { resource: "templates", actions: ["view"] },
  { resource: "reports", actions: ["view"] },
  { resource: "analytics", actions: ["view"] },
  { resource: "settings", actions: [] },
  { resource: "team", actions: ["view"] },
  { resource: "billing", actions: [] },
  { resource: "integrations", actions: [] },
  { resource: "audit_log", actions: [] },
];

// Default Roles
export const DEFAULT_ROLES: Omit<Role, "createdAt" | "updatedAt">[] = [
  {
    id: "owner",
    name: "Owner",
    description: "Full access to all features and settings. Can manage billing and transfer ownership.",
    permissions: FULL_PERMISSIONS,
    creatorVisibility: { type: "all" },
    dataFieldVisibility: {
      creatorFields: {
        email: true,
        phone: true,
        earnings: true,
        personalNotes: true,
        contracts: true,
        paymentInfo: true,
      },
      requestFields: {
        internalNotes: true,
        creatorCompensation: true,
      },
    },
    teamMemberVisibility: {
      canSeeOtherMembers: true,
      canSeeOtherMemberActivity: true,
      canSeeMemberEarnings: true,
    },
    isSystem: true,
    color: "#7c3aed",
  },
  {
    id: "admin",
    name: "Admin",
    description: "Manage team members, creators, and most settings. Cannot access billing.",
    permissions: ADMIN_PERMISSIONS,
    creatorVisibility: { type: "all" },
    dataFieldVisibility: {
      creatorFields: {
        email: true,
        phone: true,
        earnings: true,
        personalNotes: true,
        contracts: true,
        paymentInfo: false,
      },
      requestFields: {
        internalNotes: true,
        creatorCompensation: true,
      },
    },
    teamMemberVisibility: {
      canSeeOtherMembers: true,
      canSeeOtherMemberActivity: true,
      canSeeMemberEarnings: false,
    },
    isSystem: true,
    color: "#2563eb",
  },
  {
    id: "manager",
    name: "Manager",
    description: "Manage creators and content requests. Can approve uploads and view reports.",
    permissions: MANAGER_PERMISSIONS,
    creatorVisibility: { type: "all" },
    dataFieldVisibility: {
      creatorFields: {
        email: true,
        phone: true,
        earnings: false,
        personalNotes: true,
        contracts: false,
        paymentInfo: false,
      },
      requestFields: {
        internalNotes: true,
        creatorCompensation: false,
      },
    },
    teamMemberVisibility: {
      canSeeOtherMembers: true,
      canSeeOtherMemberActivity: false,
      canSeeMemberEarnings: false,
    },
    isSystem: true,
    color: "#059669",
  },
  {
    id: "editor",
    name: "Editor",
    description: "Create and edit content requests. Limited creator management.",
    permissions: EDITOR_PERMISSIONS,
    creatorVisibility: { type: "assigned" },
    dataFieldVisibility: {
      creatorFields: {
        email: true,
        phone: false,
        earnings: false,
        personalNotes: false,
        contracts: false,
        paymentInfo: false,
      },
      requestFields: {
        internalNotes: false,
        creatorCompensation: false,
      },
    },
    teamMemberVisibility: {
      canSeeOtherMembers: true,
      canSeeOtherMemberActivity: false,
      canSeeMemberEarnings: false,
    },
    isSystem: true,
    color: "#d97706",
  },
  {
    id: "viewer",
    name: "Viewer",
    description: "Read-only access to view creators, requests, and uploads.",
    permissions: VIEW_ONLY_PERMISSIONS.filter(p =>
      ["creators", "requests", "uploads", "reports"].includes(p.resource)
    ),
    creatorVisibility: { type: "assigned" },
    dataFieldVisibility: {
      creatorFields: {
        email: false,
        phone: false,
        earnings: false,
        personalNotes: false,
        contracts: false,
        paymentInfo: false,
      },
      requestFields: {
        internalNotes: false,
        creatorCompensation: false,
      },
    },
    teamMemberVisibility: {
      canSeeOtherMembers: false,
      canSeeOtherMemberActivity: false,
      canSeeMemberEarnings: false,
    },
    isSystem: true,
    color: "#6b7280",
  },
];

// Helper type for role creation
export type CreateRoleInput = Omit<Role, "id" | "createdAt" | "updatedAt" | "isSystem">;
export type UpdateRoleInput = Partial<CreateRoleInput>;

// Permission matrix type for UI
export type PermissionMatrix = Record<PermissionResource, Record<PermissionAction, boolean>>;

// Convert permissions array to matrix
export function permissionsToMatrix(permissions: Permission[]): PermissionMatrix {
  const matrix: PermissionMatrix = {} as PermissionMatrix;

  for (const resource of Object.keys(PERMISSION_RESOURCES) as PermissionResource[]) {
    matrix[resource] = {} as Record<PermissionAction, boolean>;
    for (const action of Object.keys(PERMISSION_ACTIONS) as PermissionAction[]) {
      matrix[resource][action] = false;
    }
  }

  for (const permission of permissions) {
    for (const action of permission.actions) {
      matrix[permission.resource][action] = true;
    }
  }

  return matrix;
}

// Convert matrix to permissions array
export function matrixToPermissions(matrix: PermissionMatrix): Permission[] {
  const permissions: Permission[] = [];

  for (const resource of Object.keys(matrix) as PermissionResource[]) {
    const actions = Object.entries(matrix[resource])
      .filter(([, enabled]) => enabled)
      .map(([action]) => action as PermissionAction);

    if (actions.length > 0) {
      permissions.push({ resource, actions });
    }
  }

  return permissions;
}

// Get effective permissions considering overrides
export function getEffectivePermissions(
  basePermissions: Permission[],
  overrides?: PermissionOverride[]
): Permission[] {
  const matrix = permissionsToMatrix(basePermissions);

  if (overrides) {
    for (const override of overrides) {
      for (const action of override.actions) {
        if (override.type === "grant") {
          matrix[override.resource][action] = true;
        } else {
          matrix[override.resource][action] = false;
        }
      }
    }
  }

  return matrixToPermissions(matrix);
}

// Check if a specific permission is granted
export function hasPermissionInList(
  permissions: Permission[],
  resource: PermissionResource,
  action: PermissionAction
): boolean {
  const permission = permissions.find((p) => p.resource === resource);
  return permission?.actions.includes(action) ?? false;
}

// Validate role permissions - ensures all permissions are valid
export function validateRolePermissions(permissions: Permission[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const validResources = Object.keys(PERMISSION_RESOURCES) as PermissionResource[];
  const validActions = Object.keys(PERMISSION_ACTIONS) as PermissionAction[];

  for (const permission of permissions) {
    if (!validResources.includes(permission.resource)) {
      errors.push(`Invalid resource: ${permission.resource}`);
    }

    for (const action of permission.actions) {
      if (!validActions.includes(action)) {
        errors.push(`Invalid action '${action}' for resource '${permission.resource}'`);
      }
    }

    // Check for duplicate resources
    const resourceCount = permissions.filter(p => p.resource === permission.resource).length;
    if (resourceCount > 1) {
      errors.push(`Duplicate resource: ${permission.resource}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)], // Remove duplicates
  };
}

// Category-based permission matrix for simplified UI
export type CategoryPermissionMatrix = Record<PermissionCategory, Record<PermissionAction, boolean>>;

// Convert permissions to category matrix (for simplified UI)
export function permissionsToCategoryMatrix(permissions: Permission[]): CategoryPermissionMatrix {
  const matrix: CategoryPermissionMatrix = {} as CategoryPermissionMatrix;

  // Initialize all categories
  for (const category of PERMISSION_CATEGORIES) {
    matrix[category.id] = {} as Record<PermissionAction, boolean>;
    for (const actionConfig of category.actions) {
      matrix[category.id][actionConfig.action] = false;
    }
  }

  // Map permissions to categories
  for (const permission of permissions) {
    const resourceConfig = PERMISSION_RESOURCES[permission.resource];
    if (resourceConfig && resourceConfig.category) {
      for (const action of permission.actions) {
        if (matrix[resourceConfig.category] && action in matrix[resourceConfig.category]) {
          matrix[resourceConfig.category][action] = true;
        }
      }
    }
  }

  return matrix;
}

// Convert category matrix back to detailed permissions
export function categoryMatrixToPermissions(matrix: CategoryPermissionMatrix): Permission[] {
  const permissions: Permission[] = [];
  const resourcePermissions: Map<PermissionResource, Set<PermissionAction>> = new Map();

  for (const category of PERMISSION_CATEGORIES) {
    const categoryMatrix = matrix[category.id];
    if (!categoryMatrix) continue;

    for (const resource of category.resources) {
      if (!resourcePermissions.has(resource)) {
        resourcePermissions.set(resource, new Set());
      }

      for (const actionConfig of category.actions) {
        if (categoryMatrix[actionConfig.action]) {
          // Check if action is resource-specific
          if (actionConfig.resourceSpecific) {
            if (actionConfig.resourceSpecific.includes(resource)) {
              resourcePermissions.get(resource)!.add(actionConfig.action);
            }
          } else {
            resourcePermissions.get(resource)!.add(actionConfig.action);
          }
        }
      }
    }
  }

  // Convert map to permission array
  for (const [resource, actions] of resourcePermissions) {
    if (actions.size > 0) {
      permissions.push({
        resource,
        actions: Array.from(actions),
      });
    }
  }

  return permissions;
}

// Get permission count by category
export function getPermissionCountByCategory(permissions: Permission[]): Record<PermissionCategory, number> {
  const counts: Record<PermissionCategory, number> = {} as Record<PermissionCategory, number>;

  for (const category of PERMISSION_CATEGORIES) {
    counts[category.id] = 0;
  }

  for (const permission of permissions) {
    const resourceConfig = PERMISSION_RESOURCES[permission.resource];
    if (resourceConfig && resourceConfig.category) {
      counts[resourceConfig.category] += permission.actions.length;
    }
  }

  return counts;
}

// Check if a category has any permissions
export function categoryHasPermissions(permissions: Permission[], category: PermissionCategory): boolean {
  return permissions.some(p => {
    const resourceConfig = PERMISSION_RESOURCES[p.resource];
    return resourceConfig?.category === category && p.actions.length > 0;
  });
}
