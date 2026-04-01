"use client";

import * as React from "react";
import type { ConfirmDialogVariant } from "@/components/ui/confirm-dialog";

// ============================================
// TYPES
// ============================================

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
}

export interface ConfirmState extends ConfirmOptions {
  open: boolean;
  loading: boolean;
  resolve: ((value: boolean) => void) | null;
}

export interface UseConfirmReturn {
  /** Show a confirmation dialog and wait for user response */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Current dialog state */
  state: ConfirmState;
  /** Handle confirm action */
  handleConfirm: () => void;
  /** Handle cancel action */
  handleCancel: () => void;
  /** Set loading state */
  setLoading: (loading: boolean) => void;
  /** Close dialog programmatically */
  close: () => void;
}

// ============================================
// DEFAULT OPTIONS
// ============================================

const defaultOptions: Partial<ConfirmOptions> = {
  confirmLabel: "Confirm",
  cancelLabel: "Cancel",
  variant: "default",
};

// ============================================
// USE CONFIRM HOOK
// ============================================

export function useConfirm(): UseConfirmReturn {
  const [state, setState] = React.useState<ConfirmState>({
    open: false,
    loading: false,
    title: "",
    description: undefined,
    confirmLabel: defaultOptions.confirmLabel,
    cancelLabel: defaultOptions.cancelLabel,
    variant: defaultOptions.variant,
    resolve: null,
  });

  const confirm = React.useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({
        open: true,
        loading: false,
        title: options.title,
        description: options.description,
        confirmLabel: options.confirmLabel || defaultOptions.confirmLabel,
        cancelLabel: options.cancelLabel || defaultOptions.cancelLabel,
        variant: options.variant || defaultOptions.variant,
        resolve,
      });
    });
  }, []);

  const handleConfirm = React.useCallback(() => {
    if (state.resolve) {
      state.resolve(true);
    }
    setState((prev) => ({
      ...prev,
      open: false,
      loading: false,
      resolve: null,
    }));
  }, [state.resolve]);

  const handleCancel = React.useCallback(() => {
    if (state.resolve) {
      state.resolve(false);
    }
    setState((prev) => ({
      ...prev,
      open: false,
      loading: false,
      resolve: null,
    }));
  }, [state.resolve]);

  const setLoading = React.useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, loading }));
  }, []);

  const close = React.useCallback(() => {
    if (state.resolve) {
      state.resolve(false);
    }
    setState((prev) => ({
      ...prev,
      open: false,
      loading: false,
      resolve: null,
    }));
  }, [state.resolve]);

  return {
    confirm,
    state,
    handleConfirm,
    handleCancel,
    setLoading,
    close,
  };
}

// ============================================
// USE DELETE CONFIRM HOOK - SPECIALIZED
// ============================================

export interface DeleteConfirmOptions {
  itemName?: string;
  itemType?: string;
  title?: string;
  description?: string;
}

export function useDeleteConfirm() {
  const { confirm, state, handleConfirm, handleCancel, setLoading, close } = useConfirm();

  const confirmDelete = React.useCallback(
    async (options: DeleteConfirmOptions = {}): Promise<boolean> => {
      const {
        itemName,
        itemType = "item",
        title,
        description,
      } = options;

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

  return {
    confirmDelete,
    state,
    handleConfirm,
    handleCancel,
    setLoading,
    close,
  };
}

// ============================================
// USE REVOKE CONFIRM HOOK - FOR API KEYS/TOKENS
// ============================================

export interface RevokeConfirmOptions {
  itemName?: string;
  itemType?: string;
  title?: string;
  description?: string;
}

export function useRevokeConfirm() {
  const { confirm, state, handleConfirm, handleCancel, setLoading, close } = useConfirm();

  const confirmRevoke = React.useCallback(
    async (options: RevokeConfirmOptions = {}): Promise<boolean> => {
      const {
        itemName,
        itemType = "API key",
        title,
        description,
      } = options;

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

  return {
    confirmRevoke,
    state,
    handleConfirm,
    handleCancel,
    setLoading,
    close,
  };
}

// ============================================
// USE REMOVE CONFIRM HOOK - FOR TEAM/ACCESS
// ============================================

export interface RemoveConfirmOptions {
  memberName?: string;
  memberType?: string;
  title?: string;
  description?: string;
}

export function useRemoveConfirm() {
  const { confirm, state, handleConfirm, handleCancel, setLoading, close } = useConfirm();

  const confirmRemove = React.useCallback(
    async (options: RemoveConfirmOptions = {}): Promise<boolean> => {
      const {
        memberName,
        memberType = "team member",
        title,
        description,
      } = options;

      const defaultTitle = title || `Remove ${memberType}`;
      const defaultDescription =
        description ||
        (memberName
          ? `Are you sure you want to remove ${memberName} from the team?`
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

  return {
    confirmRemove,
    state,
    handleConfirm,
    handleCancel,
    setLoading,
    close,
  };
}

// ============================================
// CONFIRM DIALOG WRAPPER COMPONENT
// Renders the dialog based on hook state
// ============================================

export { useConfirm as default };
