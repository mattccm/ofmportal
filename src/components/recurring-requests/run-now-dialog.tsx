"use client";

import * as React from "react";
import { Loader2, Play, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatStamp } from "@/components/title-wall/time";
import { useViewerTimeZone } from "@/components/title-wall/viewer-time";

interface RunCreator {
  id: string;
  name: string;
  avatar: string | null;
}

interface RunInfo {
  creators: RunCreator[];
  templateCount: number;
  nextRunAt: string | null;
}

/** Above this many creators the list gets a search box */
const SEARCH_FROM = 8;

/**
 * Run now, for the creators you pick. Everyone on the schedule is ticked to
 * start; untick some and it's a one-off for the rest, the schedule unchanged.
 */
export function RunNowDialog({
  schedule,
  onOpenChange,
  onDone,
}: {
  /** The schedule to run; null closes the dialog */
  schedule: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
  /** After a run that made requests */
  onDone: () => void;
}) {
  const tz = useViewerTimeZone();
  const [info, setInfo] = React.useState<RunInfo | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [query, setQuery] = React.useState("");
  const [running, setRunning] = React.useState(false);

  const scheduleId = schedule?.id;
  const load = React.useCallback(async () => {
    if (!scheduleId) return;
    setInfo(null);
    setLoadError(null);
    try {
      const res = await fetch(`/api/recurring-requests/${scheduleId}/run`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "The creators could not be loaded.");
      setInfo(data);
      setPicked(new Set((data as RunInfo).creators.map((c) => c.id)));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "The creators could not be loaded.");
    }
  }, [scheduleId]);

  React.useEffect(() => {
    if (scheduleId) {
      setQuery("");
      load();
    }
  }, [scheduleId, load]);

  const creators = React.useMemo(() => info?.creators ?? [], [info]);
  const total = creators.length;
  const count = picked.size;
  const everyone = total > 0 && count === total;
  const requests = count * (info?.templateCount ?? 0);
  const shown = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? creators.filter((c) => c.name.toLowerCase().includes(q)) : creators;
  }, [creators, query]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const run = async () => {
    if (!schedule || count === 0) return;
    setRunning(true);
    try {
      const res = await fetch(`/api/recurring-requests/${schedule.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Everyone: a normal run, so the schedule moves on. Some: a one-off.
        body: JSON.stringify(everyone ? {} : { creatorIds: [...picked] }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) {
        toast.error(result.error || "The requests could not be sent. Try again.");
        return;
      }
      const made = `${result.successCount} ${result.successCount === 1 ? "request" : "requests"}`;
      const to = `${result.creatorCount} ${result.creatorCount === 1 ? "creator" : "creators"}`;
      toast.success(
        result.oneOff ? `Sent ${made} to ${to}. The schedule's next run is unchanged.` : `Sent ${made} to ${to}`
      );
      if (result.failedCount > 0) toast.error(`${result.failedCount} could not be made. See the run history.`);
      onDone();
      onOpenChange(false);
    } catch {
      toast.error("The requests could not be sent. Check your connection and try again.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={!!schedule} onOpenChange={(open) => !running && onOpenChange(open)}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col">
        <DialogHeader>
          <DialogTitle>Run &ldquo;{schedule?.name}&rdquo; now</DialogTitle>
          <DialogDescription>
            {info
              ? `Each creator you pick gets ${info.templateCount === 1 ? "its request" : `its ${info.templateCount} requests`} now.`
              : "Pick who gets this run's requests now."}
          </DialogDescription>
        </DialogHeader>

        {loadError ? (
          <div className="space-y-3 rounded-[var(--tw-r-ctl)] bg-tile p-4">
            <p className="text-sm">{loadError}</p>
            <Button variant="outline" size="sm" onClick={load}>
              Try again
            </Button>
          </div>
        ) : !info ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading creators">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : total === 0 ? (
          <p className="rounded-[var(--tw-r-ctl)] bg-tile p-4 text-sm">
            No creators are on this schedule. Edit it to pick some.
          </p>
        ) : (
          <div className="flex min-h-0 flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium tabular-nums" aria-live="polite">
                {count} of {total} {total === 1 ? "creator" : "creators"}
              </p>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setPicked(new Set(creators.map((c) => c.id)))} disabled={everyone || running}>
                  Pick all
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setPicked(new Set())} disabled={count === 0 || running}>
                  Clear
                </Button>
              </div>
            </div>

            {total > SEARCH_FROM && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-icon" aria-hidden="true" />
                <Input
                  aria-label="Find a creator"
                  placeholder="Find a creator"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}

            <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto" aria-label="Creators on this schedule">
              {shown.length === 0 ? (
                <li className="p-3 text-sm text-ink-2">No creator matches</li>
              ) : (
                shown.map((c) => {
                  const on = picked.has(c.id);
                  return (
                    <li key={c.id}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--tw-r-ctl)] px-3 py-2 transition-colors [@media(hover:hover)]:hover:bg-tile">
                        <Checkbox checked={on} onCheckedChange={() => toggle(c.id)} disabled={running} aria-label={c.name} />
                        <Avatar size="sm" user={{ name: c.name, image: c.avatar }} />
                        <span className="min-w-0 flex-1 truncate text-[15px]">{c.name}</span>
                      </label>
                    </li>
                  );
                })
              )}
            </ul>

            {count > 0 && !everyone && (
              <p className="text-[13px] text-ink-2">
                A one-off for {count === 1 ? "this creator" : "these creators"}. The schedule&apos;s next run still goes to
                everyone{info.nextRunAt ? ` on ${formatStamp(info.nextRunAt, tz)}` : ""}.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>
            Cancel
          </Button>
          <Button onClick={run} disabled={!info || count === 0 || running}>
            {running ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />}
            {running
              ? "Sending…"
              : count === 0
                ? "Pick a creator"
                : `Send ${requests} ${requests === 1 ? "request" : "requests"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
