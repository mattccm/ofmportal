"use client";

import { useEffect, useState } from "react";
import { AgencyChecklist } from "./agency-checklist";

interface AgencyChecklistWrapperProps {
  className?: string;
  showByDefault?: boolean;
}

/**
 * Wrapper component that handles client-side logic for showing/hiding the checklist
 * Used in server components like the dashboard page
 */
export function AgencyChecklistWrapper({
  className,
  showByDefault = true,
}: AgencyChecklistWrapperProps) {
  const [shouldShow, setShouldShow] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed in localStorage (quick check for UX)
    const localDismissed = localStorage.getItem("agency_checklist_dismissed");
    if (localDismissed === "true") {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("agency_checklist_dismissed", "true");
    setDismissed(true);
    setShouldShow(false);
  };

  // Don't render if dismissed or explicitly hidden
  if (!showByDefault || dismissed || !shouldShow) {
    return null;
  }

  return (
    <AgencyChecklist
      className={className}
      defaultExpanded={true}
      onDismiss={handleDismiss}
      onTaskComplete={(taskId) => {
        console.log(`Task completed: ${taskId}`);
      }}
      onAllComplete={() => {
        console.log("All tasks completed!");
      }}
    />
  );
}

export default AgencyChecklistWrapper;
