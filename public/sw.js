// Content Portal Service Worker
// Version: 1.0.0

const CACHE_VERSION = 'v2';
const STATIC_CACHE = `content-portal-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `content-portal-dynamic-${CACHE_VERSION}`;
const API_CACHE = `content-portal-api-${CACHE_VERSION}`;
const IMAGE_CACHE = `content-portal-images-${CACHE_VERSION}`;

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/portal/login',
  '/manifest.webmanifest',
];

// API routes that should use network-first strategy
const API_ROUTES = [
  '/api/',
];

// Auth routes that should NEVER be cached or intercepted by service worker
// This is critical for iOS Safari PWA where service worker can interfere with auth cookies
const AUTH_ROUTES = [
  '/api/auth/',
  '/login',
  '/register',
  '/portal/login',
];

// Routes that should be cached for offline access
const CACHEABLE_ROUTES = [
  '/portal/',
  '/dashboard/',
];

// Max items in dynamic cache
const MAX_DYNAMIC_CACHE_ITEMS = 50;
const MAX_IMAGE_CACHE_ITEMS = 100;
const MAX_API_CACHE_ITEMS = 30;

// Cache expiration times (in milliseconds)
const API_CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes
const DYNAMIC_CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

// IndexedDB for offline actions queue
const DB_NAME = 'content-portal-offline';
const DB_VERSION = 1;
const PENDING_ACTIONS_STORE = 'pending-actions';

// ============================================
// Service Worker Installation
// ============================================

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// ============================================
// Service Worker Activation
// ============================================

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              return name.startsWith('content-portal-') &&
                     !name.includes(CACHE_VERSION);
            })
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      }),
      // Take control of all clients
      self.clients.claim(),
    ])
  );
});

// ============================================
// Fetch Event Handler
// ============================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // CRITICAL: Skip ALL auth routes entirely - let browser handle them directly
  // This fixes iOS Safari PWA session issues where service worker interferes with cookies
  if (isAuthRoute(url)) {
    return; // Let the browser handle auth requests without any SW interference
  }

  // Skip non-GET requests for caching (but handle POST for background sync)
  // But never intercept auth-related POST requests
  if (request.method !== 'GET') {
    if ((request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') && !isAuthRoute(url)) {
      event.respondWith(handleMutationRequest(request));
    }
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Determine caching strategy based on request type
  if (isApiRequest(url)) {
    event.respondWith(networkFirstStrategy(request, API_CACHE));
  } else if (isImageRequest(url)) {
    event.respondWith(cacheFirstStrategy(request, IMAGE_CACHE));
  } else if (isStaticAsset(url)) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
  } else if (isCacheableRoute(url)) {
    event.respondWith(networkFirstWithOfflineFallback(request));
  } else {
    event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE));
  }
});

// ============================================
// Caching Strategies
// ============================================

/**
 * Network First Strategy
 * Try network first, fall back to cache if offline
 */
async function networkFirstStrategy(request, cacheName) {
  try {
    const networkResponse = await fetchWithTimeout(request, 10000);

    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
      await trimCache(cacheName, getMaxCacheItems(cacheName));
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache for:', request.url);

    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline fallback for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline');
    }

    throw error;
  }
}

/**
 * Cache First Strategy
 * Try cache first, fall back to network
 */
async function cacheFirstStrategy(request, cacheName) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    // Refresh cache in background
    refreshCacheInBackground(request, cacheName);
    return cachedResponse;
  }

  try {
    const networkResponse = await fetchWithTimeout(request, 15000);

    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
      await trimCache(cacheName, getMaxCacheItems(cacheName));
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Failed to fetch:', request.url);

    // Return placeholder for images
    if (isImageRequest(new URL(request.url))) {
      return createImagePlaceholder();
    }

    throw error;
  }
}

/**
 * Network First with Offline Fallback
 * For navigational requests
 */
async function networkFirstWithOfflineFallback(request) {
  try {
    const networkResponse = await fetchWithTimeout(request, 10000);

    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
      await trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_CACHE_ITEMS);
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed for navigation:', request.url);

    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page
    const offlinePage = await caches.match('/offline');
    if (offlinePage) {
      return offlinePage;
    }

    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

/**
 * Handle mutation requests (POST, PUT, DELETE)
 * Queue for background sync if offline
 */
async function handleMutationRequest(request) {
  try {
    const response = await fetchWithTimeout(request.clone(), 10000);
    return response;
  } catch (error) {
    // Queue for background sync if offline
    if (!navigator.onLine) {
      await queueForSync(request);

      return new Response(JSON.stringify({
        success: true,
        offline: true,
        message: 'Your request has been queued and will sync when online.',
      }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    throw error;
  }
}

// ============================================
// Background Sync
// ============================================

self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'sync-pending-actions') {
    event.waitUntil(processPendingActions());
  }
});

/**
 * Queue a request for background sync
 */
async function queueForSync(request) {
  const db = await openDatabase();
  const tx = db.transaction(PENDING_ACTIONS_STORE, 'readwrite');
  const store = tx.objectStore(PENDING_ACTIONS_STORE);

  const action = {
    id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: await request.text(),
    timestamp: Date.now(),
    retryCount: 0,
  };

  await store.add(action);

  // Register for background sync if supported
  if ('sync' in self.registration) {
    try {
      await self.registration.sync.register('sync-pending-actions');
    } catch (error) {
      console.error('[SW] Failed to register sync:', error);
    }
  }

  // Notify clients
  await notifyClients({
    type: 'PENDING_ACTION_ADDED',
    action: {
      id: action.id,
      url: action.url,
      method: action.method,
      timestamp: action.timestamp,
    },
  });
}

/**
 * Process pending actions
 */
async function processPendingActions() {
  console.log('[SW] Processing pending actions...');

  const db = await openDatabase();
  const tx = db.transaction(PENDING_ACTIONS_STORE, 'readwrite');
  const store = tx.objectStore(PENDING_ACTIONS_STORE);
  const actions = await store.getAll();

  const results = {
    success: [],
    failed: [],
  };

  for (const action of actions) {
    try {
      const response = await fetch(action.url, {
        method: action.method,
        headers: action.headers,
        body: action.body || undefined,
      });

      if (response.ok) {
        // Remove from store
        await store.delete(action.id);
        results.success.push(action.id);

        await notifyClients({
          type: 'ACTION_SYNCED',
          actionId: action.id,
          success: true,
        });
      } else if (response.status >= 400 && response.status < 500) {
        // Client error - don't retry
        await store.delete(action.id);
        results.failed.push({
          id: action.id,
          error: 'Client error: ' + response.status,
        });

        await notifyClients({
          type: 'ACTION_FAILED',
          actionId: action.id,
          error: 'Request failed with status ' + response.status,
        });
      } else {
        // Server error - retry with backoff
        action.retryCount++;
        if (action.retryCount < 5) {
          action.lastRetry = Date.now();
          await store.put(action);
        } else {
          await store.delete(action.id);
          results.failed.push({
            id: action.id,
            error: 'Max retries exceeded',
          });

          await notifyClients({
            type: 'ACTION_FAILED',
            actionId: action.id,
            error: 'Max retries exceeded',
          });
        }
      }
    } catch (error) {
      console.error('[SW] Failed to sync action:', action.id, error);
      action.retryCount++;
      if (action.retryCount < 5) {
        action.lastRetry = Date.now();
        await store.put(action);
      }
    }
  }

  // Notify about sync completion
  await notifyClients({
    type: 'SYNC_COMPLETE',
    results,
  });

  console.log('[SW] Sync complete:', results);
}

// ============================================
// IndexedDB Helpers
// ============================================

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(PENDING_ACTIONS_STORE)) {
        const store = db.createObjectStore(PENDING_ACTIONS_STORE, {
          keyPath: 'id',
        });
        store.createIndex('timestamp', 'timestamp');
        store.createIndex('url', 'url');
      }
    };
  });
}

// ============================================
// Utility Functions
// ============================================

function isApiRequest(url) {
  // Don't treat auth routes as regular API routes
  if (isAuthRoute(url)) return false;
  return API_ROUTES.some((route) => url.pathname.startsWith(route));
}

/**
 * Check if the request is for an auth-related route
 * These should NEVER be intercepted by the service worker to avoid
 * cookie/session issues, especially on iOS Safari PWA
 */
function isAuthRoute(url) {
  return AUTH_ROUTES.some((route) => url.pathname.startsWith(route));
}

function isImageRequest(url) {
  return /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(url.pathname);
}

function isStaticAsset(url) {
  return /\.(js|css|woff2?|ttf|eot)$/i.test(url.pathname) ||
         url.pathname.startsWith('/_next/static/');
}

function isCacheableRoute(url) {
  return CACHEABLE_ROUTES.some((route) => url.pathname.startsWith(route));
}

function getMaxCacheItems(cacheName) {
  switch (cacheName) {
    case IMAGE_CACHE:
      return MAX_IMAGE_CACHE_ITEMS;
    case API_CACHE:
      return MAX_API_CACHE_ITEMS;
    default:
      return MAX_DYNAMIC_CACHE_ITEMS;
  }
}

async function fetchWithTimeout(request, timeout) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  if (keys.length > maxItems) {
    const deleteCount = keys.length - maxItems;
    for (let i = 0; i < deleteCount; i++) {
      await cache.delete(keys[i]);
    }
  }
}

function refreshCacheInBackground(request, cacheName) {
  setTimeout(async () => {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(cacheName);
        await cache.put(request, response);
      }
    } catch (error) {
      // Silently fail - we have cached version
    }
  }, 100);
}

function createImagePlaceholder() {
  const svg = `
    <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#374151"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9CA3AF" font-size="12">
        Offline
      </text>
    </svg>
  `;

  return new Response(svg, {
    headers: { 'Content-Type': 'image/svg+xml' },
  });
}

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach((client) => {
    client.postMessage(message);
  });
}

// ============================================
// Message Handler
// ============================================

self.addEventListener('message', async (event) => {
  const { type, data } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'GET_PENDING_ACTIONS':
      try {
        const db = await openDatabase();
        const tx = db.transaction(PENDING_ACTIONS_STORE, 'readonly');
        const store = tx.objectStore(PENDING_ACTIONS_STORE);
        const actions = await store.getAll();

        event.source.postMessage({
          type: 'PENDING_ACTIONS',
          actions: actions.map((a) => ({
            id: a.id,
            url: a.url,
            method: a.method,
            timestamp: a.timestamp,
            retryCount: a.retryCount,
          })),
        });
      } catch (error) {
        event.source.postMessage({
          type: 'PENDING_ACTIONS_ERROR',
          error: error.message,
        });
      }
      break;

    case 'DELETE_PENDING_ACTION':
      try {
        const db = await openDatabase();
        const tx = db.transaction(PENDING_ACTIONS_STORE, 'readwrite');
        const store = tx.objectStore(PENDING_ACTIONS_STORE);
        await store.delete(data.id);

        event.source.postMessage({
          type: 'PENDING_ACTION_DELETED',
          id: data.id,
        });
      } catch (error) {
        event.source.postMessage({
          type: 'DELETE_ERROR',
          error: error.message,
        });
      }
      break;

    case 'FORCE_SYNC':
      try {
        await processPendingActions();
      } catch (error) {
        event.source.postMessage({
          type: 'SYNC_ERROR',
          error: error.message,
        });
      }
      break;

    case 'CACHE_URLS':
      try {
        const cache = await caches.open(DYNAMIC_CACHE);
        await Promise.all(
          data.urls.map((url) => cache.add(url).catch(() => {}))
        );
        event.source.postMessage({
          type: 'URLS_CACHED',
          count: data.urls.length,
        });
      } catch (error) {
        event.source.postMessage({
          type: 'CACHE_ERROR',
          error: error.message,
        });
      }
      break;

    case 'CLEAR_CACHE':
      try {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames
            .filter((name) => name.startsWith('content-portal-'))
            .map((name) => caches.delete(name))
        );
        event.source.postMessage({
          type: 'CACHE_CLEARED',
        });
      } catch (error) {
        event.source.postMessage({
          type: 'CLEAR_CACHE_ERROR',
          error: error.message,
        });
      }
      break;

    case 'GET_CACHE_STATUS':
      try {
        const status = {};
        const cacheNames = await caches.keys();

        for (const name of cacheNames) {
          if (name.startsWith('content-portal-')) {
            const cache = await caches.open(name);
            const keys = await cache.keys();
            status[name] = keys.length;
          }
        }

        event.source.postMessage({
          type: 'CACHE_STATUS',
          status,
        });
      } catch (error) {
        event.source.postMessage({
          type: 'CACHE_STATUS_ERROR',
          error: error.message,
        });
      }
      break;
  }
});

// ============================================
// Push Notifications (for future use)
// ============================================

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();

    event.waitUntil(
      self.registration.showNotification(data.title || 'Content Portal', {
        body: data.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: data.tag || 'default',
        data: data.data,
        actions: data.actions,
        requireInteraction: data.requireInteraction || false,
      })
    );
  } catch (error) {
    console.error('[SW] Failed to handle push:', error);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Focus existing window if available
      for (const client of clients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

console.log('[SW] Service worker loaded');
