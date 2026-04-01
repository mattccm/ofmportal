'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getSyncStatus,
  updateSyncStatus,
  getPendingUploads,
  getDrafts,
  type SyncStatus,
  type PendingUpload,
  type Draft,
} from '@/lib/offline-storage';

// ============================================
// Types
// ============================================

export interface ConnectionQuality {
  type: 'wifi' | 'cellular' | '4g' | '3g' | '2g' | 'slow-2g' | 'offline' | 'unknown';
  effectiveType: string;
  downlink: number; // Mbps
  rtt: number; // ms
  saveData: boolean;
}

export interface OfflineState {
  isOffline: boolean;
  isOnline: boolean;
  pendingActions: number;
  pendingUploads: PendingUpload[];
  pendingDrafts: Draft[];
  lastSyncedAt: Date | null;
  isSyncing: boolean;
  syncError: string | null;
  connectionQuality: ConnectionQuality;
}

export interface UseOfflineReturn extends OfflineState {
  syncNow: () => Promise<void>;
  retryFailed: () => Promise<void>;
  clearPending: () => Promise<void>;
  checkConnection: () => Promise<boolean>;
}

// ============================================
// Network Information API Types
// ============================================

interface NetworkInformation {
  type: string;
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

declare global {
  interface Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  }
}

// ============================================
// Hook Implementation
// ============================================

export function useOffline(): UseOfflineReturn {
  const [isOffline, setIsOffline] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [pendingDrafts, setPendingDrafts] = useState<Draft[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>({
    type: 'unknown',
    effectiveType: 'unknown',
    downlink: 0,
    rtt: 0,
    saveData: false,
  });

  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageHandlerRef = useRef<((event: MessageEvent) => void) | null>(null);

  // ============================================
  // Connection Quality Detection
  // ============================================

  const updateConnectionQuality = useCallback(() => {
    const connection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;

    if (connection) {
      setConnectionQuality({
        type: (connection.type as ConnectionQuality['type']) || 'unknown',
        effectiveType: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 0,
        rtt: connection.rtt || 0,
        saveData: connection.saveData || false,
      });
    } else {
      setConnectionQuality((prev) => ({
        ...prev,
        type: navigator.onLine ? 'unknown' : 'offline',
      }));
    }
  }, []);

  // ============================================
  // Offline Detection
  // ============================================

  useEffect(() => {
    // Initialize offline state
    setIsOffline(!navigator.onLine);
    updateConnectionQuality();

    const handleOnline = () => {
      setIsOffline(false);
      updateConnectionQuality();

      // Trigger sync when coming back online
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      syncTimeoutRef.current = setTimeout(() => {
        triggerSync();
      }, 1000);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setConnectionQuality((prev) => ({
        ...prev,
        type: 'offline',
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for connection changes
    const connection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;

    if (connection) {
      connection.addEventListener('change', updateConnectionQuality);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);

      if (connection) {
        connection.removeEventListener('change', updateConnectionQuality);
      }

      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [updateConnectionQuality]);

  // ============================================
  // Service Worker Message Handling
  // ============================================

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      const { type, ...data } = event.data || {};

      switch (type) {
        case 'SYNC_COMPLETE':
          setIsSyncing(false);
          setLastSyncedAt(new Date());
          setSyncError(null);
          loadPendingItems();
          break;

        case 'SYNC_ERROR':
          setIsSyncing(false);
          setSyncError(data.error || 'Sync failed');
          break;

        case 'PENDING_ACTION_ADDED':
        case 'ACTION_SYNCED':
        case 'ACTION_FAILED':
        case 'PENDING_ACTION_DELETED':
          loadPendingItems();
          break;

        default:
          break;
      }
    };

    messageHandlerRef.current = handleMessage;
    navigator.serviceWorker.addEventListener('message', handleMessage);

    return () => {
      if (messageHandlerRef.current) {
        navigator.serviceWorker.removeEventListener(
          'message',
          messageHandlerRef.current
        );
      }
    };
  }, []);

  // ============================================
  // Load Pending Items
  // ============================================

  const loadPendingItems = useCallback(async () => {
    try {
      const [uploads, drafts, status] = await Promise.all([
        getPendingUploads(),
        getDrafts(),
        getSyncStatus(),
      ]);

      setPendingUploads(uploads);
      setPendingDrafts(drafts);

      if (status.lastSyncedAt) {
        setLastSyncedAt(new Date(status.lastSyncedAt));
      }
    } catch (error) {
      console.error('[useOffline] Failed to load pending items:', error);
    }
  }, []);

  // Load pending items on mount and periodically
  useEffect(() => {
    loadPendingItems();

    const interval = setInterval(loadPendingItems, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [loadPendingItems]);

  // ============================================
  // Sync Operations
  // ============================================

  const triggerSync = useCallback(async () => {
    if (isOffline || isSyncing) return;

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'FORCE_SYNC',
      });
    }
  }, [isOffline, isSyncing]);

  const syncNow = useCallback(async () => {
    if (isOffline) {
      setSyncError('Cannot sync while offline');
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      // Update sync status
      await updateSyncStatus({
        isSyncing: true,
      });

      // Trigger service worker sync
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'FORCE_SYNC',
        });
      }

      // Also sync any local pending uploads directly
      const uploads = await getPendingUploads();
      const pendingUploads = uploads.filter((u) => u.status === 'pending');

      // For now, just reload pending items after a delay
      // The actual sync is handled by the service worker
      await new Promise((resolve) => setTimeout(resolve, 2000));

      await updateSyncStatus({
        isSyncing: false,
        lastSyncedAt: Date.now(),
      });

      setLastSyncedAt(new Date());
      await loadPendingItems();
    } catch (error) {
      console.error('[useOffline] Sync failed:', error);
      setSyncError(error instanceof Error ? error.message : 'Sync failed');

      await updateSyncStatus({
        isSyncing: false,
      });
    } finally {
      setIsSyncing(false);
    }
  }, [isOffline, loadPendingItems]);

  const retryFailed = useCallback(async () => {
    // Retry failed uploads
    const uploads = await getPendingUploads();
    const failed = uploads.filter((u) => u.status === 'failed');

    // Reset status to pending for retry
    // This would trigger the sync process again
    await syncNow();
  }, [syncNow]);

  const clearPending = useCallback(async () => {
    // Clear all pending items via service worker
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CLEAR_PENDING',
      });
    }

    await loadPendingItems();
  }, [loadPendingItems]);

  // ============================================
  // Connection Check
  // ============================================

  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      // Attempt a lightweight request to check connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('/api/health', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeoutId);

      const isConnected = response.ok;
      setIsOffline(!isConnected);
      updateConnectionQuality();

      return isConnected;
    } catch {
      setIsOffline(true);
      return false;
    }
  }, [updateConnectionQuality]);

  // ============================================
  // Return Values
  // ============================================

  const pendingActions =
    pendingUploads.filter((u) => u.status !== 'completed').length +
    pendingDrafts.length;

  return {
    isOffline,
    isOnline: !isOffline,
    pendingActions,
    pendingUploads,
    pendingDrafts,
    lastSyncedAt,
    isSyncing,
    syncError,
    connectionQuality,
    syncNow,
    retryFailed,
    clearPending,
    checkConnection,
  };
}

