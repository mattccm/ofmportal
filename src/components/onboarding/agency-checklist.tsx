"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import {
  AGENCY_CHECKLIST_TASKS,
  type AgencyChecklistState,
  type OnboardingTask,
} from "@/lib/onboarding-tasks";
import {
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
  Sparkles,
  PartyPopper,
  CheckCircle2,
  ArrowRight,
  Rocket,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

interface AgencyChecklistProps {
  className?: string;
  defaultExpanded?: boolean;
  onDismiss?: () => void;
  onTaskComplete?: (taskId: string) => void;
  onAllComplete?: () => void;
}

interface TaskItemProps {
  task: OnboardingTask;
  isCompleted: boolean;
  isAutoDetected?: boolean;
  onComplete: (taskId: string) => void;
}

// ============================================
// CONFETTI ANIMATION COMPONENT
// ============================================

function Confetti({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute animate-confetti"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 0.5}s`,
            animationDuration: `${1 + Math.random() * 1}s`,
          }}
        >
          <div
            className={cn(
              "w-2 h-2 rounded-sm",
              i % 4 === 0 && "bg-yellow-400",
              i % 4 === 1 && "bg-pink-400",
              i % 4 === 2 && "bg-blue-400",
              i % 4 === 3 && "bg-green-400"
            )}
            style={{
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ============================================
// TASK ITEM COMPONENT
// ============================================

function TaskItem({ task, isCompleted, isAutoDetected, onComplete }: TaskItemProps) {
  const Icon = task.icon;

  return (
    <div
      className={cn(
        "group flex items-start gap-3 p-3 rounded-lg transition-all duration-200",
        isCompleted
          ? "bg-emerald-50/50 dark:bg-emerald-900/10"
          : "hover:bg-muted/50"
      )}
    >
      <div className="flex-shrink-0 pt-0.5">
        <Checkbox
          checked={isCompleted}
          onCheckedChange={() => !isCompleted && onComplete(task.id)}
          disabled={isCompleted}
          className={cn(
            "transition-all duration-200",
            isCompleted &&
              "data-checked:bg-emerald-500 data-checked:border-emerald-500"
          )}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex items-center justify-center w-6 h-6 rounded-md transition-colors",
              isCompleted
                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
          </div>
          <span
            className={cn(
              "text-sm font-medium transition-colors",
              isCompleted
                ? "text-emerald-700 dark:text-emerald-400 line-through decoration-emerald-400/50"
                : "text-foreground"
            )}
          >
            {task.label}
          </span>
          {isAutoDetected && isCompleted && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              Auto-detected
            </span>
          )}
        </div>
        <p
          className={cn(
            "text-xs mt-0.5 ml-8",
            isCompleted ? "text-emerald-600/70 dark:text-emerald-400/70" : "text-muted-foreground"
          )}
        >
          {task.description}
        </p>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isCompleted && (
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="h-7 px-2 text-xs"
          >
            <Link href={task.href}>
              Go
              <ArrowRight className="ml-1 w-3 h-3" />
            </Link>
          </Button>
        )}
        {task.helpHref && (
          <Button
            variant="ghost"
            size="icon-sm"
            asChild
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <Link href={task.helpHref} target="_blank">
              <ExternalLink className="w-3 h-3" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================
// COMPLETION CELEBRATION
// ============================================

function CompletionCelebration({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="text-center py-6 px-4">
      <div className="relative inline-flex items-center justify-center mb-4">
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500 rounded-full blur-xl opacity-50 animate-pulse" />
        <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
          <PartyPopper className="h-8 w-8 text-white" />
        </div>
      </div>

      <h3 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-2">
        Congratulations!
      </h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto">
        You&apos;ve completed all the setup tasks. Your agency is ready to collect amazing content!
      </p>

      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onDismiss}
          className="h-9"
        >
          Dismiss
        </Button>
        <Button
          size="sm"
          asChild
          className="h-9 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0"
        >
          <Link href="/dashboard/requests/new">
            <Rocket className="mr-2 h-4 w-4" />
            Create Request
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function AgencyChecklist({
  className,
  defaultExpanded = true,
  onDismiss,
  onTaskComplete,
  onAllComplete,
}: AgencyChecklistProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isLoading, setIsLoading] = useState(true);
  const [checklistState, setChecklistState] = useState<AgencyChecklistState | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchChecklistStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/onboarding/checklist");
      if (!response.ok) throw new Error("Failed to fetch checklist");

      const data: AgencyChecklistState = await response.json();
      setChecklistState(data);

      // Check if all tasks just completed
      if (data.isComplete && !justCompleted) {
        setJustCompleted(true);
        setShowConfetti(true);
        onAllComplete?.();

        // Hide confetti after animation
        setTimeout(() => setShowConfetti(false), 3000);
      }
    } catch (error) {
      console.error("Error fetching checklist:", error);
    } finally {
      setIsLoading(false);
    }
  }, [justCompleted, onAllComplete]);

  useEffect(() => {
    fetchChecklistStatus();
  }, [fetchChecklistStatus]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleTaskComplete = async (taskId: string) => {
    try {
      // Optimistic update
      setChecklistState((prev) => {
        if (!prev) return prev;

        const updatedTasks = prev.tasks.map((t) =>
          t.taskId === taskId
            ? { ...t, completed: true, completedAt: new Date() }
            : t
        );

        const completedCount = updatedTasks.filter((t) => t.completed).length;
        const totalTasks = AGENCY_CHECKLIST_TASKS.length;
        const newPercentage = Math.round((completedCount / totalTasks) * 100);
        const isComplete = completedCount === totalTasks;

        return {
          ...prev,
          tasks: updatedTasks,
          completionPercentage: newPercentage,
          isComplete,
        };
      });

      const response = await fetch("/api/onboarding/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });

      if (!response.ok) throw new Error("Failed to mark task complete");

      const result = await response.json();
      onTaskComplete?.(taskId);

      // Check if all complete
      if (result.isComplete && !justCompleted) {
        setJustCompleted(true);
        setShowConfetti(true);
        onAllComplete?.();
        setTimeout(() => setShowConfetti(false), 3000);
      }
    } catch (error) {
      console.error("Error completing task:", error);
      // Refetch on error to restore correct state
      fetchChecklistStatus();
    }
  };

  const handleDismiss = async () => {
    try {
      const response = await fetch("/api/onboarding/checklist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissed: true }),
      });

      if (!response.ok) throw new Error("Failed to dismiss checklist");

      setChecklistState((prev) =>
        prev ? { ...prev, dismissed: true, dismissedAt: new Date() } : prev
      );
      onDismiss?.();
    } catch (error) {
      console.error("Error dismissing checklist:", error);
    }
  };

  // ============================================
  // RENDER STATES
  // ============================================

  // Don't render if dismissed or loading
  if (isLoading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardHeader className="pb-3">
          <div className="h-5 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-1/2 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="h-2 bg-muted rounded w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!checklistState || checklistState.dismissed) {
    return null;
  }

  const { tasks, completionPercentage, isComplete } = checklistState;
  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = AGENCY_CHECKLIST_TASKS.length;

  // Get task completion status map
  const taskCompletionMap = new Map(
    tasks.map((t) => [t.taskId, { completed: t.completed, autoDetected: t.autoDetected }])
  );

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-300",
        isComplete &&
          "border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50/50 to-teal-50/50 dark:from-emerald-900/10 dark:to-teal-900/10",
        className
      )}
    >
      <Confetti show={showConfetti} />

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {isComplete ? (
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-sm">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
            ) : (
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-sm">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
            )}
            <div>
              <CardTitle className="text-base">
                {isComplete ? "Setup Complete!" : "Getting Started"}
              </CardTitle>
              <CardDescription className="text-xs">
                {isComplete
                  ? "You've completed all setup tasks"
                  : `${completedCount} of ${totalCount} tasks completed`}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            {isComplete && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleDismiss}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3">
          <Progress
            value={completionPercentage}
            className={cn(
              "[&_[data-slot=progress-indicator]]:transition-all [&_[data-slot=progress-indicator]]:duration-500",
              isComplete &&
                "[&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-emerald-400 [&_[data-slot=progress-indicator]]:to-teal-500"
            )}
          >
            <ProgressLabel className="sr-only">Progress</ProgressLabel>
            <ProgressValue />
          </Progress>
        </div>
      </CardHeader>

      {/* Expandable Task List */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300",
          isExpanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <CardContent className="pt-0">
          {isComplete ? (
            <CompletionCelebration onDismiss={handleDismiss} />
          ) : (
            <div className="space-y-1">
              {AGENCY_CHECKLIST_TASKS.map((task) => {
                const status = taskCompletionMap.get(task.id);
                return (
                  <TaskItem
                    key={task.id}
                    task={task}
                    isCompleted={status?.completed || false}
                    isAutoDetected={status?.autoDetected}
                    onComplete={handleTaskComplete}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </div>

      {/* Collapsed state hint */}
      {!isExpanded && !isComplete && (
        <CardContent className="pt-0 pb-3">
          <button
            onClick={() => setIsExpanded(true)}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            Click to expand and view tasks
          </button>
        </CardContent>
      )}
    </Card>
  );
}

export default AgencyChecklist;
