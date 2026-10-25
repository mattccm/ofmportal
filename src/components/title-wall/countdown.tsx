"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { timeLeft } from "./time";

export interface CountdownProps {
  /** Due moment. A plain "YYYY-MM-DD" is due at the end of that day. */
  due: Date | string | number;
  /** Fixed "now" (tests, server render, mocks). Without it the countdown ticks every minute. */
  now?: Date;
  /** When set, the request is finished: shows "On time" or "N days late" instead */
  completedAt?: Date | string | number | null;
  /** "sm" sits in a line of text; "lg" is the billboard's figure (40px, the largest figure allowed) */
  size?: "sm" | "lg";
  className?: string;
}

/**
 * Time left, in the wall's one rule: "3 days left", "1 d 10 h left",
 * "2 d 4 h late". Red only when overdue or under 48 hours.
 */
export function Countdown({ due, now, completedAt, size = "sm", className }: CountdownProps) {
  const [tick, setTick] = useState<Date | null>(null);

  useEffect(() => {
    if (now || completedAt) return;
    const update = () => setTick(new Date());
    update();
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, [now, completedAt]);

  if (completedAt) {
    const late = timeLeft(due, new Date(completedAt));
    const text = late.late && late.days > 0 ? `Finished ${late.days === 1 ? "1 day" : `${late.days} days`} late` : "Finished on time";
    return (
      <span className={cn("tw-countdown", className)} data-size={size} data-urgent="false">
        {text}
      </span>
    );
  }

  // Before mount (and on the server) render against `now` or the due date's
  // own clock-free fallback, so hydration matches; the effect fills it in.
  const at = now ?? tick ?? new Date();
  const t = timeLeft(due, at);

  return (
    <span
      className={cn("tw-countdown", className)}
      data-size={size}
      data-urgent={t.urgent ? "true" : "false"}
      suppressHydrationWarning
    >
      {size === "lg" ? (
        <>
          {t.parts[0]}
          <span className="tw-countdown-unit">{t.parts[1]}</span>
        </>
      ) : (
        t.text
      )}
    </span>
  );
}
