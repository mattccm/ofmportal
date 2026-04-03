/**
 * Remember Token Management for iOS PWA Session Persistence
 *
 * This module handles storing and retrieving "remember me" tokens
 * in IndexedDB, which iOS Safari preserves better than cookies
 * in standalone (PWA) mode.
 */

const DB_NAME = "auth-remember";
const DB_VERSION = 1;
const STORE_NAME = "tokens";
const TOKEN_KEY = "remember-token";

interface StoredToken {
  token: string;
  expiresAt: string;
  deviceName: string;
  storedAt: string;
}

/**
 * Open the IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("[RememberToken] Failed to open database:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Store a remember token in IndexedDB
 */
export async function storeRememberToken(
  token: string,
  expiresAt: string,
  deviceName: string
): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const data: StoredToken = {
      token,
      expiresAt,
      deviceName,
      storedAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const request = store.put(data, TOKEN_KEY);
      request.onsuccess = () => {
        console.log("[RememberToken] Token stored successfully");
        resolve();
      };
      request.onerror = () => {
        console.error("[RememberToken] Failed to store token:", request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error("[RememberToken] Error storing token:", error);
    throw error;
  }
}

/**
 * Retrieve the stored remember token from IndexedDB
 */
export async function getRememberToken(): Promise<StoredToken | null> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(TOKEN_KEY);
      request.onsuccess = () => {
        const data = request.result as StoredToken | undefined;

        if (!data) {
          resolve(null);
          return;
        }

        // Check if token is expired
        if (new Date(data.expiresAt) < new Date()) {
          console.log("[RememberToken] Token expired, clearing");
          clearRememberToken().catch(console.error);
          resolve(null);
          return;
        }

        resolve(data);
      };
      request.onerror = () => {
        console.error("[RememberToken] Failed to get token:", request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error("[RememberToken] Error getting token:", error);
    return null;
  }
}

/**
 * Clear the stored remember token
 */
export async function clearRememberToken(): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.delete(TOKEN_KEY);
      request.onsuccess = () => {
        console.log("[RememberToken] Token cleared");
        resolve();
      };
      request.onerror = () => {
        console.error("[RememberToken] Failed to clear token:", request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error("[RememberToken] Error clearing token:", error);
    throw error;
  }
}

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

/**
 * Attempt auto-login using stored remember token
 * Returns the user data if successful, null otherwise
 */
export async function attemptAutoLogin(): Promise<{
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
    role: string;
    agencyId: string;
    agencyName: string;
    twoFactorEnabled: boolean;
  };
  newToken: string;
  expiresAt: string;
} | null> {
  if (!isIndexedDBAvailable()) {
    console.log("[RememberToken] IndexedDB not available");
    return null;
  }

  try {
    const storedData = await getRememberToken();

    if (!storedData) {
      console.log("[RememberToken] No stored token found");
      return null;
    }

    console.log("[RememberToken] Attempting auto-login with stored token");

    // Send token to server for validation
    const response = await fetch("/api/auth/remember", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: storedData.token }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Token invalid or expired
      if (data.clearToken) {
        await clearRememberToken();
      }
      console.log("[RememberToken] Auto-login failed:", data.error);
      return null;
    }

    // Store the new rotated token
    await storeRememberToken(data.newToken, data.expiresAt, storedData.deviceName);

    console.log("[RememberToken] Auto-login successful");
    return data;
  } catch (error) {
    console.error("[RememberToken] Auto-login error:", error);
    return null;
  }
}

/**
 * Create a remember token after successful login
 */
export async function createRememberToken(): Promise<boolean> {
  if (!isIndexedDBAvailable()) {
    console.log("[RememberToken] IndexedDB not available");
    return false;
  }

  try {
    const response = await fetch("/api/auth/remember", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      console.error("[RememberToken] Failed to create token");
      return false;
    }

    const data = await response.json();
    await storeRememberToken(data.token, data.expiresAt, data.deviceName);

    console.log("[RememberToken] Token created and stored");
    return true;
  } catch (error) {
    console.error("[RememberToken] Error creating token:", error);
    return false;
  }
}

/**
 * Check if we're running in iOS PWA standalone mode
 */
export function isIOSPWA(): boolean {
  if (typeof window === "undefined") return false;

  return (
    ("standalone" in window.navigator &&
      (window.navigator as { standalone?: boolean }).standalone === true) ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}
