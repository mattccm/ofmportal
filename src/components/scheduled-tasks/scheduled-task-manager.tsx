"use client";

import * as React from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  isPast,
  parseISO,
} from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  List,
  Grid3X3,
  Search,
  Filter,
  Clock,
  FilePlus,
  Bell,
  Archive,
  Package,
  Play,
  Pause,
  X,
  MoreHorizontal,
  RefreshCw,
  Eye,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Repeat,
  User,
  Users,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ScheduledTask,
  ScheduledTaskType,
  ScheduledTaskStatus,
  RecurrencePattern,
  TASK_TYPE_LABELS,
  RECURRENCE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  CalendarTask,
} from "@/types/scheduled-tasks";
import { ScheduleRequestModal } from "./schedule-request-modal";

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

interface ScheduledTaskManagerProps {
  initialTasks?: ScheduledTask[];
  templates: Template[];
  creators: Creator[];
}

// ============================================
// TASK TYPE ICONS
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
// STATUS BADGE
// ============================================

const StatusBadge: React.FC<{ status: ScheduledTaskStatus }> = ({ status }) => {
  const colorMap: Record<ScheduledTaskStatus, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    processing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  };

  const iconMap: Record<ScheduledTaskStatus, React.ReactNode> = {
    pending: <Clock className="h-3 w-3" />,
    processing: <RefreshCw className="h-3 w-3 animate-spin" />,
    completed: <CheckCircle2 className="h-3 w-3" />,
    failed: <XCircle className="h-3 w-3" />,
    cancelled: <X className="h-3 w-3" />,
  };

  return (
    <Badge variant="outline" className={cn("gap-1", colorMap[status])}>
      {iconMap[status]}
      {STATUS_LABELS[status]}
    </Badge>
  );
};

// ============================================
// CALENDAR VIEW
// ============================================

