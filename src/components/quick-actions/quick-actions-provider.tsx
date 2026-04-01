"use client";

import * as React from "react";
import { QuickActionsFAB } from "./quick-actions-fab";
import {
  QuickRequestDialog,
  QuickInviteDialog,
  QuickUploadDialog,
  QuickReminderDialog,
  useQuickActionDialogs,
  QuickRequestData,
  QuickReminderData,
} from "./quick-action-dialogs";

interface QuickActionsContextValue {
  openCreateRequest: () => void;
  openInviteCreator: () => void;
  openUploadFile: () => void;
  openSendReminder: () => void;
}

const QuickActionsContext = React.createContext<QuickActionsContextValue | null>(
  null
);

export function useQuickActions() {
  const context = React.useContext(QuickActionsContext);
  if (!context) {
    throw new Error(
      "useQuickActions must be used within a QuickActionsProvider"
    );
  }
  return context;
}

interface QuickActionsProviderProps {
  children: React.ReactNode;
  onCreateRequest?: (data: QuickRequestData) => Promise<void>;
  onInviteCreator?: (email: string, message?: string) => Promise<void>;
  onUploadFiles?: (files: File[]) => Promise<void>;
  onSendReminder?: (data: QuickReminderData) => Promise<void>;
  showFab?: boolean;
}

export function QuickActionsProvider({
  children,
  onCreateRequest,
  onInviteCreator,
  onUploadFiles,
  onSendReminder,
  showFab = true,
}: QuickActionsProviderProps) {
  const dialogs = useQuickActionDialogs();

  const contextValue: QuickActionsContextValue = React.useMemo(
    () => ({
      openCreateRequest: dialogs.openCreateRequest,
      openInviteCreator: dialogs.openInviteCreator,
      openUploadFile: dialogs.openUploadFile,
      openSendReminder: dialogs.openSendReminder,
    }),
    [dialogs]
  );

  return (
    <QuickActionsContext.Provider value={contextValue}>
      {children}

      {/* Floating Action Button */}
      {showFab && (
        <QuickActionsFAB
          onCreateRequest={dialogs.openCreateRequest}
          onInviteCreator={dialogs.openInviteCreator}
          onUploadFile={dialogs.openUploadFile}
          onSendReminder={dialogs.openSendReminder}
        />
      )}

      {/* Quick Action Dialogs */}
      <QuickRequestDialog
        open={dialogs.requestDialog.open}
        onOpenChange={dialogs.requestDialog.setOpen}
        onSubmit={onCreateRequest}
      />

      <QuickInviteDialog
        open={dialogs.inviteDialog.open}
        onOpenChange={dialogs.inviteDialog.setOpen}
        onSubmit={onInviteCreator}
      />

      <QuickUploadDialog
        open={dialogs.uploadDialog.open}
        onOpenChange={dialogs.uploadDialog.setOpen}
        onUpload={onUploadFiles}
      />

      <QuickReminderDialog
        open={dialogs.reminderDialog.open}
        onOpenChange={dialogs.reminderDialog.setOpen}
        onSubmit={onSendReminder}
      />
    </QuickActionsContext.Provider>
  );
}

export default QuickActionsProvider;
