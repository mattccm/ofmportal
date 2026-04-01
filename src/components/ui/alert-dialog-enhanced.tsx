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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Loader2,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
  Trash2,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

export type AlertVariant = "default" | "destructive" | "warning" | "info" | "success";

export interface AlertAction {
  label: string;
  onClick: () => void | Promise<void>;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}

export interface AlertDialogEnhancedProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  variant?: AlertVariant;
  icon?: LucideIcon;
  actions?: AlertAction[];
  cancelLabel?: string;
  onCancel?: () => void;
  children?: React.ReactNode;
  /** Checkbox confirmation settings */
  requireConfirmation?: boolean;
  confirmationText?: string;
  /** Close dialog when clicking outside */
  closeOnOutsideClick?: boolean;
}

// ============================================
// VARIANT CONFIGURATION
// ============================================

const variantConfig: Record<
  AlertVariant,
  {
    icon: LucideIcon;
    iconClassName: string;
    headerClassName: string;
    bgClassName: string;
    borderClassName: string;
  }
> = {
  default: {
    icon: Info,
    iconClassName: "text-primary",
    headerClassName: "",
    bgClassName: "bg-primary/10",
    borderClassName: "border-primary/20",
  },
  destructive: {
    icon: AlertTriangle,
    iconClassName: "text-destructive",
    headerClassName: "text-destructive",
    bgClassName: "bg-destructive/10",
    borderClassName: "border-destructive/20",
  },
  warning: {
    icon: AlertCircle,
    iconClassName: "text-amber-500",
    headerClassName: "text-amber-500",
    bgClassName: "bg-amber-500/10",
    borderClassName: "border-amber-500/20",
  },
  info: {
    icon: Info,
    iconClassName: "text-blue-500",
    headerClassName: "text-blue-500",
    bgClassName: "bg-blue-500/10",
    borderClassName: "border-blue-500/20",
  },
  success: {
    icon: CheckCircle,
    iconClassName: "text-emerald-500",
    headerClassName: "text-emerald-500",
    bgClassName: "bg-emerald-500/10",
    borderClassName: "border-emerald-500/20",
  },
};

// ============================================
// ALERT DIALOG ENHANCED COMPONENT
// ============================================

