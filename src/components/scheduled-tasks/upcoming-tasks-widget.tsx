"use client";

import * as React from "react";
import { format, isToday, isTomorrow, addDays, startOfDay, endOfDay } from "date-fns";
import Link from "next/link";
import {
  CalendarDays,
  Clock,
  ChevronRight,
  FilePlus,
  Bell,
  Archive,
  Package,
  Calendar,
  MoreHorizontal,
  Play,
  Eye,
  Pause,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ScheduledTask,
  ScheduledTaskType,
  TASK_TYPE_LABELS,
} from "@/types/scheduled-tasks";

// ============================================
// TYPES
// ============================================

interface UpcomingTasksWidgetProps {
  className?: string;
  limit?: number;
  showCalendar?: boolean;
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
// MINI CALENDAR
// ============================================

interface MiniCalendarProps {
  tasks: ScheduledTask[];
  onDateClick?: (date: Date) => void;
}

const MiniCalendar: React.FC<MiniCalendarProps> = ({ tasks, onDateClick }) => {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const getTasksForDate = (date: Date) => {
    const start = startOfDay(date);
    const end = endOfDay(date);
    return tasks.filter((task) => {
      const taskDate = new Date(task.scheduledFor);
      return taskDate >= start && taskDate <= end;
    });
  };

  const getTaskTypeColor = (type: ScheduledTaskType): string => {
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

  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((date, index) => {
        const dayTasks = getTasksForDate(date);
        const isTodayDate = isToday(date);

        return (
          <button
            key={index}
            onClick={() => onDateClick?.(date)}
            className={cn(
              "flex flex-col items-center p-2 rounded-lg transition-colors hover:bg-muted",
              isTodayDate && "bg-primary/10"
            )}
          >
            <span className="text-xs text-muted-foreground">
              {format(date, "EEE")}
            </span>
            <span
              className={cn(
                "text-sm font-medium mb-1",
                isTodayDate && "text-primary"
              )}
            >
              {format(date, "d")}
            </span>
            <div className="flex gap-0.5">
              {dayTasks.slice(0, 3).map((task, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    getTaskTypeColor(task.type)
                  )}
                />
              ))}
              {dayTasks.length > 3 && (
                <span className="text-[8px] text-muted-foreground">
                  +{dayTasks.length - 3}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};

// ============================================
// TASK ITEM
// ============================================

interface TaskItemProps {
  task: ScheduledTask;
  onRunNow?: (task: ScheduledTask) => void;
  onView?: (task: ScheduledTask) => void;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, onRunNow, onView }) => {
  const scheduledDate = new Date(task.scheduledFor);
  const isTaskToday = isToday(scheduledDate);
  const isTaskTomorrow = isTomorrow(scheduledDate);

  const getDateLabel = () => {
    if (isTaskToday) return "Today";
    if (isTaskTomorrow) return "Tomorrow";
    return format(scheduledDate, "EEE, MMM d");
  };

  const getTypeColor = () => {
    switch (task.type) {
      case "create_request":
        return "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400";
      case "send_reminder":
        return "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400";
      case "archive_request":
        return "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400";
      case "create_bundle":
        return "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div
        className={cn(
          "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
          getTypeColor()
        )}
      >
        <TaskTypeIcon type={task.type} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{task.name}</p>
          {isTaskToday && (
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
              Today
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{getDateLabel()}</span>
          <span>at {format(scheduledDate, "h:mm a")}</span>
          {task.creatorIds && task.creatorIds.length > 1 && (
            <span className="text-muted-foreground">
              ({task.creatorIds.length} creators)
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
          <DropdownMenuItem onClick={() => onView?.(task)}>
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onRunNow?.(task)}>
            <Play className="h-4 w-4 mr-2" />
            Run Now
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

// ============================================
// LOADING SKELETON
// ============================================

const TaskItemSkeleton: React.FC = () => (
  <div className="flex items-center gap-3 p-3 rounded-lg border">
    <Skeleton className="h-9 w-9 rounded-lg" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

export function UpcomingTasksWidget({
  className,
  limit = 5,
  showCalendar = true,
}: UpcomingTasksWidgetProps) {
  const [tasks, setTasks] = React.useState<ScheduledTask[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Fetch upcoming tasks
  const fetchTasks = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        status: "pending",
        limit: String(limit + 10), // Fetch extra to show in calendar
        upcoming: "true",
      });
      const response = await fetch(`/api/scheduled-tasks?${params}`);
      if (!response.ok) throw new Error("Failed to fetch tasks");
      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error("Error fetching scheduled tasks:", error);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  React.useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

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

  const handleView = (task: ScheduledTask) => {
    // Navigate to task details or open modal
    window.location.href = `/dashboard/scheduled-tasks?task=${task.id}`;
  };

  const handleDateClick = (date: Date) => {
    window.location.href = `/dashboard/scheduled-tasks?date=${format(date, "yyyy-MM-dd")}`;
  };

  // Get display tasks (limited)
  const displayTasks = tasks.slice(0, limit);

  // Group tasks by date for summary
  const tasksByDate = React.useMemo(() => {
    const groups: Record<string, number> = {};
    tasks.forEach((task) => {
      const dateKey = format(new Date(task.scheduledFor), "yyyy-MM-dd");
      groups[dateKey] = (groups[dateKey] || 0) + 1;
    });
    return groups;
  }, [tasks]);

  const todayCount = tasksByDate[format(new Date(), "yyyy-MM-dd")] || 0;
  const tomorrowCount = tasksByDate[format(addDays(new Date(), 1), "yyyy-MM-dd")] || 0;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Upcoming Tasks
            </CardTitle>
            <CardDescription className="text-xs">
              {todayCount > 0 && (
                <span className="text-primary font-medium">{todayCount} today</span>
              )}
              {todayCount > 0 && tomorrowCount > 0 && " / "}
              {tomorrowCount > 0 && (
                <span>{tomorrowCount} tomorrow</span>
              )}
              {todayCount === 0 && tomorrowCount === 0 && "No tasks scheduled soon"}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/scheduled-tasks">
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mini Calendar */}
        {showCalendar && (
          <div className="bg-muted/50 rounded-lg p-2">
            <MiniCalendar tasks={tasks} onDateClick={handleDateClick} />
          </div>
        )}

        {/* Task List */}
        <div className="space-y-2">
          {isLoading ? (
            <>
              <TaskItemSkeleton />
              <TaskItemSkeleton />
              <TaskItemSkeleton />
            </>
          ) : displayTasks.length === 0 ? (
            <div className="text-center py-6">
              <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No upcoming scheduled tasks
              </p>
              <Button variant="link" size="sm" asChild className="mt-2">
                <Link href="/dashboard/scheduled-tasks">
                  Schedule a task
                </Link>
              </Button>
            </div>
          ) : (
            <>
              {displayTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onRunNow={handleRunNow}
                  onView={handleView}
                />
              ))}
              {tasks.length > limit && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  asChild
                >
                  <Link href="/dashboard/scheduled-tasks">
                    View {tasks.length - limit} more tasks
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// COMPACT VERSION FOR SIDEBARS
// ============================================

interface CompactTasksWidgetProps {
  className?: string;
}

export function CompactTasksWidget({ className }: CompactTasksWidgetProps) {
  const [tasks, setTasks] = React.useState<ScheduledTask[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchTasks = async () => {
      try {
        const params = new URLSearchParams({
          status: "pending",
          limit: "3",
          upcoming: "true",
        });
        const response = await fetch(`/api/scheduled-tasks?${params}`);
        if (response.ok) {
          const data = await response.json();
          setTasks(data);
        }
      } catch (error) {
        console.error("Error fetching tasks:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTasks();
  }, []);

  if (isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Upcoming Tasks
        </span>
        <Link
          href="/dashboard/scheduled-tasks"
          className="text-xs text-primary hover:underline"
        >
          View all
        </Link>
      </div>
      {tasks.map((task) => {
        const scheduledDate = new Date(task.scheduledFor);
        return (
          <Link
            key={task.id}
            href={`/dashboard/scheduled-tasks?task=${task.id}`}
            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted transition-colors"
          >
            <TaskTypeIcon type={task.type} className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="flex-1 text-sm truncate">{task.name}</span>
            <span className="text-xs text-muted-foreground">
              {isToday(scheduledDate)
                ? format(scheduledDate, "h:mm a")
                : format(scheduledDate, "MMM d")}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export default UpcomingTasksWidget;
