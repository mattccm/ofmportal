"use client";

import * as React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus,
  GripVertical,
  X,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Settings,
  LayoutGrid,
  Save,
  RotateCcw,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { ContextualHelp } from "@/components/help/contextual-help";

// ============================================
// TYPES
// ============================================

export type WidgetSize = "small" | "medium" | "large";

export interface WidgetConfig {
  id: string;
  type: string;
  title: string;
  size: WidgetSize;
  order: number;
  visible: boolean;
  settings?: Record<string, unknown>;
}

export interface WidgetDefinition {
  type: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  defaultSize: WidgetSize;
  supportedSizes: WidgetSize[];
  component: React.ComponentType<WidgetProps>;
}

export interface WidgetProps {
  config: WidgetConfig;
  size: WidgetSize;
  onSettingsChange?: (settings: Record<string, unknown>) => void;
}

interface WidgetGridProps {
  widgets: WidgetDefinition[];
  initialLayout?: WidgetConfig[];
  onLayoutChange?: (layout: WidgetConfig[]) => void;
  className?: string;
}

// ============================================
// SIZE CONFIGURATIONS
// ============================================

const SIZE_CLASSES: Record<WidgetSize, string> = {
  small: "col-span-1",
  medium: "col-span-1 md:col-span-2",
  large: "col-span-1 md:col-span-2 lg:col-span-3",
};

const SIZE_LABELS: Record<WidgetSize, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};

// ============================================
// DRAGGABLE WIDGET WRAPPER
// ============================================

interface DraggableWidgetProps {
  config: WidgetConfig;
  definition: WidgetDefinition;
  isDragging: boolean;
  isDropTarget: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragOver: (id: string) => void;
  onRemove: (id: string) => void;
  onResize: (id: string, size: WidgetSize) => void;
}

