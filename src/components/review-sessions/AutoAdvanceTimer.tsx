"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  Settings,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { AutoAdvanceState, AutoAdvanceEvent } from "@/types/review-session";

interface AutoAdvanceTimerProps {
  enabled: boolean;
  duration: number; // Total seconds
  onAdvance: () => void;
  onTimerUpdate?: (event: AutoAdvanceEvent) => void;
  onSettingsChange?: (settings: { enabled: boolean; duration: number }) => void;
  isHost: boolean;
  disabled?: boolean;
  hasConflict?: boolean; // Pause timer when there's a voting conflict
  autoAdvanceOnMajority?: boolean;
  hasMajority?: boolean;
}

export function AutoAdvanceTimer({
  enabled,
  duration,
  onAdvance,
  onTimerUpdate,
  onSettingsChange,
  isHost,
  disabled = false,
  hasConflict = false,
  autoAdvanceOnMajority = false,
  hasMajority = false,
}: AutoAdvanceTimerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [remaining, setRemaining] = useState(duration);
  const [isPaused, setIsPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [localDuration, setLocalDuration] = useState(duration);
  const [localEnabled, setLocalEnabled] = useState(enabled);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pausedAtRef = useRef<Date | null>(null);

  // Start/stop timer when enabled changes
  useEffect(() => {
    if (enabled && !disabled) {
      startTimer();
    } else {
      stopTimer();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, disabled]);

  // Reset timer when duration changes
  useEffect(() => {
    setRemaining(duration);
    setLocalDuration(duration);
  }, [duration]);

  // Pause timer when there's a conflict
  useEffect(() => {
    if (hasConflict && isRunning && !isPaused) {
      pauseTimer();
    }
  }, [hasConflict, isRunning, isPaused]);

  // Auto-advance on majority if enabled
  useEffect(() => {
    if (autoAdvanceOnMajority && hasMajority && isRunning) {
      handleAdvance();
    }
  }, [autoAdvanceOnMajority, hasMajority, isRunning]);

  const startTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    setIsRunning(true);
    setIsPaused(false);
    setRemaining(duration);
    pausedAtRef.current = null;

    onTimerUpdate?.({
      type: "timer_started",
      remaining: duration,
    });

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          handleAdvance();
          return duration; // Reset for next item
        }
        return prev - 1;
      });
    }, 1000);
  }, [duration, onTimerUpdate]);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
    setIsPaused(false);
    setRemaining(duration);
  }, [duration]);

  const pauseTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPaused(true);
    pausedAtRef.current = new Date();

    onTimerUpdate?.({
      type: "timer_paused",
      remaining,
    });
  }, [remaining, onTimerUpdate]);

  const resumeTimer = useCallback(() => {
    if (!isRunning) return;

    setIsPaused(false);
    pausedAtRef.current = null;

    onTimerUpdate?.({
      type: "timer_resumed",
      remaining,
    });

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          handleAdvance();
          return duration;
        }
        return prev - 1;
      });
    }, 1000);
  }, [isRunning, remaining, duration, onTimerUpdate]);

  const resetTimer = useCallback(() => {
    setRemaining(duration);

    onTimerUpdate?.({
      type: "timer_reset",
      remaining: duration,
    });

    if (isRunning && !isPaused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            handleAdvance();
            return duration;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [duration, isRunning, isPaused, onTimerUpdate]);

  const handleAdvance = useCallback(() => {
    onTimerUpdate?.({
      type: "timer_completed",
    });
    onAdvance();
    setRemaining(duration);
  }, [duration, onAdvance, onTimerUpdate]);

  const handleSettingsSave = () => {
    onSettingsChange?.({
      enabled: localEnabled,
      duration: localDuration,
    });
    setShowSettings(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPercent = duration > 0 ? ((duration - remaining) / duration) * 100 : 0;

  // Warning state when time is running low
  const isLowTime = remaining <= 10 && remaining > 0;

  if (!enabled && !isHost) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {/* Timer Display */}
      {enabled && (
        <div className={`flex items-center gap-2 ${isLowTime ? "animate-pulse" : ""}`}>
          <div className="relative">
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-sm font-mono ${
                isLowTime
                  ? "bg-destructive/10 text-destructive"
                  : isPaused
                  ? "bg-amber-100 text-amber-700"
                  : "bg-muted text-foreground"
              }`}
            >
              <Timer className="h-3.5 w-3.5" />
              {formatTime(remaining)}
            </div>
            {isPaused && hasConflict && (
              <Badge
                variant="outline"
                className="absolute -top-2 -right-2 h-4 px-1 text-[10px] border-amber-500 text-amber-600"
              >
                Paused
              </Badge>
            )}
          </div>

          {/* Progress bar */}
          <div className="w-20 hidden sm:block">
            <Progress
              value={progressPercent}
              className={`h-1.5 ${isLowTime ? "[&>div]:bg-destructive" : ""}`}
            />
          </div>

          {/* Controls for host */}
          {isHost && (
            <div className="flex items-center gap-1">
              {isPaused ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={resumeTimer}
                  title="Resume timer"
                >
                  <Play className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={pauseTimer}
                  title="Pause timer"
                >
                  <Pause className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={resetTimer}
                title="Reset timer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Conflict Warning */}
      {hasConflict && enabled && isPaused && (
        <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600">
          <AlertCircle className="h-3 w-3" />
          Conflict - Timer paused
        </Badge>
      )}

      {/* Settings (host only) */}
      {isHost && (
        <Popover open={showSettings} onOpenChange={setShowSettings}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" side="bottom" align="end">
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Timer className="h-4 w-4" />
                Auto-Advance Timer
              </h4>

              <div className="flex items-center justify-between">
                <Label htmlFor="auto-advance-enabled" className="text-sm">
                  Enable auto-advance
                </Label>
                <Switch
                  id="auto-advance-enabled"
                  checked={localEnabled}
                  onCheckedChange={setLocalEnabled}
                />
              </div>

              {localEnabled && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Timer duration</Label>
                      <span className="text-sm font-mono text-muted-foreground">
                        {formatTime(localDuration)}
                      </span>
                    </div>
                    <Slider
                      value={[localDuration]}
                      onValueChange={(v) => setLocalDuration(v[0])}
                      min={15}
                      max={300}
                      step={15}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>15s</span>
                      <span>5 min</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Timer will automatically advance to the next item when it reaches zero.
                    {hasConflict && " Timer pauses when votes conflict."}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSettings(false)}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSettingsSave}>
                  Apply
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Skip button (visible when timer is active) */}
      {enabled && isHost && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAdvance}
          className="gap-1 text-xs"
          title="Skip to next item"
        >
          Skip
          <ChevronRight className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

export default AutoAdvanceTimer;
