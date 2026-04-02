"use client";

import * as React from "react";
import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { CreatorContextPanel } from "@/components/creators/creator-context-panel";
import { useShortcut } from "@/hooks/use-keyboard-shortcuts";

// ============================================
// TYPES
// ============================================

interface CreatorContextProviderValue {
  /** Currently selected creator ID for the context panel */
  selectedCreatorId: string | null;
  /** Whether the context panel is open */
  isPanelOpen: boolean;
  /** Open the context panel for a specific creator */
  openCreatorContext: (creatorId: string) => void;
  /** Close the context panel */
  closeCreatorContext: () => void;
  /** Toggle the context panel for a specific creator */
  toggleCreatorContext: (creatorId?: string) => void;
  /** Set the creator ID without opening the panel (for pre-loading) */
  setCreatorId: (creatorId: string | null) => void;
}

// ============================================
// CONTEXT
// ============================================

const CreatorContextContext = createContext<CreatorContextProviderValue | null>(null);

// Default no-op context for when provider is unavailable
const defaultCreatorContextValue: CreatorContextProviderValue = {
  selectedCreatorId: null,
  isPanelOpen: false,
  openCreatorContext: () => {
    console.warn("useCreatorContextPanel: CreatorContextProvider not available");
  },
  closeCreatorContext: () => {},
  toggleCreatorContext: () => {
    console.warn("useCreatorContextPanel: CreatorContextProvider not available");
  },
  setCreatorId: () => {
    console.warn("useCreatorContextPanel: CreatorContextProvider not available");
  },
};

export function useCreatorContextPanel() {
  const context = useContext(CreatorContextContext);
  // Return safe defaults if provider failed/missing - prevents cascade failures
  if (!context) {
    return defaultCreatorContextValue;
  }
  return context;
}

// ============================================
// PROVIDER COMPONENT
// ============================================

interface CreatorContextProviderProps {
  children: React.ReactNode;
}

export function CreatorContextProvider({ children }: CreatorContextProviderProps) {
  const pathname = usePathname();
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [lastCreatorId, setLastCreatorId] = useState<string | null>(null);

  // Close panel on route change (optional - can be configured)
  useEffect(() => {
    // Don't close on navigation if we want to keep context across pages
    // setIsPanelOpen(false);
  }, [pathname]);

  const openCreatorContext = useCallback((creatorId: string) => {
    setSelectedCreatorId(creatorId);
    setLastCreatorId(creatorId);
    setIsPanelOpen(true);
  }, []);

  const closeCreatorContext = useCallback(() => {
    setIsPanelOpen(false);
    // Keep selectedCreatorId so we can re-open with 'C' key
  }, []);

  const toggleCreatorContext = useCallback(
    (creatorId?: string) => {
      if (creatorId) {
        // If a new creator ID is provided
        if (isPanelOpen && selectedCreatorId === creatorId) {
          // Toggle off if already showing this creator
          setIsPanelOpen(false);
        } else {
          // Open for the new creator
          setSelectedCreatorId(creatorId);
          setLastCreatorId(creatorId);
          setIsPanelOpen(true);
        }
      } else {
        // No creator ID provided - toggle with last known creator
        if (isPanelOpen) {
          setIsPanelOpen(false);
        } else if (lastCreatorId || selectedCreatorId) {
          setSelectedCreatorId(lastCreatorId || selectedCreatorId);
          setIsPanelOpen(true);
        }
      }
    },
    [isPanelOpen, selectedCreatorId, lastCreatorId]
  );

  const setCreatorId = useCallback((creatorId: string | null) => {
    setSelectedCreatorId(creatorId);
    if (creatorId) {
      setLastCreatorId(creatorId);
    }
  }, []);

  // Register keyboard shortcut 'C' to toggle creator context panel
  useShortcut("c", () => toggleCreatorContext(), {
    enabled: true,
    description: "Toggle creator context panel",
    category: "actions",
    context: ["requests", "uploads", "messages", "creators"],
  });

  const contextValue: CreatorContextProviderValue = {
    selectedCreatorId,
    isPanelOpen,
    openCreatorContext,
    closeCreatorContext,
    toggleCreatorContext,
    setCreatorId,
  };

  return (
    <CreatorContextContext.Provider value={contextValue}>
      {children}
      <CreatorContextPanel
        creatorId={selectedCreatorId}
        isOpen={isPanelOpen}
        onClose={closeCreatorContext}
        onOpenChange={(open) => {
          if (!open) closeCreatorContext();
        }}
      />
    </CreatorContextContext.Provider>
  );
}

// ============================================
// HOOK FOR AUTOMATIC CREATOR DETECTION
// ============================================

/**
 * Hook that automatically sets the creator context based on the current page content.
 * Use this in pages that have creator-related content to enable the 'C' shortcut.
 */
export function useSetCreatorContext(creatorId: string | null) {
  const { setCreatorId } = useCreatorContextPanel();

  useEffect(() => {
    setCreatorId(creatorId);
    return () => {
      // Don't clear on unmount - keep for 'C' key toggle
    };
  }, [creatorId, setCreatorId]);
}

/**
 * Button component that opens the creator context panel when clicked.
 * Can be used in list items, cards, etc.
 */
export function CreatorContextTrigger({
  creatorId,
  children,
  className,
  asChild,
}: {
  creatorId: string;
  children: React.ReactNode;
  className?: string;
  asChild?: boolean;
}) {
  const { openCreatorContext } = useCreatorContextPanel();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openCreatorContext(creatorId);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: handleClick,
      className: `${(children as React.ReactElement<any>).props.className || ""} ${className || ""}`.trim(),
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
    >
      {children}
    </button>
  );
}

export default CreatorContextProvider;
