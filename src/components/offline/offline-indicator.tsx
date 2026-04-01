'use client';

import { useState } from 'react';
import {
  WifiOff,
  Wifi,
  RefreshCw,
  Cloud,
  CloudOff,
  Signal,
  SignalLow,
  SignalMedium,
  SignalHigh,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOffline } from '@/hooks/use-offline';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// ============================================
// Types
// ============================================

interface OfflineIndicatorProps {
  variant?: 'minimal' | 'compact' | 'full';
  showWhenOnline?: boolean;
  className?: string;
}

// ============================================
// Helper Functions
// ============================================

function formatRelativeTime(date: Date | null): string {
  if (!date) return 'Never';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}

function getConnectionIcon(quality: string) {
  switch (quality) {
    case '4g':
    case 'wifi':
      return SignalHigh;
    case '3g':
      return SignalMedium;
    case '2g':
    case 'slow-2g':
      return SignalLow;
    case 'offline':
      return WifiOff;
    default:
      return Signal;
  }
}

function getConnectionLabel(quality: string): string {
  switch (quality) {
    case 'wifi':
      return 'Wi-Fi';
    case '4g':
      return '4G';
    case '3g':
      return '3G';
    case '2g':
      return '2G';
    case 'slow-2g':
      return 'Slow';
    case 'offline':
      return 'Offline';
    default:
      return 'Unknown';
  }
}

// ============================================
// Main Component
// ============================================

export function OfflineIndicator({
  variant = 'compact',
  showWhenOnline = false,
  className,
}: OfflineIndicatorProps) {
  const {
    isOffline,
    isOnline,
    pendingActions,
    lastSyncedAt,
    isSyncing,
    syncError,
    connectionQuality,
    syncNow,
  } = useOffline();

  const [isOpen, setIsOpen] = useState(false);

  // Don't show when online if not requested
  if (isOnline && !showWhenOnline && pendingActions === 0) {
    return null;
  }

  const ConnectionIcon = getConnectionIcon(connectionQuality.effectiveType);
  const hasIssues = isOffline || pendingActions > 0 || syncError;

  // ============================================
  // Minimal Variant - Just an icon
  // ============================================

  if (variant === 'minimal') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'relative p-2 rounded-full transition-colors',
                isOffline
                  ? 'text-red-500 bg-red-500/10'
                  : pendingActions > 0
                  ? 'text-amber-500 bg-amber-500/10'
                  : 'text-emerald-500 bg-emerald-500/10',
                className
              )}
            >
              {isOffline ? (
                <WifiOff className="h-4 w-4" />
              ) : isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : pendingActions > 0 ? (
                <Cloud className="h-4 w-4" />
              ) : (
                <Wifi className="h-4 w-4" />
              )}

              {pendingActions > 0 && (
                <span
                  className={cn(
                    'absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center',
                    'rounded-full bg-amber-500 text-[10px] font-bold text-white'
                  )}
                >
                  {pendingActions > 9 ? '9+' : pendingActions}
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {isOffline
                ? 'You are offline'
                : pendingActions > 0
                ? `${pendingActions} pending actions`
                : 'Connected'}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // ============================================
  // Compact Variant - Icon with badge
  // ============================================

  if (variant === 'compact') {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isOffline
                ? 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20'
                : pendingActions > 0
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20',
              className
            )}
          >
            {isOffline ? (
              <>
                <WifiOff className="h-4 w-4" />
                <span>Offline</span>
              </>
            ) : isSyncing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Syncing...</span>
              </>
            ) : pendingActions > 0 ? (
              <>
                <Cloud className="h-4 w-4" />
                <span>{pendingActions} pending</span>
              </>
            ) : (
              <>
                <Wifi className="h-4 w-4" />
                <span>Online</span>
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="end">
          <OfflineStatusPanel
            onSync={syncNow}
            onClose={() => setIsOpen(false)}
          />
        </PopoverContent>
      </Popover>
    );
  }

  // ============================================
  // Full Variant - Complete status display
  // ============================================

  return (
    <div
      className={cn(
        'rounded-lg border p-4 space-y-4',
        isOffline
          ? 'border-red-500/20 bg-red-500/5'
          : pendingActions > 0
          ? 'border-amber-500/20 bg-amber-500/5'
          : 'border-emerald-500/20 bg-emerald-500/5',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full',
              isOffline
                ? 'bg-red-500/10 text-red-500'
                : pendingActions > 0
                ? 'bg-amber-500/10 text-amber-500'
                : 'bg-emerald-500/10 text-emerald-500'
            )}
          >
            {isOffline ? (
              <CloudOff className="h-5 w-5" />
            ) : isSyncing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : pendingActions > 0 ? (
              <Cloud className="h-5 w-5" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )}
          </div>
          <div>
            <p className="font-medium">
              {isOffline
                ? 'You are offline'
                : isSyncing
                ? 'Syncing...'
                : pendingActions > 0
                ? 'Changes pending'
                : 'All synced'}
            </p>
            <p className="text-sm text-muted-foreground">
              {isOffline
                ? 'Changes will sync when online'
                : lastSyncedAt
                ? `Last synced ${formatRelativeTime(lastSyncedAt)}`
                : 'Never synced'}
            </p>
          </div>
        </div>

        {!isOffline && (
          <Button
            variant="outline"
            size="sm"
            onClick={syncNow}
            disabled={isSyncing}
          >
            <RefreshCw
              className={cn('h-4 w-4 mr-2', isSyncing && 'animate-spin')}
            />
            Sync
          </Button>
        )}
      </div>

      {/* Connection quality */}
      <div className="flex items-center gap-2 text-sm">
        <ConnectionIcon className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">
          Connection: {getConnectionLabel(connectionQuality.effectiveType)}
        </span>
        {connectionQuality.downlink > 0 && (
          <span className="text-muted-foreground">
            ({connectionQuality.downlink.toFixed(1)} Mbps)
          </span>
        )}
      </div>

      {/* Pending actions */}
      {pendingActions > 0 && (
        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
          <Clock className="h-4 w-4" />
          <span>{pendingActions} actions waiting to sync</span>
        </div>
      )}

      {/* Sync error */}
      {syncError && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />
          <span>{syncError}</span>
        </div>
      )}
    </div>
  );
}

