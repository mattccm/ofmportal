"use client";

import * as React from "react";
import { AnnouncementStack, type Announcement } from "./announcement-banner";

interface AnnouncementsContextType {
  announcements: Announcement[];
  isLoading: boolean;
  dismissAnnouncement: (id: string) => void;
  refreshAnnouncements: () => void;
}

const AnnouncementsContext = React.createContext<AnnouncementsContextType | null>(null);

export function useAnnouncements() {
  const context = React.useContext(AnnouncementsContext);
  if (!context) {
    throw new Error("useAnnouncements must be used within an AnnouncementsProvider");
  }
  return context;
}

interface AnnouncementsProviderProps {
  children: React.ReactNode;
}

export function AnnouncementsProvider({ children }: AnnouncementsProviderProps) {
  const [announcements, setAnnouncements] = React.useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchAnnouncements = React.useCallback(async () => {
    try {
      const response = await fetch("/api/announcements?forDisplay=true");
      if (response.ok) {
        const data = await response.json();
        setAnnouncements(data.announcements || []);
      }
    } catch (error) {
      console.error("Error fetching announcements:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchAnnouncements();

    // Refresh announcements every 5 minutes
    const interval = setInterval(fetchAnnouncements, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAnnouncements]);

  const dismissAnnouncement = React.useCallback(async (id: string) => {
    // Optimistically remove from UI
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));

    // Send dismiss request to API
    try {
      await fetch("/api/announcements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ announcementId: id }),
      });
    } catch (error) {
      console.error("Error dismissing announcement:", error);
      // Could restore the announcement on error, but for better UX we keep it dismissed
    }
  }, []);

  const value = React.useMemo(
    () => ({
      announcements,
      isLoading,
      dismissAnnouncement,
      refreshAnnouncements: fetchAnnouncements,
    }),
    [announcements, isLoading, dismissAnnouncement, fetchAnnouncements]
  );

  return (
    <AnnouncementsContext.Provider value={value}>
      {children}
    </AnnouncementsContext.Provider>
  );
}

// Component to display announcements in the layout
export function AnnouncementsDisplay() {
  const { announcements, isLoading, dismissAnnouncement } = useAnnouncements();

  if (isLoading || announcements.length === 0) {
    return null;
  }

  return (
    <AnnouncementStack
      announcements={announcements}
      onDismiss={dismissAnnouncement}
      maxVisible={3}
    />
  );
}
