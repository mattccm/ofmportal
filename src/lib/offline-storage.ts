/**
 * Offline Storage Module
 *
 * IndexedDB wrapper for offline data persistence.
 * Handles cached requests, pending uploads, drafts, and user preferences.
 */

// ============================================
// Types
// ============================================

export interface CachedRequest {
  id: string;
  url: string;
  title: string;
  description?: string;
  status: 'active' | 'completed' | 'archived';
  deadline?: string;
  createdAt: string;
  updatedAt: string;
  cachedAt: number;
  data: Record<string, unknown>;
}

export interface PendingUpload {
  id: string;
  requestId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileData: ArrayBuffer | Blob;
  thumbnail?: string;
  status: 'pending' | 'uploading' | 'failed' | 'completed';
  retryCount: number;
  error?: string;
  createdAt: number;
  lastAttempt?: number;
}

export interface Draft {
  id: string;
  type: 'comment' | 'message' | 'note' | 'reply';
  parentId?: string;
  requestId?: string;
  conversationId?: string;
  content: string;
  attachments?: DraftAttachment[];
  createdAt: number;
  updatedAt: number;
}

export interface DraftAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  data: ArrayBuffer | Blob;
}

export interface UserPreferences {
  id: string;
  offlineMode: 'auto' | 'always' | 'never';
  autoSync: boolean;
  syncOnWifi: boolean;
  maxCacheSize: number; // in MB
  cacheExpiration: number; // in hours
  notifyOnSync: boolean;
  compressImages: boolean;
  maxImageSize: number; // in pixels (max dimension)
}

export interface SyncStatus {
  lastSyncedAt: number | null;
  pendingCount: number;
  failedCount: number;
  isSyncing: boolean;
}

export interface OfflineStore {
  requests: CachedRequest[];
  pendingUploads: PendingUpload[];
  drafts: Draft[];
  preferences: UserPreferences;
}

// ============================================
// Database Configuration
// ============================================

const DB_NAME = 'content-portal-offline-v1';
const DB_VERSION = 2;

const STORES = {
  REQUESTS: 'cached-requests',
  UPLOADS: 'pending-uploads',
  DRAFTS: 'drafts',
  PREFERENCES: 'preferences',
  SYNC_STATUS: 'sync-status',
  CACHE_META: 'cache-meta',
} as const;

// ============================================
// Database Connection
// ============================================

let db: IDBDatabase | null = null;

export async function openDatabase(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[OfflineStorage] Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;

      db.onversionchange = () => {
        db?.close();
        db = null;
      };

      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Cached requests store
      if (!database.objectStoreNames.contains(STORES.REQUESTS)) {
        const requestStore = database.createObjectStore(STORES.REQUESTS, {
          keyPath: 'id',
        });
        requestStore.createIndex('status', 'status');
        requestStore.createIndex('cachedAt', 'cachedAt');
        requestStore.createIndex('url', 'url');
      }

      // Pending uploads store
      if (!database.objectStoreNames.contains(STORES.UPLOADS)) {
        const uploadStore = database.createObjectStore(STORES.UPLOADS, {
          keyPath: 'id',
        });
        uploadStore.createIndex('requestId', 'requestId');
        uploadStore.createIndex('status', 'status');
        uploadStore.createIndex('createdAt', 'createdAt');
      }

      // Drafts store
      if (!database.objectStoreNames.contains(STORES.DRAFTS)) {
        const draftStore = database.createObjectStore(STORES.DRAFTS, {
          keyPath: 'id',
        });
        draftStore.createIndex('type', 'type');
        draftStore.createIndex('requestId', 'requestId');
        draftStore.createIndex('updatedAt', 'updatedAt');
      }

      // Preferences store
      if (!database.objectStoreNames.contains(STORES.PREFERENCES)) {
        database.createObjectStore(STORES.PREFERENCES, { keyPath: 'id' });
      }

      // Sync status store
      if (!database.objectStoreNames.contains(STORES.SYNC_STATUS)) {
        database.createObjectStore(STORES.SYNC_STATUS, { keyPath: 'id' });
      }

      // Cache metadata store
      if (!database.objectStoreNames.contains(STORES.CACHE_META)) {
        const metaStore = database.createObjectStore(STORES.CACHE_META, {
          keyPath: 'key',
        });
        metaStore.createIndex('expiresAt', 'expiresAt');
      }
    };
  });
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    db.close();
    db = null;
  }
}

