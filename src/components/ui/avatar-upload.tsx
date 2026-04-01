"use client"

import * as React from "react"
import { Camera, Upload, X, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar } from "@/components/ui/avatar"
import {
  generateInitials,
  getAvatarGradientStyle,
  validateAvatarFile,
  compressAvatarImage,
  type AvatarUser,
} from "@/lib/avatar"

interface CropArea {
  x: number
  y: number
  scale: number
}

interface AvatarUploadProps {
  /** Current user for fallback display */
  user?: AvatarUser | null
  /** Current avatar URL */
  currentAvatarUrl?: string | null
  /** Called when avatar upload is complete */
  onUpload?: (base64: string) => Promise<void>
  /** Called when avatar is removed */
  onRemove?: () => Promise<void>
  /** Size of the avatar preview */
  size?: "md" | "lg" | "xl" | "2xl" | "3xl"
  /** Whether the component is disabled */
  disabled?: boolean
  /** Additional class name */
  className?: string
}

// Crop dialog component
function CropDialog({
  imageSrc,
  onCrop,
  onCancel,
}: {
  imageSrc: string
  onCrop: (croppedBase64: string) => void
  onCancel: () => void
}) {
  const [crop, setCrop] = React.useState<CropArea>({ x: 0, y: 0, scale: 1 })
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 })
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const imageRef = React.useRef<HTMLImageElement | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const PREVIEW_SIZE = 280
  const OUTPUT_SIZE = 256

  // Load image
  React.useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imageRef.current = img
      // Center the image initially
      const scale = Math.max(PREVIEW_SIZE / img.width, PREVIEW_SIZE / img.height)
      setCrop({
        x: (PREVIEW_SIZE - img.width * scale) / 2,
        y: (PREVIEW_SIZE - img.height * scale) / 2,
        scale,
      })
    }
    img.src = imageSrc
  }, [imageSrc])

  // Draw preview
  React.useEffect(() => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE)
    ctx.save()

    // Create circular clip path
    ctx.beginPath()
    ctx.arc(PREVIEW_SIZE / 2, PREVIEW_SIZE / 2, PREVIEW_SIZE / 2, 0, Math.PI * 2)
    ctx.clip()

    // Draw image
    ctx.drawImage(
      img,
      crop.x,
      crop.y,
      img.width * crop.scale,
      img.height * crop.scale
    )

    ctx.restore()
  }, [crop])

  // Mouse handlers for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - crop.x, y: e.clientY - crop.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setCrop((prev) => ({
      ...prev,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    }))
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    setIsDragging(true)
    setDragStart({ x: touch.clientX - crop.x, y: touch.clientY - crop.y })
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    const touch = e.touches[0]
    setCrop((prev) => ({
      ...prev,
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    }))
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  // Wheel handler for zooming
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const img = imageRef.current
    if (!img) return

    const delta = e.deltaY > 0 ? -0.05 : 0.05
    const minScale = Math.max(PREVIEW_SIZE / img.width, PREVIEW_SIZE / img.height)
    const maxScale = minScale * 3

    setCrop((prev) => {
      const newScale = Math.min(Math.max(prev.scale + delta, minScale), maxScale)
      // Adjust position to zoom towards center
      const scaleDiff = newScale / prev.scale
      const centerX = PREVIEW_SIZE / 2
      const centerY = PREVIEW_SIZE / 2
      return {
        x: centerX - (centerX - prev.x) * scaleDiff,
        y: centerY - (centerY - prev.y) * scaleDiff,
        scale: newScale,
      }
    })
  }

  // Handle crop confirmation
  const handleCrop = () => {
    const img = imageRef.current
    if (!img) return

    // Create output canvas at desired resolution
    const outputCanvas = document.createElement("canvas")
    outputCanvas.width = OUTPUT_SIZE
    outputCanvas.height = OUTPUT_SIZE
    const ctx = outputCanvas.getContext("2d")
    if (!ctx) return

    // Scale crop coordinates to output size
    const outputScale = OUTPUT_SIZE / PREVIEW_SIZE
    const scaledX = crop.x * outputScale
    const scaledY = crop.y * outputScale
    const scaledImageWidth = img.width * crop.scale * outputScale
    const scaledImageHeight = img.height * crop.scale * outputScale

    // Draw image
    ctx.drawImage(img, scaledX, scaledY, scaledImageWidth, scaledImageHeight)

    // Convert to base64
    const base64 = outputCanvas.toDataURL("image/jpeg", 0.9)
    onCrop(base64)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card rounded-2xl shadow-2xl border border-border/50 p-6 max-w-md w-full mx-4 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Crop your photo</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            className="h-8 w-8 rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Drag to reposition. Scroll to zoom.
        </p>

        {/* Crop preview */}
        <div
          ref={containerRef}
          className="relative mx-auto mb-6 cursor-move overflow-hidden rounded-full border-4 border-primary/20 shadow-lg"
          style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          <canvas
            ref={canvasRef}
            width={PREVIEW_SIZE}
            height={PREVIEW_SIZE}
            className="rounded-full"
          />
          {/* Circular overlay guide */}
          <div className="absolute inset-0 rounded-full ring-4 ring-white/20 pointer-events-none" />
        </div>

        {/* Zoom slider */}
        <div className="mb-6">
          <input
            type="range"
            min="0"
            max="100"
            value={(() => {
              const img = imageRef.current
              if (!img) return 50
              const minScale = Math.max(PREVIEW_SIZE / img.width, PREVIEW_SIZE / img.height)
              const maxScale = minScale * 3
              return ((crop.scale - minScale) / (maxScale - minScale)) * 100
            })()}
            onChange={(e) => {
              const img = imageRef.current
              if (!img) return
              const minScale = Math.max(PREVIEW_SIZE / img.width, PREVIEW_SIZE / img.height)
              const maxScale = minScale * 3
              const newScale = minScale + (maxScale - minScale) * (parseInt(e.target.value) / 100)
              const scaleDiff = newScale / crop.scale
              const centerX = PREVIEW_SIZE / 2
              const centerY = PREVIEW_SIZE / 2
              setCrop({
                x: centerX - (centerX - crop.x) * scaleDiff,
                y: centerY - (centerY - crop.y) * scaleDiff,
                scale: newScale,
              })
            }}
            className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleCrop} className="flex-1 btn-gradient">
            <Check className="h-4 w-4 mr-2" />
            Apply
          </Button>
        </div>
      </div>
    </div>
  )
}

