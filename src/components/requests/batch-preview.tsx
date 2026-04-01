"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  Calendar,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import type { Creator } from "./batch-creator-selector";

export interface BatchRequestItem {
  id: string;
  creator: Creator;
  title: string;
  description?: string;
  dueDate?: string;
  urgency: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  customized: boolean;
  valid: boolean;
  validationErrors: string[];
}

interface BatchPreviewProps {
  items: BatchRequestItem[];
  templateName?: string;
  onItemUpdate: (id: string, updates: Partial<BatchRequestItem>) => void;
  onItemRemove: (id: string) => void;
  onReorder: (items: BatchRequestItem[]) => void;
}

const URGENCY_OPTIONS = [
  { value: "LOW", label: "Low", class: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  { value: "NORMAL", label: "Normal", class: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "HIGH", label: "High", class: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" },
  { value: "URGENT", label: "Urgent", class: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
] as const;

export function BatchPreview({
  items,
  templateName,
  onItemUpdate,
  onItemRemove,
  onReorder,
}: BatchPreviewProps) {
  const [editingItem, setEditingItem] = useState<BatchRequestItem | null>(null);
  const [editDialog, setEditDialog] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<"name" | "dueDate" | "urgency" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Calculate validation summary
  const validationSummary = useMemo(() => {
    const validCount = items.filter((i) => i.valid).length;
    const invalidCount = items.filter((i) => !i.valid).length;
    const customizedCount = items.filter((i) => i.customized).length;

    return { validCount, invalidCount, customizedCount, total: items.length };
  }, [items]);

  // Sort items
  const sortedItems = useMemo(() => {
    if (!sortField) return items;

    return [...items].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "name":
          comparison = a.creator.name.localeCompare(b.creator.name);
          break;
        case "dueDate":
          if (!a.dueDate && !b.dueDate) comparison = 0;
          else if (!a.dueDate) comparison = 1;
          else if (!b.dueDate) comparison = -1;
          else comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          break;
        case "urgency":
          const urgencyOrder = { LOW: 0, NORMAL: 1, HIGH: 2, URGENT: 3 };
          comparison = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [items, sortField, sortDirection]);

  // Toggle sort
  const toggleSort = useCallback(
    (field: "name" | "dueDate" | "urgency") => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("asc");
      }
    },
    [sortField]
  );

  // Toggle row expansion
  const toggleRowExpansion = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Open edit dialog
  const openEditDialog = useCallback((item: BatchRequestItem) => {
    setEditingItem({ ...item });
    setEditDialog(true);
  }, []);

  // Save edit
  const saveEdit = useCallback(() => {
    if (!editingItem) return;

    // Validate
    const errors: string[] = [];
    if (!editingItem.title.trim()) {
      errors.push("Title is required");
    }

    const isValid = errors.length === 0;

    onItemUpdate(editingItem.id, {
      title: editingItem.title,
      description: editingItem.description,
      dueDate: editingItem.dueDate,
      urgency: editingItem.urgency,
      customized: true,
      valid: isValid,
      validationErrors: errors,
    });

    setEditDialog(false);
    setEditingItem(null);
  }, [editingItem, onItemUpdate]);

  // Inline urgency change
  const handleUrgencyChange = useCallback(
    (id: string, urgency: "LOW" | "NORMAL" | "HIGH" | "URGENT") => {
      onItemUpdate(id, { urgency, customized: true });
    },
    [onItemUpdate]
  );

  // Inline due date change
  const handleDueDateChange = useCallback(
    (id: string, dueDate: string) => {
      onItemUpdate(id, { dueDate, customized: true });
    },
    [onItemUpdate]
  );

  // Get urgency config
  const getUrgencyConfig = (urgency: string) => {
    return URGENCY_OPTIONS.find((o) => o.value === urgency) || URGENCY_OPTIONS[1];
  };

  // Sort header component
  const SortHeader = ({
    field,
    label,
  }: {
    field: "name" | "dueDate" | "urgency";
    label: string;
  }) => (
    <button
      onClick={() => toggleSort(field)}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {label}
      {sortField === field && (
        sortDirection === "asc" ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )
      )}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {validationSummary.total}
            </span>
            <span className="text-sm text-muted-foreground">
              request{validationSummary.total !== 1 ? "s" : ""} to create
            </span>
          </div>
          <div className="h-6 w-px bg-border" />
          {templateName && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Template:</span>
                <Badge variant="secondary">{templateName}</Badge>
              </div>
              <div className="h-6 w-px bg-border" />
            </>
          )}
          <div className="flex items-center gap-3">
            {validationSummary.validCount > 0 && (
              <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                <span>{validationSummary.validCount} valid</span>
              </div>
            )}
            {validationSummary.invalidCount > 0 && (
              <div className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                <XCircle className="h-4 w-4" />
                <span>{validationSummary.invalidCount} invalid</span>
              </div>
            )}
            {validationSummary.customizedCount > 0 && (
              <div className="flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400">
                <Edit2 className="h-4 w-4" />
                <span>{validationSummary.customizedCount} customized</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Validation Warnings */}
      {validationSummary.invalidCount > 0 && (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900/50">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-red-800 dark:text-red-300">
              {validationSummary.invalidCount} request{validationSummary.invalidCount !== 1 ? "s have" : " has"} validation errors
            </h4>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
              Please fix the errors before proceeding. Click the edit button on each row to customize the request.
            </p>
          </div>
        </div>
      )}

      {/* Preview Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[40px]">#</TableHead>
              <TableHead>
                <SortHeader field="name" label="Creator" />
              </TableHead>
              <TableHead>Title</TableHead>
              <TableHead>
                <SortHeader field="dueDate" label="Due Date" />
              </TableHead>
              <TableHead>
                <SortHeader field="urgency" label="Priority" />
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedItems.map((item, index) => {
              const urgencyConfig = getUrgencyConfig(item.urgency);
              const isExpanded = expandedRows.has(item.id);

              return (
                <>
                  <TableRow
                    key={item.id}
                    className={`
                      ${!item.valid ? "bg-red-50/50 dark:bg-red-950/10" : ""}
                      ${item.customized ? "bg-amber-50/30 dark:bg-amber-950/10" : ""}
                    `}
                  >
                    <TableCell className="font-medium text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-xs font-semibold">
                            {item.creator.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-medium text-foreground truncate">
                            {item.creator.name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {item.creator.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[200px]">
                        <div className="font-medium text-foreground truncate">
                          {item.title}
                        </div>
                        {item.description && (
                          <div className="text-xs text-muted-foreground truncate">
                            {item.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={item.dueDate || ""}
                        onChange={(e) => handleDueDateChange(item.id, e.target.value)}
                        className="w-[140px] h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={item.urgency}
                        onValueChange={(v) => handleUrgencyChange(item.id, v as "LOW" | "NORMAL" | "HIGH" | "URGENT")}
                      >
                        <SelectTrigger className="w-[110px] h-8">
                          <SelectValue>
                            <Badge variant="secondary" className={`${urgencyConfig.class} text-xs`}>
                              {urgencyConfig.label}
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {URGENCY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <Badge variant="secondary" className={`${option.class} text-xs`}>
                                {option.label}
                              </Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.valid ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Valid
                          </Badge>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleRowExpansion(item.id)}
                            className="h-auto p-1"
                          >
                            <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              <AlertCircle className="mr-1 h-3 w-3" />
                              {item.validationErrors.length} error{item.validationErrors.length !== 1 ? "s" : ""}
                            </Badge>
                          </Button>
                        )}
                        {item.customized && (
                          <Badge variant="outline" className="text-amber-600 border-amber-300">
                            Customized
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => openEditDialog(item)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-600"
                          onClick={() => onItemRemove(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {/* Expanded validation errors row */}
                  {isExpanded && !item.valid && (
                    <TableRow key={`${item.id}-errors`} className="bg-red-50/30 dark:bg-red-950/5">
                      <TableCell colSpan={7} className="py-2">
                        <div className="pl-10 flex flex-col gap-1">
                          {item.validationErrors.map((error, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                              <XCircle className="h-3.5 w-3.5" />
                              {error}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Customize Request</DialogTitle>
            <DialogDescription>
              {editingItem && (
                <span>
                  Customizing request for{" "}
                  <strong>{editingItem.creator.name}</strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title *</Label>
                <Input
                  id="edit-title"
                  value={editingItem.title}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, title: e.target.value })
                  }
                  placeholder="Request title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editingItem.description || ""}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, description: e.target.value })
                  }
                  placeholder="Additional details for this creator..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-dueDate">Due Date</Label>
                  <Input
                    id="edit-dueDate"
                    type="date"
                    value={editingItem.dueDate || ""}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, dueDate: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-urgency">Priority</Label>
                  <Select
                    value={editingItem.urgency}
                    onValueChange={(v) =>
                      setEditingItem({
                        ...editingItem,
                        urgency: v as "LOW" | "NORMAL" | "HIGH" | "URGENT",
                      })
                    }
                  >
                    <SelectTrigger id="edit-urgency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {URGENCY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} className="bg-indigo-600 hover:bg-indigo-700">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
