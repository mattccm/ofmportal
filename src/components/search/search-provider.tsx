"use client";

import * as React from "react";
import { GlobalSearch } from "./global-search";

interface SearchContextValue {
  isOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;
}

const SearchContext = React.createContext<SearchContextValue | undefined>(undefined);

export function useSearch() {
  const context = React.useContext(SearchContext);
  if (!context) {
    throw new Error("useSearch must be used within a SearchProvider");
  }
  return context;
}

interface SearchProviderProps {
  children: React.ReactNode;
}

export function SearchProvider({ children }: SearchProviderProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const openSearch = React.useCallback(() => setIsOpen(true), []);
  const closeSearch = React.useCallback(() => setIsOpen(false), []);
  const toggleSearch = React.useCallback(() => setIsOpen((prev) => !prev), []);

  // Handle Cmd+K / Ctrl+K keyboard shortcut
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        e.stopPropagation();
        toggleSearch();
      }
    };

    // Add listener to document
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [toggleSearch]);

  const value = React.useMemo(
    () => ({
      isOpen,
      openSearch,
      closeSearch,
      toggleSearch,
    }),
    [isOpen, openSearch, closeSearch, toggleSearch]
  );

  return (
    <SearchContext.Provider value={value}>
      {children}
      <GlobalSearch open={isOpen} onOpenChange={setIsOpen} />
    </SearchContext.Provider>
  );
}
