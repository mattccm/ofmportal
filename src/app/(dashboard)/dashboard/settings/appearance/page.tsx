"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Sun, Moon, Monitor, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTheme, type Theme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";

const themeOptions: {
  value: Theme;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "light",
    label: "Light",
    description: "A bright theme with light backgrounds",
    icon: <Sun className="h-6 w-6" />,
  },
  {
    value: "dark",
    label: "Dark",
    description: "A dark theme that's easy on the eyes",
    icon: <Moon className="h-6 w-6" />,
  },
  {
    value: "system",
    label: "System",
    description: "Automatically match your system preferences",
    icon: <Monitor className="h-6 w-6" />,
  },
];

export default function AppearanceSettingsPage() {
  const { theme, setTheme, resolvedTheme, systemTheme, mounted } = useTheme();

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/settings">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-500/20 via-amber-500/20 to-yellow-500/20 flex items-center justify-center">
            <Sun className="h-7 w-7 text-orange-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Appearance</h1>
            <p className="text-muted-foreground">
              Customize how the portal looks for you
            </p>
          </div>
        </div>
      </div>

      {/* Theme Selection */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>
            Select your preferred color theme for the interface
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setTheme(option.value)}
                className={cn(
                  "relative flex flex-col items-center gap-4 rounded-xl border-2 p-6 transition-all duration-200",
                  "hover:bg-accent/50 active:scale-[0.98]",
                  theme === option.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                )}
              >
                {/* Selected indicator */}
                {theme === option.value && (
                  <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}

                {/* Icon */}
                <div
                  className={cn(
                    "h-14 w-14 rounded-xl flex items-center justify-center transition-all",
                    theme === option.value
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {option.icon}
                </div>

                {/* Text */}
                <div className="text-center">
                  <p className="font-semibold">{option.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {option.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Current Theme Info */}
      {mounted && (
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle>Current Theme</CardTitle>
            <CardDescription>
              Information about your active theme settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  {resolvedTheme === "dark" ? (
                    <Moon className="h-6 w-6 text-primary" />
                  ) : (
                    <Sun className="h-6 w-6 text-primary" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Theme</p>
                  <p className="font-semibold capitalize">{resolvedTheme} Mode</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
                <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <Monitor className="h-6 w-6 text-violet-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">System Preference</p>
                  <p className="font-semibold capitalize">{systemTheme} Mode</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Theme Preview */}
      <Card className="card-elevated overflow-hidden">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            See how your selected theme looks
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative">
            {/* Light Mode Preview */}
            <div
              className={cn(
                "p-6 bg-white border-t transition-opacity duration-300",
                resolvedTheme === "light" ? "opacity-100" : "opacity-0 absolute inset-0"
              )}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Light Mode Active</p>
                  <p className="text-sm text-gray-500">Clean and bright interface</p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-8 w-24 rounded-lg bg-violet-600"></div>
                <div className="h-8 w-24 rounded-lg bg-gray-200"></div>
                <div className="h-8 w-24 rounded-lg bg-gray-100 border border-gray-200"></div>
              </div>
            </div>

            {/* Dark Mode Preview */}
            <div
              className={cn(
                "p-6 bg-gray-900 border-t border-gray-800 transition-opacity duration-300",
                resolvedTheme === "dark" ? "opacity-100" : "opacity-0 absolute inset-0"
              )}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="h-10 w-10 rounded-xl bg-violet-900/50 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-violet-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-100">Dark Mode Active</p>
                  <p className="text-sm text-gray-400">Easy on the eyes</p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-8 w-24 rounded-lg bg-violet-500"></div>
                <div className="h-8 w-24 rounded-lg bg-gray-700"></div>
                <div className="h-8 w-24 rounded-lg bg-gray-800 border border-gray-700"></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pro Tip */}
      <Card className="card-elevated border-orange-200/50 bg-gradient-to-r from-orange-50/50 to-amber-50/50 dark:from-orange-950/20 dark:to-amber-950/20 dark:border-orange-800/30">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <h3 className="font-semibold text-orange-700 dark:text-orange-400">
                Pro Tip: Use System Theme
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Enable System theme to automatically switch between light and dark modes
                based on your operating system preferences. This is especially useful if
                you use scheduled dark mode on your device.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
