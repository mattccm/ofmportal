"use client";

import { ArrowLeft, Home } from "lucide-react";
import { ErrorShell } from "@/components/errors/error-shell";

// Creator-area 404: only ever points back into the creator app.
export default function CreatorNotFound() {
  return (
    <ErrorShell
      eyebrow="404"
      title="Page not found"
      message="This page doesn't exist. Your requests are all on your home screen."
      primaryAction={{ label: "Go to your requests", href: "/creator/dashboard", icon: Home }}
      secondaryAction={{
        label: "Go back",
        icon: ArrowLeft,
        onClick: () => {
          if (window.history.length > 1) window.history.back();
        },
      }}
    />
  );
}
