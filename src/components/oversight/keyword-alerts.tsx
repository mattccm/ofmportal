"use client";

import * as React from "react";
import {
  Bell,
  ChevronRight,
  Flag,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type KeywordAlert } from "@/types/oversight";
import { cn } from "@/lib/utils";

interface ConfiguredKeyword {
  keyword: string;
  category: string;
  priority: "low" | "medium" | "high";
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case "high":
      return "text-red-600 bg-red-100 dark:bg-red-900/30";
    case "medium":
      return "text-orange-600 bg-orange-100 dark:bg-orange-900/30";
    case "low":
      return "text-blue-600 bg-blue-100 dark:bg-blue-900/30";
    default:
      return "text-gray-600 bg-gray-100 dark:bg-gray-900/30";
  }
}

export function KeywordAlerts() {
  const [isLoading, setIsLoading] = React.useState(true);
  const [alerts, setAlerts] = React.useState<KeywordAlert[]>([]);
  const [keywords, setKeywords] = React.useState<ConfiguredKeyword[]>([]);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [showKeywordConfig, setShowKeywordConfig] = React.useState(false);

  // Config dialog working state
  const [draftKeywords, setDraftKeywords] = React.useState<ConfiguredKeyword[]>([]);
  const [newKeyword, setNewKeyword] = React.useState("");
  const [newPriority, setNewPriority] = React.useState<"low" | "medium" | "high">(
    "medium"
  );
  const [isSaving, setIsSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/oversight?type=keywords");
      if (res.ok) {
        const data = await res.json();
        setKeywords(data.keywords || []);
        setAlerts(
          (data.alerts || []).map((a: KeywordAlert) => ({
            ...a,
            timestamp: new Date(a.timestamp),
          }))
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const filteredAlerts = React.useMemo(() => {
    let result = [...alerts];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.keyword.toLowerCase().includes(query) ||
          a.senderName.toLowerCase().includes(query) ||
          a.messagePreview.toLowerCase().includes(query)
      );
    }
    return result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [alerts, searchQuery]);

  const stats = React.useMemo(
    () => ({
      totalAlerts: alerts.length,
      staffCreatorAlerts: alerts.filter(
        (a) => a.conversationType === "staff_creator"
      ).length,
      internalAlerts: alerts.filter((a) => a.conversationType === "staff_staff")
        .length,
      totalKeywords: keywords.length,
    }),
    [alerts, keywords]
  );

  const openConfig = () => {
    setDraftKeywords(keywords.map((k) => ({ ...k })));
    setNewKeyword("");
    setNewPriority("medium");
    setShowKeywordConfig(true);
  };

  const addDraftKeyword = () => {
    const kw = newKeyword.trim();
    if (!kw) return;
    if (draftKeywords.some((k) => k.keyword.toLowerCase() === kw.toLowerCase())) {
      setNewKeyword("");
      return;
    }
    setDraftKeywords([
      ...draftKeywords,
      { keyword: kw, category: "General", priority: newPriority },
    ]);
    setNewKeyword("");
  };

  const removeDraftKeyword = (index: number) => {
    setDraftKeywords(draftKeywords.filter((_, i) => i !== index));
  };

  const saveKeywords = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/oversight", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: draftKeywords }),
      });
      if (res.ok) {
        setShowKeywordConfig(false);
        await load();
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Keyword Alerts
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Real messages matching your monitored keywords
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={isLoading}
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")}
            />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={openConfig}>
            <Settings className="h-4 w-4 mr-2" />
            Configure Keywords
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card size="sm">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Matches</p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    stats.totalAlerts > 0 && "text-blue-600"
                  )}
                >
                  {stats.totalAlerts}
                </p>
              </div>
              <Bell className="h-8 w-8 text-blue-500/20" />
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Staff-Creator</p>
                <p className="text-2xl font-bold">{stats.staffCreatorAlerts}</p>
              </div>
              <Flag className="h-8 w-8 text-amber-500/20" />
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Internal</p>
                <p className="text-2xl font-bold">{stats.internalAlerts}</p>
              </div>
              <Flag className="h-8 w-8 text-red-500/20" />
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Keywords</p>
                <p className="text-2xl font-bold">{stats.totalKeywords}</p>
              </div>
              <Search className="h-8 w-8 text-muted-foreground/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card size="sm">
        <CardContent className="pt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search keywords, senders, content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Alerts List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Keyword Matches</CardTitle>
          <CardDescription>{filteredAlerts.length} matches</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] -mx-4 px-4">
            <div className="space-y-3">
              {filteredAlerts.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {isLoading
                      ? "Loading matches..."
                      : keywords.length === 0
                      ? "No keywords configured yet"
                      : "No messages match your monitored keywords"}
                  </p>
                </div>
              ) : (
                filteredAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-2 w-2 rounded-full mt-2 shrink-0 bg-blue-500" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="destructive">{alert.keyword}</Badge>
                          <Badge variant="outline">
                            {alert.conversationType === "staff_creator"
                              ? "Staff-Creator"
                              : "Internal"}
                          </Badge>
                        </div>

                        <p className="text-sm mt-2 line-clamp-2">
                          {alert.messagePreview}
                        </p>

                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Avatar
                              size="xs"
                              user={{ name: alert.senderName }}
                            />
                            <span>{alert.senderName}</span>
                            <span className="text-muted-foreground">
                              ({alert.senderRole})
                            </span>
                          </div>
                          {alert.recipientName && (
                            <>
                              <ChevronRight className="h-3 w-3" />
                              <span>{alert.recipientName}</span>
                            </>
                          )}
                          <span className="ml-auto">
                            {formatTimeAgo(alert.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Keyword Configuration Dialog */}
      <Dialog open={showKeywordConfig} onOpenChange={setShowKeywordConfig}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configure Keywords</DialogTitle>
            <DialogDescription>
              Manage the keywords that flag messages for review when detected.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Add new keyword */}
            <div className="flex gap-2">
              <Input
                placeholder="Enter new keyword..."
                className="flex-1"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addDraftKeyword();
                  }
                }}
              />
              <Select
                value={newPriority}
                onValueChange={(v) =>
                  setNewPriority(v as "low" | "medium" | "high")
                }
              >
                <SelectTrigger aria-label="Priority" className="w-[130px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={addDraftKeyword}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>

            {/* Keyword list */}
            <ScrollArea className="h-[300px] border rounded-lg">
              <div className="p-4 space-y-2">
                {draftKeywords.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No keywords configured. Add one above.
                  </div>
                ) : (
                  draftKeywords.map((kw, index) => (
                    <div
                      key={`${kw.keyword}-${index}`}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{kw.keyword}</Badge>
                        <Badge variant="secondary">{kw.category}</Badge>
                        <Badge className={getPriorityColor(kw.priority)}>
                          {kw.priority}
                        </Badge>
                      </div>
                      <Button aria-label={`Remove keyword ${kw.keyword}`}
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeDraftKeyword(index)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowKeywordConfig(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={saveKeywords} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
