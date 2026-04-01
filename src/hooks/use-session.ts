"use client";

import { useSession as useNextAuthSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function useSession(requireAuth: boolean = false) {
  const session = useNextAuthSession();
  const router = useRouter();

  useEffect(() => {
    if (requireAuth && session.status === "unauthenticated") {
      router.push("/login");
    }
  }, [requireAuth, session.status, router]);

  return session;
}

export function useRequireAuth() {
  return useSession(true);
}

export function useUser() {
  const { data: session } = useSession();
  return session?.user;
}
