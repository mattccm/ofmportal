"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, Image, Upload, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  preview?: string;
  errorMessage?: string;
}

interface MobileUploadButtonProps {
  onUpload?: (files: File[]) => Promise<void>;
  accept?: string;
  maxFiles?: number;
  maxSize?: number; // in MB
  disabled?: boolean;
  className?: string;
}

export function MobileUploadButton({
  onUpload,
  accept = "image/*,video/*",
  maxFiles = 10,
  maxSize = 100,
  disabled = false,
  className,
}: MobileUploadButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      files.forEach((f) => {
        if (f.preview) {
          URL.revokeObjectURL(f.preview);
        }
      });
    };
  }, [files]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const handleCameraCapture = useCallback(() => {
    cameraInputRef.current?.click();
    // Trigger haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }, []);

  const handleGalleryPick = useCallback(() => {
    galleryInputRef.current?.click();
    // Trigger haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }, []);

  const processFiles = useCallback(
    (selectedFiles: FileList | null) => {
      if (!selectedFiles || selectedFiles.length === 0) return;

      const maxSizeBytes = maxSize * 1024 * 1024;
      const newFiles: UploadFile[] = [];
      const existingCount = files.length;

      Array.from(selectedFiles).forEach((file, index) => {
        if (existingCount + newFiles.length >= maxFiles) {
          return;
        }

        if (file.size > maxSizeBytes) {
          newFiles.push({
            id: generateId(),
            file,
            progress: 0,
            status: "error",
            errorMessage: `File exceeds ${maxSize}MB limit`,
          });
          return;
        }

        const uploadFile: UploadFile = {
          id: generateId(),
          file,
          progress: 0,
          status: "pending",
        };

        // Generate preview for images
        if (file.type.startsWith("image/")) {
          uploadFile.preview = URL.createObjectURL(file);
        }

        newFiles.push(uploadFile);
      });

      setFiles((prev) => [...prev, ...newFiles]);
      setIsOpen(true);
    },
    [files.length, maxFiles, maxSize]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      processFiles(e.target.files);
      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [processFiles]
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((f) => f.id !== id);
    });
    // Trigger haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }, []);

  const startUpload = useCallback(async () => {
    const filesToUpload = files.filter((f) => f.status === "pending");
    if (filesToUpload.length === 0) return;

    setIsUploading(true);

    // Mark all as uploading
    setFiles((prev) =>
      prev.map((f) =>
        f.status === "pending" ? { ...f, status: "uploading" as const } : f
      )
    );

    // Simulate upload progress
    const uploadPromises = filesToUpload.map(async (uploadFile) => {
      return new Promise<void>((resolve) => {
        let progress = 0;
        const interval = setInterval(() => {
          progress += Math.random() * 20;
          if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            setFiles((prev) =>
              prev.map((f) =>
                f.id === uploadFile.id
                  ? { ...f, progress: 100, status: "completed" as const }
                  : f
              )
            );
            // Success haptic
            if (navigator.vibrate) {
              navigator.vibrate([10, 50, 10]);
            }
            resolve();
          } else {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === uploadFile.id ? { ...f, progress: Math.round(progress) } : f
              )
            );
          }
        }, 200);
      });
    });

    try {
      await Promise.all(uploadPromises);

      // Call the actual upload handler if provided
      if (onUpload) {
        const validFiles = filesToUpload.map((f) => f.file);
        await onUpload(validFiles);
      }

      // Auto-close after successful upload
      setTimeout(() => {
        setFiles([]);
        setIsOpen(false);
      }, 1500);
    } catch (error) {
      console.error("Upload failed:", error);
      // Error haptic
      if (navigator.vibrate) {
        navigator.vibrate([50, 100, 50]);
      }
    } finally {
      setIsUploading(false);
    }
  }, [files, onUpload]);

  const closeOverlay = useCallback(() => {
    if (isUploading) return;
    setFiles([]);
    setIsOpen(false);
  }, [isUploading]);

  const hasCompletedFiles = files.some((f) => f.status === "completed");
  const hasPendingFiles = files.some((f) => f.status === "pending");

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept={accept}
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept={accept}
        multiple
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* Main Upload Button - Floating Action Button Style */}
      <div className={cn("md:hidden", className)}>
        <button
          onClick={() => setIsOpen(true)}
          disabled={disabled}
          className={cn(
            "fixed z-40",
            "flex items-center justify-center",
            "h-14 w-14 rounded-2xl",
            "bg-gradient-to-br from-primary to-violet-600 text-white",
            "shadow-lg shadow-primary/30",
            "active:scale-95 transition-all duration-150",
            "touch-manipulation",
            "disabled:opacity-50 disabled:pointer-events-none"
          )}
          style={{
            bottom: "calc(80px + env(safe-area-inset-bottom, 0px))",
            right: "16px",
          }}
          aria-label="Upload files"
        >
          <Upload className="h-6 w-6" />
        </button>
      </div>

      {/* Upload Selection Sheet */}
      {isOpen && !files.length && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
        >
          <div
            className={cn(
              "w-full bg-card rounded-t-3xl",
              "animate-slide-up"
            )}
            onClick={(e) => e.stopPropagation()}
            style={{
              paddingBottom: "env(safe-area-inset-bottom, 16px)",
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="px-6 pb-4 pt-2">
              <h3 className="text-lg font-semibold text-center">Upload Content</h3>
              <p className="text-sm text-muted-foreground text-center mt-1">
                Choose how you want to add files
              </p>
            </div>

            {/* Options */}
            <div className="px-4 pb-6 space-y-3">
              {/* Camera Option */}
              <button
                onClick={handleCameraCapture}
                className={cn(
                  "flex items-center gap-4 w-full p-4 rounded-2xl",
                  "bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20",
                  "border border-blue-200 dark:border-blue-800",
                  "active:scale-[0.98] transition-transform",
                  "touch-manipulation"
                )}
              >
                <div
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-xl",
                    "bg-blue-500 text-white"
                  )}
                >
                  <Camera className="h-7 w-7" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-foreground">Take Photo or Video</p>
                  <p className="text-sm text-muted-foreground">
                    Use your camera to capture
                  </p>
                </div>
              </button>

              {/* Gallery Option */}
              <button
                onClick={handleGalleryPick}
                className={cn(
                  "flex items-center gap-4 w-full p-4 rounded-2xl",
                  "bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20",
                  "border border-violet-200 dark:border-violet-800",
                  "active:scale-[0.98] transition-transform",
                  "touch-manipulation"
                )}
              >
                <div
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-xl",
                    "bg-violet-500 text-white"
                  )}
                >
                  <Image className="h-7 w-7" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-foreground">Choose from Gallery</p>
                  <p className="text-sm text-muted-foreground">
                    Select photos or videos from your device
                  </p>
                </div>
              </button>

              {/* Cancel Button */}
              <Button
                variant="ghost"
                onClick={() => setIsOpen(false)}
                className="w-full h-12 rounded-xl touch-manipulation mt-2"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Progress Overlay */}
      {isOpen && files.length > 0 && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm md:hidden">
          {/* Header */}
          <div
            className={cn(
              "sticky top-0 z-10 bg-background/95 backdrop-blur-xl",
              "border-b border-border"
            )}
            style={{
              paddingTop: "env(safe-area-inset-top, 16px)",
            }}
          >
            <div className="flex items-center justify-between px-4 py-3">
              <button
                onClick={closeOverlay}
                disabled={isUploading}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  "hover:bg-muted active:scale-95 transition-all",
                  "touch-manipulation",
                  "disabled:opacity-50 disabled:pointer-events-none"
                )}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>

              <h2 className="font-semibold text-lg">
                {hasCompletedFiles && !hasPendingFiles
                  ? "Upload Complete"
                  : `${files.length} ${files.length === 1 ? "file" : "files"}`}
              </h2>

              <div className="w-10" /> {/* Spacer for alignment */}
            </div>
          </div>

          {/* File List */}
          <div
            className="flex-1 overflow-auto px-4 py-4"
            style={{
              height: `calc(100vh - 160px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))`,
            }}
          >
            <div className="space-y-3">
              {files.map((uploadFile) => (
                <div
                  key={uploadFile.id}
                  className={cn(
                    "relative flex items-center gap-3 p-3 rounded-2xl",
                    "border transition-colors",
                    uploadFile.status === "uploading" &&
                      "bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800",
                    uploadFile.status === "completed" &&
                      "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800",
                    uploadFile.status === "error" &&
                      "bg-red-50/50 border-red-200 dark:bg-red-900/10 dark:border-red-800",
                    uploadFile.status === "pending" && "bg-card border-border"
                  )}
                >
                  {/* Preview or Icon */}
                  <div
                    className={cn(
                      "relative h-14 w-14 shrink-0 rounded-xl overflow-hidden",
                      "bg-muted flex items-center justify-center"
                    )}
                  >
                    {uploadFile.preview ? (
                      <img
                        src={uploadFile.preview}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : uploadFile.file.type.startsWith("video/") ? (
                      <Camera className="h-6 w-6 text-muted-foreground" />
                    ) : (
                      <Image className="h-6 w-6 text-muted-foreground" />
                    )}

                    {/* Progress overlay */}
                    {uploadFile.status === "uploading" && (
                      <div
                        className="absolute inset-0 bg-blue-500/30 flex items-center justify-center"
                        style={{
                          clipPath: `inset(${100 - uploadFile.progress}% 0 0 0)`,
                        }}
                      />
                    )}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {uploadFile.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(uploadFile.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>

                    {/* Progress bar */}
                    {uploadFile.status === "uploading" && (
                      <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-200"
                          style={{ width: `${uploadFile.progress}%` }}
                        />
                      </div>
                    )}

                    {/* Error message */}
                    {uploadFile.status === "error" && uploadFile.errorMessage && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        {uploadFile.errorMessage}
                      </p>
                    )}
                  </div>

                  {/* Status Icon or Remove Button */}
                  <div className="shrink-0">
                    {uploadFile.status === "pending" && (
                      <button
                        onClick={() => removeFile(uploadFile.id)}
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl",
                          "hover:bg-muted active:scale-95 transition-all",
                          "touch-manipulation"
                        )}
                        aria-label="Remove file"
                      >
                        <X className="h-5 w-5 text-muted-foreground" />
                      </button>
                    )}
                    {uploadFile.status === "uploading" && (
                      <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                    )}
                    {uploadFile.status === "completed" && (
                      <CheckCircle className="h-5 w-5 text-emerald-500" />
                    )}
                    {uploadFile.status === "error" && (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add more files button */}
            {!isUploading && files.length < maxFiles && (
              <button
                onClick={handleGalleryPick}
                className={cn(
                  "flex items-center justify-center gap-2 w-full mt-4 p-4",
                  "border-2 border-dashed border-muted-foreground/30 rounded-2xl",
                  "text-muted-foreground hover:border-primary hover:text-primary",
                  "active:scale-[0.98] transition-all touch-manipulation"
                )}
              >
                <Upload className="h-5 w-5" />
                <span className="font-medium">Add more files</span>
              </button>
            )}
          </div>

          {/* Bottom Action Bar */}
          <div
            className={cn(
              "sticky bottom-0 px-4 py-4 bg-background border-t border-border"
            )}
            style={{
              paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
            }}
          >
            {hasPendingFiles && !isUploading && (
              <Button
                onClick={startUpload}
                className={cn(
                  "w-full h-14 rounded-2xl text-lg font-semibold",
                  "bg-gradient-to-r from-primary to-violet-600",
                  "hover:from-primary/90 hover:to-violet-600/90",
                  "active:scale-[0.98] transition-all touch-manipulation"
                )}
              >
                <Upload className="h-5 w-5 mr-2" />
                Upload {files.filter((f) => f.status === "pending").length} files
              </Button>
            )}

            {isUploading && (
              <div className="flex items-center justify-center gap-3 h-14">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="font-medium text-muted-foreground">
                  Uploading...
                </span>
              </div>
            )}

            {hasCompletedFiles && !hasPendingFiles && !isUploading && (
              <Button
                onClick={closeOverlay}
                className={cn(
                  "w-full h-14 rounded-2xl text-lg font-semibold",
                  "bg-emerald-500 hover:bg-emerald-600",
                  "active:scale-[0.98] transition-all touch-manipulation"
                )}
              >
                <CheckCircle className="h-5 w-5 mr-2" />
                Done
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
