"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  History,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Loader2,
  RefreshCw,
  Filter,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type {
  DuplicateHistoryEntry,
  DuplicatePattern,
} from "@/types/content-fingerprint";

export interface DuplicateHistoryProps {
  /**
   * Creator ID to fetch history for
   */
  creatorId: string;

  /**
   * API endpoint for fetching history
   */
  apiEndpoint?: string;

  /**
   * Initial data (for SSR)
   */
  initialData?: DuplicateHistoryEntry[];

  /**
   * Custom class name
   */
  className?: string;

  /**
   * Whether to show pattern detection
   */
  showPatterns?: boolean;

  /**
   * Maximum entries to display
   */
  maxEntries?: number;
}

type ActionFilter = "all" | "blocked" | "warned" | "allowed" | "overridden";
type TimeFilter = "7d" | "30d" | "90d" | "all";

const OVERRIDE_REASON_LABELS: Record<string, string> = {
  different_angle: "Different angle",
  different_lighting: "Different lighting",
  different_edit: "Different edit",
  retake: "Retake",
  different_version: "New version",
  intentional_duplicate: "Intentional",
  false_positive: "False positive",
  other: "Other",
};

export function DuplicateHistory({
  creatorId,
  apiEndpoint = "/api/uploads/duplicate-history",
  initialData,
  className,
  showPatterns = true,
  maxEntries = 50,
}: DuplicateHistoryProps) {
  const [history, setHistory] = useState<DuplicateHistoryEntry[]>(
    initialData || []
  );
  const [patterns, setPatterns] = useState<DuplicatePattern[]>([]);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("30d");
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(
    new Set()
  );

  // Fetch history
  useEffect(() => {
    if (initialData) return;

    const fetchHistory = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          creatorId,
          limit: maxEntries.toString(),
          ...(timeFilter !== "all" && { timeFilter }),
        });

        const response = await fetch(`${apiEndpoint}?${params}`);
        if (!response.ok) throw new Error("Failed to fetch history");

        const data = await response.json();
        setHistory(data.history || []);
        if (showPatterns) {
          setPatterns(data.patterns || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [creatorId, apiEndpoint, maxEntries, timeFilter, initialData, showPatterns]);

  // Filter history
  const filteredHistory = history.filter((entry) => {
    if (actionFilter !== "all" && entry.action !== actionFilter) {
      return false;
    }
    return true;
  });

  // Calculate stats
  const stats = {
    total: history.length,
    blocked: history.filter((e) => e.action === "blocked").length,
    warned: history.filter((e) => e.action === "warned").length,
    allowed: history.filter((e) => e.action === "allowed").length,
    overridden: history.filter((e) => e.action === "overridden").length,
  };

  const toggleExpanded = (id: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Duplicate History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Duplicate History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
            <p>{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="mt-3"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Duplicate History
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select
              value={timeFilter}
              onValueChange={(val) => setTimeFilter(val as TimeFilter)}
            >
              <SelectTrigger className="w-28 h-8 text-xs">
                <Calendar className="h-3.5 w-3.5 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 days</SelectItem>
                <SelectItem value="30d">30 days</SelectItem>
                <SelectItem value="90d">90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={actionFilter}
              onValueChange={(val) => setActionFilter(val as ActionFilter)}
            >
              <SelectTrigger className="w-28 h-8 text-xs">
                <Filter className="h-3.5 w-3.5 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
                <SelectItem value="warned">Warned</SelectItem>
                <SelectItem value="allowed">Allowed</SelectItem>
                <SelectItem value="overridden">Overridden</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats summary */}
        <div className="grid grid-cols-4 gap-2">
          <StatBadge
            icon={ShieldAlert}
            label="Blocked"
            count={stats.blocked}
            color="red"
          />
          <StatBadge
            icon={AlertTriangle}
            label="Warned"
            count={stats.warned}
            color="amber"
          />
          <StatBadge
            icon={Check}
            label="Overridden"
            count={stats.overridden}
            color="blue"
          />
          <StatBadge
            icon={ShieldCheck}
            label="Allowed"
            count={stats.allowed}
            color="emerald"
          />
        </div>

        {/* Pattern detection warnings */}
        {showPatterns && patterns.length > 0 && (
          <div className="space-y-2">
            {patterns.map((pattern, index) => (
              <PatternWarning key={index} pattern={pattern} />
            ))}
          </div>
        )}

        {/* History list */}
        {filteredHistory.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Copy className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No duplicate attempts recorded</p>
            <p className="text-xs mt-1">
              {actionFilter !== "all"
                ? "Try changing the filter"
                : "Your upload history looks clean!"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredHistory.map((entry) => (
              <HistoryEntry
                key={entry.id}
                entry={entry}
                isExpanded={expandedEntries.has(entry.id)}
                onToggle={() => toggleExpanded(entry.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Stats badge component
 */
function StatBadge({
  icon: Icon,
  label,
  count,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  color: "red" | "amber" | "blue" | "emerald";
}) {
  const colorClasses = {
    red: "bg-red-50 text-red-700 border-red-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center p-2 rounded-lg border",
        colorClasses[color]
      )}
    >
      <Icon className="h-4 w-4 mb-1" />
      <span className="text-lg font-semibold">{count}</span>
      <span className="text-xs">{label}</span>
    </div>
  );
}

/**
 * Pattern warning component
 */
function PatternWarning({ pattern }: { pattern: DuplicatePattern }) {
  const severityColors = {
    low: "border-yellow-200 bg-yellow-50 text-yellow-800",
    medium: "border-amber-200 bg-amber-50 text-amber-800",
    high: "border-red-200 bg-red-50 text-red-800",
  };

  const patternLabels = {
    repeated_exact: "Repeated exact duplicates detected",
    repeated_near: "Multiple similar uploads detected",
    bulk_duplicates: "Bulk duplicate pattern detected",
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border",
        severityColors[pattern.severity]
      )}
    >
      <TrendingUp className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">
          {patternLabels[pattern.patternType]}
        </p>
        <p className="text-xs mt-1 opacity-80">
          {pattern.occurrenceCount} occurrences since{" "}
          {format(new Date(pattern.firstOccurrence), "MMM d, yyyy")}
        </p>
      </div>
      <Badge
        variant="secondary"
        className={cn(
          "shrink-0",
          pattern.severity === "high" && "bg-red-200",
          pattern.severity === "medium" && "bg-amber-200",
          pattern.severity === "low" && "bg-yellow-200"
        )}
      >
        {pattern.severity}
      </Badge>
    </div>
  );
}

/**
 * Individual history entry component
 */
function HistoryEntry({
  entry,
  isExpanded,
  onToggle,
}: {
  entry: DuplicateHistoryEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const actionIcons = {
    blocked: ShieldAlert,
    warned: AlertTriangle,
    allowed: ShieldCheck,
    overridden: Check,
  };

  const actionColors = {
    blocked: "text-red-600 bg-red-50 border-red-200",
    warned: "text-amber-600 bg-amber-50 border-amber-200",
    allowed: "text-emerald-600 bg-emerald-50 border-emerald-200",
    overridden: "text-blue-600 bg-blue-50 border-blue-200",
  };

  const Icon = actionIcons[entry.action];

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div
        className={cn(
          "rounded-lg border transition-colors",
          actionColors[entry.action]
        )}
      >
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-black/5 transition-colors">
            <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium capitalize">
                  {entry.action}
                </span>
                <Badge variant="outline" className="text-xs">
                  {entry.matchConfidence}% match
                </Badge>
                <Badge variant="outline" className="text-xs capitalize">
                  {entry.matchType}
                </Badge>
              </div>
              <p className="text-xs opacity-70 mt-0.5">
                {format(new Date(entry.attemptedAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0" />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 space-y-2 border-t border-current/10 mt-1">
            <div className="text-xs space-y-1 pt-2">
              <p>
                <span className="opacity-70">Upload ID:</span>{" "}
                <code className="bg-white/50 px-1 rounded">
                  {entry.uploadId}
                </code>
              </p>
              <p>
                <span className="opacity-70">Matched with:</span>{" "}
                {entry.matchedUploadIds.length} file
                {entry.matchedUploadIds.length > 1 ? "s" : ""}
              </p>
              {entry.overrideReason && (
                <p>
                  <span className="opacity-70">Override reason:</span>{" "}
                  {OVERRIDE_REASON_LABELS[entry.overrideReason] ||
                    entry.overrideReason}
                </p>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

/**
 * Compact version for sidebars
 */
export function CompactDuplicateHistory({
  history,
  className,
}: {
  history: DuplicateHistoryEntry[];
  className?: string;
}) {
  const recentBlocked = history
    .filter((e) => e.action === "blocked")
    .slice(0, 3);

  if (recentBlocked.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        <ShieldAlert className="h-3.5 w-3.5" />
        Recent blocked duplicates
      </p>
      {recentBlocked.map((entry) => (
        <div
          key={entry.id}
          className="text-xs p-2 rounded bg-red-50 border border-red-100"
        >
          <div className="flex items-center justify-between">
            <span className="text-red-700 font-medium">
              {entry.matchConfidence}% match
            </span>
            <span className="text-red-600 opacity-70">
              {format(new Date(entry.attemptedAt), "MMM d")}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default DuplicateHistory;