// ============================================
// Status Panel Component
// ============================================

interface OfflineStatusPanelProps {
  onSync: () => Promise<void>;
  onClose?: () => void;
}

function OfflineStatusPanel({ onSync, onClose }: OfflineStatusPanelProps) {
  const {
    isOffline,
    pendingActions,
    pendingUploads,
    pendingDrafts,
    lastSyncedAt,
    isSyncing,
    syncError,
    connectionQuality,
  } = useOffline();

  const ConnectionIcon = getConnectionIcon(connectionQuality.effectiveType);

  return (
    <div className="divide-y divide-border">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full',
              isOffline
                ? 'bg-red-500/10 text-red-500'
                : 'bg-emerald-500/10 text-emerald-500'
            )}
          >
            {isOffline ? (
              <WifiOff className="h-5 w-5" />
            ) : (
              <Wifi className="h-5 w-5" />
            )}
          </div>
          <div>
            <p className="font-semibold">
              {isOffline ? 'Offline Mode' : 'Connected'}
            </p>
            <p className="text-xs text-muted-foreground">
              {getConnectionLabel(connectionQuality.effectiveType)}
              {connectionQuality.downlink > 0 &&
                ` - ${connectionQuality.downlink.toFixed(1)} Mbps`}
            </p>
          </div>
        </div>
      </div>

      {/* Status Items */}
      <div className="p-4 space-y-3">
        {/* Last synced */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Last synced</span>
          <span className="font-medium">
            {formatRelativeTime(lastSyncedAt)}
          </span>
        </div>

        {/* Pending uploads */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Pending uploads</span>
          <span
            className={cn(
              'font-medium',
              pendingUploads.length > 0 && 'text-amber-500'
            )}
          >
            {pendingUploads.filter((u) => u.status !== 'completed').length}
          </span>
        </div>

        {/* Drafts */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Unsaved drafts</span>
          <span
            className={cn(
              'font-medium',
              pendingDrafts.length > 0 && 'text-amber-500'
            )}
          >
            {pendingDrafts.length}
          </span>
        </div>

        {/* Sync error */}
        {syncError && (
          <div className="flex items-center gap-2 text-xs text-red-500 bg-red-500/10 rounded-lg p-2">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="line-clamp-2">{syncError}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4">
        <Button
          className="w-full"
          onClick={onSync}
          disabled={isOffline || isSyncing}
        >
          {isSyncing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync Now
            </>
          )}
        </Button>

        {isOffline && (
          <p className="text-xs text-center text-muted-foreground mt-2">
            Sync will resume when online
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================
// Exports
// ============================================

export { OfflineStatusPanel };