// ============================================
// Generic Store Operations
// ============================================

async function getStore(
  storeName: string,
  mode: IDBTransactionMode = 'readonly'
): Promise<IDBObjectStore> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const store = await getStore(storeName, 'readonly');

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getByKey<T>(storeName: string, key: string): Promise<T | undefined> {
  const store = await getStore(storeName, 'readonly');

  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putInStore<T>(storeName: string, data: T): Promise<void> {
  const store = await getStore(storeName, 'readwrite');

  return new Promise((resolve, reject) => {
    const request = store.put(data);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function deleteFromStore(storeName: string, key: string): Promise<void> {
  const store = await getStore(storeName, 'readwrite');

  return new Promise((resolve, reject) => {
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function clearStore(storeName: string): Promise<void> {
  const store = await getStore(storeName, 'readwrite');

  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getByIndex<T>(
  storeName: string,
  indexName: string,
  value: IDBValidKey
): Promise<T[]> {
  const store = await getStore(storeName, 'readonly');
  const index = store.index(indexName);

  return new Promise((resolve, reject) => {
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ============================================
// Cached Requests Operations
// ============================================

export async function saveRequestForOffline(request: CachedRequest): Promise<void> {
  await putInStore(STORES.REQUESTS, {
    ...request,
    cachedAt: Date.now(),
  });
}

export async function getOfflineRequests(): Promise<CachedRequest[]> {
  return getAllFromStore<CachedRequest>(STORES.REQUESTS);
}

export async function getOfflineRequest(id: string): Promise<CachedRequest | undefined> {
  return getByKey<CachedRequest>(STORES.REQUESTS, id);
}

export async function getOfflineRequestsByStatus(
  status: CachedRequest['status']
): Promise<CachedRequest[]> {
  return getByIndex<CachedRequest>(STORES.REQUESTS, 'status', status);
}

export async function deleteOfflineRequest(id: string): Promise<void> {
  await deleteFromStore(STORES.REQUESTS, id);
}

export async function clearOfflineRequests(): Promise<void> {
  await clearStore(STORES.REQUESTS);
}

// ============================================
// Pending Uploads Operations
// ============================================

export async function addPendingUpload(upload: Omit<PendingUpload, 'id' | 'createdAt' | 'retryCount' | 'status'>): Promise<string> {
  const id = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const pendingUpload: PendingUpload = {
    ...upload,
    id,
    status: 'pending',
    retryCount: 0,
    createdAt: Date.now(),
  };

  await putInStore(STORES.UPLOADS, pendingUpload);
  return id;
}

export async function getPendingUploads(): Promise<PendingUpload[]> {
  return getAllFromStore<PendingUpload>(STORES.UPLOADS);
}

export async function getPendingUpload(id: string): Promise<PendingUpload | undefined> {
  return getByKey<PendingUpload>(STORES.UPLOADS, id);
}

export async function getPendingUploadsByRequest(requestId: string): Promise<PendingUpload[]> {
  return getByIndex<PendingUpload>(STORES.UPLOADS, 'requestId', requestId);
}

export async function getPendingUploadsByStatus(
  status: PendingUpload['status']
): Promise<PendingUpload[]> {
  return getByIndex<PendingUpload>(STORES.UPLOADS, 'status', status);
}

export async function updatePendingUpload(
  id: string,
  updates: Partial<PendingUpload>
): Promise<void> {
  const existing = await getPendingUpload(id);
  if (!existing) {
    throw new Error(`Pending upload not found: ${id}`);
  }

  await putInStore(STORES.UPLOADS, {
    ...existing,
    ...updates,
  });
}

export async function deletePendingUpload(id: string): Promise<void> {
  await deleteFromStore(STORES.UPLOADS, id);
}

export async function clearPendingUploads(): Promise<void> {
  await clearStore(STORES.UPLOADS);
}

// ============================================
// Drafts Operations
// ============================================

export async function saveDraft(
  draft: Omit<Draft, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<string> {
  const id = draft.id || `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();

  const existing = draft.id ? await getDraft(draft.id) : undefined;

  const draftData: Draft = {
    ...draft,
    id,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  await putInStore(STORES.DRAFTS, draftData);
  return id;
}

export async function getDrafts(): Promise<Draft[]> {
  return getAllFromStore<Draft>(STORES.DRAFTS);
}

export async function getDraft(id: string): Promise<Draft | undefined> {
  return getByKey<Draft>(STORES.DRAFTS, id);
}

export async function getDraftsByType(type: Draft['type']): Promise<Draft[]> {
  return getByIndex<Draft>(STORES.DRAFTS, 'type', type);
}

export async function getDraftsByRequest(requestId: string): Promise<Draft[]> {
  return getByIndex<Draft>(STORES.DRAFTS, 'requestId', requestId);
}

export async function deleteDraft(id: string): Promise<void> {
  await deleteFromStore(STORES.DRAFTS, id);
}

export async function clearDrafts(): Promise<void> {
  await clearStore(STORES.DRAFTS);
}

// ============================================
// User Preferences Operations
// ============================================

const DEFAULT_PREFERENCES: UserPreferences = {
  id: 'user-preferences',
  offlineMode: 'auto',
  autoSync: true,
  syncOnWifi: true,
  maxCacheSize: 100, // 100 MB
  cacheExpiration: 168, // 7 days in hours
  notifyOnSync: true,
  compressImages: true,
  maxImageSize: 2048,
};

export async function getPreferences(): Promise<UserPreferences> {
  const preferences = await getByKey<UserPreferences>(
    STORES.PREFERENCES,
    'user-preferences'
  );
  return preferences || DEFAULT_PREFERENCES;
}

export async function updatePreferences(
  updates: Partial<UserPreferences>
): Promise<UserPreferences> {
  const current = await getPreferences();
  const updated = {
    ...current,
    ...updates,
    id: 'user-preferences',
  };

  await putInStore(STORES.PREFERENCES, updated);
  return updated;
}

export async function resetPreferences(): Promise<UserPreferences> {
  await putInStore(STORES.PREFERENCES, DEFAULT_PREFERENCES);
  return DEFAULT_PREFERENCES;
}

// ============================================
// Sync Status Operations
// ============================================

export async function getSyncStatus(): Promise<SyncStatus> {
  const status = await getByKey<SyncStatus & { id: string }>(
    STORES.SYNC_STATUS,
    'sync-status'
  );

  if (!status) {
    return {
      lastSyncedAt: null,
      pendingCount: 0,
      failedCount: 0,
      isSyncing: false,
    };
  }

  return {
    lastSyncedAt: status.lastSyncedAt,
    pendingCount: status.pendingCount,
    failedCount: status.failedCount,
    isSyncing: status.isSyncing,
  };
}

export async function updateSyncStatus(
  updates: Partial<SyncStatus>
): Promise<void> {
  const current = await getSyncStatus();
  await putInStore(STORES.SYNC_STATUS, {
    id: 'sync-status',
    ...current,
    ...updates,
  });
}

// ============================================
// Generic Offline Data Operations
// ============================================

export type OfflineDataType = 'requests' | 'uploads' | 'drafts' | 'preferences';

export async function saveForOffline(
  type: OfflineDataType,
  data: unknown
): Promise<void> {
  switch (type) {
    case 'requests':
      await saveRequestForOffline(data as CachedRequest);
      break;
    case 'uploads':
      await addPendingUpload(data as Omit<PendingUpload, 'id' | 'createdAt' | 'retryCount' | 'status'>);
      break;
    case 'drafts':
      await saveDraft(data as Omit<Draft, 'id' | 'createdAt' | 'updatedAt'>);
      break;
    case 'preferences':
      await updatePreferences(data as Partial<UserPreferences>);
      break;
    default:
      throw new Error(`Unknown offline data type: ${type}`);
  }
}

export async function getOfflineData(type: OfflineDataType): Promise<unknown> {
  switch (type) {
    case 'requests':
      return getOfflineRequests();
    case 'uploads':
      return getPendingUploads();
    case 'drafts':
      return getDrafts();
    case 'preferences':
      return getPreferences();
    default:
      throw new Error(`Unknown offline data type: ${type}`);
  }
}

// ============================================
// Pending Actions Operations
// ============================================

export interface PendingAction {
  id: string;
  type: 'upload' | 'comment' | 'message' | 'update' | 'delete';
  entityType: 'request' | 'file' | 'comment' | 'message';
  entityId?: string;
  payload: Record<string, unknown>;
  createdAt: number;
  retryCount: number;
  lastError?: string;
}

export async function addPendingAction(
  action: Omit<PendingAction, 'id' | 'createdAt' | 'retryCount'>
): Promise<string> {
  // Pending actions are managed by the service worker
  // This function communicates with the SW via postMessage
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    return new Promise((resolve) => {
      const id = `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // The actual storage is handled by the service worker
      // This is for client-side tracking
      const pendingAction: PendingAction = {
        ...action,
        id,
        createdAt: Date.now(),
        retryCount: 0,
      };

      // Store locally for UI tracking
      const existingActions = JSON.parse(
        localStorage.getItem('pending-actions') || '[]'
      );
      existingActions.push(pendingAction);
      localStorage.setItem('pending-actions', JSON.stringify(existingActions));

      resolve(id);
    });
  }

  throw new Error('Service worker not available');
}

export function getPendingActions(): PendingAction[] {
  try {
    return JSON.parse(localStorage.getItem('pending-actions') || '[]');
  } catch {
    return [];
  }
}

export function clearSyncedActions(ids: string[]): void {
  const actions = getPendingActions();
  const remaining = actions.filter((a) => !ids.includes(a.id));
  localStorage.setItem('pending-actions', JSON.stringify(remaining));
}

// ============================================
// Cache Management
// ============================================

export async function getCacheSize(): Promise<number> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return estimate.usage || 0;
  }
  return 0;
}

export async function clearAllOfflineData(): Promise<void> {
  await Promise.all([
    clearOfflineRequests(),
    clearPendingUploads(),
    clearDrafts(),
  ]);

  localStorage.removeItem('pending-actions');

  // Clear caches via service worker
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'CLEAR_CACHE',
    });
  }
}

export async function pruneExpiredCache(): Promise<number> {
  const preferences = await getPreferences();
  const expirationTime = preferences.cacheExpiration * 60 * 60 * 1000;
  const cutoff = Date.now() - expirationTime;

  const requests = await getOfflineRequests();
  let pruned = 0;

  for (const request of requests) {
    if (request.cachedAt < cutoff) {
      await deleteOfflineRequest(request.id);
      pruned++;
    }
  }

  return pruned;
}

// ============================================
// Export/Import for Backup
// ============================================

export async function exportOfflineData(): Promise<string> {
  const data: OfflineStore = {
    requests: await getOfflineRequests(),
    pendingUploads: await getPendingUploads(),
    drafts: await getDrafts(),
    preferences: await getPreferences(),
  };

  return JSON.stringify(data, null, 2);
}

export async function importOfflineData(jsonData: string): Promise<void> {
  const data = JSON.parse(jsonData) as OfflineStore;

  // Import requests
  for (const request of data.requests) {
    await saveRequestForOffline(request);
  }

  // Import drafts (excluding pending uploads as they have binary data)
  for (const draft of data.drafts) {
    await saveDraft(draft);
  }

  // Import preferences
  if (data.preferences) {
    await updatePreferences(data.preferences);
  }
}
