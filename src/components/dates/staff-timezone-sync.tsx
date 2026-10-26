"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const TRIED_KEY = "ccm.tzSync";

/**
 * A staff member still on the default "UTC" gets their browser's time zone
 * saved once, silently, so sent/uploaded/message times read in their own day.
 * Renders nothing.
 */
export function StaffTimeZoneSync({ current }: { current: string }) {
  const router = useRouter();

  useEffect(() => {
    if (current !== "UTC") return;
    let browserTz = "UTC";
    try {
      browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return;
    }
    if (browserTz === "UTC") return;
    try {
      if (sessionStorage.getItem(TRIED_KEY) === browserTz) return;
      sessionStorage.setItem(TRIED_KEY, browserTz);
    } catch {
      // Storage blocked: still try once for this page load
    }
    fetch("/api/users/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: browserTz }),
    })
      .then((res) => {
        if (res.ok) router.refresh();
      })
      .catch(() => {});
  }, [current, router]);

  return null;
}
