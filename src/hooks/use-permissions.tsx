"use client";

import { useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { usePermissions as usePermissionsContext } from "@/components/providers/permission-provider";
import {
  Permission,
  PermissionAction,
  PermissionResource,
  Role,
  DataFieldVisibility,
  TeamMemberVisibility,
} from "@/types/permissions";
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canAccessCreator,
  getVisibleFields,
  getTeamMemberVisibility,
  canSeeTeamMember,
  filterCreatorData,
  filterRequestData,
  isActivityAllowed,
  getAllUserPermissions,
  isOwner,
  isAdminOrHigher,
  canManageUser,
  PermissionUser,
} from "@/lib/permissions";

// Hook return type
interface UsePermissionsReturn {
  // Loading and user state
  isLoading: boolean;
  user: PermissionUser | null;
  role: Role | null;

  // Basic permission checks
  can: (resource: PermissionResource, action: PermissionAction) => boolean;
  canAny: (checks: Array<{ resource: PermissionResource; action: PermissionAction }>) => boolean;
  canAll: (checks: Array<{ resource: PermissionResource; action: PermissionAction }>) => boolean;

  // Creator access
  canAccessCreator: (creatorId: string, creatorGroupIds?: string[]) => boolean;
  canAccessAllCreators: () => boolean;

  // Field visibility
  getCreatorFieldVisibility: () => DataFieldVisibility["creatorFields"];
  getRequestFieldVisibility: () => DataFieldVisibility["requestFields"];
  canSeeField: (type: "creator" | "request", field: string) => boolean;

  // Team visibility
  getTeamVisibility: () => TeamMemberVisibility;
  canSeeTeamMember: (memberId: string) => boolean;

  // Data filtering
  filterCreator: <T extends Record<string, unknown>>(data: T) => Partial<T>;
  filterRequest: <T extends Record<string, unknown>>(data: T) => Partial<T>;
  filterCreators: <T extends Record<string, unknown>>(data: T[]) => Partial<T>[];
  filterRequests: <T extends Record<string, unknown>>(data: T[]) => Partial<T>[];

  // Activity restrictions
  isActivityAllowed: (action?: "bulk_edit" | "export" | "delete") => {
    allowed: boolean;
    reason?: string;
  };

  // Role checks
  isOwner: () => boolean;
  isAdmin: () => boolean;
  isAdminOrHigher: () => boolean;
  canManageUser: (targetUser: { role: string; roleId?: string }) => boolean;

  // Full permissions list
  getAllPermissions: () => Permission[];

  // Convenience permission checks
  permissions: {
    // Creators
    canViewCreators: boolean;
    canCreateCreators: boolean;
    canEditCreators: boolean;
    canDeleteCreators: boolean;
    canExportCreators: boolean;

    // Requests
    canViewRequests: boolean;
    canCreateRequests: boolean;
    canEditRequests: boolean;
    canDeleteRequests: boolean;
    canApproveRequests: boolean;
    canExportRequests: boolean;

    // Uploads
    canViewUploads: boolean;
    canCreateUploads: boolean;
    canEditUploads: boolean;
    canDeleteUploads: boolean;
    canApproveUploads: boolean;
    canExportUploads: boolean;

    // Templates
    canViewTemplates: boolean;
    canCreateTemplates: boolean;
    canEditTemplates: boolean;
    canDeleteTemplates: boolean;

    // Reports
    canViewReports: boolean;
    canExportReports: boolean;

    // Settings
    canViewSettings: boolean;
    canEditSettings: boolean;

    // Team
    canViewTeam: boolean;
    canCreateTeam: boolean;
    canEditTeam: boolean;
    canDeleteTeam: boolean;

    // Billing
    canViewBilling: boolean;
    canEditBilling: boolean;

    // Integrations
    canViewIntegrations: boolean;
    canEditIntegrations: boolean;

    // Audit Log
    canViewAuditLog: boolean;
  };
}

/**
 * React hook for checking permissions in components
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { can, permissions, filterCreator } = usePermissions();
 *
 *   // Check specific permission
 *   if (can("creators", "edit")) {
 *     // Show edit button
 *   }
 *
 *   // Use pre-computed permission
 *   if (permissions.canViewReports) {
 *     // Show reports link
 *   }
 *
 *   // Filter sensitive data
 *   const filteredCreator = filterCreator(creator);
 * }
 * ```
 */
