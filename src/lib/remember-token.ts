/**
 * Remember Token Management for iOS PWA Session Persistence
 *
 * This module handles storing and retrieving "remember me" tokens
 * using MULTIPLE storage mechanisms for maximum reliability:
 * 1. IndexedDB - Primary storage (persists well on iOS)
 * 2. localStorage - Backup storage (another layer of redundancy)
 * 3. Cookie - Non-HttpOnly for JS readability check
 *
 * On iOS Safari standalone mode, any single storage can be cleared,
 * so we use all three and check them all.
 */

const DB_NAME = "auth-remember";
const DB_VERSION = 1;
const STORE_NAME = "tokens";
const TOKEN_KEY = "remember-token";
const LS_KEY = "ccm-remember-token"; // localStorage key
const COOKIE_NAME = "ccm-has-remember"; // Non-HttpOnly cookie to indicate we have a token

interface StoredToken {
  token: string;
  expiresAt: string;
  deviceName: string;
  storedAt: string;
}

// ============================================
// localStorage helpers (backup storage)
// ============================================

function storeInLocalStorage(data: StoredToken): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
      console.log("[RememberToken] Stored in localStorage");
    }
  } catch (error) {
    console.warn("[RememberToken] localStorage store failed:", error);
  }
}

function getFromLocalStorage(): StoredToken | null {
  try {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) {
        const data = JSON.parse(stored) as StoredToken;
        // Check expiry
        if (new Date(data.expiresAt) > new Date()) {
          return data;
        }
        // Expired - clean up
        localStorage.removeItem(LS_KEY);
      }
    }
  } catch (error) {
    console.warn("[RememberToken] localStorage read failed:", error);
  }
  return null;
}

function clearLocalStorage(): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(LS_KEY);
    }
  } catch (error) {
    console.warn("[RememberToken] localStorage clear failed:", error);
  }
}

// ============================================
// Cookie helpers (indicator that we have a token)
// ============================================

function setIndicatorCookie(expiresAt: string): void {
  try {
    if (typeof document !== "undefined") {
      const expires = new Date(expiresAt).toUTCString();
      // Non-HttpOnly cookie that JS can read to know we have a remember token
      document.cookie = `${COOKIE_NAME}=1; path=/; expires=${expires}; SameSite=Lax`;
      console.log("[RememberToken] Set indicator cookie");
    }
  } catch (error) {
    console.warn("[RememberToken] Cookie set failed:", error);
  }
}

/**
 * Check if the indicator cookie exists (quick check without async)
 * This can be used to quickly determine if we might have a remember token
 */
export function hasIndicatorCookie(): boolean {
  try {
    if (typeof document !== "undefined") {
      return document.cookie.includes(`${COOKIE_NAME}=1`);
    }
  } catch (error) {
    console.warn("[RememberToken] Cookie read failed:", error);
  }
  return false;
}

function clearIndicatorCookie(): void {
  try {
    if (typeof document !== "undefined") {
      document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
  } catch (error) {
    console.warn("[RememberToken] Cookie clear failed:", error);
  }
}

// ============================================
// Sign-out flag (prevents auto-login after intentional sign-out)
// Uses sessionStorage so it persists until tab is closed
// ============================================

const SIGNOUT_FLAG_KEY = "ccm-signed-out";

/**
 * Set a flag indicating the user intentionally signed out
 * This prevents auto-login from kicking in immediately after sign-out
 */
export function setSignedOutFlag(): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(SIGNOUT_FLAG_KEY, "true");
      console.log("[RememberToken] Set signed-out flag");
    }
  } catch (error) {
    console.warn("[RememberToken] Failed to set signed-out flag:", error);
  }
}

/**
 * Check if the user recently signed out intentionally
 */
export function hasSignedOutFlag(): boolean {
  try {
    if (typeof sessionStorage !== "undefined") {
      return sessionStorage.getItem(SIGNOUT_FLAG_KEY) === "true";
    }
  } catch (error) {
    console.warn("[RememberToken] Failed to check signed-out flag:", error);
  }
  return false;
}

/**
 * Clear the signed-out flag (e.g., when user logs in again)
 */
export function clearSignedOutFlag(): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(SIGNOUT_FLAG_KEY);
      console.log("[RememberToken] Cleared signed-out flag");
    }
  } catch (error) {
    console.warn("[RememberToken] Failed to clear signed-out flag:", error);
  }
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
 * Store a remember token in ALL available storage mechanisms
 * Uses IndexedDB (primary), localStorage (backup), and a cookie indicator
 */