export function AlertDialogEnhanced({
  open,
  onOpenChange,
  title,
  description,
  variant = "default",
  icon: CustomIcon,
  actions = [],
  cancelLabel = "Cancel",
  onCancel,
  children,
  requireConfirmation = false,
  confirmationText = "I understand this action cannot be undone",
  closeOnOutsideClick = true,
}: AlertDialogEnhancedProps) {
  const [confirmed, setConfirmed] = React.useState(false);
  const [loadingAction, setLoadingAction] = React.useState<number | null>(null);
  const autoFocusRef = React.useRef<HTMLButtonElement>(null);

  const config = variantConfig[variant];
  const Icon = CustomIcon || config.icon;

  // Reset confirmation when dialog closes
  React.useEffect(() => {
    if (!open) {
      setConfirmed(false);
      setLoadingAction(null);
    }
  }, [open]);

  // Focus auto-focus button on open
  React.useEffect(() => {
    if (open && autoFocusRef.current) {
      const timer = setTimeout(() => {
        autoFocusRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleAction = async (action: AlertAction, index: number) => {
    if (requireConfirmation && !confirmed) return;

    setLoadingAction(index);
    try {
      await action.onClick();
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !closeOnOutsideClick && loadingAction !== null) {
      return; // Prevent closing while loading
    }
    onOpenChange(newOpen);
  };

  const isActionDisabled = (action: AlertAction, index: number) => {
    if (action.disabled) return true;
    if (loadingAction !== null) return true;
    if (requireConfirmation && !confirmed) return true;
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={cn("flex items-center gap-2", config.headerClassName)}>
            <div
              className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center",
                config.bgClassName
              )}
            >
              <Icon className={cn("h-4 w-4", config.iconClassName)} />
            </div>
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-left">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        {children && <div className="py-2">{children}</div>}

        {requireConfirmation && (
          <div
            className={cn(
              "flex items-start gap-3 p-4 rounded-lg border",
              config.bgClassName,
              config.borderClassName
            )}
          >
            <Checkbox
              id="confirmation-checkbox"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
              className="mt-0.5"
            />
            <Label
              htmlFor="confirmation-checkbox"
              className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
            >
              {confirmationText}
            </Label>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={loadingAction !== null}
            className="sm:order-first"
          >
            {cancelLabel}
          </Button>

          {actions.map((action, index) => {
            const isLoading = loadingAction === index || action.loading;
            const isDisabled = isActionDisabled(action, index);
            const shouldAutoFocus = action.autoFocus;

            return (
              <Button
                key={index}
                ref={shouldAutoFocus ? autoFocusRef : undefined}
                variant={action.variant || "default"}
                onClick={() => handleAction(action, index)}
                disabled={isDisabled}
              >
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {action.label}
              </Button>
            );
          })}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// DANGER ZONE ALERT - FOR CRITICAL DESTRUCTIVE ACTIONS
// ============================================

export interface DangerZoneAlertProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  itemName?: string;
  consequences?: string[];
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export function DangerZoneAlert({
  open,
  onOpenChange,
  title,
  description,
  itemName,
  consequences = [],
  confirmLabel = "Delete",
  loading = false,
  onConfirm,
  onCancel,
}: DangerZoneAlertProps) {
  return (
    <AlertDialogEnhanced
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      variant="destructive"
      icon={Trash2}
      requireConfirmation
      confirmationText={
        itemName
          ? `I understand that "${itemName}" will be permanently deleted`
          : "I understand this action is permanent and cannot be undone"
      }
      actions={[
        {
          label: confirmLabel,
          onClick: onConfirm,
          variant: "destructive",
          loading,
          autoFocus: false,
        },
      ]}
      onCancel={onCancel}
    >
      {consequences.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/5 border border-destructive/10 mb-2">
          <ShieldAlert className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-destructive">This action will:</p>
            <ul className="text-muted-foreground mt-2 space-y-1 list-disc list-inside">
              {consequences.map((consequence, index) => (
                <li key={index}>{consequence}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </AlertDialogEnhanced>
  );
}

// ============================================
// CLEAR DATA ALERT - FOR CLEARING ALL DATA
// ============================================

export interface ClearDataAlertProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  dataType?: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export function ClearDataAlert({
  open,
  onOpenChange,
  title = "Clear All Data",
  description,
  dataType = "data",
  loading = false,
  onConfirm,
  onCancel,
}: ClearDataAlertProps) {
  return (
    <AlertDialogEnhanced
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={
        description ||
        `This will permanently delete all ${dataType}. This action cannot be undone.`
      }
      variant="destructive"
      icon={XCircle}
      requireConfirmation
      confirmationText={`I understand that all ${dataType} will be permanently deleted`}
      actions={[
        {
          label: "Clear All",
          onClick: onConfirm,
          variant: "destructive",
          loading,
        },
      ]}
      onCancel={onCancel}
    >
      <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/5 border border-destructive/10 mb-2">
        <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <p>
            <strong className="text-destructive">Warning:</strong> This is a
            destructive action that will remove all {dataType} from the system.
            Make sure you have backed up any important information before
            proceeding.
          </p>
        </div>
      </div>
    </AlertDialogEnhanced>
  );
}

// ============================================
// MULTI-ACTION ALERT - FOR MULTIPLE CHOICES
// ============================================

export interface MultiActionAlertProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  variant?: AlertVariant;
  icon?: LucideIcon;
  actions: AlertAction[];
  cancelLabel?: string;
  onCancel?: () => void;
  children?: React.ReactNode;
}

export function MultiActionAlert({
  open,
  onOpenChange,
  title,
  description,
  variant = "default",
  icon,
  actions,
  cancelLabel = "Cancel",
  onCancel,
  children,
}: MultiActionAlertProps) {
  return (
    <AlertDialogEnhanced
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      variant={variant}
      icon={icon}
      actions={actions}
      cancelLabel={cancelLabel}
      onCancel={onCancel}
    >
      {children}
    </AlertDialogEnhanced>
  );
}

// Re-export dialog components as AlertDialog aliases for compatibility
export {
  Dialog as AlertDialog,
  DialogContent as AlertDialogContent,
  DialogDescription as AlertDialogDescription,
  DialogFooter as AlertDialogFooter,
  DialogHeader as AlertDialogHeader,
  DialogTitle as AlertDialogTitle,
};

// Export button variants as action components
export const AlertDialogAction = Button;
export const AlertDialogCancel = Button;

export default AlertDialogEnhanced;
