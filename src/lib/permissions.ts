import {
  Permission,
  PermissionAction,
  PermissionResource,
  Role,
  TeamMember,
  CreatorVisibility,
  DataFieldVisibility,
  TeamMemberVisibility,
  PermissionOverride,
  ActivityRestrictions,
  TemplateVisibility,
  DEFAULT_ROLES,
  getEffectivePermissions,
  hasPermissionInList,
} from "@/types/permissions";

// User type expected by permission functions
export interface PermissionUser {
  id: string;
  role: string;
  roleId?: string;
  agencyId: string;
  customRole?: Role;
  permissionOverrides?: PermissionOverride[];
  assignedCreatorIds?: string[];
  templateVisibility?: TemplateVisibility;
  activityRestrictions?: ActivityRestrictions;
}

// Get role by ID or name
export function getRole(roleIdOrName: string, customRoles?: Role[]): Role | undefined {
  // First check default roles
  const defaultRole = DEFAULT_ROLES.find(
    (r) => r.id === roleIdOrName.toLowerCase() || r.name.toLowerCase() === roleIdOrName.toLowerCase()
  );

  if (defaultRole) {
    return {
      ...defaultRole,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Role;
  }

  // Then check custom roles
  return customRoles?.find((r) => r.id === roleIdOrName || r.name === roleIdOrName);
}

// Get user's effective role
export function getUserRole(user: PermissionUser, customRoles?: Role[]): Role | undefined {
  if (user.customRole) {
    return user.customRole;
  }

  return getRole(user.roleId || user.role, customRoles);
}

// Main permission check function
export function hasPermission(
  user: PermissionUser,
  resource: PermissionResource,
  action: PermissionAction,
  customRoles?: Role[]
): boolean {
  const role = getUserRole(user, customRoles);

  if (!role) {
    return false;
  }

  // Get effective permissions with overrides
  const effectivePermissions = getEffectivePermissions(
    role.permissions,
    user.permissionOverrides
  );

  return hasPermissionInList(effectivePermissions, resource, action);
}

// Check multiple permissions at once
export function hasAnyPermission(
  user: PermissionUser,
  checks: Array<{ resource: PermissionResource; action: PermissionAction }>,
  customRoles?: Role[]
): boolean {
  return checks.some((check) => hasPermission(user, check.resource, check.action, customRoles));
}

// Check all permissions
export function hasAllPermissions(
  user: PermissionUser,
  checks: Array<{ resource: PermissionResource; action: PermissionAction }>,
  customRoles?: Role[]
): boolean {
  return checks.every((check) => hasPermission(user, check.resource, check.action, customRoles));
}

// Check if user can access a specific creator
export function canAccessCreator(
  user: PermissionUser,
  creatorId: string,
  creatorGroupIds?: string[],
  customRoles?: Role[]
): boolean {
  const role = getUserRole(user, customRoles);

  if (!role) {
    return false;
  }

  // First check if user has view permission for creators
  if (!hasPermission(user, "creators", "view", customRoles)) {
    return false;
  }

  const visibility = role.creatorVisibility;

  switch (visibility.type) {
    case "all":
      return true;

    case "assigned":
      // Check if creator is in user's assigned list
      return user.assignedCreatorIds?.includes(creatorId) ?? false;

    case "groups":
      // Check if creator belongs to any of the allowed groups
      if (!visibility.groupIds || !creatorGroupIds) {
        return false;
      }
      return visibility.groupIds.some((groupId) => creatorGroupIds.includes(groupId));

    case "specific":
      // Check if creator is in the specific list
      return visibility.creatorIds?.includes(creatorId) ?? false;

    default:
      return false;
  }
}

// Get visible fields for a resource
export function getVisibleFields<T extends "creator" | "request">(
  user: PermissionUser,
  resourceType: T,
  customRoles?: Role[]
): T extends "creator"
  ? DataFieldVisibility["creatorFields"]
  : DataFieldVisibility["requestFields"] {
  const role = getUserRole(user, customRoles);

  if (!role) {
    // Return all fields hidden if no role
    if (resourceType === "creator") {
      return {
        email: false,
        phone: false,
        earnings: false,
        personalNotes: false,
        contracts: false,
        paymentInfo: false,
      } as T extends "creator"
        ? DataFieldVisibility["creatorFields"]
        : DataFieldVisibility["requestFields"];
    }
    return {
      internalNotes: false,
      creatorCompensation: false,
    } as T extends "creator"
      ? DataFieldVisibility["creatorFields"]
      : DataFieldVisibility["requestFields"];
  }

  if (resourceType === "creator") {
    return role.dataFieldVisibility.creatorFields as T extends "creator"
      ? DataFieldVisibility["creatorFields"]
      : DataFieldVisibility["requestFields"];
  }

  return role.dataFieldVisibility.requestFields as T extends "creator"
    ? DataFieldVisibility["creatorFields"]
    : DataFieldVisibility["requestFields"];
}

// Get team member visibility settings
export function getTeamMemberVisibility(
  user: PermissionUser,
  customRoles?: Role[]
): TeamMemberVisibility {
  const role = getUserRole(user, customRoles);

  if (!role) {
    return {
      canSeeOtherMembers: false,
      canSeeOtherMemberActivity: false,
      canSeeMemberEarnings: false,
    };
  }

  return role.teamMemberVisibility;
}

// Check if user can access a specific template
export function canAccessTemplate(
  user: PermissionUser,
  templateId: string
): boolean {
  const visibility = user.templateVisibility;

  // No visibility restrictions means access all
  if (!visibility || visibility.type === "all") {
    return true;
  }

  const templateIds = visibility.templateIds || [];

  switch (visibility.type) {
    case "include":
      // Can only see templates in the include list
      return templateIds.includes(templateId);

    case "exclude":
      // Can see all except excluded templates
      return !templateIds.includes(templateId);

    default:
      return true;
  }
}

// Filter templates by user's visibility settings
export function filterTemplatesByVisibility<T extends { id: string }>(
  user: PermissionUser,
  templates: T[]
): T[] {
  const visibility = user.templateVisibility;

  // No visibility restrictions means access all
  if (!visibility || visibility.type === "all") {
    return templates;
  }

  const templateIds = visibility.templateIds || [];

  switch (visibility.type) {
    case "include":
      // Only return templates in the include list
      return templates.filter((t) => templateIds.includes(t.id));

    case "exclude":
      // Return all except excluded templates
      return templates.filter((t) => !templateIds.includes(t.id));

    default:
      return templates;
  }
}

// Check if user can see another team member
export function canSeeTeamMember(
  user: PermissionUser,
  memberId: string,
  customRoles?: Role[]
): boolean {
  if (user.id === memberId) {
    return true; // Always can see self
  }

  const visibility = getTeamMemberVisibility(user, customRoles);

  if (!visibility.canSeeOtherMembers) {
    return false;
  }

  if (visibility.visibleMemberIds) {
    return visibility.visibleMemberIds.includes(memberId);
  }

  return true;
}

// Filter data by permissions - removes fields user shouldn't see
export function filterCreatorData<T extends Record<string, unknown>>(
  user: PermissionUser,
  creator: T,
  customRoles?: Role[]
): Partial<T> {
  const visibleFields = getVisibleFields(user, "creator", customRoles);
  const result: Partial<T> = { ...creator };

  // Map of fields to their visibility keys
  const fieldMapping: Record<string, keyof typeof visibleFields> = {
    email: "email",
    phone: "phone",
    phoneNumber: "phone",
    earnings: "earnings",
    totalEarnings: "earnings",
    personalNotes: "personalNotes",
    notes: "personalNotes",
    contracts: "contracts",
    contractUrl: "contracts",
    paymentInfo: "paymentInfo",
    paymentDetails: "paymentInfo",
    bankInfo: "paymentInfo",
  };

  for (const [field, visibilityKey] of Object.entries(fieldMapping)) {
    if (field in result && !visibleFields[visibilityKey]) {
      delete result[field as keyof T];
    }
  }

  return result;
}

// Filter request data by permissions
export function filterRequestData<T extends Record<string, unknown>>(
  user: PermissionUser,
  request: T,
  customRoles?: Role[]
): Partial<T> {
  const visibleFields = getVisibleFields(user, "request", customRoles);
  const result: Partial<T> = { ...request };

  const fieldMapping: Record<string, keyof typeof visibleFields> = {
    internalNotes: "internalNotes",
    creatorCompensation: "creatorCompensation",
    compensation: "creatorCompensation",
    payment: "creatorCompensation",
    budget: "creatorCompensation",
  };

  for (const [field, visibilityKey] of Object.entries(fieldMapping)) {
    if (field in result && !visibleFields[visibilityKey]) {
      delete result[field as keyof T];
    }
  }

  return result;
}

// Filter array of data by permissions
export function filterDataByPermissions<T extends Record<string, unknown>>(
  user: PermissionUser,
  data: T[],
  resourceType: "creator" | "request",
  customRoles?: Role[]
): Partial<T>[] {
  const filterFn = resourceType === "creator" ? filterCreatorData : filterRequestData;
  return data.map((item) => filterFn(user, item, customRoles));
}

// Check activity restrictions
export function isActivityAllowed(
  user: PermissionUser,
  action?: "bulk_edit" | "export" | "delete"
): { allowed: boolean; reason?: string } {
  const restrictions = user.activityRestrictions;

  if (!restrictions) {
    return { allowed: true };
  }

  // Check time-based restrictions
  if (restrictions.allowedHours) {
    const now = new Date();
    const hour = now.getHours();
    const { start, end } = restrictions.allowedHours;

    if (start <= end) {
      // Same day range (e.g., 9-17)
      if (hour < start || hour >= end) {
        return {
          allowed: false,
          reason: `Access is only allowed between ${start}:00 and ${end}:00`,
        };
      }
    } else {
      // Overnight range (e.g., 22-6)
      if (hour >= end && hour < start) {
        return {
          allowed: false,
          reason: `Access is only allowed between ${start}:00 and ${end}:00`,
        };
      }
    }
  }

  // Check day-based restrictions
  if (restrictions.allowedDays) {
    const today = new Date().getDay();
    if (!restrictions.allowedDays.includes(today)) {
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const allowedDayNames = restrictions.allowedDays.map((d) => dayNames[d]).join(", ");
      return {
        allowed: false,
        reason: `Access is only allowed on ${allowedDayNames}`,
      };
    }
  }

  // Check specific action restrictions
  if (action) {
    switch (action) {
      case "bulk_edit":
        if (restrictions.canBulkEdit === false) {
          return { allowed: false, reason: "Bulk editing is not allowed" };
        }
        break;
      case "export":
        if (restrictions.canExport === false) {
          return { allowed: false, reason: "Exporting is not allowed" };
        }
        break;
      case "delete":
        if (restrictions.canDelete === false) {
          return { allowed: false, reason: "Deleting is not allowed" };
        }
        break;
    }
  }

  return { allowed: true };
}

// Get all permissions for a user (for display purposes)
export function getAllUserPermissions(
  user: PermissionUser,
  customRoles?: Role[]
): Permission[] {
  const role = getUserRole(user, customRoles);

  if (!role) {
    return [];
  }

  return getEffectivePermissions(role.permissions, user.permissionOverrides);
}

// Check if user is owner
export function isOwner(user: PermissionUser): boolean {
  return user.role.toLowerCase() === "owner" || user.roleId?.toLowerCase() === "owner";
}

// Check if user is admin or higher
export function isAdminOrHigher(user: PermissionUser): boolean {
  const adminRoles = ["owner", "admin"];
  return (
    adminRoles.includes(user.role.toLowerCase()) ||
    (user.roleId ? adminRoles.includes(user.roleId.toLowerCase()) : false)
  );
}

// Check if user can manage another user
export function canManageUser(
  user: PermissionUser,
  targetUser: { role: string; roleId?: string },
  customRoles?: Role[]
): boolean {
  // Must have team edit permission
  if (!hasPermission(user, "team", "edit", customRoles)) {
    return false;
  }

  // Owner can manage anyone
  if (isOwner(user)) {
    return true;
  }

  // Admin can manage non-owners and non-admins
  if (isAdminOrHigher(user)) {
    const targetRole = targetUser.roleId?.toLowerCase() || targetUser.role.toLowerCase();
    return !["owner", "admin"].includes(targetRole);
  }

  // Others can only manage viewers
  const targetRole = targetUser.roleId?.toLowerCase() || targetUser.role.toLowerCase();
  return targetRole === "viewer";
}

// Validate role permissions (for creation/editing)
export function validateRolePermissions(permissions: Permission[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check for dangerous permission combinations
  const hasBillingDelete = permissions.some(
    (p) => p.resource === "billing" && p.actions.includes("delete")
  );
  if (hasBillingDelete) {
    errors.push("Billing delete permission is restricted to system roles");
  }

  const hasTeamDelete = permissions.some(
    (p) => p.resource === "team" && p.actions.includes("delete")
  );
  const hasSettingsDelete = permissions.some(
    (p) => p.resource === "settings" && p.actions.includes("delete")
  );
  if (hasTeamDelete && hasSettingsDelete) {
    errors.push("Combined team and settings delete permissions require admin approval");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Create a permission summary for display
export function getPermissionSummary(permissions: Permission[]): string[] {
  const summaries: string[] = [];

  const resourceLabels: Record<PermissionResource, string> = {
    creators: "Creators",
    requests: "Requests",
    uploads: "Uploads",
    templates: "Templates",
    reports: "Reports",
    settings: "Settings",
    team: "Team",
    billing: "Billing",
    integrations: "Integrations",
    audit_log: "Audit Log",
    analytics: "Analytics",
  };

  for (const permission of permissions) {
    const label = resourceLabels[permission.resource];
    const actions = permission.actions.join(", ");
    summaries.push(`${label}: ${actions}`);
  }

  return summaries;
}

// Export commonly used permission checks as convenience functions
export const permissionChecks = {
  canViewCreators: (user: PermissionUser, roles?: Role[]) =>
    hasPermission(user, "creators", "view", roles),
  canCreateCreators: (user: PermissionUser, roles?: Role[]) =>
    hasPermission(user, "creators", "create", roles),
  canEditCreators: (user: PermissionUser, roles?: Role[]) =>
    hasPermission(user, "creators", "edit", roles),
  canDeleteCreators: (user: PermissionUser, roles?: Role[]) =>
    hasPermission(user, "creators", "delete", roles),

  canViewRequests: (user: PermissionUser, roles?: Role[]) =>
    hasPermission(user, "requests", "view", roles),
  canCreateRequests: (user: PermissionUser, roles?: Role[]) =>
    hasPermission(user, "requests", "create", roles),
  canEditRequests: (user: PermissionUser, roles?: Role[]) =>
    hasPermission(user, "requests", "edit", roles),
  canApproveRequests: (user: PermissionUser, roles?: Role[]) =>
    hasPermission(user, "requests", "approve", roles),

  canViewUploads: (user: PermissionUser, roles?: Role[]) =>
    hasPermission(user, "uploads", "view", roles),
  canApproveUploads: (user: PermissionUser, roles?: Role[]) =>
    hasPermission(user, "uploads", "approve", roles),
  canExportUploads: (user: PermissionUser, roles?: Role[]) =>
    hasPermission(user, "uploads", "export", roles),

  canViewTeam: (user: PermissionUser, roles?: Role[]) =>
    hasPermission(user, "team", "view", roles),
  canManageTeam: (user: PermissionUser, roles?: Role[]) =>
    hasPermission(user, "team", "edit", roles),

  canViewSettings: (user: PermissionUser, roles?: Role[]) =>
    hasPermission(user, "settings", "view", roles),
  canEditSettings: (user: PermissionUser, roles?: Role[]) =>
    hasPermission(user, "settings", "edit", roles),

  canViewBilling: (user: PermissionUser, roles?: Role[]) =>
    hasPermission(user, "billing", "view", roles),
  canManageBilling: (user: PermissionUser, roles?: Role[]) =>
    hasPermission(user, "billing", "edit", roles),

  canViewReports: (user: PermissionUser, roles?: Role[]) =>
    hasPermission(user, "reports", "view", roles),
  canExportReports: (user: PermissionUser, roles?: Role[]) =>
    hasPermission(user, "reports", "export", roles),

  canViewAuditLog: (user: PermissionUser, roles?: Role[]) =>
    hasPermission(user, "audit_log", "view", roles),

  canViewTemplates: (user: PermissionUser, roles?: Role[]) =>
    hasPermission(user, "templates", "view", roles),
  canCreateTemplates: (user: PermissionUser, roles?: Role[]) =>
    hasPermission(user, "templates", "create", roles),
  canEditTemplates: (user: PermissionUser, roles?: Role[]) =>
    hasPermission(user, "templates", "edit", roles),
  canDeleteTemplates: (user: PermissionUser, roles?: Role[]) =>
    hasPermission(user, "templates", "delete", roles),
};
