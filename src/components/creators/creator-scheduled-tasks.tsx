"use client";

import * as React from "react";
import { format, isToday, isFuture, isPast, addDays } from "date-fns";
import {
  CalendarDays,
  Clock,
  Plus,
  ChevronRight,
  FilePlus,
  Bell,
  Archive,
  Package,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MoreHorizontal,
  Play,
  Pencil,
  Trash2,
  Calendar,
  ArrowRight,
  Repeat,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ScheduledTask,
  ScheduledTaskType,
  ScheduledTaskStatus,
  TASK_TYPE_LABELS,
  RECURRENCE_LABELS,
  STATUS_LABELS,
} from "@/types/scheduled-tasks";

// ============================================
// TYPES
// ============================================

interface Template {
  id: string;
  name: string;
  description?: string;
}

interface Creator {
  id: string;
  name: string;
  email: string;
}

interface CreatorScheduledTasksProps {
  creatorId: string;
  creatorName: string;
  templates: Template[];
  onScheduleNew?: () => void;
}

// ============================================
// TASK TYPE ICON
// ============================================

const TaskTypeIcon: React.FC<{ type: ScheduledTaskType; className?: string }> = ({
  type,
  className,
}) => {
  const iconClass = cn("h-4 w-4", className);

  switch (type) {
    case "create_request":
      return <FilePlus className={iconClass} />;
    case "send_reminder":
      return <Bell className={iconClass} />;
    case "archive_request":
      return <Archive className={iconClass} />;
    case "create_bundle":
      return <Package className={iconClass} />;
    default:
      return <Clock className={iconClass} />;
  }
};

// ============================================
// STATUS INDICATOR
// ============================================

const StatusIndicator: React.FC<{ status: ScheduledTaskStatus }> = ({ status }) => {
  const config: Record<
    ScheduledTaskStatus,
    { icon: React.ReactNode; color: string; bgColor: string }
  > = {
    pending: {
      icon: <Clock className="h-3.5 w-3.5" />,
      color: "text-yellow-600 dark:text-yellow-400",
      bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
    },
    processing: {
      icon: <Clock className="h-3.5 w-3.5 animate-spin" />,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
    },
    completed: {
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-100 dark:bg-green-900/30",
    },
    failed: {
      icon: <XCircle className="h-3.5 w-3.5" />,
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-100 dark:bg-red-900/30",
    },
    cancelled: {
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      color: "text-gray-600 dark:text-gray-400",
      bgColor: "bg-gray-100 dark:bg-gray-900/30",
    },
  };

  const { icon, color, bgColor } = config[status];

  return (
    <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium", color, bgColor)}>
      {icon}
      <span>{STATUS_LABELS[status]}</span>
    </div>
  );
};

// ============================================
// TIMELINE VIEW
// ============================================

interface TimelineViewProps {
  tasks: ScheduledTask[];
  templates: Template[];
  onRunNow: (task: ScheduledTask) => void;
  onEdit: (task: ScheduledTask) => void;
  onDelete: (task: ScheduledTask) => void;
}