interface CalendarViewProps {
  tasks: ScheduledTask[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  onTaskClick: (task: ScheduledTask) => void;
  onDateClick: (date: Date) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  currentMonth,
  onMonthChange,
  onTaskClick,
  onDateClick,
}) => {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getTasksForDate = (date: Date): ScheduledTask[] => {
    return tasks.filter((task) => {
      const taskDate = new Date(task.scheduledFor);
      return isSameDay(taskDate, date);
    });
  };

  const getTaskColor = (type: ScheduledTaskType): string => {
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
    <div className="bg-card border rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onMonthChange(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onMonthChange(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((weekDay) => (
          <div
            key={weekDay}
            className="text-center text-sm font-medium text-muted-foreground py-2"
          >
            {weekDay}
          </div>
        ))}
      </div>

      {/* Calendar days */}
      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((date, index) => {
          const dayTasks = getTasksForDate(date);
          const isCurrentMonth = isSameMonth(date, currentMonth);
          const isTodayDate = isToday(date);
          const isPastDate = isPast(date) && !isTodayDate;

          return (
            <div
              key={index}
              onClick={() => onDateClick(date)}
              className={cn(
                "min-h-24 p-2 border rounded-lg cursor-pointer transition-colors",
                !isCurrentMonth && "bg-muted/30",
                isTodayDate && "bg-primary/5 border-primary",
                isPastDate && "opacity-60",
                "hover:bg-accent/50"
              )}
            >
              <div
                className={cn(
                  "text-sm font-medium mb-1",
                  !isCurrentMonth && "text-muted-foreground",
                  isTodayDate && "text-primary"
                )}
              >
                {format(date, "d")}
              </div>
              <div className="space-y-1">
                {dayTasks.slice(0, 3).map((task) => (
                  <div
                    key={task.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTaskClick(task);
                    }}
                    className={cn(
                      "text-xs px-1.5 py-0.5 rounded truncate text-white",
                      getTaskColor(task.type),
                      task.status === "cancelled" && "opacity-50 line-through"
                    )}
                    title={task.name}
                  >
                    {task.name}
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <div className="text-xs text-muted-foreground px-1">
                    +{dayTasks.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
        <div className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 rounded bg-blue-500" />
          <span>Create Request</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 rounded bg-amber-500" />
          <span>Send Reminder</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 rounded bg-gray-500" />
          <span>Archive</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 rounded bg-purple-500" />
          <span>Bundle</span>
        </div>
      </div>
    </div>
  );
};

// ============================================
// LIST VIEW
// ============================================

interface ListViewProps {
  tasks: ScheduledTask[];
  onTaskClick: (task: ScheduledTask) => void;
  onEdit: (task: ScheduledTask) => void;
  onPause: (task: ScheduledTask) => void;
  onCancel: (task: ScheduledTask) => void;
  onDelete: (task: ScheduledTask) => void;
  onRunNow: (task: ScheduledTask) => void;
  isLoading: boolean;
}

const ListView: React.FC<ListViewProps> = ({
  tasks,
  onTaskClick,
  onEdit,
  onPause,
  onCancel,
  onDelete,
  onRunNow,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No scheduled tasks</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Create your first scheduled task to automate request creation,
            reminders, and more.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <Card
          key={task.id}
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            task.status === "cancelled" && "opacity-60"
          )}
          onClick={() => onTaskClick(task)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div
                  className={cn(
                    "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                    task.type === "create_request" && "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
                    task.type === "send_reminder" && "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
                    task.type === "archive_request" && "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400",
                    task.type === "create_bundle" && "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                  )}
                >
                  <TaskTypeIcon type={task.type} className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium truncate">{task.name}</h3>
                    <StatusBadge status={task.status} />
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                    {task.description || TASK_TYPE_LABELS[task.type]}
                  </p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {format(new Date(task.scheduledFor), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Repeat className="h-3.5 w-3.5" />
                      <span>{RECURRENCE_LABELS[task.recurrence]}</span>
                    </div>
                    {task.creatorIds && task.creatorIds.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        <span>{task.creatorIds.length} creators</span>
                      </div>
                    )}
                    {task.runCount > 0 && (
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Run {task.runCount} times</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    onTaskClick(task);
                  }}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    onEdit(task);
                  }}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  {task.status === "pending" && (
                    <>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        onRunNow(task);
                      }}>
                        <Play className="h-4 w-4 mr-2" />
                        Run Now
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        onPause(task);
                      }}>
                        <Pause className="h-4 w-4 mr-2" />
                        Pause
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  {task.status !== "cancelled" && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onCancel(task);
                      }}
                      className="text-amber-600"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel Task
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(task);
                    }}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

// ============================================
// TASK DETAILS PANEL
// ============================================

interface TaskDetailsPanelProps {
  task: ScheduledTask | null;
  templates: Template[];
  creators: Creator[];
  onClose: () => void;
  onEdit: (task: ScheduledTask) => void;
  onCancel: (task: ScheduledTask) => void;
  onRunNow: (task: ScheduledTask) => void;
}

const TaskDetailsPanel: React.FC<TaskDetailsPanelProps> = ({
  task,
  templates,
  creators,
  onClose,
  onEdit,
  onCancel,
  onRunNow,
}) => {
  if (!task) return null;

  const template = task.config.requestConfig?.templateId
    ? templates.find((t) => t.id === task.config.requestConfig?.templateId)
    : null;

  const taskCreators = task.creatorIds
    ? creators.filter((c) => task.creatorIds?.includes(c.id))
    : task.creatorId
    ? creators.filter((c) => c.id === task.creatorId)
    : [];

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-background border-l shadow-lg z-50 overflow-y-auto">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Task Details</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Task Info */}
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "h-12 w-12 rounded-lg flex items-center justify-center shrink-0",
                task.type === "create_request" && "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
                task.type === "send_reminder" && "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
                task.type === "archive_request" && "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400",
                task.type === "create_bundle" && "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
              )}
            >
              <TaskTypeIcon type={task.type} className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{task.name}</h3>
              <p className="text-sm text-muted-foreground">
                {TASK_TYPE_LABELS[task.type]}
              </p>
            </div>
            <StatusBadge status={task.status} />
          </div>

          {task.description && (
            <div>
              <h4 className="text-sm font-medium mb-1">Description</h4>
              <p className="text-sm text-muted-foreground">{task.description}</p>
            </div>
          )}

          {/* Schedule Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-medium">Schedule</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Scheduled For</span>
                <p className="font-medium">
                  {format(new Date(task.scheduledFor), "MMM d, yyyy")}
                </p>
                <p className="text-muted-foreground">
                  {format(new Date(task.scheduledFor), "h:mm a")}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Recurrence</span>
                <p className="font-medium">{RECURRENCE_LABELS[task.recurrence]}</p>
              </div>
              {task.nextRunAt && (
                <div>
                  <span className="text-muted-foreground">Next Run</span>
                  <p className="font-medium">
                    {format(new Date(task.nextRunAt), "MMM d, yyyy")}
                  </p>
                </div>
              )}
              {task.lastRunAt && (
                <div>
                  <span className="text-muted-foreground">Last Run</span>
                  <p className="font-medium">
                    {format(new Date(task.lastRunAt), "MMM d, yyyy")}
                  </p>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Run Count</span>
                <p className="font-medium">{task.runCount} times</p>
              </div>
              {task.recurrenceEndDate && (
                <div>
                  <span className="text-muted-foreground">Ends On</span>
                  <p className="font-medium">
                    {format(new Date(task.recurrenceEndDate), "MMM d, yyyy")}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Template Info */}
          {template && (
            <div>
              <h4 className="text-sm font-medium mb-2">Template</h4>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{template.name}</p>
                  {template.description && (
                    <p className="text-sm text-muted-foreground">
                      {template.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Creators */}
          {taskCreators.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">
                Creators ({taskCreators.length})
              </h4>
              <div className="space-y-2">
                {taskCreators.slice(0, 5).map((creator) => (
                  <div
                    key={creator.id}
                    className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg"
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{creator.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {creator.email}
                      </p>
                    </div>
                  </div>
                ))}
                {taskCreators.length > 5 && (
                  <p className="text-sm text-muted-foreground pl-2">
                    +{taskCreators.length - 5} more creators
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Request Config */}
          {task.config.requestConfig && (
            <div>
              <h4 className="text-sm font-medium mb-2">Request Settings</h4>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                {task.config.requestConfig.title && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Title</span>
                    <span className="font-medium">
                      {task.config.requestConfig.title}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Due In</span>
                  <span className="font-medium">
                    {task.config.requestConfig.dueInDays} days
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Urgency</span>
                  <Badge variant="outline">
                    {task.config.requestConfig.urgency}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Auto Send</span>
                  <span className="font-medium">
                    {task.config.requestConfig.autoSend ? "Yes" : "No"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          {task.results && (
            <div>
              <h4 className="text-sm font-medium mb-2">Results</h4>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 space-y-2 text-sm">
                {task.results.createdRequestIds && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Requests Created</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {task.results.createdRequestIds.length}
                    </span>
                  </div>
                )}
                {task.results.sentReminderCount !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reminders Sent</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {task.results.sentReminderCount}
                    </span>
                  </div>
                )}
                {task.results.archivedCount !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items Archived</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {task.results.archivedCount}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {task.lastError && (
            <div>
              <h4 className="text-sm font-medium mb-2 text-destructive">Error</h4>
              <div className="bg-destructive/10 rounded-lg p-4 text-sm text-destructive">
                {task.lastError}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onEdit(task)}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
            {task.status === "pending" && (
              <>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onRunNow(task)}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Run Now
                </Button>
                <Button
                  variant="outline"
                  className="text-amber-600"
                  onClick={() => onCancel(task)}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export function ScheduledTaskManager({
  initialTasks = [],
  templates,
  creators,
}: ScheduledTaskManagerProps) {
  const [tasks, setTasks] = React.useState<ScheduledTask[]>(initialTasks);
  const [isLoading, setIsLoading] = React.useState(true);
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const [viewMode, setViewMode] = React.useState<"calendar" | "list">("calendar");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<ScheduledTaskStatus | "all">("all");
  const [typeFilter, setTypeFilter] = React.useState<ScheduledTaskType | "all">("all");
  const [selectedTask, setSelectedTask] = React.useState<ScheduledTask | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<ScheduledTask | null>(null);
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);

  // Fetch tasks
  const fetchTasks = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/scheduled-tasks");
      if (!response.ok) throw new Error("Failed to fetch tasks");
      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast.error("Failed to load scheduled tasks");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Filter tasks
  const filteredTasks = React.useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch =
        !searchQuery ||
        task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || task.status === statusFilter;

      const matchesType = typeFilter === "all" || task.type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [tasks, searchQuery, statusFilter, typeFilter]);

  // Handlers
  const handleTaskClick = (task: ScheduledTask) => {
    setSelectedTask(task);
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setIsScheduleModalOpen(true);
  };

  const handleEdit = (task: ScheduledTask) => {
    setEditingTask(task);
    setIsScheduleModalOpen(true);
  };

  const handlePause = async (task: ScheduledTask) => {
    // Implement pause functionality
    toast.info("Pause functionality coming soon");
  };

  const handleCancel = async (task: ScheduledTask) => {
    try {
      const response = await fetch(`/api/scheduled-tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });

      if (!response.ok) throw new Error("Failed to cancel task");

      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status: "cancelled" as ScheduledTaskStatus } : t
        )
      );
      setSelectedTask(null);
      toast.success("Task cancelled");
    } catch (error) {
      console.error("Error cancelling task:", error);
      toast.error("Failed to cancel task");
    }
  };

  const handleDelete = async (task: ScheduledTask) => {
    if (!confirm("Are you sure you want to delete this task?")) return;

    try {
      const response = await fetch(`/api/scheduled-tasks/${task.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete task");

      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      setSelectedTask(null);
      toast.success("Task deleted");
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task");
    }
  };

  const handleRunNow = async (task: ScheduledTask) => {
    try {
      const response = await fetch(`/api/scheduled-tasks/${task.id}/run`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to run task");

      await fetchTasks();
      toast.success("Task executed successfully");
    } catch (error) {
      console.error("Error running task:", error);
      toast.error("Failed to run task");
    }
  };

  const handleModalClose = () => {
    setIsScheduleModalOpen(false);
    setEditingTask(null);
    setSelectedDate(null);
  };

  const handleTaskCreated = (newTask: ScheduledTask) => {
    if (editingTask) {
      setTasks((prev) =>
        prev.map((t) => (t.id === newTask.id ? newTask : t))
      );
    } else {
      setTasks((prev) => [newTask, ...prev]);
    }
    handleModalClose();
    toast.success(editingTask ? "Task updated" : "Task scheduled");
  };

  // Stats
  const stats = React.useMemo(() => {
    const pending = tasks.filter((t) => t.status === "pending").length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const failed = tasks.filter((t) => t.status === "failed").length;
    const thisWeek = tasks.filter((t) => {
      const taskDate = new Date(t.scheduledFor);
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return taskDate >= now && taskDate <= weekFromNow;
    }).length;

    return { pending, completed, failed, thisWeek };
  }, [tasks]);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <CalendarDays className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.thisWeek}</p>
                <p className="text-sm text-muted-foreground">This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.failed}</p>
                <p className="text-sm text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as ScheduledTaskStatus | "all")}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as ScheduledTaskType | "all")}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="create_request">Create Request</SelectItem>
              <SelectItem value="send_reminder">Send Reminder</SelectItem>
              <SelectItem value="archive_request">Archive Request</SelectItem>
              <SelectItem value="create_bundle">Create Bundle</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-lg p-1">
            <Button
              variant={viewMode === "calendar" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("calendar")}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => setIsScheduleModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Schedule Task
          </Button>
        </div>
      </div>

      {/* Content */}
      {viewMode === "calendar" ? (
        <CalendarView
          tasks={filteredTasks}
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          onTaskClick={handleTaskClick}
          onDateClick={handleDateClick}
        />
      ) : (
        <ListView
          tasks={filteredTasks}
          onTaskClick={handleTaskClick}
          onEdit={handleEdit}
          onPause={handlePause}
          onCancel={handleCancel}
          onDelete={handleDelete}
          onRunNow={handleRunNow}
          isLoading={isLoading}
        />
      )}

      {/* Task Details Panel */}
      {selectedTask && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setSelectedTask(null)}
          />
          <TaskDetailsPanel
            task={selectedTask}
            templates={templates}
            creators={creators}
            onClose={() => setSelectedTask(null)}
            onEdit={handleEdit}
            onCancel={handleCancel}
            onRunNow={handleRunNow}
          />
        </>
      )}

      {/* Schedule Modal */}
      <ScheduleRequestModal
        open={isScheduleModalOpen}
        onOpenChange={handleModalClose}
        templates={templates}
        creators={creators}
        editingTask={editingTask}
        initialDate={selectedDate}
        onTaskCreated={handleTaskCreated}
      />
    </div>
  );
}

export default ScheduledTaskManager;