export function usePermissions(): UsePermissionsReturn {
  const { data: session, status } = useSession();
  const context = usePermissionsContext();

  const isLoading = status === "loading" || context.isLoading;

  // Build permission user from session and context
  const user: PermissionUser | null = useMemo(() => {
    if (!session?.user) return null;

    return {
      id: session.user.id,
      role: session.user.role,
      roleId: context.userRole?.id,
      agencyId: session.user.agencyId,
      customRole: context.userRole || undefined,
      permissionOverrides: context.permissionOverrides,
      assignedCreatorIds: context.assignedCreatorIds,
      activityRestrictions: context.activityRestrictions,
    };
  }, [session, context]);

  // Get custom roles from context
  const customRoles = context.customRoles;

  // Basic permission check
  const can = useCallback(
    (resource: PermissionResource, action: PermissionAction): boolean => {
      if (!user) return false;
      return hasPermission(user, resource, action, customRoles);
    },
    [user, customRoles]
  );

  // Check any of multiple permissions
  const canAny = useCallback(
    (checks: Array<{ resource: PermissionResource; action: PermissionAction }>): boolean => {
      if (!user) return false;
      return hasAnyPermission(user, checks, customRoles);
    },
    [user, customRoles]
  );

  // Check all of multiple permissions
  const canAll = useCallback(
    (checks: Array<{ resource: PermissionResource; action: PermissionAction }>): boolean => {
      if (!user) return false;
      return hasAllPermissions(user, checks, customRoles);
    },
    [user, customRoles]
  );

  // Creator access check
  const canAccessCreatorFn = useCallback(
    (creatorId: string, creatorGroupIds?: string[]): boolean => {
      if (!user) return false;
      return canAccessCreator(user, creatorId, creatorGroupIds, customRoles);
    },
    [user, customRoles]
  );

  // Check if user can access all creators
  const canAccessAllCreators = useCallback((): boolean => {
    if (!user) return false;
    const role = context.userRole;
    return role?.creatorVisibility.type === "all";
  }, [user, context.userRole]);

  // Get creator field visibility
  const getCreatorFieldVisibility = useCallback((): DataFieldVisibility["creatorFields"] => {
    if (!user) {
      return {
        email: false,
        phone: false,
        earnings: false,
        personalNotes: false,
        contracts: false,
        paymentInfo: false,
      };
    }
    return getVisibleFields(user, "creator", customRoles);
  }, [user, customRoles]);

  // Get request field visibility
  const getRequestFieldVisibility = useCallback((): DataFieldVisibility["requestFields"] => {
    if (!user) {
      return {
        internalNotes: false,
        creatorCompensation: false,
      };
    }
    return getVisibleFields(user, "request", customRoles);
  }, [user, customRoles]);

  // Check if user can see a specific field
  const canSeeField = useCallback(
    (type: "creator" | "request", field: string): boolean => {
      if (type === "creator") {
        const visibility = getCreatorFieldVisibility();
        return visibility[field as keyof typeof visibility] ?? true;
      } else {
        const visibility = getRequestFieldVisibility();
        return visibility[field as keyof typeof visibility] ?? true;
      }
    },
    [getCreatorFieldVisibility, getRequestFieldVisibility]
  );

  // Get team visibility settings
  const getTeamVisibility = useCallback((): TeamMemberVisibility => {
    if (!user) {
      return {
        canSeeOtherMembers: false,
        canSeeOtherMemberActivity: false,
        canSeeMemberEarnings: false,
      };
    }
    return getTeamMemberVisibility(user, customRoles);
  }, [user, customRoles]);

  // Check if user can see a team member
  const canSeeTeamMemberFn = useCallback(
    (memberId: string): boolean => {
      if (!user) return false;
      return canSeeTeamMember(user, memberId, customRoles);
    },
    [user, customRoles]
  );

  // Filter creator data
  const filterCreator = useCallback(
    <T extends Record<string, unknown>>(data: T): Partial<T> => {
      if (!user) return {} as Partial<T>;
      return filterCreatorData(user, data, customRoles);
    },
    [user, customRoles]
  );

  // Filter request data
  const filterRequest = useCallback(
    <T extends Record<string, unknown>>(data: T): Partial<T> => {
      if (!user) return {} as Partial<T>;
      return filterRequestData(user, data, customRoles);
    },
    [user, customRoles]
  );

  // Filter array of creators
  const filterCreators = useCallback(
    <T extends Record<string, unknown>>(data: T[]): Partial<T>[] => {
      return data.map((item) => filterCreator(item));
    },
    [filterCreator]
  );

  // Filter array of requests
  const filterRequests = useCallback(
    <T extends Record<string, unknown>>(data: T[]): Partial<T>[] => {
      return data.map((item) => filterRequest(item));
    },
    [filterRequest]
  );

  // Check activity restrictions
  const isActivityAllowedFn = useCallback(
    (action?: "bulk_edit" | "export" | "delete"): { allowed: boolean; reason?: string } => {
      if (!user) return { allowed: false, reason: "Not authenticated" };
      return isActivityAllowed(user, action);
    },
    [user]
  );

  // Role checks
  const isOwnerFn = useCallback((): boolean => {
    if (!user) return false;
    return isOwner(user);
  }, [user]);

  const isAdminFn = useCallback((): boolean => {
    if (!user) return false;
    return user.role.toLowerCase() === "admin" || user.roleId?.toLowerCase() === "admin";
  }, [user]);

  const isAdminOrHigherFn = useCallback((): boolean => {
    if (!user) return false;
    return isAdminOrHigher(user);
  }, [user]);

  const canManageUserFn = useCallback(
    (targetUser: { role: string; roleId?: string }): boolean => {
      if (!user) return false;
      return canManageUser(user, targetUser, customRoles);
    },
    [user, customRoles]
  );

  // Get all permissions
  const getAllPermissionsFn = useCallback((): Permission[] => {
    if (!user) return [];
    return getAllUserPermissions(user, customRoles);
  }, [user, customRoles]);

  // Pre-computed permissions for convenience
  const permissions = useMemo(
    () => ({
      // Creators
      canViewCreators: can("creators", "view"),
      canCreateCreators: can("creators", "create"),
      canEditCreators: can("creators", "edit"),
      canDeleteCreators: can("creators", "delete"),
      canExportCreators: can("creators", "export"),

      // Requests
      canViewRequests: can("requests", "view"),
      canCreateRequests: can("requests", "create"),
      canEditRequests: can("requests", "edit"),
      canDeleteRequests: can("requests", "delete"),
      canApproveRequests: can("requests", "approve"),
      canExportRequests: can("requests", "export"),

      // Uploads
      canViewUploads: can("uploads", "view"),
      canCreateUploads: can("uploads", "create"),
      canEditUploads: can("uploads", "edit"),
      canDeleteUploads: can("uploads", "delete"),
      canApproveUploads: can("uploads", "approve"),
      canExportUploads: can("uploads", "export"),

      // Templates
      canViewTemplates: can("templates", "view"),
      canCreateTemplates: can("templates", "create"),
      canEditTemplates: can("templates", "edit"),
      canDeleteTemplates: can("templates", "delete"),

      // Reports
      canViewReports: can("reports", "view"),
      canExportReports: can("reports", "export"),

      // Settings
      canViewSettings: can("settings", "view"),
      canEditSettings: can("settings", "edit"),

      // Team
      canViewTeam: can("team", "view"),
      canCreateTeam: can("team", "create"),
      canEditTeam: can("team", "edit"),
      canDeleteTeam: can("team", "delete"),

      // Billing
      canViewBilling: can("billing", "view"),
      canEditBilling: can("billing", "edit"),

      // Integrations
      canViewIntegrations: can("integrations", "view"),
      canEditIntegrations: can("integrations", "edit"),

      // Audit Log
      canViewAuditLog: can("audit_log", "view"),
    }),
    [can]
  );

  return {
    isLoading,
    user,
    role: context.userRole || null,

    can,
    canAny,
    canAll,

    canAccessCreator: canAccessCreatorFn,
    canAccessAllCreators,

    getCreatorFieldVisibility,
    getRequestFieldVisibility,
    canSeeField,

    getTeamVisibility,
    canSeeTeamMember: canSeeTeamMemberFn,

    filterCreator,
    filterRequest,
    filterCreators,
    filterRequests,

    isActivityAllowed: isActivityAllowedFn,

    isOwner: isOwnerFn,
    isAdmin: isAdminFn,
    isAdminOrHigher: isAdminOrHigherFn,
    canManageUser: canManageUserFn,

    getAllPermissions: getAllPermissionsFn,

    permissions,
  };
}

