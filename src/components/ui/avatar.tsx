"use client"

import * as React from "react"
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import {
  generateInitials,
  getAvatarGradientStyle,
  getAvatarUrl,
  getDisplayName,
  type AvatarUser,
} from "@/lib/avatar"

// Size variants for the avatar
const avatarSizeVariants = cva(
  "relative flex shrink-0 rounded-full select-none overflow-hidden",
  {
    variants: {
      size: {
        xs: "size-6 text-[10px]",
        sm: "size-8 text-xs",
        md: "size-10 text-sm",
        lg: "size-12 text-base",
        xl: "size-16 text-lg",
        "2xl": "size-20 text-xl",
        "3xl": "size-24 text-2xl",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

// Ring/border variants
const avatarRingVariants = cva("", {
  variants: {
    ring: {
      none: "",
      default: "ring-2 ring-background",
      primary: "ring-2 ring-primary",
      gradient: "ring-2 ring-primary/50",
      white: "ring-2 ring-white",
      thick: "ring-4 ring-background",
    },
  },
  defaultVariants: {
    ring: "none",
  },
})

// Online status indicator variants
const statusIndicatorVariants = cva(
  "absolute rounded-full border-2 border-background",
  {
    variants: {
      size: {
        xs: "size-1.5 -right-0.5 -bottom-0.5",
        sm: "size-2 -right-0.5 -bottom-0.5",
        md: "size-2.5 right-0 bottom-0",
        lg: "size-3 right-0 bottom-0",
        xl: "size-3.5 right-0.5 bottom-0.5",
        "2xl": "size-4 right-1 bottom-1",
        "3xl": "size-5 right-1.5 bottom-1.5",
      },
      status: {
        online: "bg-emerald-500",
        offline: "bg-gray-400",
        busy: "bg-red-500",
        away: "bg-amber-500",
      },
    },
    defaultVariants: {
      size: "md",
      status: "online",
    },
  }
)

export interface AvatarProps
  extends Omit<AvatarPrimitive.Root.Props, "size">,
    VariantProps<typeof avatarSizeVariants>,
    VariantProps<typeof avatarRingVariants> {
  /** User object for automatic fallback generation */
  user?: AvatarUser | null
  /** Show online status indicator */
  showStatus?: boolean
  /** Online status type */
  status?: "online" | "offline" | "busy" | "away"
  /** Custom fallback content (overrides auto-generated initials) */
  fallback?: React.ReactNode
  /** Image src (overrides user.image) */
  src?: string | null
  /** Alt text for image */
  alt?: string
}

function Avatar({
  className,
  size = "md",
  ring = "none",
  user,
  showStatus = false,
  status = "online",
  fallback,
  src,
  alt,
  children,
  ...props
}: AvatarProps) {
  // Determine the image source
  const imageSrc = src ?? getAvatarUrl(user)
  // Determine display name for alt text and initials
  const displayName = user ? getDisplayName(user) : alt || "User"
  // Generate initials if no custom fallback provided
  const initials = fallback ?? generateInitials(displayName)
  // Get gradient style for fallback
  const gradientStyle = getAvatarGradientStyle(displayName)

  return (
    <div className="relative inline-flex">
      <AvatarPrimitive.Root
        data-slot="avatar"
        data-size={size}
        className={cn(
          avatarSizeVariants({ size }),
          avatarRingVariants({ ring }),
          "after:absolute after:inset-0 after:rounded-full after:border after:border-border/30 after:mix-blend-darken dark:after:mix-blend-lighten",
          className
        )}
        {...props}
      >
        {imageSrc ? (
          <AvatarPrimitive.Image
            data-slot="avatar-image"
            src={imageSrc}
            alt={displayName}
            className="aspect-square size-full rounded-full object-cover"
          />
        ) : null}
        <AvatarPrimitive.Fallback
          data-slot="avatar-fallback"
          className="flex size-full items-center justify-center rounded-full font-medium text-white"
          style={gradientStyle}
        >
          {initials}
        </AvatarPrimitive.Fallback>
        {children}
      </AvatarPrimitive.Root>
      {showStatus && (
        <span
          data-slot="avatar-status"
          className={cn(statusIndicatorVariants({ size, status }))}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  )
}

function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn(
        "aspect-square size-full rounded-full object-cover",
        className
      )}
      {...props}
    />
  )
}

interface AvatarFallbackProps extends AvatarPrimitive.Fallback.Props {
  /** Name for gradient generation */
  name?: string | null
  /** Use gradient background */
  gradient?: boolean
}

function AvatarFallback({
  className,
  name,
  gradient = true,
  style,
  ...props
}: AvatarFallbackProps) {
  const gradientStyle = gradient ? getAvatarGradientStyle(name) : {}

  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full font-medium",
        gradient ? "text-white" : "bg-muted text-muted-foreground",
        className
      )}
      style={{ ...gradientStyle, ...style }}
      {...props}
    />
  )
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground bg-blend-color ring-2 ring-background select-none",
        "group-data-[size=xs]/avatar:size-2 group-data-[size=xs]/avatar:[&>svg]:hidden",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=md]/avatar:size-2.5 group-data-[size=md]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        "group-data-[size=xl]/avatar:size-4 group-data-[size=xl]/avatar:[&>svg]:size-3",
        "group-data-[size=2xl]/avatar:size-5 group-data-[size=2xl]/avatar:[&>svg]:size-3.5",
        "group-data-[size=3xl]/avatar:size-6 group-data-[size=3xl]/avatar:[&>svg]:size-4",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
        className
      )}
      {...props}
    />
  )
}

interface AvatarGroupCountProps extends React.ComponentProps<"div"> {
  count: number
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl"
}

function AvatarGroupCount({
  className,
  count,
  size = "md",
  ...props
}: AvatarGroupCountProps) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        avatarSizeVariants({ size }),
        "items-center justify-center bg-muted text-muted-foreground ring-2 ring-background font-medium",
        className
      )}
      {...props}
    >
      +{count}
    </div>
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
  avatarSizeVariants,
  avatarRingVariants,
}
