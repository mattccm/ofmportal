// Client-side resumable multipart uploader for large files.
//
// Splits a File into parts, uploads them directly to R2 via short-lived
// presigned URLs with bounded concurrency + per-part retry, reports progress,
// and persists enough state in IndexedDB that a dropped connection or page
// reload can RESUME the same multipart upload instead of restarting.
//
// The server side lives under /api/uploads/multipart/{initiate,sign-part,complete,abort}.

// Use multipart only above this size; smaller files keep the single presigned PUT.
// Kept low so a phone that drops the connection (switching apps, locking the
// screen) carries on from the parts already sent instead of starting again.
export const MULTIPART_THRESHOLD = 32 * 1024 * 1024; // 32MB

// Target part size. Kept within S3 limits (5MB min, 10,000 parts max); we grow
// the part size for very large files so we never exceed the part-count cap.
const TARGET_PART_SIZE = 16 * 1024 * 1024; // 16MB
const MIN_PART_SIZE = 5 * 1024 * 1024; // 5MB (S3 minimum, last part exempt)
const MAX_PARTS = 10000;

const DEFAULT_CONCURRENCY = 4;
const SIGN_BATCH_SIZE = 20;
const MAX_PART_ATTEMPTS = 4;
// The complete call: 1 attempt + up to 3 retries on network errors / 5xx / 429.
const MAX_COMPLETE_ATTEMPTS = 4;
const COMPLETE_BACKOFF_BASE_MS = 1000;
const COMPLETE_BACKOFF_MAX_MS = 15000;

// Error codes the complete route sends when this multipart upload can never be
// completed as sent, so the resume state must be dropped.
const MULTIPART_DEAD_CODES = new Set(["MULTIPART_UPLOAD_GONE", "MULTIPART_PARTS_INVALID"]);
// Sent with a 409 when the request is closed for uploads (not a storage issue).
const UPLOAD_CLOSED_CODE = "UPLOAD_CLOSED";

export interface MultipartProgress {
  bytesUploaded: number;
  totalBytes: number;
  percent: number;
}

export interface MultipartUploadOptions {
  file: File;
  requestId: string;
  fieldId?: string;
  /** Extra headers for the API calls (e.g. x-creator-token, agency auth). */
  headers: Record<string, string>;
  signal?: AbortSignal;
  concurrency?: number;
  onProgress?: (progress: MultipartProgress) => void;
  /** Fired once the multipart upload exists (new or resumed) with its ids. */
  onInit?: (info: { dbUploadId: string; multipartUploadId: string }) => void;
}

export interface MultipartUploadResult {
  dbUploadId: string;
  storageKey: string;
}

interface CompletedPart {
  PartNumber: number;
  ETag: string;
}

interface PersistedSession {
  id: string;
  dbUploadId: string;
  multipartUploadId: string;
  storageKey: string;
  partSize: number;
  fileName: string;
  fileSize: number;
  lastModified: number;
  requestId: string;
  fieldId?: string;
  completedParts: CompletedPart[];
  updatedAt: number;
}

/** Thrown when an upload is stopped via its AbortSignal (pause or cancel). */
export class MultipartAbortError extends Error {
  constructor() {
    super("Upload was cancelled");
    this.name = "MultipartAbortError";
  }
}

// ---------------------------------------------------------------------------
// File identity + part math
// ---------------------------------------------------------------------------

/**
 * Stable identity for a (file, request, field) tuple. A page reload can't keep
 * a File handle, but when the user re-selects the same file we recognise it and
 * resume the persisted multipart upload.
 */
export function getFileIdentity(
  file: File,
  requestId: string,
  fieldId?: string
): string {
  return [
    requestId,
    fieldId ?? "",
    file.name,
    file.size,
    file.lastModified,
  ].join(":");
}

function computePartSize(fileSize: number): number {
  let partSize = TARGET_PART_SIZE;
  if (Math.ceil(fileSize / partSize) > MAX_PARTS) {
    partSize = Math.ceil(fileSize / MAX_PARTS);
  }
  return Math.max(partSize, MIN_PART_SIZE);
}

function computePartCount(fileSize: number, partSize: number): number {
  return Math.max(1, Math.ceil(fileSize / partSize));
}

// ---------------------------------------------------------------------------
// IndexedDB persistence (best-effort — resume is a nicety, not a requirement)
// ---------------------------------------------------------------------------

const DB_NAME = "upload-portal-multipart";
const STORE_NAME = "sessions";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet(id: string): Promise<PersistedSession | null> {
  const database = await openDb();
  if (!database) return null;
  return new Promise((resolve) => {
    try {
      const tx = database.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => resolve((req.result as PersistedSession) ?? null);
      req.onerror = () => resolve(null);
      tx.oncomplete = () => database.close();
    } catch {
      resolve(null);
    }
  });
}

