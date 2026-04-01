'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  WifiOff,
  RefreshCw,
  FileText,
  Upload,
  MessageSquare,
  Clock,
  ArrowLeft,
  Home,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Wifi,
  Settings,
  Trash2,
  Database,
  HardDrive,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOffline } from '@/hooks/use-offline';
import {
  getCacheSize,
  clearAllOfflineData,
  pruneExpiredCache,
  getPreferences,
  updatePreferences,
} from '@/lib/offline-storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OfflineRequestViewer } from '@/components/offline/offline-request-viewer';
import { PendingSyncPanel } from '@/components/offline/pending-sync-panel';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

// ============================================
// Types
// ============================================

interface OfflineCapability {
  icon: React.ReactNode;
  title: string;
  description: string;
  available: boolean;
}

// ============================================
// Helper Functions
// ============================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================
// Main Page Component
// ============================================

export default function OfflinePage() {
  const {
    isOffline,
    isOnline,
    pendingActions,
    lastSyncedAt,
    isSyncing,
    connectionQuality,
    syncNow,
    checkConnection,
  } = useOffline();

  const [isChecking, setIsChecking] = useState(false);
  const [cacheSize, setCacheSize] = useState<number>(0);
  const [showSettings, setShowSettings] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isPruning, setIsPruning] = useState(false);
  const [prunedCount, setPrunedCount] = useState<number | null>(null);
  const [autoSync, setAutoSync] = useState(true);
  const [notifyOnSync, setNotifyOnSync] = useState(true);

  // Load cache size and preferences
  useEffect(() => {
    const loadData = async () => {
      const size = await getCacheSize();
      setCacheSize(size);

      const prefs = await getPreferences();
      setAutoSync(prefs.autoSync);
      setNotifyOnSync(prefs.notifyOnSync);
    };
    loadData();
  }, []);

  const handleRetryConnection = useCallback(async () => {
    setIsChecking(true);
    try {
      const connected = await checkConnection();
      if (connected) {
        // Optionally trigger sync
        syncNow();
      }
    } finally {
      setIsChecking(false);
    }
  }, [checkConnection, syncNow]);

  const handleClearCache = useCallback(async () => {
    setIsClearing(true);
    try {
      await clearAllOfflineData();
      const size = await getCacheSize();
      setCacheSize(size);
    } finally {
      setIsClearing(false);
    }
  }, []);

  const handlePruneCache = useCallback(async () => {
    setIsPruning(true);
    try {
      const pruned = await pruneExpiredCache();
      setPrunedCount(pruned);
      const size = await getCacheSize();
      setCacheSize(size);

      // Clear the count after 3 seconds
      setTimeout(() => setPrunedCount(null), 3000);
    } finally {
      setIsPruning(false);
    }
  }, []);

  const handleToggleAutoSync = useCallback(async (enabled: boolean) => {
    setAutoSync(enabled);
    await updatePreferences({ autoSync: enabled });
  }, []);

  const handleToggleNotifications = useCallback(async (enabled: boolean) => {
    setNotifyOnSync(enabled);
    await updatePreferences({ notifyOnSync: enabled });
  }, []);

  // Offline capabilities
  const capabilities: OfflineCapability[] = [
    {
      icon: <FileText className="h-5 w-5" />,
      title: 'View Cached Requests',
      description: 'Browse requests you have previously viewed',
      available: true,
    },
    {
      icon: <Upload className="h-5 w-5" />,
      title: 'Queue Uploads',
      description: 'Save files to upload when back online',
      available: true,
    },
    {
      icon: <MessageSquare className="h-5 w-5" />,
      title: 'Draft Messages',
      description: 'Write messages and comments to send later',
      available: true,
    },
    {
      icon: <Clock className="h-5 w-5" />,
      title: 'Background Sync',
      description: 'Automatic sync when connection returns',
      available: true,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </Link>
              <div className="h-6 w-px bg-border hidden sm:block" />
              <h1 className="font-semibold">Offline Mode</h1>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
              <Link href="/">
                <Button variant="ghost" size="icon">
                  <Home className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Connection Status */}
        <Card
          className={cn(
            'border-2',
            isOffline ? 'border-amber-500/50' : 'border-emerald-500/50'
          )}
        >
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    'flex h-14 w-14 items-center justify-center rounded-full',
                    isOffline
                      ? 'bg-amber-500/10 text-amber-500'
                      : 'bg-emerald-500/10 text-emerald-500'
                  )}
                >
                  {isOffline ? (
                    <WifiOff className="h-7 w-7" />
                  ) : (
                    <Wifi className="h-7 w-7" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-semibold">
                    {isOffline ? 'You are offline' : 'You are online'}
                  </h2>
                  <p className="text-muted-foreground">
                    {isOffline
                      ? 'Some features are limited. Your changes will sync when connected.'
                      : pendingActions > 0
                      ? `${pendingActions} items pending sync`
                      : 'All changes are synced'}
                  </p>
                  {lastSyncedAt && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Last synced:{' '}
                      {lastSyncedAt.toLocaleString('en-US', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {isOffline ? (
                  <Button
                    onClick={handleRetryConnection}
                    disabled={isChecking}
                    className="bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    {isChecking ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retry Connection
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={syncNow}
                    disabled={isSyncing || pendingActions === 0}
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <Cloud className="h-4 w-4 mr-2" />
                        Sync Now
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settings Panel */}
        {showSettings && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Offline Settings
              </CardTitle>
              <CardDescription>
                Configure how offline mode works for you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-sync">Auto Sync</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically sync when connection returns
                  </p>
                </div>
                <Switch
                  id="auto-sync"
                  checked={autoSync}
                  onCheckedChange={handleToggleAutoSync}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notify-sync">Sync Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Show notifications when sync completes
                  </p>
                </div>
                <Switch
                  id="notify-sync"
                  checked={notifyOnSync}
                  onCheckedChange={handleToggleNotifications}
                />
              </div>

              <div className="border-t pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <HardDrive className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">Cache Size</p>
                      <p className="text-sm text-muted-foreground">
                        {formatBytes(cacheSize)} used
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePruneCache}
                      disabled={isPruning}
                    >
                      {isPruning ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : prunedCount !== null ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-500" />
                          Pruned {prunedCount}
                        </>
                      ) : (
                        'Prune Expired'
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearCache}
                      disabled={isClearing}
                      className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    >
                      {isClearing ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Clear All
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Offline Capabilities */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Available Offline</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {capabilities.map((capability, index) => (
              <Card key={index} className="relative">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0',
                        capability.available
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {capability.icon}
                    </div>
                    <div>
                      <p className="font-medium">{capability.title}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {capability.description}
                      </p>
                    </div>
                  </div>
                  {capability.available && (
                    <div className="absolute top-3 right-3">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Pending Sync Panel */}
        {pendingActions > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Pending Items</h3>
            <PendingSyncPanel maxHeight="300px" />
          </div>
        )}

        {/* Cached Requests */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Cached Requests</h3>
          <OfflineRequestViewer maxHeight="400px" />
        </div>

        {/* Help Section */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary flex-shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold">How Offline Mode Works</h4>
                <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">1.</span>
                    <span>
                      Content you view while online is automatically cached for
                      offline access.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">2.</span>
                    <span>
                      Actions like uploads and messages are queued and will sync
                      when you reconnect.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">3.</span>
                    <span>
                      Cached content may be outdated. Always verify important
                      information when online.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">4.</span>
                    <span>
                      Install the app for the best offline experience with larger
                      cache storage.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
