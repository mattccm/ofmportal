"use client";

import * as React from "react";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useSession } from "next-auth/react";
import {
  Role,
  Permission,
  PermissionOverride,
  ActivityRestrictions,
  DEFAULT_ROLES,
  getEffectivePermissions,
} from "@/types/permissions";
import { getRole } from "@/lib/permissions";

// Context type
interface PermissionContextType {
  // Loading state
  isLoading: boolean;
  error: string | null;

  // User's role and permissions
  userRole: Role | null;
  effectivePermissions: Permission[];
  permissionOverrides?: PermissionOverride[];
  assignedCreatorIds?: string[];
  activityRestrictions?: ActivityRestrictions;

  // Custom roles (agency-specific)
  customRoles: Role[];

  // Actions
  refreshPermissions: () => Promise<void>;
  setUserRole: (role: Role | null) => void;
}

// Create context
const PermissionContext = createContext<PermissionContextType>({
  isLoading: true,
  error: null,
  userRole: null,
  effectivePermissions: [],
  customRoles: [],
  refreshPermissions: async () => {},
  setUserRole: () => {},
});

// Hook to use permission context
export function usePermissions() {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error("usePermissions must be used within a PermissionProvider");
  }
  return context;
}

// Provider props
interface PermissionProviderProps {
  children: React.ReactNode;
}

