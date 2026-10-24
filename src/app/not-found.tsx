"use client";

import { usePathname } from "next/navigation";
import { ArrowLeft, LayoutDashboard, Upload } from "lucide-react";
import { ErrorShell } from "@/components/errors/error-shell";

// Root 404. Creator URLs only get the creator home; anything else is neutral
// (the visitor may be staff or a creator), so both entry points are offered.
export default function NotFound() {
  const pathname = usePathname();
  const creator = !!pathname && /^\/(creator|portal)(\/|$)/.test(pathname);

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
  };

  return (
    <ErrorShell
      fullScreen
      eyebrow="404"
      title="Page not found"
      message="The page you're looking for doesn't exist or has been moved."
      primaryAction={{ label: "Creator portal", href: "/creator/dashboard", icon: Upload }}
      secondaryAction={
        creator
          ? { label: "Go back", onClick: goBack, icon: ArrowLeft }
          : { label: "Staff dashboard", href: "/dashboard", icon: LayoutDashboard }
      }
      extraActions={creator ? undefined : [{ label: "Go back", onClick: goBack, icon: ArrowLeft }]}
    />
  );
}
