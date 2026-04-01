"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle, Loader2, AlertCircle, Info, CheckCircle } from "lucide-react";

// ============================================
// TYPES
// ============================================

export type ConfirmDialogVariant = "default" | "destructive" | "warning" | "info";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  children?: React.ReactNode;
}

// ============================================
// VARIANT CONFIGURATION
// ============================================

const variantConfig: Record<
  ConfirmDialogVariant,
  {
    icon: React.ElementType;
    iconClassName: string;
    headerClassName: string;
    confirmButtonVariant: "default" | "destructive" | "outline" | "secondary";
  }
> = {
  default: {
    icon: CheckCircle,
    iconClassName: "text-primary",
    headerClassName: "",
    confirmButtonVariant: "default",
  },
  destructive: {
    icon: AlertTriangle,
    iconClassName: "text-destructive",
    headerClassName: "text-destructive",
    confirmButtonVariant: "destructive",
  },
  warning: {
    icon: AlertCircle,
    iconClassName: "text-amber-500",
    headerClassName: "text-amber-500",
    confirmButtonVariant: "default",
  },
  info: {
    icon: Info,
    iconClassName: "text-blue-500",
    headerClassName: "text-blue-500",
    confirmButtonVariant: "default",
  },
};

// ============================================
// CONFIRM DIALOG COMPONENT
// ============================================

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const confirmButtonRef = React.useRef<HTMLButtonElement>(null);

  const config = variantConfig[variant];
  const Icon = config.icon;

  // Focus confirm button on open
  React.useEffect(() => {
    if (open && confirmButtonRef.current) {
      // Small delay to ensure dialog is fully rendered
      const timer = setTimeout(() => {
        confirmButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Handle keyboard shortcuts
  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !isLoading && !loading) {
        e.preventDefault();
        handleConfirm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, isLoading, loading]);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const actualLoading = loading || isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={cn("flex items-center gap-2", config.headerClassName)}>
            <Icon className={cn("h-5 w-5", config.iconClassName)} />
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        {children && <div className="py-4">{children}</div>}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={actualLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmButtonRef}
            variant={config.confirmButtonVariant}
            onClick={handleConfirm}
            disabled={actualLoading}
          >
            {actualLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// DELETE CONFIRM DIALOG - SPECIALIZED VARIANT
// ============================================

export interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  itemName?: string;
  itemType?: string;
  description?: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  itemName,
  itemType = "item",
  description,
  loading = false,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  const defaultTitle = `Delete ${itemType}`;
  const defaultDescription = itemName
    ? `Are you sure you want to delete "${itemName}"? This action cannot be undone.`
    : `Are you sure you want to delete this ${itemType}? This action cannot be undone.`;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title || defaultTitle}
      description={description || defaultDescription}
      confirmLabel="Delete"
      cancelLabel="Cancel"
      variant="destructive"
      loading={loading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
        <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-destructive">Warning</p>
          <p className="text-muted-foreground mt-1">
            {itemName
              ? `This will permanently delete "${itemName}". All associated data will be removed.`
              : `This will permanently delete this ${itemType}. All associated data will be removed.`
            }
          </p>
        </div>
      </div>
    </ConfirmDialog>
  );
}

// ============================================
// REMOVE CONFIRM DIALOG - FOR TEAM/ACCESS REMOVAL
// ============================================

export interface RemoveConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  itemName?: string;
  itemType?: string;
  description?: string;
  consequences?: string[];
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export function RemoveConfirmDialog({
  open,
  onOpenChange,
  title,
  itemName,
  itemType = "member",
  description,
  consequences = [],
  loading = false,
  onConfirm,
  onCancel,
}: RemoveConfirmDialogProps) {
  const defaultTitle = `Remove ${itemType}`;
  const defaultDescription = itemName
    ? `Are you sure you want to remove "${itemName}"?`
    : `Are you sure you want to remove this ${itemType}?`;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title || defaultTitle}
      description={description || defaultDescription}
      confirmLabel="Remove"
      cancelLabel="Cancel"
      variant="destructive"
      loading={loading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
        <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-destructive">This action will:</p>
          <ul className="text-muted-foreground mt-1 space-y-1 list-disc list-inside">
            {consequences.length > 0 ? (
              consequences.map((consequence, index) => (
                <li key={index}>{consequence}</li>
              ))
            ) : (
              <>
                <li>Remove all access permissions</li>
                <li>Revoke any active sessions</li>
              </>
            )}
          </ul>
        </div>
      </div>
    </ConfirmDialog>
  );
}

// ============================================
// REVOKE CONFIRM DIALOG - FOR API KEYS/TOKENS
// ============================================

export interface RevokeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  itemName?: string;
  itemType?: string;
  description?: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export function RevokeConfirmDialog({
  open,
  onOpenChange,
  title,
  itemName,
  itemType = "API key",
  description,
  loading = false,
  onConfirm,
  onCancel,
}: RevokeConfirmDialogProps) {
  const defaultTitle = `Revoke ${itemType}`;
  const defaultDescription = itemName
    ? `Are you sure you want to revoke "${itemName}"?`
    : `Are you sure you want to revoke this ${itemType}?`;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title || defaultTitle}
      description={description || defaultDescription}
      confirmLabel="Revoke"
      cancelLabel="Cancel"
      variant="warning"
      loading={loading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-amber-600 dark:text-amber-400">Warning</p>
          <p className="text-muted-foreground mt-1">
            Any applications using this {itemType.toLowerCase()} will immediately lose access.
            This action cannot be undone.
          </p>
        </div>
      </div>
    </ConfirmDialog>
  );
}

export default ConfirmDialog;
