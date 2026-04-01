"use client";

import * as React from "react";
import { ConfirmDialog, type ConfirmDialogVariant } from "@/components/ui/confirm-dialog";

// ============================================
// TYPES
// ============================================

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  /** Additional content to render in the dialog */
  content?: React.ReactNode;
}

interface ConfirmContextValue {
  /** Show a confirmation dialog and wait for user response */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Show a delete confirmation dialog */
  confirmDelete: (options: {
    itemName?: string;
    itemType?: string;
    title?: string;
    description?: string;
  }) => Promise<boolean>;
  /** Show a remove confirmation dialog */
  confirmRemove: (options: {
    memberName?: string;
    memberType?: string;
    title?: string;
    description?: string;
  }) => Promise<boolean>;
  /** Show a revoke confirmation dialog */
  confirmRevoke: (options: {
    itemName?: string;
    itemType?: string;
    title?: string;
    description?: string;
  }) => Promise<boolean>;
}

// ============================================
// CONTEXT
// ============================================

const ConfirmContext = React.createContext<ConfirmContextValue | null>(null);

// ============================================
// PROVIDER COMPONENT
// ============================================

interface ConfirmState {
  open: boolean;
  loading: boolean;
  options: ConfirmOptions;
  content: React.ReactNode;
  resolve: ((value: boolean) => void) | null;
}

const initialState: ConfirmState = {
  open: false,
  loading: false,
  options: {
    title: "",
    description: undefined,
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    variant: "default",
  },
  content: null,
  resolve: null,
};

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ConfirmState>(initialState);

  const confirm = React.useCallback(
    (options: ConfirmOptions): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        setState({
          open: true,
          loading: false,
          options: {
            title: options.title,
            description: options.description,
            confirmLabel: options.confirmLabel || "Confirm",
            cancelLabel: options.cancelLabel || "Cancel",
            variant: options.variant || "default",
          },
          content: options.content || null,
          resolve,
        });
      });
    },
    []
  );

  const confirmDelete = React.useCallback(
    (options: {
      itemName?: string;
      itemType?: string;
      title?: string;
      description?: string;
    }): Promise<boolean> => {
      const { itemName, itemType = "item", title, description } = options;

      const defaultTitle = title || `Delete ${itemType}`;
      const defaultDescription =
        description ||
        (itemName
          ? `Are you sure you want to delete "${itemName}"? This action cannot be undone.`
          : `Are you sure you want to delete this ${itemType}? This action cannot be undone.`);

      return confirm({
        title: defaultTitle,
        description: defaultDescription,
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        variant: "destructive",
      });
    },
    [confirm]
  );

  const confirmRemove = React.useCallback(
    (options: {
      memberName?: string;
      memberType?: string;
      title?: string;
      description?: string;
    }): Promise<boolean> => {
      const { memberName, memberType = "team member", title, description } = options;

      const defaultTitle = title || `Remove ${memberType}`;
      const defaultDescription =
        description ||
        (memberName
          ? `Are you sure you want to remove ${memberName}?`
          : `Are you sure you want to remove this ${memberType}?`);

      return confirm({
        title: defaultTitle,
        description: defaultDescription,
        confirmLabel: "Remove",
        cancelLabel: "Cancel",
        variant: "destructive",
      });
    },
    [confirm]
  );

  const confirmRevoke = React.useCallback(
    (options: {
      itemName?: string;
      itemType?: string;
      title?: string;
      description?: string;
    }): Promise<boolean> => {
      const { itemName, itemType = "API key", title, description } = options;

      const defaultTitle = title || `Revoke ${itemType}`;
      const defaultDescription =
        description ||
        (itemName
          ? `Are you sure you want to revoke "${itemName}"? Applications using this key will lose access immediately.`
          : `Are you sure you want to revoke this ${itemType}? Applications using it will lose access immediately.`);

      return confirm({
        title: defaultTitle,
        description: defaultDescription,
        confirmLabel: "Revoke",
        cancelLabel: "Cancel",
        variant: "warning",
      });
    },
    [confirm]
  );

  const handleConfirm = React.useCallback(async () => {
    if (state.resolve) {
      state.resolve(true);
    }
    setState((prev) => ({ ...prev, open: false, resolve: null }));
  }, [state.resolve]);

  const handleCancel = React.useCallback(() => {
    if (state.resolve) {
      state.resolve(false);
    }
    setState((prev) => ({ ...prev, open: false, resolve: null }));
  }, [state.resolve]);

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        handleCancel();
      }
    },
    [handleCancel]
  );

  const contextValue = React.useMemo(
    () => ({
      confirm,
      confirmDelete,
      confirmRemove,
      confirmRevoke,
    }),
    [confirm, confirmDelete, confirmRemove, confirmRevoke]
  );

  return (
    <ConfirmContext.Provider value={contextValue}>
      {children}
      <ConfirmDialog
        open={state.open}
        onOpenChange={handleOpenChange}
        title={state.options.title}
        description={state.options.description}
        confirmLabel={state.options.confirmLabel}
        cancelLabel={state.options.cancelLabel}
        variant={state.options.variant}
        loading={state.loading}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      >
        {state.content}
      </ConfirmDialog>
    </ConfirmContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useConfirmDialog() {
  const context = React.useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirmDialog must be used within a ConfirmProvider");
  }
  return context;
}

export default ConfirmProvider;
