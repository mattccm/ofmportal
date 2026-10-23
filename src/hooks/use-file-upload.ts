"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { MAX_FILE_SIZE, isAllowedFileType, resolveMimeType } from "@/lib/file-utils";
import { extractVideoThumbnail, isVideoFile } from "@/lib/video-thumbnail";
import {
  uploadFileMultipart,
  abortPersistedUpload,
  MultipartAbortError,
  MULTIPART_THRESHOLD,
} from "@/lib/multipart-upload";

export type UploadStatus = "pending" | "uploading" | "paused" | "completed" | "error" | "cancelled";

export interface QueuedFile {
  id: string;
  file: File;
  progress: number;
  status: UploadStatus;
  error?: string;
  uploadId?: string;
  uploadUrl?: string;
  storageKey?: string;
  xhr?: XMLHttpRequest;
  multipartUploadId?: string; // storage backend multipart upload id (large files)
  abortController?: AbortController; // aborts an in-flight multipart upload
  startTime?: number;
  bytesUploaded?: number;
  speed?: number; // bytes per second
  timeRemaining?: number; // seconds
  retryCount: number;
  fieldId?: string; // Template field ID for per-field uploads
}

export interface UseFileUploadOptions {
  requestId: string;
  maxConcurrent?: number;
  maxRetries?: number;
  onUploadComplete?: (file: QueuedFile) => void;
  onAllComplete?: () => void;
  onError?: (file: QueuedFile, error: string) => void;
  getAuthHeaders?: () => Record<string, string>;
}

export interface UseFileUploadReturn {
  queue: QueuedFile[];
  addFiles: (files: FileList | File[], fieldId?: string) => void;
  removeFile: (fileId: string) => void;
  pauseFile: (fileId: string) => void;
  resumeFile: (fileId: string) => void;
  retryFile: (fileId: string) => void;
  cancelFile: (fileId: string) => void;
  clearCompleted: () => void;
  clearAll: () => void;
  pauseAll: () => void;
  resumeAll: () => void;
  isUploading: boolean;
  totalProgress: number;
  totalSize: number;
  uploadedSize: number;
  activeCount: number;
  pendingCount: number;
  completedCount: number;
  errorCount: number;
}

// Helper function to generate and upload video thumbnail (runs async, non-blocking)
async function generateAndUploadThumbnail(
  file: File,
  uploadId: string,
  headers: Record<string, string>,
  token: string | null
): Promise<void> {
  try {
    // Extract thumbnail from video
    const thumbnailBlob = await extractVideoThumbnail(file);

    if (!thumbnailBlob) {
      console.log("[Thumbnail] Could not extract thumbnail from video");
      return;
    }

    // Create form data for thumbnail upload
    const formData = new FormData();
    formData.append("thumbnail", thumbnailBlob, "thumbnail.jpg");

    // Upload thumbnail
    const response = await fetch(`/api/uploads/${uploadId}/thumbnail/upload`, {
      method: "POST",
      headers: {
        "x-creator-token": token || "",
        ...headers,
      },
      body: formData,
    });

    if (response.ok) {
      console.log("[Thumbnail] Video thumbnail uploaded successfully");
    } else {
      console.warn("[Thumbnail] Failed to upload video thumbnail:", await response.text());
    }
  } catch (error) {
    // Non-critical - don't fail the upload if thumbnail generation fails
    console.warn("[Thumbnail] Error generating/uploading video thumbnail:", error);
  }
}

// Smooths the *displayed* transfer speed (and the ETA derived from it) with an
// exponential moving average, so the MB/s and time-remaining readouts don't
// flicker on every progress tick. The raw upload is untouched — this only
// affects the numbers shown to the user.
//
// Progress events fire irregularly and dividing a byte delta by a tiny time
// delta produces wild spikes; we ignore samples closer together than
// MIN_SAMPLE_MS and blend the rest into a running average.
interface SpeedSmoother {
  update: (
    bytesUploaded: number,
    totalBytes: number
  ) => { speed: number; timeRemaining: number };
}