// Permission Provider Component
export function PermissionProvider({ children }: PermissionProviderProps) {
  const { data: session, status } = useSession();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [customRoles, setCustomRoles] = useState<Role[]>([]);
  const [permissionOverrides, setPermissionOverrides] = useState<PermissionOverride[]>();
  const [assignedCreatorIds, setAssignedCreatorIds] = useState<string[]>();
  const [activityRestrictions, setActivityRestrictions] = useState<ActivityRestrictions>();

  // Fetch user permissions and custom roles
  const fetchPermissions = useCallback(async () => {
    if (status === "loading") return;

    if (!session?.user) {
      setIsLoading(false);
      setUserRole(null);
      setCustomRoles([]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch custom roles and user permissions from API
      const [rolesResponse, userPermissionsResponse] = await Promise.all([
        fetch("/api/roles"),
        fetch("/api/roles/user-permissions"),
      ]);

      // Handle roles response
      if (rolesResponse.ok) {
        const rolesData = await rolesResponse.json();
        setCustomRoles(rolesData.roles || []);
      }

      // Handle user permissions response
      if (userPermissionsResponse.ok) {
        const permissionsData = await userPermissionsResponse.json();

        if (permissionsData.role) {
          setUserRole(permissionsData.role);
        } else {
          // Fall back to default role based on session
          const defaultRole = getRole(session.user.role);
          if (defaultRole) {
            setUserRole(defaultRole);
          }
        }

        setPermissionOverrides(permissionsData.permissionOverrides);
        setAssignedCreatorIds(permissionsData.assignedCreatorIds);
        setActivityRestrictions(permissionsData.activityRestrictions);
      } else {
        // Fall back to default role
        const defaultRole = getRole(session.user.role);
        if (defaultRole) {
          setUserRole(defaultRole);
        }
      }
    } catch (err) {
      console.error("Error fetching permissions:", err);
      setError(err instanceof Error ? err.message : "Failed to load permissions");

      // Fall back to default role on error
      if (session?.user) {
        const defaultRole = getRole(session.user.role);
        if (defaultRole) {
          setUserRole(defaultRole);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [session, status]);

  // Fetch on mount and when session changes
  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Calculate effective permissions
  const effectivePermissions = useMemo(() => {
    if (!userRole) return [];
    return getEffectivePermissions(userRole.permissions, permissionOverrides);
  }, [userRole, permissionOverrides]);

  // Context value
  const value = useMemo(
    () => ({
      isLoading,
      error,
      userRole,
      effectivePermissions,
      permissionOverrides,
      assignedCreatorIds,
      activityRestrictions,
      customRoles,
      refreshPermissions: fetchPermissions,
      setUserRole,
    }),
    [
      isLoading,
      error,
      userRole,
      effectivePermissions,
      permissionOverrides,
      assignedCreatorIds,
      activityRestrictions,
      customRoles,
      fetchPermissions,
    ]
  );

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

// Higher-order component for requiring specific permissions
export function withRequiredPermission<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredPermission: { resource: string; action: string },
  options?: {
    redirectTo?: string;
    fallback?: React.ReactNode;
    showLoading?: boolean;
  }
) {
  return function WithRequiredPermissionComponent(props: P) {
    const { effectivePermissions, isLoading } = usePermissions();

    // Show loading state
    if (isLoading && options?.showLoading !== false) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      );
    }

    // Check permission
    const hasPermission = effectivePermissions.some(
      (p) =>
        p.resource === requiredPermission.resource &&
        p.actions.includes(requiredPermission.action as any)
    );

    if (!hasPermission) {
      if (options?.fallback) {
        return <>{options.fallback}</>;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <svg
              className="h-8 w-8 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-1">Access Denied</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            You don't have permission to access this feature. Contact your
            administrator if you believe this is an error.
          </p>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };
}

// Component for conditionally rendering based on permissions
interface RequirePermissionProps {
  resource: string;
  action: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showLoading?: boolean;
}

export function RequirePermission({
  resource,
  action,
  children,
  fallback,
  showLoading = false,
}: RequirePermissionProps) {
  const { effectivePermissions, isLoading } = usePermissions();

  if (isLoading && showLoading) {
    return null;
  }

  const hasPermission = effectivePermissions.some(
    (p) => p.resource === resource && p.actions.includes(action as any)
  );

  if (!hasPermission) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}

// Component for showing content only to specific roles
interface RequireRoleProps {
  roles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequireRole({ roles, children, fallback }: RequireRoleProps) {
  const { userRole, isLoading } = usePermissions();

  if (isLoading) {
    return null;
  }

  const hasRole =
    userRole && roles.some((r) => r.toLowerCase() === userRole.id.toLowerCase());

  if (!hasRole) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}

// Component for hiding content from specific roles
interface HideFromRoleProps {
  roles: string[];
  children: React.ReactNode;
}

export function HideFromRole({ roles, children }: HideFromRoleProps) {
  const { userRole, isLoading } = usePermissions();

  if (isLoading) {
    return null;
  }

  const hasRole =
    userRole && roles.some((r) => r.toLowerCase() === userRole.id.toLowerCase());

  if (hasRole) {
    return null;
  }

  return <>{children}</>;
}

// Hook for checking a single permission
export function useHasPermission(resource: string, action: string): boolean {
  const { effectivePermissions, isLoading } = usePermissions();

  if (isLoading) {
    return false;
  }

  return effectivePermissions.some(
    (p) => p.resource === resource && p.actions.includes(action as any)
  );
}

// Hook for checking multiple permissions
export function useHasAnyPermission(
  checks: Array<{ resource: string; action: string }>
): boolean {
  const { effectivePermissions, isLoading } = usePermissions();

  if (isLoading) {
    return false;
  }

  return checks.some((check) =>
    effectivePermissions.some(
      (p) => p.resource === check.resource && p.actions.includes(check.action as any)
    )
  );
}

// Hook for checking if user has all specified permissions
export function useHasAllPermissions(
  checks: Array<{ resource: string; action: string }>
): boolean {
  const { effectivePermissions, isLoading } = usePermissions();

  if (isLoading) {
    return false;
  }

  return checks.every((check) =>
    effectivePermissions.some(
      (p) => p.resource === check.resource && p.actions.includes(check.action as any)
    )
  );
}

// Hook for getting user's role
export function useUserRole(): Role | null {
  const { userRole } = usePermissions();
  return userRole;
}

// Hook for checking if user is admin or higher
export function useIsAdmin(): boolean {
  const { userRole, isLoading } = usePermissions();

  if (isLoading || !userRole) {
    return false;
  }

  const adminRoles = ["owner", "admin"];
  return adminRoles.includes(userRole.id.toLowerCase());
}

// Hook for checking if user is owner
export function useIsOwner(): boolean {
  const { userRole, isLoading } = usePermissions();

  if (isLoading || !userRole) {
    return false;
  }

  return userRole.id.toLowerCase() === "owner";
}

export default PermissionProvider;