async function idbPut(session: PersistedSession): Promise<void> {
  const database = await openDb();
  if (!database) return;
  return new Promise((resolve) => {
    try {
      const tx = database.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(session);
      tx.oncomplete = () => {
        database.close();
        resolve();
      };
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbDelete(id: string): Promise<void> {
  const database = await openDb();
  if (!database) return;
  return new Promise((resolve) => {
    try {
      const tx = database.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => {
        database.close();
        resolve();
      };
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function jsonHeaders(headers: Record<string, string>): Record<string, string> {
  return { "Content-Type": "application/json", ...headers };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new MultipartAbortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new MultipartAbortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

// ---------------------------------------------------------------------------
// Main upload flow
// ---------------------------------------------------------------------------

export async function uploadFileMultipart(
  options: MultipartUploadOptions
): Promise<MultipartUploadResult> {
  try {
    return await uploadFileMultipartAttempt(options);
  } catch (error) {
    if (error instanceof MultipartAbortError) throw error;
    // An aborted fetch (initiate / sign-part / mid-batch) throws a DOMException
    // AbortError; surface it as a pause/cancel rather than a failure.
    if (options.signal?.aborted || (error as Error)?.name === "AbortError") {
      throw new MultipartAbortError();
    }
    // The resumed session is dead on the server (cleaned up, expired, deleted):
    // drop the persisted state and start over. Recurses at most once in practice
    // because the IndexedDB entry is gone, so the next attempt initiates fresh.
    if ((error as Error & { staleSession?: boolean }).staleSession) {
      await idbDelete(getFileIdentity(options.file, options.requestId, options.fieldId));
      return uploadFileMultipart(options);
    }
    throw error;
  }
}

async function uploadFileMultipartAttempt(
  options: MultipartUploadOptions
): Promise<MultipartUploadResult> {
  const {
    file,
    requestId,
    fieldId,
    headers,
    signal,
    concurrency = DEFAULT_CONCURRENCY,
    onProgress,
    onInit,
  } = options;

  if (signal?.aborted) {
    throw new MultipartAbortError();
  }

  const identity = getFileIdentity(file, requestId, fieldId);

  // Try to resume a persisted session for this exact file.
  const existing = await idbGet(identity);
  let dbUploadId: string;
  let multipartUploadId: string;
  let storageKey: string;
  let partSize: number;
  const completed = new Map<number, CompletedPart>();

  const isSameFile =
    existing &&
    existing.fileSize === file.size &&
    existing.lastModified === file.lastModified &&
    existing.fileName === file.name;

  const resumed = !!isSameFile;

  if (isSameFile) {
    dbUploadId = existing.dbUploadId;
    multipartUploadId = existing.multipartUploadId;
    storageKey = existing.storageKey;
    partSize = existing.partSize;
    for (const part of existing.completedParts) {
      completed.set(part.PartNumber, part);
    }
  } else {
    // Start a fresh multipart upload.
    const res = await fetch("/api/uploads/multipart/initiate", {
      method: "POST",
      headers: jsonHeaders(headers),
      body: JSON.stringify({
        requestId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fieldId,
      }),
      signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error = new Error(err.error || "Failed to initiate multipart upload");
      // Signal to the caller whether falling back to another path makes sense.
      // A 409 means "storage not configured, use the local endpoint", EXCEPT
      // when the request is closed for uploads: falling back would only hide
      // the creator-readable message, so don't expose that status.
      if (err.code !== UPLOAD_CLOSED_CODE) {
        (error as Error & { status?: number }).status = res.status;
      }
      throw error;
    }

    const data = (await res.json()) as {
      uploadId: string;
      multipartUploadId: string;
      storageKey: string;
    };
    dbUploadId = data.uploadId;
    multipartUploadId = data.multipartUploadId;
    storageKey = data.storageKey;
    partSize = computePartSize(file.size);
  }

  onInit?.({ dbUploadId, multipartUploadId });

  // Skip once aborted so a part finishing after a cancel can't write the
  // (now dead) session back after abortPersistedUpload deleted it.
  const persist = (): Promise<void> =>
    signal?.aborted ? Promise.resolve() : idbPut({
      id: identity,
      dbUploadId,
      multipartUploadId,
      storageKey,
      partSize,
      fileName: file.name,
      fileSize: file.size,
      lastModified: file.lastModified,
      requestId,
      fieldId,
      completedParts: Array.from(completed.values()),
      updatedAt: Date.now(),
    });

  await persist();

  const partCount = computePartCount(file.size, partSize);

  // Progress accounting: completed bytes + in-flight loaded bytes per part.
  const partByteLength = (partNumber: number): number => {
    const start = (partNumber - 1) * partSize;
    return Math.min(partSize, file.size - start);
  };
  let completedBytes = 0;
  for (const partNumber of completed.keys()) {
    completedBytes += partByteLength(partNumber);
  }
  const inFlight = new Map<number, number>();

  const emitProgress = () => {
    if (!onProgress) return;
    let bytesUploaded = completedBytes;
    for (const loaded of inFlight.values()) {
      bytesUploaded += loaded;
    }
    bytesUploaded = Math.min(bytesUploaded, file.size);
    onProgress({
      bytesUploaded,
      totalBytes: file.size,
      percent: Math.round((bytesUploaded / file.size) * 100),
    });
  };

  emitProgress();

  // Which parts still need uploading?
  const remaining: number[] = [];
  for (let partNumber = 1; partNumber <= partCount; partNumber++) {
    if (!completed.has(partNumber)) {
      remaining.push(partNumber);
    }
  }

  // Sign a batch of part URLs in one request.
  const signParts = async (
    partNumbers: number[]
  ): Promise<Map<number, string>> => {
    const res = await fetch("/api/uploads/multipart/sign-part", {
      method: "POST",
      headers: jsonHeaders(headers),
      body: JSON.stringify({ uploadId: dbUploadId, multipartUploadId, partNumbers }),
      signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error = new Error(err.error || "Failed to sign upload parts");
      (error as Error & { status?: number; staleSession?: boolean }).status = res.status;
      (error as Error & { staleSession?: boolean }).staleSession =
        resumed && [400, 404].includes(res.status);
      throw error;
    }
    const data = (await res.json()) as {
      parts: Array<{ partNumber: number; url: string }>;
    };
    const map = new Map<number, string>();
    for (const part of data.parts) {
      map.set(part.partNumber, part.url);
    }
    return map;
  };

  // PUT a single part to R2 via XHR (gives us upload progress + the ETag).
  const putPart = (partNumber: number, url: string): Promise<string> => {
    const start = (partNumber - 1) * partSize;
    const end = Math.min(start + partSize, file.size);
    const blob = file.slice(start, end);

    return new Promise<string>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new MultipartAbortError());
        return;
      }

      const xhr = new XMLHttpRequest();

      const onAbort = () => xhr.abort();
      signal?.addEventListener("abort", onAbort, { once: true });

      const cleanup = () => {
        signal?.removeEventListener("abort", onAbort);
        inFlight.delete(partNumber);
      };

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          inFlight.set(partNumber, event.loaded);
          emitProgress();
        }
      });

      xhr.onload = () => {
        cleanup();
        if (xhr.status >= 200 && xhr.status < 300) {
          const etag = xhr.getResponseHeader("ETag") || xhr.getResponseHeader("etag");
          if (!etag) {
            reject(
              new Error(
                "Missing ETag on part response (check R2 CORS exposes the ETag header)"
              )
            );
            return;
          }
          resolve(etag);
        } else {
          reject(new Error(`Part ${partNumber} failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        cleanup();
        reject(new Error(`Network error uploading part ${partNumber}`));
      };
      xhr.onabort = () => {
        cleanup();
        reject(new MultipartAbortError());
      };

      xhr.open("PUT", url);
      xhr.send(blob);
    });
  };

  // Upload one part with retry + exponential backoff.
  const uploadPartWithRetry = async (
    partNumber: number,
    url: string
  ): Promise<void> => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_PART_ATTEMPTS; attempt++) {
      if (signal?.aborted) throw new MultipartAbortError();
      try {
        const etag = await putPart(partNumber, url);
        const part: CompletedPart = { PartNumber: partNumber, ETag: etag };
        completed.set(partNumber, part);
        completedBytes += partByteLength(partNumber);
        inFlight.delete(partNumber);
        emitProgress();
        await persist();
        return;
      } catch (error) {
        if (error instanceof MultipartAbortError) throw error;
        lastError = error;
        inFlight.delete(partNumber);
        if (attempt < MAX_PART_ATTEMPTS) {
          // Exponential backoff with jitter before the next attempt.
          const backoff = 500 * 2 ** (attempt - 1) + Math.random() * 250;
          await sleep(backoff, signal);
        }
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(`Part ${partNumber} failed`);
  };

  // Process remaining parts: sign in batches, upload each batch with a bounded
  // worker pool so we never hold more than `concurrency` requests in flight.
  for (let i = 0; i < remaining.length; i += SIGN_BATCH_SIZE) {
    if (signal?.aborted) throw new MultipartAbortError();

    const batch = remaining.slice(i, i + SIGN_BATCH_SIZE);
    const urlMap = await signParts(batch);

    let cursor = 0;
    const runner = async (): Promise<void> => {
      while (cursor < batch.length) {
        if (signal?.aborted) throw new MultipartAbortError();
        const partNumber = batch[cursor++];
        const url = urlMap.get(partNumber);
        if (!url) throw new Error(`Missing presigned URL for part ${partNumber}`);
        await uploadPartWithRetry(partNumber, url);
      }
    };

    const runners = Array.from(
      { length: Math.min(concurrency, batch.length) },
      () => runner()
    );
    await Promise.all(runners);
  }

  if (signal?.aborted) throw new MultipartAbortError();

  // All parts uploaded — assemble the object and run server bookkeeping.
  const parts = Array.from(completed.values()).sort(
    (a, b) => a.PartNumber - b.PartNumber
  );

  await completeWithRetry({
    headers,
    body: JSON.stringify({ uploadId: dbUploadId, multipartUploadId, parts }),
    onGone: () => idbDelete(identity),
    resumed,
  });

  // Success — drop the resume state.
  await idbDelete(identity);

  return { dbUploadId, storageKey };
}

/**
 * POST the multipart complete call, retrying network errors, 5xx and 429 with
 * exponential backoff + jitter. Other 4xx responses are final. The server
 * route is idempotent, so a retry after a lost response is safe.
 *
 * Resume state is only dropped (via `onGone`) when the server says the
 * multipart upload is gone or its parts are invalid; on any other failure it
 * is kept so the next attempt with the same file resumes straight to complete
 * instead of re-uploading every part.
 *
 * Deliberately not tied to the AbortSignal: once every part is uploaded,
 * pausing shouldn't strand an almost-finished upload.
 */
async function completeWithRetry(input: {
  headers: Record<string, string>;
  body: string;
  onGone: () => Promise<void>;
  resumed: boolean;
}): Promise<void> {
  let lastError: Error = new Error("Failed to complete upload");

  for (let attempt = 1; attempt <= MAX_COMPLETE_ATTEMPTS; attempt++) {
    let res: Response | null = null;
    try {
      res = await fetch("/api/uploads/multipart/complete", {
        method: "POST",
        headers: jsonHeaders(input.headers),
        body: input.body,
      });
    } catch (error) {
      // Network error (offline, connection reset): retryable.
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    if (res?.ok) return;

    let retryAfterMs = 0;
    if (res) {
      const err = (await res.json().catch(() => ({}))) as {
        error?: string;
        details?: string;
        code?: string;
      };
      lastError = new Error(err.error || err.details || "Failed to complete upload");
      (lastError as Error & { status?: number }).status = res.status;

      // 404 = the Upload record or the multipart session no longer exists.
      const gone =
        res.status === 404 || (err.code !== undefined && MULTIPART_DEAD_CODES.has(err.code));
      if (gone) {
        await input.onGone();
        // A resumed session that died server-side: let the caller start fresh.
        (lastError as Error & { staleSession?: boolean }).staleSession = input.resumed;
        throw lastError;
      }

      const retryable = res.status >= 500 || res.status === 429;
      if (!retryable) throw lastError;

      const retryAfter = Number(res.headers.get("Retry-After"));
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        retryAfterMs = Math.min(retryAfter * 1000, COMPLETE_BACKOFF_MAX_MS);
      }
    }

    if (attempt < MAX_COMPLETE_ATTEMPTS) {
      const backoff = Math.min(
        COMPLETE_BACKOFF_BASE_MS * 2 ** (attempt - 1),
        COMPLETE_BACKOFF_MAX_MS
      );
      const jitter = Math.random() * backoff * 0.5;
      await sleep(Math.max(retryAfterMs, backoff + jitter));
    }
  }

  throw lastError;
}

/**
 * Cancel a (possibly in-progress or interrupted) multipart upload: aborts the
 * multipart session on the backend and clears the persisted resume state.
 * Safe to call even if nothing was persisted.
 */
export async function abortPersistedUpload(options: {
  file: File;
  requestId: string;
  fieldId?: string;
  headers: Record<string, string>;
  /** Fallback ids when nothing is persisted (e.g. cancel mid-flight). */
  dbUploadId?: string;
  multipartUploadId?: string;
}): Promise<void> {
  const identity = getFileIdentity(options.file, options.requestId, options.fieldId);
  const persisted = await idbGet(identity);

  const dbUploadId = persisted?.dbUploadId ?? options.dbUploadId;
  const multipartUploadId = persisted?.multipartUploadId ?? options.multipartUploadId;

  if (dbUploadId && multipartUploadId) {
    try {
      await fetch("/api/uploads/multipart/abort", {
        method: "POST",
        headers: jsonHeaders(options.headers),
        body: JSON.stringify({ uploadId: dbUploadId, multipartUploadId }),
      });
    } catch {
      // Best effort — the server also cleans up incomplete uploads over time.
    }
  }

  await idbDelete(identity);
}