// Progress ring component
function ProgressRing({
  progress,
  size = 80,
  strokeWidth = 4,
}: {
  progress: number
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (progress / 100) * circumference

  return (
    <svg
      width={size}
      height={size}
      className="absolute inset-0 -rotate-90 transition-transform"
    >
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/30"
      />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="url(#progress-gradient)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-300"
      />
      <defs>
        <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function AvatarUpload({
  user,
  currentAvatarUrl,
  onUpload,
  onRemove,
  size = "2xl",
  disabled = false,
  className,
}: AvatarUploadProps) {
  const [isDragging, setIsDragging] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const [uploadProgress, setUploadProgress] = React.useState(0)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [cropImageSrc, setCropImageSrc] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Size mapping for the avatar and progress ring
  const sizeMap = {
    md: { avatar: 40, ring: 48 },
    lg: { avatar: 48, ring: 56 },
    xl: { avatar: 64, ring: 72 },
    "2xl": { avatar: 80, ring: 88 },
    "3xl": { avatar: 96, ring: 104 },
  }

  const currentSize = sizeMap[size]
  const displayUrl = previewUrl || currentAvatarUrl
  const displayName = user?.name || user?.email?.split("@")[0] || "User"
  const initials = generateInitials(displayName)
  const gradientStyle = getAvatarGradientStyle(displayName)

  // Handle file selection
  const handleFileSelect = async (file: File) => {
    setError(null)

    // Validate file
    const validation = validateAvatarFile(file)
    if (!validation.valid) {
      setError(validation.error || "Invalid file")
      return
    }

    // Read and show crop dialog
    const reader = new FileReader()
    reader.onload = (e) => {
      setCropImageSrc(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  // Handle crop completion
  const handleCropComplete = async (croppedBase64: string) => {
    setCropImageSrc(null)
    setPreviewUrl(croppedBase64)

    if (onUpload) {
      setIsUploading(true)
      setUploadProgress(0)

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 10
        })
      }, 100)

      try {
        await onUpload(croppedBase64)
        setUploadProgress(100)

        // Brief delay to show 100%
        await new Promise((resolve) => setTimeout(resolve, 300))
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed")
        setPreviewUrl(null)
      } finally {
        clearInterval(progressInterval)
        setIsUploading(false)
        setUploadProgress(0)
      }
    }
  }

  // Handle drag events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (disabled) return

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  // Handle remove
  const handleRemove = async () => {
    if (onRemove) {
      try {
        await onRemove()
        setPreviewUrl(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove avatar")
      }
    }
  }

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      {/* Avatar preview with upload functionality */}
      <div
        className={cn(
          "relative group cursor-pointer transition-all duration-300",
          isDragging && "scale-105",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
      >
        {/* Main avatar */}
        <div
          className={cn(
            "relative rounded-full overflow-hidden transition-all duration-300",
            "shadow-lg hover:shadow-xl",
            isDragging && "ring-4 ring-primary ring-offset-2 ring-offset-background"
          )}
          style={{ width: currentSize.avatar, height: currentSize.avatar }}
        >
          {displayUrl ? (
            <img
              src={displayUrl}
              alt={displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-white font-semibold"
              style={{
                ...gradientStyle,
                fontSize: currentSize.avatar * 0.35,
              }}
            >
              {initials}
            </div>
          )}

          {/* Hover overlay */}
          {!isUploading && (
            <div
              className={cn(
                "absolute inset-0 bg-black/50 flex items-center justify-center",
                "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              )}
            >
              <Camera className="h-6 w-6 text-white" />
            </div>
          )}

          {/* Upload progress overlay */}
          {isUploading && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            </div>
          )}
        </div>

        {/* Progress ring */}
        {isUploading && uploadProgress > 0 && (
          <div
            className="absolute"
            style={{
              top: (currentSize.avatar - currentSize.ring) / 2,
              left: (currentSize.avatar - currentSize.ring) / 2,
            }}
          >
            <ProgressRing
              progress={uploadProgress}
              size={currentSize.ring}
              strokeWidth={3}
            />
          </div>
        )}

        {/* Drag indicator */}
        {isDragging && (
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-primary animate-pulse" />
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const files = e.target.files
          if (files && files.length > 0) {
            handleFileSelect(files[0])
          }
          // Reset input so same file can be selected again
          e.target.value = ""
        }}
        disabled={disabled}
      />

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          className="text-xs"
        >
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          Upload photo
        </Button>
        {displayUrl && onRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              handleRemove()
            }}
            disabled={disabled || isUploading}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5 mr-1.5" />
            Remove
          </Button>
        )}
      </div>

      {/* Helper text */}
      <p className="text-xs text-muted-foreground text-center">
        Drag and drop or click to upload. JPG, PNG, GIF or WebP. Max 10MB.
      </p>

      {/* Error message */}
      {error && (
        <p className="text-xs text-destructive text-center animate-fade-in">
          {error}
        </p>
      )}

      {/* Crop dialog */}
      {cropImageSrc && (
        <CropDialog
          imageSrc={cropImageSrc}
          onCrop={handleCropComplete}
          onCancel={() => setCropImageSrc(null)}
        />
      )}
    </div>
  )
}

export default AvatarUpload
