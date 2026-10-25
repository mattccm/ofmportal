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
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
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
  { value: "LOW", label: "Low", class: "bg-tile-hi text-ink-2  " },
  { value: "NORMAL", label: "Normal", class: "bg-tile-hi text-ink-2  " },
  { value: "HIGH", label: "High", class: "bg-tile-hi text-ink-2  " },
  { value: "URGENT", label: "Urgent", class: "bg-late/10 text-late " },
] as const;

const SortHeader = ({
  field,
  label,
  sortField,
  sortDirection,
  onToggle,
}: {
  field: "name" | "dueDate" | "urgency";
  label: string;
  sortField: "name" | "dueDate" | "urgency" | null;
  sortDirection: "asc" | "desc";
  onToggle: (field: "name" | "dueDate" | "urgency") => void;
}) => (
  <button
    onClick={() => onToggle(field)}
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

export function BatchPreview({
  items,
  templateName,
  onItemUpdate,
  onItemRemove,
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

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="flex items-center justify-between p-4 bg-tile-hi rounded-lg border border-line dark:border-line">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-foreground dark:text-foreground">
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
              <div className="flex items-center gap-1 text-sm text-success">
                <CheckCircle className="h-4 w-4" />
                <span>{validationSummary.validCount} valid</span>
              </div>
            )}
            {validationSummary.invalidCount > 0 && (
              <div className="flex items-center gap-1 text-sm text-late">
                <XCircle className="h-4 w-4" />
                <span>{validationSummary.invalidCount} invalid</span>
              </div>
            )}
            {validationSummary.customizedCount > 0 && (
              <div className="flex items-center gap-1 text-sm text-ink-2">
                <Edit2 className="h-4 w-4" />
                <span>{validationSummary.customizedCount} customized</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Validation Warnings */}
      {validationSummary.invalidCount > 0 && (
        <div className="flex items-start gap-3 p-4 bg-late/10 rounded-lg border border-late/30">
          <AlertTriangle className="h-5 w-5 text-late flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-late">
              {validationSummary.invalidCount} request{validationSummary.invalidCount !== 1 ? "s have" : " has"} validation errors
            </h4>
            <p className="text-sm text-late mt-1">
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
                <SortHeader
                  field="name"
                  label="Creator"
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onToggle={toggleSort}
                />
              </TableHead>
              <TableHead>Title</TableHead>
              <TableHead>
                <SortHeader
                  field="dueDate"
                  label="Due Date"
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onToggle={toggleSort}
                />
              </TableHead>
              <TableHead>
                <SortHeader
                  field="urgency"
                  label="Priority"
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onToggle={toggleSort}
                />
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
                      ${!item.valid ? "bg-late/10" : ""}
                      ${item.customized ? "bg-tile-hi" : ""}
                    `}
                  >
                    <TableCell className="font-medium text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback gradient={false} className="bg-raised text-ink text-xs font-semibold">
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
                        <SelectTrigger aria-label={`Urgency for ${item.title}`} className="w-[110px] h-8">
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
                          <Badge variant="secondary" className="bg-success/10 text-success">
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
                            <Badge variant="secondary" className="bg-late/10 text-late">
                              <AlertCircle className="mr-1 h-3 w-3" />
                              {item.validationErrors.length} error{item.validationErrors.length !== 1 ? "s" : ""}
                            </Badge>
                          </Button>
                        )}
                        {item.customized && (
                          <Badge variant="outline" className="text-ink-2 border-line">
                            Customized
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button aria-label={`Edit request for ${item.creator.name}`}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => openEditDialog(item)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button aria-label={`Remove request for ${item.creator.name}`}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-late"
                          onClick={() => onItemRemove(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {/* Expanded validation errors row */}
                  {isExpanded && !item.valid && (
                    <TableRow key={`${item.id}-errors`} className="bg-late/10">
                      <TableCell colSpan={7} className="py-2">
                        <div className="pl-10 flex flex-col gap-1">
                          {item.validationErrors.map((error, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm text-late">
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
            <Button onClick={saveEdit} className="bg-raised-hi text-ink hover:bg-raised-hi">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
