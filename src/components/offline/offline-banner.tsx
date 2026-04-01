'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  WifiOff,
  X,
  CloudOff,
  FileText,
  Upload,
  MessageSquare,
  Eye,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOffline } from '@/hooks/use-offline';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// ============================================
// Types
// ============================================

interface OfflineBannerProps {
  position?: 'top' | 'bottom';
  dismissible?: boolean;
  showFeatures?: boolean;
  className?: string;
}

interface OfflineFeature {
  icon: React.ReactNode;
  title: string;
  description: string;
}

// ============================================
// Constants
// ============================================

const OFFLINE_FEATURES: OfflineFeature[] = [
  {
    icon: <FileText className="h-4 w-4" />,
    title: 'View Cached Requests',
    description: 'Browse previously loaded requests',
  },
  {
    icon: <Upload className="h-4 w-4" />,
    title: 'Queue Uploads',
    description: 'Save files to upload when online',
  },
  {
    icon: <MessageSquare className="h-4 w-4" />,
    title: 'Draft Messages',
    description: 'Write messages to send later',
  },
];

const DISMISS_KEY = 'offline-banner-dismissed';

// ============================================
// Main Component
// ============================================

export function OfflineBanner({
  position = 'top',
  dismissible = true,
  showFeatures = true,
  className,
}: OfflineBannerProps) {
  const { isOffline, isOnline, pendingActions, checkConnection } = useOffline();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  // Track offline state changes for reconnection notification
  useEffect(() => {
    if (isOffline) {
      setWasOffline(true);
      setIsDismissed(false);
    } else if (wasOffline && isOnline) {
      setShowReconnected(true);
      setWasOffline(false);

      // Auto-hide reconnection message after 5 seconds
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isOffline, isOnline, wasOffline]);

  // Reset dismissed state when going offline
  useEffect(() => {
    if (isOffline) {
      setIsDismissed(false);
    }
  }, [isOffline]);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    sessionStorage.setItem(DISMISS_KEY, 'true');
  }, []);

  const handleRetryConnection = useCallback(async () => {
    setIsChecking(true);
    try {
      await checkConnection();
    } finally {
      setIsChecking(false);
    }
  }, [checkConnection]);

  // Don't render if online and no reconnection message
  if (!isOffline && !showReconnected) {
    return null;
  }

  // Don't render if dismissed (but not for reconnection message)
  if (isDismissed && isOffline) {
    return null;
  }

  // ============================================
  // Reconnected Banner
  // ============================================

  if (showReconnected && !isOffline) {
    return (
      <div
        className={cn(
          'fixed left-0 right-0 z-50',
          position === 'top' ? 'top-0' : 'bottom-0',
          'animate-in slide-in-from-top duration-300',
          className
        )}
      >
        <div className="bg-emerald-500 text-white">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-12">
              <div className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                  <RefreshCw className="h-3.5 w-3.5" />
                </div>
                <span className="font-medium text-sm">
                  You are back online!
                  {pendingActions > 0 && (
                    <span className="ml-2 opacity-90">
                      Syncing {pendingActions} pending items...
                    </span>
                  )}
                </span>
              </div>

              <button
                onClick={() => setShowReconnected(false)}
                className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // Offline Banner
  // ============================================

  return (
    <div
      className={cn(
        'fixed left-0 right-0 z-50',
        position === 'top' ? 'top-0' : 'bottom-0',
        'animate-in slide-in-from-top duration-300',
        className
      )}
    >
      <div
        className={cn(
          'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
          'shadow-lg shadow-amber-500/20'
        )}
      >
        <div className="container mx-auto px-4">
          {/* Main Banner */}
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full',
                  'bg-white/20 backdrop-blur-sm'
                )}
              >
                <WifiOff className="h-4 w-4" />
              </div>
              <div>
                <span className="font-semibold text-sm sm:text-base">
                  You are currently offline
                </span>
                <span className="hidden sm:inline text-sm opacity-90 ml-2">
                  Some features may be limited
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Retry button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRetryConnection}
                disabled={isChecking}
                className="text-white hover:bg-white/20 hover:text-white"
              >
                <RefreshCw
                  className={cn('h-4 w-4 mr-2', isChecking && 'animate-spin')}
                />
                <span className="hidden sm:inline">Retry</span>
              </Button>

              {/* Toggle features */}
              {showFeatures && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-white hover:bg-white/20 hover:text-white"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">
                    {isExpanded ? 'Hide' : 'Available offline'}
                  </span>
                </Button>
              )}

              {/* Dismiss button */}
              {dismissible && (
                <button
                  onClick={handleDismiss}
                  className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Expanded Features */}
          {showFeatures && isExpanded && (
            <div
              className={cn(
                'pb-4 pt-2 border-t border-white/20',
                'animate-in fade-in slide-in-from-top-2 duration-200'
              )}
            >
              <p className="text-sm opacity-90 mb-3">
                While offline, you can still:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {OFFLINE_FEATURES.map((feature, index) => (
                  <div
                    key={index}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg',
                      'bg-white/10 backdrop-blur-sm'
                    )}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 flex-shrink-0">
                      {feature.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{feature.title}</p>
                      <p className="text-xs opacity-75">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* View cached content link */}
              <Link
                href="/offline"
                className={cn(
                  'inline-flex items-center gap-2 mt-4 text-sm font-medium',
                  'hover:underline underline-offset-2'
                )}
              >
                View cached content
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Minimal Offline Banner
// ============================================

interface MinimalOfflineBannerProps {
  className?: string;
}

export function MinimalOfflineBanner({ className }: MinimalOfflineBannerProps) {
  const { isOffline } = useOffline();

  if (!isOffline) {
    return null;
  }

  return (
    <div
      className={cn(
        'bg-amber-500 text-white text-center py-2 text-sm font-medium',
        'animate-in slide-in-from-top duration-200',
        className
      )}
    >
      <div className="flex items-center justify-center gap-2">
        <WifiOff className="h-4 w-4" />
        <span>You are offline - changes will sync when connection returns</span>
      </div>
    </div>
  );
}

// ============================================
// Floating Offline Indicator
// ============================================

interface FloatingOfflineIndicatorProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  className?: string;
}

export function FloatingOfflineIndicator({
  position = 'bottom-right',
  className,
}: FloatingOfflineIndicatorProps) {
  const { isOffline, pendingActions, syncNow, isSyncing } = useOffline();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isOffline && pendingActions === 0) {
    return null;
  }

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  return (
    <div
      className={cn(
        'fixed z-50',
        positionClasses[position],
        'animate-in fade-in zoom-in-95 duration-200',
        className
      )}
    >
      {isExpanded ? (
        <div
          className={cn(
            'rounded-2xl shadow-2xl overflow-hidden',
            'bg-card border border-border',
            'w-72'
          )}
        >
          <div
            className={cn(
              'p-4',
              isOffline
                ? 'bg-amber-500 text-white'
                : 'bg-muted'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOffline ? (
                  <CloudOff className="h-5 w-5" />
                ) : (
                  <RefreshCw className={cn('h-5 w-5', isSyncing && 'animate-spin')} />
                )}
                <span className="font-semibold">
                  {isOffline ? 'Offline Mode' : 'Syncing'}
                </span>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 rounded-full hover:bg-black/10 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {isOffline ? (
              <p className="text-sm text-muted-foreground">
                Your changes are being saved locally and will sync when you reconnect.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {pendingActions} items waiting to sync.
              </p>
            )}

            <div className="flex gap-2">
              <Link href="/offline" className="flex-1">
                <Button variant="outline" size="sm" className="w-full">
                  View Cached
                </Button>
              </Link>
              {!isOffline && (
                <Button
                  size="sm"
                  onClick={syncNow}
                  disabled={isSyncing}
                  className="flex-1"
                >
                  Sync Now
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsExpanded(true)}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg',
            'font-medium text-sm transition-all hover:scale-105',
            isOffline
              ? 'bg-amber-500 text-white hover:bg-amber-600'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          )}
        >
          {isOffline ? (
            <>
              <WifiOff className="h-4 w-4" />
              <span>Offline</span>
            </>
          ) : (
            <>
              <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
              <span>{pendingActions} pending</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