function DraggableWidget({
  config,
  definition,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onRemove,
  onResize,
}: DraggableWidgetProps) {
  const dragRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const WidgetComponent = definition.component;

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", config.id);
      onDragStart(config.id);
    },
    [config.id, onDragStart]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      onDragOver(config.id);
    },
    [config.id, onDragOver]
  );

  const handleDragEnd = useCallback(() => {
    onDragEnd();
  }, [onDragEnd]);

  return (
    <div
      ref={dragRef}
      className={cn(
        "relative group transition-all duration-200",
        SIZE_CLASSES[config.size],
        isDragging && "opacity-50 scale-95",
        isDropTarget && "ring-2 ring-primary ring-offset-2"
      )}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Widget Controls Overlay */}
      <div
        className={cn(
          "absolute top-2 right-2 z-10 flex items-center gap-1 transition-opacity duration-200",
          isHovered ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Drag Handle */}
        <div
          className="cursor-grab active:cursor-grabbing p-1.5 rounded-md bg-background/80 backdrop-blur-sm border shadow-sm hover:bg-muted"
          title="Drag to reorder"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Widget Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 bg-background/80 backdrop-blur-sm border shadow-sm hover:bg-muted"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Widget Size
            </div>
            {definition.supportedSizes.map((size) => (
              <DropdownMenuItem
                key={size}
                onClick={() => onResize(config.id, size)}
                className="flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  {size === "small" && <Minimize2 className="h-3.5 w-3.5" />}
                  {size === "medium" && <LayoutGrid className="h-3.5 w-3.5" />}
                  {size === "large" && <Maximize2 className="h-3.5 w-3.5" />}
                  {SIZE_LABELS[size]}
                </span>
                {config.size === size && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onRemove(config.id)}
              className="text-red-600 focus:text-red-600"
            >
              <X className="h-4 w-4 mr-2" />
              Remove Widget
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Widget Component */}
      <WidgetComponent config={config} size={config.size} />
    </div>
  );
}

// ============================================
// ADD WIDGET DIALOG
// ============================================

interface AddWidgetDialogProps {
  widgets: WidgetDefinition[];
  activeWidgets: WidgetConfig[];
  onAdd: (type: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function AddWidgetDialog({
  widgets,
  activeWidgets,
  onAdd,
  open,
  onOpenChange,
}: AddWidgetDialogProps) {
  const activeTypes = new Set(activeWidgets.filter(w => w.visible).map((w) => w.type));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Widget</DialogTitle>
          <DialogDescription>
            Choose a widget to add to your dashboard
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2 mt-4">
          {widgets.map((widget) => {
            const isActive = activeTypes.has(widget.type);
            return (
              <button
                key={widget.type}
                onClick={() => {
                  if (!isActive) {
                    onAdd(widget.type);
                    onOpenChange(false);
                  }
                }}
                disabled={isActive}
                className={cn(
                  "flex items-start gap-4 p-4 rounded-xl border text-left transition-all duration-200",
                  isActive
                    ? "opacity-50 cursor-not-allowed bg-muted"
                    : "hover:border-primary hover:bg-primary/5 cursor-pointer"
                )}
              >
                <div
                  className={cn(
                    "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                    isActive ? "bg-muted" : "bg-primary/10"
                  )}
                >
                  <div className={cn(isActive ? "text-muted-foreground" : "text-primary")}>
                    {widget.icon}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{widget.title}</p>
                    {isActive && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted-foreground/20 text-muted-foreground">
                        Added
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {widget.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// MAIN WIDGET GRID COMPONENT
// ============================================

export function WidgetGrid({
  widgets,
  initialLayout = [],
  onLayoutChange,
  className,
}: WidgetGridProps) {
  const [layout, setLayout] = useState<WidgetConfig[]>(initialLayout);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Widget definition map for quick lookup
  const widgetMap = React.useMemo(() => {
    return new Map(widgets.map((w) => [w.type, w]));
  }, [widgets]);

  // Get visible widgets sorted by order
  const visibleWidgets = React.useMemo(() => {
    return layout
      .filter((w) => w.visible)
      .sort((a, b) => a.order - b.order);
  }, [layout]);

  // Initialize layout if empty
  useEffect(() => {
    if (initialLayout.length === 0 && widgets.length > 0) {
      // Default layout - add first few widgets
      const defaultLayout: WidgetConfig[] = widgets.slice(0, 4).map((w, index) => ({
        id: `${w.type}-${Date.now()}-${index}`,
        type: w.type,
        title: w.title,
        size: w.defaultSize,
        order: index,
        visible: true,
      }));
      setLayout(defaultLayout);
    }
  }, [initialLayout.length, widgets]);

  // Drag handlers
  const handleDragStart = useCallback((id: string) => {
    setDraggingId(id);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (draggingId && dropTargetId && draggingId !== dropTargetId) {
      setLayout((prev) => {
        const newLayout = [...prev];
        const dragIndex = newLayout.findIndex((w) => w.id === draggingId);
        const dropIndex = newLayout.findIndex((w) => w.id === dropTargetId);

        if (dragIndex !== -1 && dropIndex !== -1) {
          // Swap orders
          const dragOrder = newLayout[dragIndex].order;
          newLayout[dragIndex].order = newLayout[dropIndex].order;
          newLayout[dropIndex].order = dragOrder;
          setHasChanges(true);
        }

        return newLayout;
      });
    }
    setDraggingId(null);
    setDropTargetId(null);
  }, [draggingId, dropTargetId]);

  const handleDragOver = useCallback((id: string) => {
    setDropTargetId(id);
  }, []);

  // Widget management
  const handleAddWidget = useCallback(
    (type: string) => {
      const definition = widgetMap.get(type);
      if (!definition) return;

      const newWidget: WidgetConfig = {
        id: `${type}-${Date.now()}`,
        type,
        title: definition.title,
        size: definition.defaultSize,
        order: layout.length,
        visible: true,
      };

      setLayout((prev) => [...prev, newWidget]);
      setHasChanges(true);
      toast.success(`${definition.title} widget added`);
    },
    [widgetMap, layout.length]
  );

  const handleRemoveWidget = useCallback((id: string) => {
    setLayout((prev) =>
      prev.map((w) => (w.id === id ? { ...w, visible: false } : w))
    );
    setHasChanges(true);
    toast.success("Widget removed");
  }, []);

  const handleResizeWidget = useCallback((id: string, size: WidgetSize) => {
    setLayout((prev) =>
      prev.map((w) => (w.id === id ? { ...w, size } : w))
    );
    setHasChanges(true);
  }, []);

  // Save layout
  const handleSaveLayout = useCallback(async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/dashboard/widgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout }),
      });

      if (response.ok) {
        setHasChanges(false);
        toast.success("Dashboard layout saved");
        onLayoutChange?.(layout);
      } else {
        throw new Error("Failed to save layout");
      }
    } catch (error) {
      toast.error("Failed to save dashboard layout");
    } finally {
      setIsSaving(false);
    }
  }, [layout, onLayoutChange]);

  // Reset layout
  const handleResetLayout = useCallback(() => {
    const defaultLayout: WidgetConfig[] = widgets.slice(0, 4).map((w, index) => ({
      id: `${w.type}-${Date.now()}-${index}`,
      type: w.type,
      title: w.title,
      size: w.defaultSize,
      order: index,
      visible: true,
    }));
    setLayout(defaultLayout);
    setHasChanges(true);
    toast.info("Layout reset to default");
  }, [widgets]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddDialog(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Widget
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetLayout}
            className="gap-2 text-muted-foreground"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>

        {hasChanges && (
          <Button
            size="sm"
            onClick={handleSaveLayout}
            disabled={isSaving}
            className="gap-2 bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save Layout"}
          </Button>
        )}
      </div>

      {/* Widget Grid */}
      {visibleWidgets.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="text-center">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <LayoutGrid className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No widgets added</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
                Add widgets to customize your dashboard and see the information
                that matters most to you.
              </p>
              <Button
                className="mt-6 gap-2"
                onClick={() => setShowAddDialog(true)}
              >
                <Plus className="h-4 w-4" />
                Add Your First Widget
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {visibleWidgets.map((config) => {
            const definition = widgetMap.get(config.type);
            if (!definition) return null;

            return (
              <DraggableWidget
                key={config.id}
                config={config}
                definition={definition}
                isDragging={draggingId === config.id}
                isDropTarget={dropTargetId === config.id && draggingId !== config.id}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onRemove={handleRemoveWidget}
                onResize={handleResizeWidget}
              />
            );
          })}
        </div>
      )}

      {/* Add Widget Dialog */}
      <AddWidgetDialog
        widgets={widgets}
        activeWidgets={layout}
        onAdd={handleAddWidget}
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
      />
    </div>
  );
}

// ============================================
// WIDGET CARD WRAPPER COMPONENT
// ============================================

interface WidgetCardProps {
  title: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Help content key for contextual help */
  helpKey?: string;
}

export function WidgetCard({
  title,
  icon,
  actions,
  className,
  contentClassName,
  children,
  isLoading,
  error,
  onRetry,
  helpKey,
}: WidgetCardProps) {
  return (
    <Card className={cn("card-elevated h-full flex flex-col", className)}>
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            {icon}
            {title}
            {helpKey && (
              <ContextualHelp
                helpKey={helpKey}
                size="sm"
                showTips={true}
                showLinks={true}
              />
            )}
          </CardTitle>
          {actions}
        </div>
      </CardHeader>
      <CardContent className={cn("flex-1 min-h-0", contentClassName)}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full min-h-[120px]">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[120px] text-center">
            <p className="text-sm text-red-600 mb-2">{error}</p>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Retry
              </Button>
            )}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

// Re-export types for widget implementations
export type { WidgetCardProps };