export async function storeRememberToken(
  token: string,
  expiresAt: string,
  deviceName: string
): Promise<void> {
  const data: StoredToken = {
    token,
    expiresAt,
    deviceName,
    storedAt: new Date().toISOString(),
  };

  // Store in all mechanisms for redundancy
  let indexedDBSuccess = false;

  // 1. Try IndexedDB (primary)
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.put(data, TOKEN_KEY);
      request.onsuccess = () => {
        console.log("[RememberToken] Token stored in IndexedDB");
        indexedDBSuccess = true;
        resolve();
      };
      request.onerror = () => {
        console.error("[RememberToken] IndexedDB store failed:", request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error("[RememberToken] IndexedDB error:", error);
  }

  // 2. Store in localStorage (backup)
  storeInLocalStorage(data);

  // 3. Set indicator cookie (so we know to check for token)
  setIndicatorCookie(expiresAt);

  // If IndexedDB failed but localStorage worked, that's still a success
  if (!indexedDBSuccess) {
    const lsData = getFromLocalStorage();
    if (!lsData) {
      throw new Error("Failed to store token in any storage mechanism");
    }
  }

  console.log("[RememberToken] Token stored successfully in all mechanisms");
}

/**
 * Retrieve the stored remember token from ANY available storage
 * Tries IndexedDB first, falls back to localStorage
 */
export async function getRememberToken(): Promise<StoredToken | null> {
  // 1. Try IndexedDB first (primary)
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    const idbData = await new Promise<StoredToken | null>((resolve, reject) => {
      const request = store.get(TOKEN_KEY);
      request.onsuccess = () => {
        const data = request.result as StoredToken | undefined;

        if (!data) {
          resolve(null);
          return;
        }

        // Check if token is expired
        if (new Date(data.expiresAt) < new Date()) {
          console.log("[RememberToken] IndexedDB token expired");
          resolve(null);
          return;
        }

        console.log("[RememberToken] Found valid token in IndexedDB");
        resolve(data);
      };
      request.onerror = () => {
        console.error("[RememberToken] IndexedDB read failed:", request.error);
        reject(request.error);
      };
    });

    if (idbData) {
      return idbData;
    }
  } catch (error) {
    console.warn("[RememberToken] IndexedDB error, trying localStorage:", error);
  }

  // 2. Fall back to localStorage
  const lsData = getFromLocalStorage();
  if (lsData) {
    console.log("[RememberToken] Found valid token in localStorage");
    return lsData;
  }

  // 3. Check if indicator cookie exists but we have no token
  // This means storage was cleared - clean up the cookie
  if (hasIndicatorCookie()) {
    console.log("[RememberToken] Indicator cookie exists but no token found, cleaning up");
    clearIndicatorCookie();
  }

  return null;
}

/**
 * Clear the stored remember token from ALL storage mechanisms
 */
export async function clearRememberToken(): Promise<void> {
  // Clear from all mechanisms
  const errors: Error[] = [];

  // 1. Clear IndexedDB
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(TOKEN_KEY);
      request.onsuccess = () => {
        console.log("[RememberToken] Cleared from IndexedDB");
        resolve();
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.warn("[RememberToken] IndexedDB clear failed:", error);
    errors.push(error as Error);
  }

  // 2. Clear localStorage
  clearLocalStorage();
  console.log("[RememberToken] Cleared from localStorage");

  // 3. Clear indicator cookie
  clearIndicatorCookie();
  console.log("[RememberToken] Cleared indicator cookie");

  console.log("[RememberToken] Token cleared from all mechanisms");
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

// ============================================
// Creator Token Storage (for creator portal)
// Uses IndexedDB for PWA persistence
// ============================================

const CREATOR_TOKEN_KEY = "creator-session";
const CREATOR_LS_KEY = "ccm-creator-session";
const CREATOR_COOKIE_NAME = "ccm-has-creator-session"; // Indicator cookie for quick checks

interface CreatorSession {
  token: string;
  creatorId: string;
  name: string;
  email: string;
  avatar?: string;
  storedAt: string;
}

/**
 * Store creator session in IndexedDB and localStorage
 */
export async function storeCreatorSession(session: {
  token: string;
  creatorId: string;
  name: string;
  email: string;
  avatar?: string;
}): Promise<void> {
  console.log("[CreatorSession] storeCreatorSession called for:", session.email);

  const data: CreatorSession = {
    ...session,
    storedAt: new Date().toISOString(),
  };

  // 1. Store in IndexedDB
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.put(data, CREATOR_TOKEN_KEY);
      request.onsuccess = () => {
        console.log("[CreatorSession] Stored in IndexedDB");
        resolve();
      };
      request.onerror = () => {
        console.error("[CreatorSession] IndexedDB store failed:", request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.warn("[CreatorSession] IndexedDB error:", error);
  }

  // 2. Store in localStorage
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(CREATOR_LS_KEY, JSON.stringify(data));
      console.log("[CreatorSession] Stored in localStorage");
    }
  } catch (error) {
    console.warn("[CreatorSession] localStorage store failed:", error);
  }

  // 3. Set indicator cookie (30 days)
  try {
    if (typeof document !== "undefined") {
      const maxAge = 30 * 24 * 60 * 60; // 30 days
      document.cookie = `${CREATOR_COOKIE_NAME}=1; path=/; max-age=${maxAge}; SameSite=Lax`;
      console.log("[CreatorSession] Set indicator cookie");
    }
  } catch (error) {
    console.warn("[CreatorSession] Cookie set failed:", error);
  }
}

