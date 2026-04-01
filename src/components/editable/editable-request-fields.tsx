"use client";

import * as React from "react";
import { EditableText } from "./editable-text";
import { EditableBadge, STATUS_BADGE_OPTIONS, PRIORITY_BADGE_OPTIONS } from "./editable-badge";
import { EditableDate } from "./editable-date";
import { toast } from "sonner";

/**
 * Editable Request Title
 *
 * Inline editing for request titles with validation
 */
export interface EditableRequestTitleProps {
  requestId: string;
  title: string;
  onUpdate?: (title: string) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function EditableRequestTitle({
  requestId,
  title,
  onUpdate,
  className,
  size = "md",
}: EditableRequestTitleProps) {
  const handleSave = async (newTitle: string) => {
    try {
      const response = await fetch(`/api/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });

      if (!response.ok) {
        throw new Error("Failed to update title");
      }

      onUpdate?.(newTitle);
      toast.success("Title updated");
    } catch (error) {
      toast.error("Failed to update title");
      throw error;
    }
  };

  return (
    <EditableText
      value={title}
      onSave={handleSave}
      placeholder="Enter request title..."
      required
      validate={(value) => ({
        valid: value.trim().length >= 3,
        message: "Title must be at least 3 characters",
      })}
      size={size}
      className={className}
      ariaLabel="Edit request title"
      name="request-title"
    />
  );
}

/**
 * Editable Creator Name
 *
 * Inline editing for creator names with validation
 */
export interface EditableCreatorNameProps {
  creatorId: string;
  name: string;
  onUpdate?: (name: string) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function EditableCreatorName({
  creatorId,
  name,
  onUpdate,
  className,
  size = "md",
}: EditableCreatorNameProps) {
  const handleSave = async (newName: string) => {
    try {
      const response = await fetch(`/api/creators/${creatorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });

      if (!response.ok) {
        throw new Error("Failed to update name");
      }

      onUpdate?.(newName);
      toast.success("Name updated");
    } catch (error) {
      toast.error("Failed to update name");
      throw error;
    }
  };

  return (
    <EditableText
      value={name}
      onSave={handleSave}
      placeholder="Enter creator name..."
      required
      validate={(value) => ({
        valid: value.trim().length >= 2,
        message: "Name must be at least 2 characters",
      })}
      size={size}
      className={className}
      ariaLabel="Edit creator name"
      name="creator-name"
    />
  );
}

/**
 * Editable Status Badge
 *
 * Inline status changing with predefined options
 */
export interface EditableStatusBadgeProps {
  requestId: string;
  status: string;
  onUpdate?: (status: string) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  /** Optionally filter available statuses */
  allowedStatuses?: string[];
}

export function EditableStatusBadge({
  requestId,
  status,
  onUpdate,
  className,
  size = "md",
  allowedStatuses,
}: EditableStatusBadgeProps) {
  const options = allowedStatuses
    ? STATUS_BADGE_OPTIONS.filter((opt) => allowedStatuses.includes(opt.value))
    : STATUS_BADGE_OPTIONS;

  const handleSave = async (newStatus: string) => {
    try {
      const response = await fetch(`/api/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update status");
      }

      onUpdate?.(newStatus);
      toast.success("Status updated");
    } catch (error) {
      toast.error("Failed to update status");
      throw error;
    }
  };

  return (
    <EditableBadge
      value={status}
      options={options}
      onSave={handleSave}
      size={size}
      className={className}
      ariaLabel="Change request status"
    />
  );
}

/**
 * Editable Priority Badge
 *
 * Inline priority changing with predefined options
 */
export interface EditablePriorityBadgeProps {
  requestId: string;
  priority: string;
  onUpdate?: (priority: string) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function EditablePriorityBadge({
  requestId,
  priority,
  onUpdate,
  className,
  size = "md",
}: EditablePriorityBadgeProps) {
  const handleSave = async (newPriority: string) => {
    try {
      const response = await fetch(`/api/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urgency: newPriority }),
      });

      if (!response.ok) {
        throw new Error("Failed to update priority");
      }

      onUpdate?.(newPriority);
      toast.success("Priority updated");
    } catch (error) {
      toast.error("Failed to update priority");
      throw error;
    }
  };

  return (
    <EditableBadge
      value={priority}
      options={PRIORITY_BADGE_OPTIONS}
      onSave={handleSave}
      size={size}
      className={className}
      ariaLabel="Change request priority"
    />
  );
}

/**
 * Editable Due Date
 *
 * Inline date editing with calendar picker
 */
export interface EditableDueDateProps {
  requestId: string;
  dueDate: string | Date | null;
  onUpdate?: (dueDate: string | null) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  disablePast?: boolean;
}

export function EditableDueDate({
  requestId,
  dueDate,
  onUpdate,
  className,
  size = "md",
  disablePast = true,
}: EditableDueDateProps) {
  const handleSave = async (newDueDate: string | null) => {
    try {
      const response = await fetch(`/api/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: newDueDate }),
      });

      if (!response.ok) {
        throw new Error("Failed to update due date");
      }

      onUpdate?.(newDueDate);
      toast.success(newDueDate ? "Due date updated" : "Due date cleared");
    } catch (error) {
      toast.error("Failed to update due date");
      throw error;
    }
  };

  return (
    <EditableDate
      value={dueDate}
      onSave={handleSave}
      placeholder="Set due date..."
      size={size}
      className={className}
      ariaLabel="Edit due date"
      disablePast={disablePast}
      clearable
    />
  );
}

export default {
  EditableRequestTitle,
  EditableCreatorName,
  EditableStatusBadge,
  EditablePriorityBadge,
  EditableDueDate,
};
