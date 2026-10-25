"use client";

import * as React from "react";
import type { PermissionKey } from "./catalogue";
import type { ClientAccess } from "./server";

/**
 * Client-side access: a convenience for hiding what someone can't use. The
 * server check is the real gate (see server.ts). The staff layout loads the
 * signed-in person's access once and provides it to the whole dashboard.
 */

export interface UseAccess extends ClientAccess {
  /** False until the provider is mounted with data (never in the dashboard) */
  ready: boolean;
  can(key: PermissionKey): boolean;
  canAny(keys: PermissionKey[]): boolean;
}

const EMPTY: ClientAccess = {
  userId: "",
  isOwner: false,
  roleId: "",
  roleName: "",
  keys: [],
  creatorScope: "all",
  teamScope: "all",
};

const Ctx = React.createContext<ClientAccess | null>(null);

export function AccessProvider({ value, children }: { value: ClientAccess; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAccess(): UseAccess {
  const value = React.useContext(Ctx);
  return React.useMemo(() => {
    const v = value ?? EMPTY;
    const set = new Set(v.keys);
    return {
      ...v,
      ready: value !== null,
      can: (k: PermissionKey) => v.isOwner || set.has(k),
      canAny: (ks: PermissionKey[]) => v.isOwner || ks.some((k) => set.has(k)),
    };
  }, [value]);
}

/**
 * Render children only when the person has the permission (or any of them).
 *   <Can perm="requests.create"><Button>New request</Button></Can>
 *   <Can perm={["review.approve", "review.requestChanges"]} fallback={null}>…</Can>
 */
export function Can({
  perm,
  fallback = null,
  children,
}: {
  perm: PermissionKey | PermissionKey[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { can, canAny } = useAccess();
  const ok = Array.isArray(perm) ? canAny(perm) : can(perm);
  return <>{ok ? children : fallback}</>;
}
