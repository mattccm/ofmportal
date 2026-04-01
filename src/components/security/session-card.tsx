"use client";

import * as React from "react";
import {
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  Clock,
  LogOut,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface SessionData {
  id: string;
  sessionToken: string;
  current: boolean;
  device: string;
  browser: string;
  os: string;
  ip: string;
  location: string;
  lastActive: string;
  createdAt: string;
}

interface SessionCardProps {
  session: SessionData;
  onRevoke: (sessionId: string) => Promise<void>;
  isRevoking?: boolean;
}

// Get device icon based on device type
function getDeviceIcon(device: string) {
  switch (device.toLowerCase()) {
    case "mobile":
      return Smartphone;
    case "tablet":
      return Tablet;
    default:
      return Monitor;
  }
}

// Get device color based on device type
function getDeviceColor(device: string) {
  switch (device.toLowerCase()) {
    case "mobile":
      return "text-blue-500 bg-blue-500/10";
    case "tablet":
      return "text-purple-500 bg-purple-500/10";
    default:
      return "text-violet-500 bg-violet-500/10";
  }
}

// Format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return "Just now";
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
}

export function SessionCard({ session, onRevoke, isRevoking }: SessionCardProps) {
  const [showRevokeDialog, setShowRevokeDialog] = React.useState(false);
  const [isRevokingLocal, setIsRevokingLocal] = React.useState(false);

  const DeviceIcon = getDeviceIcon(session.device);
  const deviceColorClass = getDeviceColor(session.device);

  const handleRevoke = async () => {
    setIsRevokingLocal(true);
    try {
      await onRevoke(session.id);
      setShowRevokeDialog(false);
    } finally {
      setIsRevokingLocal(false);
    }
  };

  const isLoading = isRevoking || isRevokingLocal;

  return (
    <>
      <Card
        className={cn(
          "card-elevated transition-all duration-200",
          session.current && "ring-2 ring-primary/20 border-primary/30"
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            {/* Device Icon and Info */}
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <div
                className={cn(
                  "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
                  deviceColorClass
                )}
              >
                <DeviceIcon className="h-6 w-6" />
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                {/* Browser and OS */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground truncate">
                    {session.browser}
                  </span>
                  <span className="text-muted-foreground">on</span>
                  <span className="text-muted-foreground truncate">
                    {session.os}
                  </span>
                  {session.current && (
                    <Badge
                      variant="default"
                      className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 shrink-0"
                    >
                      <ShieldCheck className="h-3 w-3 mr-1" />
                      Current Session
                    </Badge>
                  )}
                </div>

                {/* Location and IP */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="truncate">{session.location}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5" />
                    <span className="font-mono text-xs">{session.ip}</span>
                  </div>
                </div>

                {/* Last Activity */}
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    {session.current
                      ? "Active now"
                      : `Last active: ${formatRelativeTime(session.lastActive)}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Revoke Button */}
            {!session.current && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRevokeDialog(true)}
                disabled={isLoading}
                className="shrink-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Revoke Confirmation Dialog */}
      <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Revoke Session
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke this session? The device will be
              signed out immediately.
            </DialogDescription>
          </DialogHeader>

          {/* Session Details */}
          <div className="py-4">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
              <div
                className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center",
                  deviceColorClass
                )}
              >
                <DeviceIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">
                  {session.browser} on {session.os}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {session.location} - {session.ip}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRevokeDialog(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4 mr-2" />
              )}
              Revoke Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Session List Component
interface SessionListProps {
  sessions: SessionData[];
  onRevokeSession: (sessionId: string) => Promise<void>;
  onRevokeAllOther: () => Promise<void>;
  isRevokingAll?: boolean;
  revokingSessionId?: string | null;
}

export function SessionList({
  sessions,
  onRevokeSession,
  onRevokeAllOther,
  isRevokingAll,
  revokingSessionId,
}: SessionListProps) {
  const [showRevokeAllDialog, setShowRevokeAllDialog] = React.useState(false);
  const [isRevokingAllLocal, setIsRevokingAllLocal] = React.useState(false);

  const currentSession = sessions.find((s) => s.current);
  const otherSessions = sessions.filter((s) => !s.current);

  const handleRevokeAll = async () => {
    setIsRevokingAllLocal(true);
    try {
      await onRevokeAllOther();
      setShowRevokeAllDialog(false);
    } finally {
      setIsRevokingAllLocal(false);
    }
  };

  const isLoadingRevokeAll = isRevokingAll || isRevokingAllLocal;

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Monitor className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="font-medium">No active sessions</p>
        <p className="text-sm mt-1">
          Session tracking requires database sessions to be enabled.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Session */}
      {currentSession && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Current Session
          </h3>
          <SessionCard
            session={currentSession}
            onRevoke={onRevokeSession}
            isRevoking={revokingSessionId === currentSession.id}
          />
        </div>
      )}

      {/* Other Sessions */}
      {otherSessions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Other Sessions ({otherSessions.length})
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRevokeAllDialog(true)}
              disabled={isLoadingRevokeAll}
              className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
            >
              {isLoadingRevokeAll ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4 mr-2" />
              )}
              Sign Out All
            </Button>
          </div>

          <div className="space-y-3">
            {otherSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onRevoke={onRevokeSession}
                isRevoking={revokingSessionId === session.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Sign Out All Dialog */}
      <Dialog open={showRevokeAllDialog} onOpenChange={setShowRevokeAllDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Sign Out All Other Devices
            </DialogTitle>
            <DialogDescription>
              This will sign you out from all devices except this one. You will
              need to sign in again on those devices.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-500">
                    {otherSessions.length} session
                    {otherSessions.length === 1 ? "" : "s"} will be terminated
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    This action cannot be undone. All other sessions will be
                    immediately invalidated.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRevokeAllDialog(false)}
              disabled={isLoadingRevokeAll}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevokeAll}
              disabled={isLoadingRevokeAll}
            >
              {isLoadingRevokeAll ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4 mr-2" />
              )}
              Sign Out All Devices
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SessionCard;