const TimelineView: React.FC<TimelineViewProps> = ({
  tasks,
  templates,
  onRunNow,
  onEdit,
  onDelete,
}) => {
  // Group tasks by date
  const groupedTasks = React.useMemo(() => {
    const groups: Record<string, ScheduledTask[]> = {};

    tasks.forEach((task) => {
      const dateKey = format(new Date(task.scheduledFor), "yyyy-MM-dd");
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(task);
    });

    // Sort by date
    const sortedKeys = Object.keys(groups).sort();
    return sortedKeys.map((key) => ({
      date: new Date(key),
      tasks: groups[key].sort(
        (a, b) =>
          new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
      ),
    }));
  }, [tasks]);

  const getDateLabel = (date: Date): string => {
    if (isToday(date)) return "Today";
    const tomorrow = addDays(new Date(), 1);
    if (format(date, "yyyy-MM-dd") === format(tomorrow, "yyyy-MM-dd")) {
      return "Tomorrow";
    }
    return format(date, "EEEE, MMMM d");
  };

  const getTypeColor = (type: ScheduledTaskType): string => {
    switch (type) {
      case "create_request":
        return "bg-blue-500";
      case "send_reminder":
        return "bg-amber-500";
      case "archive_request":
        return "bg-gray-500";
      case "create_bundle":
        return "bg-purple-500";
      default:
        return "bg-gray-400";
    }
  };

  if (groupedTasks.length === 0) {
    return (
      <div className="text-center py-8">
        <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-medium mb-1">No scheduled tasks</h3>
        <p className="text-sm text-muted-foreground">
          Schedule tasks to automate requests for this creator
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

      <div className="space-y-6">
        {groupedTasks.map(({ date, tasks: dateTasks }) => (
          <div key={format(date, "yyyy-MM-dd")} className="relative">
            {/* Date header */}
            <div className="flex items-center gap-3 mb-3">
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center z-10 border-2 border-background",
                  isToday(date)
                    ? "bg-primary text-primary-foreground"
                    : isFuture(date)
                    ? "bg-muted text-muted-foreground"
                    : "bg-muted/50 text-muted-foreground"
                )}
              >
                <CalendarDays className="h-4 w-4" />
              </div>
              <div>
                <p
                  className={cn(
                    "font-medium",
                    isToday(date) && "text-primary"
                  )}
                >
                  {getDateLabel(date)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {dateTasks.length} task{dateTasks.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {/* Tasks for this date */}
            <div className="ml-11 space-y-2">
              {dateTasks.map((task) => {
                const template = templates.find(
                  (t) => t.id === task.config.requestConfig?.templateId
                );

                return (
                  <div
                    key={task.id}
                    className={cn(
                      "relative bg-card border rounded-lg p-3 transition-all hover:shadow-md",
                      task.status === "cancelled" && "opacity-60"
                    )}
                  >
                    {/* Timeline connector dot */}
                    <div
                      className={cn(
                        "absolute -left-7 top-4 h-3 w-3 rounded-full border-2 border-background",
                        getTypeColor(task.type)
                      )}
                    />

                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <TaskTypeIcon
                            type={task.type}
                            className={cn(
                              task.type === "create_request" && "text-blue-500",
                              task.type === "send_reminder" && "text-amber-500",
                              task.type === "archive_request" && "text-gray-500",
                              task.type === "create_bundle" && "text-purple-500"
                            )}
                          />
                          <span className="font-medium text-sm truncate">
                            {task.name}
                          </span>
                          <StatusIndicator status={task.status} />
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(task.scheduledFor), "h:mm a")}
                          </span>
                          {task.recurrence !== "once" && (
                            <span className="flex items-center gap-1">
                              <Repeat className="h-3 w-3" />
                              {RECURRENCE_LABELS[task.recurrence]}
                            </span>
                          )}
                          {template && (
                            <span className="flex items-center gap-1">
                              <FilePlus className="h-3 w-3" />
                              {template.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {task.status === "pending" && (
                            <DropdownMenuItem onClick={() => onRunNow(task)}>
                              <Play className="h-4 w-4 mr-2" />
                              Run Now
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => onEdit(task)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onDelete(task)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Results preview for completed tasks */}
                    {task.status === "completed" && task.results && (
                      <div className="mt-2 pt-2 border-t">
                        <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>
                            {task.results.createdRequestIds?.length
                              ? `Created ${task.results.createdRequestIds.length} request(s)`
                              : task.results.sentReminderCount
                              ? `Sent ${task.results.sentReminderCount} reminder(s)`
                              : "Completed successfully"}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Error for failed tasks */}
                    {task.status === "failed" && task.lastError && (
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-xs text-destructive truncate">
                          {task.lastError}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export function CreatorScheduledTasks({
  creatorId,
  creatorName,
  templates,
  onScheduleNew,
}: CreatorScheduledTasksProps) {
  const [tasks, setTasks] = React.useState<ScheduledTask[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<"upcoming" | "past" | "all">("upcoming");

  // Fetch tasks for this creator
  const fetchTasks = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({ creatorId });
      const response = await fetch(`/api/scheduled-tasks?${params}`);
      if (!response.ok) throw new Error("Failed to fetch tasks");
      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast.error("Failed to load scheduled tasks");
    } finally {
      setIsLoading(false);
    }
  }, [creatorId]);

  React.useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Filter tasks
  const filteredTasks = React.useMemo(() => {
    const now = new Date();
    return tasks.filter((task) => {
      const taskDate = new Date(task.scheduledFor);
      if (filter === "upcoming") {
        return taskDate >= now || task.status === "pending";
      }
      if (filter === "past") {
        return taskDate < now && task.status !== "pending";
      }
      return true;
    });
  }, [tasks, filter]);

  // Stats
  const stats = React.useMemo(() => {
    const pending = tasks.filter((t) => t.status === "pending").length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const failed = tasks.filter((t) => t.status === "failed").length;
    return { pending, completed, failed, total: tasks.length };
  }, [tasks]);

  // Handlers
  const handleRunNow = async (task: ScheduledTask) => {
    try {
      const response = await fetch(`/api/scheduled-tasks/${task.id}/run`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to run task");

      toast.success("Task executed successfully");
      fetchTasks();
    } catch (error) {
      console.error("Error running task:", error);
      toast.error("Failed to run task");
    }
  };

  const handleEdit = (task: ScheduledTask) => {
    // Navigate to edit or trigger edit modal
    window.location.href = `/dashboard/scheduled-tasks?edit=${task.id}`;
  };

  const handleDelete = async (task: ScheduledTask) => {
    if (!confirm("Are you sure you want to delete this scheduled task?")) return;

    try {
      const response = await fetch(`/api/scheduled-tasks/${task.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete task");

      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      toast.success("Task deleted");
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Scheduled Tasks
            </CardTitle>
            <CardDescription>
              Automated tasks scheduled for {creatorName}
            </CardDescription>
          </div>
          <Button size="sm" onClick={onScheduleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Schedule
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {stats.pending}
            </p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.completed}
            </p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {stats.failed}
            </p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg mb-6">
          <button
            onClick={() => setFilter("upcoming")}
            className={cn(
              "flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              filter === "upcoming"
                ? "bg-background shadow-sm"
                : "hover:bg-background/50"
            )}
          >
            Upcoming
          </button>
          <button
            onClick={() => setFilter("past")}
            className={cn(
              "flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              filter === "past"
                ? "bg-background shadow-sm"
                : "hover:bg-background/50"
            )}
          >
            Past
          </button>
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              filter === "all"
                ? "bg-background shadow-sm"
                : "hover:bg-background/50"
            )}
          >
            All
          </button>
        </div>

        {/* Timeline */}
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <TimelineView
            tasks={filteredTasks}
            templates={templates}
            onRunNow={handleRunNow}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}

        {/* Link to full scheduled tasks page */}
        {stats.total > 0 && (
          <div className="mt-6 pt-4 border-t">
            <Button variant="ghost" className="w-full" asChild>
              <a href={`/dashboard/scheduled-tasks?creator=${creatorId}`}>
                View all scheduled tasks
                <ArrowRight className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CreatorScheduledTasks;
