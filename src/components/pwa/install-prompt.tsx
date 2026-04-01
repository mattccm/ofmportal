"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Download, Smartphone, Share, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

const STORAGE_KEY = "pwa-install-prompt-dismissed";
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  // Check if app is already installed (standalone mode)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      setIsStandalone(standalone);

      // Detect iOS
      const iOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !(window as Window & { MSStream?: unknown }).MSStream;
      setIsIOS(iOS);
    }
  }, []);

  // Listen for the beforeinstallprompt event
  useEffect(() => {
    if (isStandalone) return;

    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);

      // Check if user has dismissed prompt recently
      const dismissedAt = localStorage.getItem(STORAGE_KEY);
      if (dismissedAt) {
        const dismissedTime = parseInt(dismissedAt, 10);
        if (Date.now() - dismissedTime < DISMISS_DURATION) {
          return;
        }
      }

      // Show prompt after a short delay for better UX
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // For iOS, check if we should show the prompt
    if (isIOS) {
      const dismissedAt = localStorage.getItem(STORAGE_KEY);
      if (!dismissedAt) {
        setTimeout(() => {
          setShowPrompt(true);
        }, 3000);
      } else {
        const dismissedTime = parseInt(dismissedAt, 10);
        if (Date.now() - dismissedTime >= DISMISS_DURATION) {
          setTimeout(() => {
            setShowPrompt(true);
          }, 3000);
        }
      }
    }

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, [isIOS, isStandalone]);

  const handleInstall = useCallback(async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === "accepted") {
        setDeferredPrompt(null);
        setShowPrompt(false);
      }
    } catch (error) {
      console.error("Error showing install prompt:", error);
    }
  }, [deferredPrompt, isIOS]);

  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
    setShowIOSInstructions(false);
  }, []);

  const handleDontShowAgain = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    setShowPrompt(false);
    setShowIOSInstructions(false);
  }, []);

  // Don't render if already installed or prompt shouldn't show
  if (isStandalone || !showPrompt) {
    return null;
  }

  return (
    <>
      {/* Main Install Prompt Banner */}
      <div
        className={cn(
          "fixed bottom-20 left-4 right-4 z-50 md:hidden",
          "animate-slide-up",
          showIOSInstructions && "hidden"
        )}
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl",
            "bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700",
            "p-4 shadow-xl shadow-primary/25"
          )}
        >
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className={cn(
              "absolute top-3 right-3",
              "flex h-8 w-8 items-center justify-center rounded-full",
              "bg-white/20 text-white/80 hover:bg-white/30 hover:text-white",
              "transition-colors active:scale-95",
              "touch-manipulation"
            )}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Content */}
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div
              className={cn(
                "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
                "bg-white/20 backdrop-blur-sm"
              )}
            >
              <Smartphone className="h-7 w-7 text-white" />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0 pt-1">
              <h3 className="font-semibold text-white text-lg leading-tight">
                Add to Home Screen
              </h3>
              <p className="text-white/80 text-sm mt-1 leading-relaxed">
                Install Content Portal for faster access and offline features
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3 mt-4">
            <Button
              onClick={handleInstall}
              className={cn(
                "flex-1 h-12 rounded-xl",
                "bg-white text-violet-700 font-semibold",
                "hover:bg-white/90 active:scale-[0.98]",
                "touch-manipulation transition-all"
              )}
            >
              <Download className="h-5 w-5 mr-2" />
              Install App
            </Button>
            <button
              onClick={handleDontShowAgain}
              className={cn(
                "text-sm text-white/70 hover:text-white underline-offset-2 hover:underline",
                "transition-colors touch-manipulation px-2 py-2"
              )}
            >
              Don&apos;t show again
            </button>
          </div>

          {/* Decorative elements */}
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-white/10 blur-xl" />
        </div>
      </div>

      {/* iOS Installation Instructions Modal */}
      {showIOSInstructions && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm md:hidden"
          onClick={handleDismiss}
        >
          <div
            className={cn(
              "w-full max-w-lg mx-4 mb-4 rounded-2xl bg-card",
              "animate-slide-up overflow-hidden"
            )}
            onClick={(e) => e.stopPropagation()}
            style={{
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
            }}
          >
            {/* Header */}
            <div className="relative bg-gradient-to-br from-violet-600 to-indigo-700 p-6 text-center">
              <button
                onClick={handleDismiss}
                className={cn(
                  "absolute top-4 right-4",
                  "flex h-8 w-8 items-center justify-center rounded-full",
                  "bg-white/20 text-white/80 hover:bg-white/30",
                  "transition-colors active:scale-95 touch-manipulation"
                )}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>

              <div
                className={cn(
                  "mx-auto flex h-16 w-16 items-center justify-center rounded-2xl",
                  "bg-white/20 backdrop-blur-sm mb-4"
                )}
              >
                <Smartphone className="h-8 w-8 text-white" />
              </div>

              <h3 className="font-bold text-white text-xl">Install Content Portal</h3>
              <p className="text-white/80 text-sm mt-2">
                Add this app to your home screen for quick access
              </p>
            </div>

            {/* Instructions */}
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                  )}
                >
                  <span className="font-bold">1</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Tap the Share button</p>
                  <div className="flex items-center gap-2 mt-1 text-muted-foreground text-sm">
                    <Share className="h-4 w-4" />
                    <span>at the bottom of your browser</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                  )}
                >
                  <span className="font-bold">2</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    Scroll and tap &quot;Add to Home Screen&quot;
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-muted-foreground text-sm">
                    <Plus className="h-4 w-4" />
                    <span>Add to Home Screen</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                  )}
                >
                  <span className="font-bold">3</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Tap &quot;Add&quot; to confirm</p>
                  <p className="text-muted-foreground text-sm mt-1">
                    The app will appear on your home screen
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border p-4 flex gap-3">
              <Button
                variant="outline"
                onClick={handleDontShowAgain}
                className="flex-1 h-12 rounded-xl touch-manipulation"
              >
                Don&apos;t show again
              </Button>
              <Button
                onClick={handleDismiss}
                className="flex-1 h-12 rounded-xl touch-manipulation"
              >
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
