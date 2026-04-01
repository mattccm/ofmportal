"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  CloudUpload,
  X,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  Check,
  AlertCircle,
  Folder,
  Tag,
  Plus,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaFolder, MediaType } from "@/types/media-library";

interface MediaUploaderProps {
  creatorId: string;
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
  folders?: MediaFolder[];
}

interface UploadFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: MediaType;
  mimeType: string;
  progress: number;
  status: "pending" | "uploading" | "processing" | "complete" | "error";
  error?: string;
  thumbnailUrl?: string;
  title?: string;
  tags: string[];
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/aac",
  "application/pdf",
];

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getMediaType(mimeType: string): MediaType {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}

function getMediaTypeIcon(type: MediaType, className?: string) {
  switch (type) {
    case "image":
      return <ImageIcon className={className} />;
    case "video":
      return <Video className={className} />;
    case "audio":
      return <Music className={className} />;
    case "document":
      return <FileText className={className} />;
  }
}

function getMediaTypeColor(type: MediaType) {
  switch (type) {
    case "image":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "video":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "audio":
      return "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400";
    case "document":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
  }
}

export function MediaUploader({
  creatorId,
  isOpen,
  onClose,
  onUploadComplete,
  folders = [],
}: MediaUploaderProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [globalTags, setGlobalTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  // Generate thumbnail for images/videos
  const generateThumbnail = useCallback(async (file: File): Promise<string | undefined> => {
    if (file.type.startsWith("image/")) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
    }
    if (file.type.startsWith("video/")) {
      return new Promise((resolve) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
          video.currentTime = Math.min(1, video.duration / 4);
        };
        video.onseeked = () => {
          const canvas = document.createElement("canvas");
          canvas.width = 200;
          canvas.height = 200 * (video.videoHeight / video.videoWidth);
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
          URL.revokeObjectURL(video.src);
        };
        video.onerror = () => resolve(undefined);
        video.src = URL.createObjectURL(file);
      });
    }
    return undefined;
  }, []);

  // Add files
  const addFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const newFiles: UploadFile[] = [];

      for (const file of Array.from(fileList)) {
        // Validate file
        if (!ALLOWED_TYPES.includes(file.type)) {
          console.warn(`Skipping unsupported file type: ${file.type}`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          console.warn(`Skipping file too large: ${file.name}`);
          continue;
        }

        const mediaType = getMediaType(file.type);
        const thumbnailUrl = await generateThumbnail(file);

        newFiles.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          name: file.name,
          size: file.size,
          type: mediaType,
          mimeType: file.type,
          progress: 0,
          status: "pending",
          thumbnailUrl,
          title: file.name.replace(/\.[^.]+$/, ""),
          tags: [...globalTags],
        });
      }

      setFiles((prev) => [...prev, ...newFiles]);
    },
    [generateThumbnail, globalTags]
  );

  // Drag handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);

      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  // File input handler
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [addFiles]
  );

  // Remove file
  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // Update file metadata
  const updateFile = useCallback((id: string, updates: Partial<UploadFile>) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  }, []);

  // Add tag to all files
  const addGlobalTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !globalTags.includes(tag)) {
      setGlobalTags((prev) => [...prev, tag]);
      setFiles((prev) =>
        prev.map((f) => ({
          ...f,
          tags: f.tags.includes(tag) ? f.tags : [...f.tags, tag],
        }))
      );
    }
    setTagInput("");
  }, [tagInput, globalTags]);

  // Remove global tag
  const removeGlobalTag = useCallback((tag: string) => {
    setGlobalTags((prev) => prev.filter((t) => t !== tag));
    setFiles((prev) =>
      prev.map((f) => ({
        ...f,
        tags: f.tags.filter((t) => t !== tag),
      }))
    );
  }, []);

  // Upload files
  const uploadFiles = async () => {
    if (files.length === 0) return;

    setIsUploading(true);

    for (const uploadFile of files) {
      if (uploadFile.status === "complete") continue;

      try {
        // Update status
        updateFile(uploadFile.id, { status: "uploading", progress: 0 });

        // Get presigned URL
        const presignResponse = await fetch("/api/media-library/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creatorId,
            fileName: uploadFile.name,
            fileType: uploadFile.mimeType,
            fileSize: uploadFile.size,
          }),
        });

        if (!presignResponse.ok) {
          throw new Error("Failed to get upload URL");
        }

        const { uploadUrl, storageKey } = await presignResponse.json();

        // Upload to storage with progress
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded / e.total) * 100);
              updateFile(uploadFile.id, { progress });
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          };
          xhr.onerror = () => reject(new Error("Upload failed"));
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", uploadFile.mimeType);
          xhr.send(uploadFile.file);
        });

        // Update status to processing
        updateFile(uploadFile.id, { status: "processing" });

        // Complete the upload in the database
        const completeResponse = await fetch("/api/media-library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creatorId,
            fileName: uploadFile.name,
            originalName: uploadFile.name,
            fileType: uploadFile.file.type.split("/")[1] || "unknown",
            mimeType: uploadFile.mimeType,
            fileSize: uploadFile.size,
            storageKey,
            mediaType: uploadFile.type,
            folderId: selectedFolder,
            tags: uploadFile.tags,
            title: uploadFile.title,
          }),
        });

        if (!completeResponse.ok) {
          throw new Error("Failed to save media item");
        }

        updateFile(uploadFile.id, { status: "complete", progress: 100 });
      } catch (error) {
        console.error("Upload error:", error);
        updateFile(uploadFile.id, {
          status: "error",
          error: error instanceof Error ? error.message : "Upload failed",
        });
      }
    }

    setIsUploading(false);

    // Check if all complete
    const allComplete = files.every(
      (f) => f.status === "complete" || f.status === "error"
    );
    if (allComplete && files.some((f) => f.status === "complete")) {
      onUploadComplete();
    }
  };

  // Reset and close
  const handleClose = () => {
    if (!isUploading) {
      setFiles([]);
      setGlobalTags([]);
      setSelectedFolder(null);
      onClose();
    }
  };

  const completedCount = files.filter((f) => f.status === "complete").length;
  const errorCount = files.filter((f) => f.status === "error").length;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Upload to Media Library</DialogTitle>
          <DialogDescription>
            Upload files to the creator&apos;s media library for easy access and organization.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* Dropzone */}
          <div
            className={cn(
              "relative rounded-xl border-2 border-dashed transition-all duration-300",
              isDragging
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-border/60 hover:border-primary/50 hover:bg-accent/30",
              files.length > 0 && "py-4"
            )}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {files.length === 0 ? (
              <div className="p-8 text-center">
                <div
                  className={cn(
                    "mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all",
                    isDragging
                      ? "bg-primary text-white scale-110"
                      : "bg-violet-50 text-violet-500 dark:bg-violet-900/30"
                  )}
                >
                  {isDragging ? (
                    <Sparkles className="h-8 w-8 animate-pulse" />
                  ) : (
                    <CloudUpload className="h-8 w-8" />
                  )}
                </div>
                <h3 className="font-semibold text-lg mb-2">
                  {isDragging ? "Drop files here" : "Drag and drop files"}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  or click to browse. Supports images, videos, audio, and PDFs up to 5GB.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ALLOWED_TYPES.join(",")}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Select Files
                </Button>
              </div>
            ) : (
              <div className="px-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">
                    {files.length} file{files.length !== 1 ? "s" : ""} selected
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add More
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ALLOWED_TYPES.join(",")}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                {/* File list */}
                <div className="space-y-2 max-h-[200px] overflow-auto">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-lg border",
                        file.status === "error" && "border-destructive bg-destructive/5",
                        file.status === "complete" && "border-green-500 bg-green-50 dark:bg-green-900/10"
                      )}
                    >
                      {/* Thumbnail */}
                      <div
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden",
                          getMediaTypeColor(file.type)
                        )}
                      >
                        {file.thumbnailUrl ? (
                          <img
                            src={file.thumbnailUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          getMediaTypeIcon(file.type, "h-5 w-5")
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)}
                        </p>
                      </div>

                      {/* Status/Progress */}
                      {file.status === "uploading" && (
                        <div className="w-24">
                          <Progress value={file.progress} className="h-1.5" />
                        </div>
                      )}
                      {file.status === "processing" && (
                        <Badge variant="outline" className="text-blue-600">
                          Processing...
                        </Badge>
                      )}
                      {file.status === "complete" && (
                        <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center">
                          <Check className="h-4 w-4" />
                        </div>
                      )}
                      {file.status === "error" && (
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-destructive" />
                          <span className="text-xs text-destructive">{file.error}</span>
                        </div>
                      )}

                      {/* Remove button */}
                      {file.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeFile(file.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Organization options */}
          {files.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              {/* Folder selection */}
              <div className="space-y-2">
                <Label>Destination Folder</Label>
                <Select
                  value={selectedFolder || "none"}
                  onValueChange={(v) => setSelectedFolder(v === "none" ? null : v)}
                >
                  <SelectTrigger>
                    <Folder className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Select folder" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No folder (root)</SelectItem>
                    {folders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label>Tags (applied to all files)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add tag..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addGlobalTag();
                      }
                    }}
                  />
                  <Button variant="outline" onClick={addGlobalTag}>
                    <Tag className="h-4 w-4" />
                  </Button>
                </div>
                {globalTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {globalTags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => removeGlobalTag(tag)}
                      >
                        {tag}
                        <X className="ml-1 h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upload summary */}
          {(completedCount > 0 || errorCount > 0) && (
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted">
              {completedCount > 0 && (
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="h-4 w-4" />
                  <span className="text-sm">{completedCount} uploaded</span>
                </div>
              )}
              {errorCount > 0 && (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{errorCount} failed</span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            {completedCount === files.length && files.length > 0 ? "Done" : "Cancel"}
          </Button>
          {completedCount < files.length && (
            <Button
              onClick={uploadFiles}
              disabled={files.length === 0 || isUploading}
            >
              {isUploading ? (
                <>
                  <span className="animate-spin mr-2">
                    <Upload className="h-4 w-4" />
                  </span>
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload {files.length} File{files.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default MediaUploader;