function createSpeedSmoother(): SpeedSmoother {
  const EMA_ALPHA = 0.25; // weight of the newest sample (lower = smoother)
  const MIN_SAMPLE_MS = 350; // don't sample faster than this

  let lastBytes = 0;
  let lastTime = Date.now();
  let smoothed = 0; // bytes/sec, 0 until the first real sample
  let lastSpeed = 0;
  let lastRemaining = 0;

  return {
    update(bytesUploaded, totalBytes) {
      const now = Date.now();
      const elapsedMs = now - lastTime;

      if (elapsedMs >= MIN_SAMPLE_MS) {
        const bytesDiff = bytesUploaded - lastBytes;
        if (bytesDiff >= 0) {
          const instant = bytesDiff / (elapsedMs / 1000);
          smoothed =
            smoothed > 0 ? EMA_ALPHA * instant + (1 - EMA_ALPHA) * smoothed : instant;
          lastSpeed = smoothed;
          const remaining = Math.max(totalBytes - bytesUploaded, 0);
          lastRemaining = smoothed > 0 ? remaining / smoothed : 0;
        }
        lastBytes = bytesUploaded;
        lastTime = now;
      }

      return { speed: lastSpeed, timeRemaining: lastRemaining };
    },
  };
}

export function useFileUpload({
  requestId,
  maxConcurrent = 3,
  maxRetries = 3,
  onUploadComplete,
  onAllComplete,
  onError,
  getAuthHeaders,
}: UseFileUploadOptions): UseFileUploadReturn {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const activeUploadsRef = useRef<Set<string>>(new Set());
  const processingRef = useRef(false);

  // Generate unique file ID
  const generateFileId = () => `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Validate file before adding to queue
  const validateFile = useCallback((file: File): string | null => {
    // Browsers report empty/alias types for some valid media (HEIC, MKV, WAV)
    if (!isAllowedFileType(resolveMimeType(file.name, file.type))) {
      return `File type "${file.type || file.name.split(".").pop() || "unknown"}" is not allowed`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds 5GB limit`;
    }
    return null;
  }, []);

  // Add files to upload queue
  const addFiles = useCallback((files: FileList | File[], fieldId?: string) => {
    const fileArray = Array.from(files);
    const newQueueItems: QueuedFile[] = [];

    for (const file of fileArray) {
      const error = validateFile(file);
      if (error) {
        toast.error(`${file.name}: ${error}`);
        continue;
      }

      newQueueItems.push({
        id: generateFileId(),
        file,
        progress: 0,
        status: "pending",
        retryCount: 0,
        fieldId,
      });
    }

    if (newQueueItems.length > 0) {
      setQueue((prev) => [...prev, ...newQueueItems]);
    }
  }, [validateFile]);

  // Build auth headers (creator token + any caller-provided headers)
  const buildAuthHeaders = useCallback((): Record<string, string> => {
    const headers = getAuthHeaders?.() || {};
    const token = typeof window !== "undefined" ? localStorage.getItem("creatorToken") : null;
    return { "x-creator-token": token || "", ...headers };
  }, [getAuthHeaders]);

  // Abort + clean up a multipart upload's server session and resume state.
  const abortMultipartFor = useCallback((file: QueuedFile) => {
    if (file.file.size <= MULTIPART_THRESHOLD) return;
    abortPersistedUpload({
      file: file.file,
      requestId,
      fieldId: file.fieldId,
      headers: buildAuthHeaders(),
      dbUploadId: file.uploadId,
      multipartUploadId: file.multipartUploadId,
    }).catch(() => {
      // Best effort — server also reaps incomplete uploads over time.
    });
  }, [requestId, buildAuthHeaders]);

  // Upload using local fallback (FormData approach)
  const uploadFileLocal = useCallback(async (queuedFile: QueuedFile): Promise<void> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("creatorToken") : null;
    const headers = getAuthHeaders?.() || {};

    // Update status to uploading
    setQueue((prev) =>
      prev.map((f) =>
        f.id === queuedFile.id
          ? { ...f, status: "uploading" as UploadStatus, startTime: Date.now() }
          : f
      )
    );

    const formData = new FormData();
    formData.append("file", queuedFile.file);
    formData.append("requestId", requestId);
    if (queuedFile.fieldId) {
      formData.append("fieldId", queuedFile.fieldId);
    }

    const xhr = new XMLHttpRequest();

    // Store XHR reference
    setQueue((prev) =>
      prev.map((f) =>
        f.id === queuedFile.id ? { ...f, xhr } : f
      )
    );

    const smoother = createSpeedSmoother();

    return new Promise((resolve, reject) => {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          const { speed, timeRemaining } = smoother.update(e.loaded, e.total);

          setQueue((prev) =>
            prev.map((f) =>
              f.id === queuedFile.id
                ? { ...f, progress, bytesUploaded: e.loaded, speed, timeRemaining }
                : f
            )
          );
        }
      });

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Pull the created upload id out of the response so we can attach a
          // thumbnail (and report it to the caller).
          let uploadId: string | undefined;
          try {
            uploadId = JSON.parse(xhr.responseText)?.uploadId;
          } catch {
            // Non-JSON body — thumbnail generation just won't run.
          }

          setQueue((prev) =>
            prev.map((f) =>
              f.id === queuedFile.id
                ? { ...f, status: "completed" as UploadStatus, progress: 100, uploadId, xhr: undefined }
                : f
            )
          );
          toast.success(`${queuedFile.file.name} uploaded`);

          // Generate and upload a thumbnail for videos (async, non-blocking).
          if (isVideoFile(queuedFile.file) && uploadId) {
            generateAndUploadThumbnail(queuedFile.file, uploadId, headers, token);
          }

          onUploadComplete?.({ ...queuedFile, status: "completed", uploadId });
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.onabort = () => reject(new Error("Upload was cancelled"));

      xhr.open("POST", "/api/uploads/local");
      if (token) {
        xhr.setRequestHeader("x-creator-token", token);
      }
      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });
      xhr.send(formData);
    });
  }, [requestId, getAuthHeaders, onUploadComplete]);

  // Upload a large file via resumable S3 multipart upload
  const uploadFileMultipartFlow = useCallback(async (queuedFile: QueuedFile): Promise<void> => {
    const headers = getAuthHeaders?.() || {};
    const token = typeof window !== "undefined" ? localStorage.getItem("creatorToken") : null;
    const authHeaders: Record<string, string> = { "x-creator-token": token || "", ...headers };

    const controller = new AbortController();

    // Smooth the displayed speed / ETA (display only — see createSpeedSmoother).
    const smoother = createSpeedSmoother();

    setQueue((prev) =>
      prev.map((f) =>
        f.id === queuedFile.id
          ? { ...f, abortController: controller, status: "uploading" as UploadStatus, startTime: Date.now() }
          : f
      )
    );

    try {
      const result = await uploadFileMultipart({
        file: queuedFile.file,
        requestId,
        fieldId: queuedFile.fieldId,
        headers: authHeaders,
        signal: controller.signal,
        onInit: ({ dbUploadId, multipartUploadId }) => {
          setQueue((prev) =>
            prev.map((f) =>
              f.id === queuedFile.id ? { ...f, uploadId: dbUploadId, multipartUploadId } : f
            )
          );
        },
        onProgress: ({ bytesUploaded, totalBytes, percent }) => {
          const { speed, timeRemaining } = smoother.update(bytesUploaded, totalBytes);

          setQueue((prev) =>
            prev.map((f) =>
              f.id === queuedFile.id
                ? { ...f, progress: percent, bytesUploaded, speed, timeRemaining }
                : f
            )
          );
        },
      });

      setQueue((prev) =>
        prev.map((f) =>
          f.id === queuedFile.id
            ? {
                ...f,
                status: "completed" as UploadStatus,
                progress: 100,
                uploadId: result.dbUploadId,
                abortController: undefined,
              }
            : f
        )
      );

      toast.success(`Uploaded ${queuedFile.file.name}`);

      if (isVideoFile(queuedFile.file) && result.dbUploadId) {
        generateAndUploadThumbnail(queuedFile.file, result.dbUploadId, headers, token);
      }

      onUploadComplete?.({ ...queuedFile, status: "completed" as UploadStatus, uploadId: result.dbUploadId });
    } catch (error) {
      // Aborted: keep "paused" if the user paused, otherwise mark cancelled.
      if (error instanceof MultipartAbortError) {
        setQueue((prev) =>
          prev.map((f) =>
            f.id === queuedFile.id
              ? f.status === "paused"
                ? { ...f, abortController: undefined }
                : { ...f, status: "cancelled" as UploadStatus, abortController: undefined }
              : f
          )
        );
        return;
      }

      // If storage isn't configured for multipart (local dev), fall back to
      // the local single-shot endpoint.
      const status = (error as Error & { status?: number }).status;
      if (status === 409) {
        setQueue((prev) =>
          prev.map((f) =>
            f.id === queuedFile.id
              ? { ...f, progress: 0, status: "pending" as UploadStatus, abortController: undefined }
              : f
          )
        );
        // Await so a local failure falls through to the error state below
        try {
          await uploadFileLocal(queuedFile);
          return;
        } catch (localError) {
          error = localError;
        }
      }

      const errorMessage = error instanceof Error ? error.message : "Upload failed";
      setQueue((prev) =>
        prev.map((f) =>
          f.id === queuedFile.id
            ? {
                ...f,
                status: "error" as UploadStatus,
                error: errorMessage,
                abortController: undefined,
                retryCount: f.retryCount + 1,
              }
            : f
        )
      );
      toast.error(`${queuedFile.file.name}: ${errorMessage}`);
      onError?.(queuedFile, errorMessage);
    }
  }, [requestId, getAuthHeaders, onUploadComplete, onError, uploadFileLocal]);

  // Upload a single file
  const uploadFile = useCallback(async (queuedFile: QueuedFile): Promise<void> => {
    const headers = getAuthHeaders?.() || {};
    const token = typeof window !== "undefined" ? localStorage.getItem("creatorToken") : null;

    // Large files use resumable multipart upload; small files keep the
    // single-shot presigned PUT below.
    if (queuedFile.file.size > MULTIPART_THRESHOLD) {
      return uploadFileMultipartFlow(queuedFile);
    }

    // Same resolution as validateFile; the PUT Content-Type must match what was signed
    const fileType = resolveMimeType(queuedFile.file.name, queuedFile.file.type);

    try {
      // Get presigned URL
      const presignResponse = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-creator-token": token || "",
          ...headers,
        },
        body: JSON.stringify({
          requestId,
          fileName: queuedFile.file.name,
          fileType,
          fileSize: queuedFile.file.size,
          fieldId: queuedFile.fieldId,
        }),
      });

      if (!presignResponse.ok) {
        const error = await presignResponse.json().catch(() => ({}));
        // 409 means storage isn't configured (local dev): use the local
        // endpoint. Awaited so a local failure is handled by the catch below.
        // A 409 with code UPLOAD_CLOSED is a closed request / archived
        // creator instead: show its message rather than falling back.
        if (presignResponse.status === 409 && error.code !== "UPLOAD_CLOSED") {
          console.warn("Presign unavailable, using local upload:", error.error);
          return await uploadFileLocal(queuedFile);
        }
        throw new Error(error.error || "Failed to get upload URL");
      }

      const { uploadUrl, uploadId, storageKey } = await presignResponse.json();

      // Update queue with upload info
      setQueue((prev) =>
        prev.map((f) =>
          f.id === queuedFile.id
            ? { ...f, uploadUrl, uploadId, storageKey, status: "uploading" as UploadStatus, startTime: Date.now() }
            : f
        )
      );

      // Upload to storage using XHR for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Store XHR reference for pause/cancel
        setQueue((prev) =>
          prev.map((f) =>
            f.id === queuedFile.id ? { ...f, xhr } : f
          )
        );

        const smoother = createSpeedSmoother();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            const { speed, timeRemaining } = smoother.update(e.loaded, e.total);

            setQueue((prev) =>
              prev.map((f) =>
                f.id === queuedFile.id
                  ? {
                      ...f,
                      progress,
                      bytesUploaded: e.loaded,
                      speed,
                      timeRemaining,
                    }
                  : f
              )
            );
          }
        });

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.onabort = () => reject(new Error("Upload was cancelled"));

        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", fileType);
        xhr.send(queuedFile.file);
      });

      // Complete the upload
      const completeResponse = await fetch("/api/uploads/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-creator-token": token || "",
          ...headers,
        },
        body: JSON.stringify({ uploadId }),
      });

      if (!completeResponse.ok) {
        const errorData = await completeResponse.json().catch(() => ({}));
        console.error("[FileUpload] Complete upload failed:", completeResponse.status, errorData);
        throw new Error(errorData.details || errorData.error || "Failed to complete upload");
      }

      // Mark as completed
      setQueue((prev) =>
        prev.map((f) =>
          f.id === queuedFile.id
            ? { ...f, status: "completed" as UploadStatus, progress: 100, xhr: undefined }
            : f
        )
      );

      toast.success(`Uploaded ${queuedFile.file.name}`);

      // Generate and upload thumbnail for videos (async, non-blocking)
      if (isVideoFile(queuedFile.file) && uploadId) {
        generateAndUploadThumbnail(queuedFile.file, uploadId, headers, token);
      }

      // Get updated file info
      const completedFile = { ...queuedFile, status: "completed" as UploadStatus, uploadId };
      onUploadComplete?.(completedFile);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Upload failed";

      // Check if it was a cancellation
      if (errorMessage === "Upload was cancelled") {
        setQueue((prev) =>
          prev.map((f) =>
            f.id === queuedFile.id
              ? f.status === "paused"
                ? { ...f, xhr: undefined }
                : { ...f, status: "cancelled" as UploadStatus, xhr: undefined }
              : f
          )
        );
        return;
      }

      // Handle error with retry logic
      setQueue((prev) =>
        prev.map((f) =>
          f.id === queuedFile.id
            ? {
                ...f,
                status: "error" as UploadStatus,
                error: errorMessage,
                xhr: undefined,
                retryCount: f.retryCount + 1,
              }
            : f
        )
      );

      toast.error(`${queuedFile.file.name}: ${errorMessage}`);
      onError?.(queuedFile, errorMessage);
    }
  }, [requestId, getAuthHeaders, onUploadComplete, onError, uploadFileLocal, uploadFileMultipartFlow]);

  // Process upload queue
  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    const pendingFiles = queue.filter(
      (f) => f.status === "pending" && !activeUploadsRef.current.has(f.id)
    );

    const availableSlots = maxConcurrent - activeUploadsRef.current.size;
    const filesToProcess = pendingFiles.slice(0, availableSlots);

    for (const file of filesToProcess) {
      activeUploadsRef.current.add(file.id);

      uploadFile(file).catch(() => {}).finally(() => {
        activeUploadsRef.current.delete(file.id);

        // Check if all uploads are complete
        setQueue((currentQueue) => {
          const allComplete = currentQueue.every(
            (f) => f.status === "completed" || f.status === "error" || f.status === "cancelled"
          );
          if (allComplete && currentQueue.length > 0) {
            onAllComplete?.();
          }
          return currentQueue;
        });
      });
    }

    processingRef.current = false;
  }, [queue, maxConcurrent, uploadFile, onAllComplete]);

  // Process queue when it changes
  useEffect(() => {
    const hasPending = queue.some((f) => f.status === "pending");
    const hasSlots = activeUploadsRef.current.size < maxConcurrent;

    if (hasPending && hasSlots) {
      processQueue();
    }
  }, [queue, maxConcurrent, processQueue]);

  // Remove file from queue
  const removeFile = useCallback((fileId: string) => {
    setQueue((prev) => {
      const file = prev.find((f) => f.id === fileId);
      if (file?.xhr) {
        file.xhr.abort();
      }
      if (file?.abortController) {
        file.abortController.abort();
      }
      if (file) {
        abortMultipartFor(file);
      }
      return prev.filter((f) => f.id !== fileId);
    });
    activeUploadsRef.current.delete(fileId);
  }, [abortMultipartFor]);

  // Pause file upload
  const pauseFile = useCallback((fileId: string) => {
    setQueue((prev) =>
      prev.map((f) => {
        if (f.id === fileId && f.status === "uploading" && (f.xhr || f.abortController)) {
          // Soft stop: keep the multipart resume state so it can continue.
          f.xhr?.abort();
          f.abortController?.abort();
          return { ...f, status: "paused" as UploadStatus, xhr: undefined, abortController: undefined };
        }
        return f;
      })
    );
    activeUploadsRef.current.delete(fileId);
  }, []);

  // Resume file upload
  const resumeFile = useCallback((fileId: string) => {
    setQueue((prev) =>
      prev.map((f) =>
        f.id === fileId && f.status === "paused"
          ? { ...f, status: "pending" as UploadStatus, progress: 0 }
          : f
      )
    );
  }, []);

  // Retry failed upload
  const retryFile = useCallback((fileId: string) => {
    setQueue((prev) => {
      const file = prev.find((f) => f.id === fileId);
      if (file && file.retryCount < maxRetries) {
        return prev.map((f) =>
          f.id === fileId
            ? { ...f, status: "pending" as UploadStatus, progress: 0, error: undefined }
            : f
        );
      } else if (file) {
        toast.error(`${file.file.name}: Maximum retry attempts reached`);
      }
      return prev;
    });
  }, [maxRetries]);

  // Cancel file upload
  const cancelFile = useCallback((fileId: string) => {
    setQueue((prev) => {
      const file = prev.find((f) => f.id === fileId);
      if (file?.xhr) {
        file.xhr.abort();
      }
      if (file?.abortController) {
        file.abortController.abort();
      }
      if (file) {
        abortMultipartFor(file);
      }
      return prev.map((f) =>
        f.id === fileId ? { ...f, status: "cancelled" as UploadStatus, xhr: undefined, abortController: undefined } : f
      );
    });
    activeUploadsRef.current.delete(fileId);
  }, [abortMultipartFor]);

  // Clear completed uploads
  const clearCompleted = useCallback(() => {
    setQueue((prev) => prev.filter((f) => f.status !== "completed"));
  }, []);

  // Clear all uploads
  const clearAll = useCallback(() => {
    queue.forEach((f) => {
      if (f.xhr) {
        f.xhr.abort();
      }
      if (f.abortController) {
        f.abortController.abort();
      }
      abortMultipartFor(f);
    });
    setQueue([]);
    activeUploadsRef.current.clear();
  }, [queue, abortMultipartFor]);

  // Pause all uploads
  const pauseAll = useCallback(() => {
    setQueue((prev) =>
      prev.map((f) => {
        if (f.status === "uploading" && (f.xhr || f.abortController)) {
          f.xhr?.abort();
          f.abortController?.abort();
          activeUploadsRef.current.delete(f.id);
          return { ...f, status: "paused" as UploadStatus, xhr: undefined, abortController: undefined };
        }
        if (f.status === "pending") {
          return { ...f, status: "paused" as UploadStatus };
        }
        return f;
      })
    );
  }, []);

  // Resume all uploads
  const resumeAll = useCallback(() => {
    setQueue((prev) =>
      prev.map((f) =>
        f.status === "paused"
          ? { ...f, status: "pending" as UploadStatus, progress: 0 }
          : f
      )
    );
  }, []);

  // Calculate stats
  const isUploading = queue.some((f) => f.status === "uploading");

  // Ask the browser to confirm ("Leave site?") while anything is uploading or
  // queued to upload. Removed as soon as uploads finish, fail or are cancelled.
  const hasInFlightUploads = queue.some(
    (f) => f.status === "uploading" || f.status === "pending"
  );
  useEffect(() => {
    if (!hasInFlightUploads) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy browsers need returnValue set to show the prompt.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasInFlightUploads]);
  const totalSize = queue.reduce((sum, f) => sum + f.file.size, 0);
  const uploadedSize = queue.reduce((sum, f) => {
    if (f.status === "completed") return sum + f.file.size;
    return sum + (f.bytesUploaded || 0);
  }, 0);
  const totalProgress = totalSize > 0 ? Math.round((uploadedSize / totalSize) * 100) : 0;
  const activeCount = queue.filter((f) => f.status === "uploading").length;
  const pendingCount = queue.filter((f) => f.status === "pending" || f.status === "paused").length;
  const completedCount = queue.filter((f) => f.status === "completed").length;
  const errorCount = queue.filter((f) => f.status === "error").length;

  return {
    queue,
    addFiles,
    removeFile,
    pauseFile,
    resumeFile,
    retryFile,
    cancelFile,
    clearCompleted,
    clearAll,
    pauseAll,
    resumeAll,
    isUploading,
    totalProgress,
    totalSize,
    uploadedSize,
    activeCount,
    pendingCount,
    completedCount,
    errorCount,
  };
}