// ============================================
// Utility Hook: Offline-aware Fetch
// ============================================

export function useOfflineFetch() {
  const { isOffline } = useOffline();

  const offlineFetch = useCallback(
    async <T>(
      url: string,
      options?: RequestInit,
      cacheKey?: string
    ): Promise<T | null> => {
      if (isOffline) {
        // Try to get from cache
        if (cacheKey) {
          const cached = localStorage.getItem(`offline-cache:${cacheKey}`);
          if (cached) {
            try {
              const { data, timestamp } = JSON.parse(cached);
              // Return cached data if less than 24 hours old
              if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
                return data as T;
              }
            } catch {
              // Invalid cache, ignore
            }
          }
        }
        return null;
      }

      try {
        const response = await fetch(url, options);
        const data = await response.json();

        // Cache the response
        if (cacheKey) {
          localStorage.setItem(
            `offline-cache:${cacheKey}`,
            JSON.stringify({
              data,
              timestamp: Date.now(),
            })
          );
        }

        return data as T;
      } catch (error) {
        // On error, try cache
        if (cacheKey) {
          const cached = localStorage.getItem(`offline-cache:${cacheKey}`);
          if (cached) {
            try {
              const { data } = JSON.parse(cached);
              return data as T;
            } catch {
              // Invalid cache, ignore
            }
          }
        }
        throw error;
      }
    },
    [isOffline]
  );

  return { offlineFetch, isOffline };
}

// ============================================
// Utility Hook: Simple Online/Offline State
// ============================================

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