/**
 * Check if the creator session indicator cookie exists (quick synchronous check)
 */
export function hasCreatorSessionIndicator(): boolean {
  try {
    if (typeof document !== "undefined") {
      return document.cookie.includes(`${CREATOR_COOKIE_NAME}=1`);
    }
  } catch (error) {
    console.warn("[CreatorSession] Cookie read failed:", error);
  }
  return false;
}

/**
 * Retrieve creator session from IndexedDB or localStorage
 */
export async function getCreatorSession(): Promise<CreatorSession | null> {
  console.log("[CreatorSession] getCreatorSession called, checking all storage...");

  // 1. Try IndexedDB first
  try {
    console.log("[CreatorSession] Opening IndexedDB...");
    const db = await openDatabase();
    console.log("[CreatorSession] IndexedDB opened successfully");
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    const idbData = await new Promise<CreatorSession | null>((resolve, reject) => {
      const request = store.get(CREATOR_TOKEN_KEY);
      request.onsuccess = () => {
        const data = request.result as CreatorSession | undefined;
        if (data) {
          console.log("[CreatorSession] Found in IndexedDB:", {
            creatorId: data.creatorId,
            email: data.email,
            storedAt: data.storedAt,
            tokenPreview: data.token?.substring(0, 20) + "...",
          });
          resolve(data);
        } else {
          console.log("[CreatorSession] NOT found in IndexedDB (key:", CREATOR_TOKEN_KEY, ")");
          resolve(null);
        }
      };
      request.onerror = () => {
        console.error("[CreatorSession] IndexedDB get error:", request.error);
        reject(request.error);
      };
    });

    if (idbData) {
      return idbData;
    }
  } catch (error) {
    console.warn("[CreatorSession] IndexedDB error:", error);
  }

  // 2. Try localStorage backup key
  try {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(CREATOR_LS_KEY);
      console.log("[CreatorSession] localStorage backup key (" + CREATOR_LS_KEY + "):", stored ? "EXISTS" : "NULL");
      if (stored) {
        const data = JSON.parse(stored) as CreatorSession;
        console.log("[CreatorSession] Found in localStorage backup");
        return data;
      }
    }
  } catch (error) {
    console.warn("[CreatorSession] localStorage error:", error);
  }

  console.log("[CreatorSession] No session found in any storage");
  return null;
}

/**
 * Clear creator session from all storage
 */
export async function clearCreatorSession(): Promise<void> {
  // 1. Clear IndexedDB
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(CREATOR_TOKEN_KEY);
      request.onsuccess = () => {
        console.log("[CreatorSession] Cleared from IndexedDB");
        resolve();
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.warn("[CreatorSession] IndexedDB clear failed:", error);
  }

  // 2. Clear localStorage
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(CREATOR_LS_KEY);
      console.log("[CreatorSession] Cleared from localStorage");
    }
  } catch (error) {
    console.warn("[CreatorSession] localStorage clear failed:", error);
  }

  // 3. Clear indicator cookie
  try {
    if (typeof document !== "undefined") {
      document.cookie = `${CREATOR_COOKIE_NAME}=; path=/; max-age=0`;
      console.log("[CreatorSession] Cleared indicator cookie");
    }
  } catch (error) {
    console.warn("[CreatorSession] Cookie clear failed:", error);
  }
}
