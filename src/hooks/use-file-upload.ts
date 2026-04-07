"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { ALLOWED_TYPES, MAX_FILE_SIZE, isAllowedFileType } from "@/lib/file-utils";
import { extractVideoThumbnail, isVideoFile } from "@/lib/video-thumbnail";

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
    if (!isAllowedFileType(file.type)) {
      return `File type "${file.type}" is not allowed`;
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

    return new Promise((resolve, reject) => {
      let lastLoaded = 0;
      let lastTime = Date.now();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          const now = Date.now();
          const timeDiff = (now - lastTime) / 1000;
          const bytesDiff = e.loaded - lastLoaded;
          const speed = timeDiff > 0 ? bytesDiff / timeDiff : 0;
          const remaining = e.total - e.loaded;
          const timeRemaining = speed > 0 ? remaining / speed : 0;

          lastLoaded = e.loaded;
          lastTime = now;

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
          setQueue((prev) =>
            prev.map((f) =>
              f.id === queuedFile.id
                ? { ...f, status: "completed" as UploadStatus, progress: 100, xhr: undefined }
                : f
            )
          );
          toast.success(`${queuedFile.file.name} uploaded successfully`);
          onUploadComplete?.({ ...queuedFile, status: "completed" });
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

  // Upload a single file
  const uploadFile = useCallback(async (queuedFile: QueuedFile): Promise<void> => {
    const headers = getAuthHeaders?.() || {};
    const token = typeof window !== "undefined" ? localStorage.getItem("creatorToken") : null;

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
          fileType: queuedFile.file.type,
          fileSize: queuedFile.file.size,
          fieldId: queuedFile.fieldId,
        }),
      });

      if (!presignResponse.ok) {
        const error = await presignResponse.json();
        // If presign fails (e.g., S3/R2 not configured), try local upload
        console.warn("Presign failed, attempting local upload:", error.error);
        return uploadFileLocal(queuedFile);
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

        let lastLoaded = 0;
        let lastTime = Date.now();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            const now = Date.now();
            const timeDiff = (now - lastTime) / 1000;
            const bytesDiff = e.loaded - lastLoaded;
            const speed = timeDiff > 0 ? bytesDiff / timeDiff : 0;
            const remaining = e.total - e.loaded;
            const timeRemaining = speed > 0 ? remaining / speed : 0;

            lastLoaded = e.loaded;
            lastTime = now;

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
        xhr.setRequestHeader("Content-Type", queuedFile.file.type);
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

      toast.success(`${queuedFile.file.name} uploaded successfully`);

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
              ? { ...f, status: "cancelled" as UploadStatus, xhr: undefined }
              : f
          )
        );
        return;
      }

      // If it's a network error during S3 upload, try local fallback
      if (errorMessage.includes("Network error") || errorMessage.includes("Upload failed with status")) {
        console.warn("S3 upload failed, attempting local fallback:", errorMessage);
        try {
          // Reset progress for local upload attempt
          setQueue((prev) =>
            prev.map((f) =>
              f.id === queuedFile.id
                ? { ...f, progress: 0, status: "pending" as UploadStatus, xhr: undefined }
                : f
            )
          );
          await uploadFileLocal(queuedFile);
          return;
        } catch (localError) {
          const localErrorMessage = localError instanceof Error ? localError.message : "Local upload failed";
          console.error("Local upload also failed:", localErrorMessage);
        }
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
  }, [requestId, getAuthHeaders, onUploadComplete, onError, uploadFileLocal]);

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

      uploadFile(file).finally(() => {
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
      return prev.filter((f) => f.id !== fileId);
    });
    activeUploadsRef.current.delete(fileId);
  }, []);

  // Pause file upload
  const pauseFile = useCallback((fileId: string) => {
    setQueue((prev) =>
      prev.map((f) => {
        if (f.id === fileId && f.xhr && f.status === "uploading") {
          f.xhr.abort();
          return { ...f, status: "paused" as UploadStatus, xhr: undefined };
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
      return prev.map((f) =>
        f.id === fileId ? { ...f, status: "cancelled" as UploadStatus, xhr: undefined } : f
      );
    });
    activeUploadsRef.current.delete(fileId);
  }, []);

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
    });
    setQueue([]);
    activeUploadsRef.current.clear();
  }, [queue]);

  // Pause all uploads
  const pauseAll = useCallback(() => {
    setQueue((prev) =>
      prev.map((f) => {
        if (f.status === "uploading" && f.xhr) {
          f.xhr.abort();
          activeUploadsRef.current.delete(f.id);
          return { ...f, status: "paused" as UploadStatus, xhr: undefined };
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
