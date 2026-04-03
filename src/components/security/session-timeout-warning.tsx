"use client";

import * as React from "react";
import { signOut } from "next-auth/react";
import { clearRememberToken } from "@/lib/remember-token";
import {
  Clock,
  LogOut,
  RefreshCw,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

interface SessionTimeoutWarningProps {
  /**
   * Time in milliseconds before session expires when warning should appear
   * Default: 5 minutes (300000ms)
   */
  warningTime?: number;

  /**
   * Total session timeout in milliseconds
   * Default: 30 minutes (1800000ms)
   */
  sessionTimeout?: number;

  /**
   * Callback to refresh the session
   */
  onExtendSession?: () => Promise<void>;

  /**
   * Whether the component is enabled
   * Default: true
   */
  enabled?: boolean;
}

// Format time remaining
function formatTimeRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${seconds} seconds`;
}

export function SessionTimeoutWarning({
  warningTime = 5 * 60 * 1000, // 5 minutes
  sessionTimeout = 30 * 60 * 1000, // 30 minutes
  onExtendSession,
  enabled = true,
}: SessionTimeoutWarningProps) {
  const [showWarning, setShowWarning] = React.useState(false);
  const [timeRemaining, setTimeRemaining] = React.useState(warningTime);
  const [isExtending, setIsExtending] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const lastActivityRef = React.useRef<number>(Date.now());
  const warningTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const logoutTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update last activity timestamp
  const updateLastActivity = React.useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Clear all timers
  const clearAllTimers = React.useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  }, []);

  // Reset the session timeout
  const resetTimeout = React.useCallback(() => {
    if (!enabled) return;

    clearAllTimers();
    setShowWarning(false);
    setTimeRemaining(warningTime);
    updateLastActivity();

    // Set warning timer
    const timeUntilWarning = sessionTimeout - warningTime;
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setTimeRemaining(warningTime);

      // Start countdown
      countdownTimerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          const newTime = prev - 1000;
          if (newTime <= 0) {
            if (countdownTimerRef.current) {
              clearInterval(countdownTimerRef.current);
            }
            return 0;
          }
          return newTime;
        });
      }, 1000);

      // Set auto-logout timer
      logoutTimerRef.current = setTimeout(() => {
        handleLogout();
      }, warningTime);
    }, timeUntilWarning);
  }, [enabled, sessionTimeout, warningTime, clearAllTimers, updateLastActivity]);

  // Handle extending the session
  const handleExtendSession = async () => {
    setIsExtending(true);
    try {
      // Call the extend session callback if provided
      if (onExtendSession) {
        await onExtendSession();
      }

      // Also update session activity on the server
      await fetch("/api/auth/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Reset the timeout
      resetTimeout();
    } catch (error) {
      console.error("Failed to extend session:", error);
    } finally {
      setIsExtending(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    setIsLoggingOut(true);
    clearAllTimers();

    try {
      // Clear remember token to prevent auto-login after timeout
      await clearRememberToken();
      await signOut({ callbackUrl: "/login?reason=timeout" });
    } catch (error) {
      console.error("Failed to sign out:", error);
      // Force redirect even if signOut fails
      window.location.href = "/login?reason=timeout";
    }
  };

  // Listen for user activity to reset timeout
  React.useEffect(() => {
    if (!enabled) return;

    const activityEvents = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
    ];

    let throttleTimer: ReturnType<typeof setTimeout> | null = null;

    const handleActivity = () => {
      // Throttle activity updates to every 30 seconds
      if (throttleTimer) return;

      throttleTimer = setTimeout(() => {
        throttleTimer = null;
      }, 30000);

      // Only reset if warning is not showing
      if (!showWarning) {
        updateLastActivity();
      }
    };

    // Add event listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Initial timeout setup
    resetTimeout();

    // Cleanup
    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      clearAllTimers();
      if (throttleTimer) {
        clearTimeout(throttleTimer);
      }
    };
  }, [enabled, resetTimeout, showWarning, updateLastActivity, clearAllTimers]);

  // Handle visibility change (tab becoming active/inactive)
  React.useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Check if session has expired while tab was inactive
        const elapsed = Date.now() - lastActivityRef.current;
        if (elapsed >= sessionTimeout) {
          handleLogout();
        } else if (elapsed >= sessionTimeout - warningTime) {
          // Show warning if within warning period
          const remaining = sessionTimeout - elapsed;
          setTimeRemaining(remaining);
          setShowWarning(true);

          // Update countdown
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
          }
          countdownTimerRef.current = setInterval(() => {
            setTimeRemaining((prev) => {
              const newTime = prev - 1000;
              if (newTime <= 0) {
                if (countdownTimerRef.current) {
                  clearInterval(countdownTimerRef.current);
                }
                return 0;
              }
              return newTime;
            });
          }, 1000);

          // Update logout timer
          if (logoutTimerRef.current) {
            clearTimeout(logoutTimerRef.current);
          }
          logoutTimerRef.current = setTimeout(() => {
            handleLogout();
          }, remaining);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, sessionTimeout, warningTime]);

  // Calculate progress percentage
  const progressPercentage = Math.max(0, (timeRemaining / warningTime) * 100);

  if (!enabled) {
    return null;
  }

  return (
    <Dialog open={showWarning} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-500">
            <AlertTriangle className="h-5 w-5" />
            Session Expiring Soon
          </DialogTitle>
          <DialogDescription>
            Your session will expire due to inactivity. Would you like to stay
            logged in?
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          {/* Time Remaining Display */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-amber-500/10 mb-4">
              <Clock className="h-10 w-10 text-amber-500" />
            </div>
            <p className="text-3xl font-bold font-mono text-foreground">
              {formatTimeRemaining(timeRemaining)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              until automatic sign out
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress
              value={progressPercentage}
              className="h-2"
            />
            <p className="text-xs text-center text-muted-foreground">
              Time remaining before session expires
            </p>
          </div>

          {/* Security Notice */}
          <div className="p-4 rounded-xl border border-muted bg-muted/50">
            <div className="flex gap-3">
              <Clock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p>
                  For your security, inactive sessions are automatically signed
                  out. Click &quot;Stay Logged In&quot; to continue your session.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleLogout}
            disabled={isLoggingOut || isExtending}
            className="w-full sm:w-auto"
          >
            {isLoggingOut ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4 mr-2" />
            )}
            Sign Out Now
          </Button>
          <Button
            onClick={handleExtendSession}
            disabled={isExtending || isLoggingOut}
            className="w-full sm:w-auto btn-gradient"
          >
            {isExtending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Stay Logged In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Hook to use session timeout warning
export function useSessionTimeout(options?: {
  warningTime?: number;
  sessionTimeout?: number;
}) {
  const [lastActivity, setLastActivity] = React.useState(Date.now());

  const updateActivity = React.useCallback(() => {
    setLastActivity(Date.now());
  }, []);

  const isSessionExpiringSoon = React.useMemo(() => {
    const elapsed = Date.now() - lastActivity;
    const sessionTimeout = options?.sessionTimeout ?? 30 * 60 * 1000;
    const warningTime = options?.warningTime ?? 5 * 60 * 1000;
    return elapsed >= sessionTimeout - warningTime;
  }, [lastActivity, options?.sessionTimeout, options?.warningTime]);

  return {
    lastActivity,
    updateActivity,
    isSessionExpiringSoon,
  };
}

export default SessionTimeoutWarning;
