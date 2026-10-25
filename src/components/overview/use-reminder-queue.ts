"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Send reminders through the existing POST /api/reminders/send, with Undo.
 *
 * That API sends straight away and cannot be taken back, so Undo works by
 * holding each reminder for a few seconds before it is posted. Leaving the
 * page (or closing it) while one is held sends it at once with `keepalive`,
 * so a reminder the user did not cancel is never lost.
 */

export type ReminderState = "queued" | "sending" | "sent" | "failed";

interface Job {
  key: string;
  requestIds: string[];
  name: string;
  timer: number;
}

const HOLD_MS = 5000;

// The server picks the channel (the creator's preferred contact method)
async function post(requestId: string, keepalive = false): Promise<boolean> {
  try {
    const res = await fetch("/api/reminders/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
      keepalive,
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function useReminderQueue() {
  const [states, setStates] = useState<Record<string, ReminderState>>({});
  const jobs = useRef(new Map<string, Job>());

  const mark = useCallback((ids: string[], s: ReminderState | null) => {
    setStates((prev) => {
      const next = { ...prev };
      for (const id of ids) {
        if (s) next[id] = s;
        else delete next[id];
      }
      return next;
    });
  }, []);

  const deliver = useCallback(
    async (job: Job) => {
      jobs.current.delete(job.key);
      mark(job.requestIds, "sending");
      const results = await Promise.all(job.requestIds.map((id) => post(id)));
      const failed = job.requestIds.filter((_, i) => !results[i]);
      const sent = job.requestIds.filter((_, i) => results[i]);
      if (sent.length) mark(sent, "sent");
      if (failed.length) {
        mark(failed, "failed");
        toast.error(`The reminder to ${job.name} did not send`, {
          description: "Check their email address or phone number on their profile, then try again.",
        });
      } else {
        toast(`Reminder sent to ${job.name}`);
      }
    },
    [mark]
  );

  /** Hold a reminder for a few seconds with Undo, then send it */
  const remind = useCallback(
    (opts: { key: string; requestIds: string[]; name: string }) => {
      if (jobs.current.has(opts.key) || opts.requestIds.length === 0) return;
      const job: Job = { ...opts, timer: 0 };
      job.timer = window.setTimeout(() => void deliver(job), HOLD_MS);
      jobs.current.set(opts.key, job);
      mark(opts.requestIds, "queued");
      toast(`Sending a reminder to ${opts.name}`, {
        id: `remind-${opts.key}`,
        duration: HOLD_MS,
        action: {
          label: "Undo",
          onClick: () => {
            const j = jobs.current.get(opts.key);
            if (!j) return;
            window.clearTimeout(j.timer);
            jobs.current.delete(opts.key);
            mark(j.requestIds, null);
            toast(`Reminder to ${opts.name} cancelled`);
          },
        },
      });
    },
    [deliver, mark]
  );

  // leaving the page sends whatever is still held
  useEffect(() => {
    const live = jobs.current;
    const flush = () => {
      for (const j of live.values()) {
        window.clearTimeout(j.timer);
        for (const id of j.requestIds) void post(id, true);
      }
      live.clear();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const stateOf = useCallback(
    (ids: string[]): ReminderState | null => {
      const s = ids.map((id) => states[id]);
      if (s.some((x) => x === "queued")) return "queued";
      if (s.some((x) => x === "sending")) return "sending";
      if (ids.length && s.every((x) => x === "sent")) return "sent";
      if (s.some((x) => x === "failed")) return "failed";
      return null;
    },
    [states]
  );

  return { remind, stateOf };
}