/**
 * HOC for protecting components based on permissions
 */
export function withPermission<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  resource: PermissionResource,
  action: PermissionAction,
  FallbackComponent?: React.ComponentType
) {
  return function WithPermissionComponent(props: P) {
    const { can, isLoading } = usePermissions();

    if (isLoading) {
      return null;
    }

    if (!can(resource, action)) {
      if (FallbackComponent) {
        return <FallbackComponent />;
      }
      return null;
    }

    return <WrappedComponent {...props} />;
  };
}

/**
 * Component that renders children only if user has permission
 */
export function PermissionGate({
  resource,
  action,
  children,
  fallback,
}: {
  resource: PermissionResource;
  action: PermissionAction;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { can, isLoading } = usePermissions();

  if (isLoading) {
    return null;
  }

  if (!can(resource, action)) {
    return fallback ?? null;
  }

  return <>{children}</>;
}

/**
 * Component that renders children only if user has any of the specified permissions
 */
export function PermissionGateAny({
  checks,
  children,
  fallback,
}: {
  checks: Array<{ resource: PermissionResource; action: PermissionAction }>;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { canAny, isLoading } = usePermissions();

  if (isLoading) {
    return null;
  }

  if (!canAny(checks)) {
    return fallback ?? null;
  }

  return <>{children}</>;
}

export default usePermissions;
