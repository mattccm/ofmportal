"use client";

import { useState } from "react";
import { WidgetGrid, type WidgetConfig } from "@/components/dashboard/widget-grid";
import { WIDGET_DEFINITIONS } from "@/components/dashboard/widgets";
import { Sparkles } from "lucide-react";

interface DashboardClientProps {
  userName: string;
  initialLayout: WidgetConfig[];
}

export function DashboardClient({ userName, initialLayout }: DashboardClientProps) {
  const [layout, setLayout] = useState<WidgetConfig[]>(initialLayout);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Sparkles className="h-4 w-4" />
          <span>{greeting()}</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          Welcome back, {userName}
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Here&apos;s what&apos;s happening with your content today.
        </p>
      </div>

      {/* Widget Grid */}
      <WidgetGrid
        widgets={WIDGET_DEFINITIONS}
        initialLayout={layout}
        onLayoutChange={setLayout}
      />
    </div>
  );
}
