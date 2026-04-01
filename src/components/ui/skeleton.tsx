import { cn } from "@/lib/utils"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The type of skeleton shape to render
   */
  variant?: "default" | "circle" | "text" | "title" | "button" | "avatar" | "badge"
  /**
   * Enable animated shimmer effect
   */
  animate?: boolean
  /**
   * Width of the skeleton (use Tailwind classes or custom styles)
   */
  width?: string
  /**
   * Height of the skeleton (use Tailwind classes or custom styles)
   */
  height?: string
}

function Skeleton({
  className,
  variant = "default",
  animate = true,
  width,
  height,
  style,
  ...props
}: SkeletonProps) {
  const baseStyles = "bg-muted"

  const animationStyles = animate
    ? "animate-shimmer"
    : ""

  const variantStyles = {
    default: "rounded-lg",
    circle: "rounded-full aspect-square",
    text: "h-4 rounded-md",
    title: "h-6 rounded-md",
    button: "h-10 rounded-lg",
    avatar: "h-10 w-10 rounded-full",
    badge: "h-5 w-16 rounded-full",
  }

  return (
    <div
      className={cn(
        baseStyles,
        animationStyles,
        variantStyles[variant],
        className
      )}
      style={{
        width: width,
        height: height,
        ...style,
      }}
      {...props}
    />
  )
}

// Convenience components for common skeleton patterns
function SkeletonText({ className, lines = 1, ...props }: { lines?: number } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={cn(
            i === lines - 1 && lines > 1 ? "w-3/4" : "w-full"
          )}
        />
      ))}
    </div>
  )
}

function SkeletonAvatar({
  size = "default",
  className,
  ...props
}: {
  size?: "sm" | "default" | "lg" | "xl"
} & React.HTMLAttributes<HTMLDivElement>) {
  const sizeStyles = {
    sm: "h-8 w-8",
    default: "h-10 w-10",
    lg: "h-12 w-12",
    xl: "h-16 w-16",
  }

  return (
    <Skeleton
      variant="circle"
      className={cn(sizeStyles[size], className)}
      {...props}
    />
  )
}

function SkeletonButton({
  size = "default",
  className,
  ...props
}: {
  size?: "sm" | "default" | "lg"
} & React.HTMLAttributes<HTMLDivElement>) {
  const sizeStyles = {
    sm: "h-8 w-20",
    default: "h-10 w-24",
    lg: "h-11 w-28",
  }

  return (
    <Skeleton
      variant="button"
      className={cn(sizeStyles[size], className)}
      {...props}
    />
  )
}

function SkeletonBadge({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Skeleton
      variant="badge"
      className={className}
      {...props}
    />
  )
}

function SkeletonIcon({
  size = "default",
  className,
  ...props
}: {
  size?: "sm" | "default" | "lg"
} & React.HTMLAttributes<HTMLDivElement>) {
  const sizeStyles = {
    sm: "h-4 w-4",
    default: "h-5 w-5",
    lg: "h-6 w-6",
  }

  return (
    <Skeleton
      variant="default"
      className={cn(sizeStyles[size], "rounded", className)}
      {...props}
    />
  )
}

export {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonBadge,
  SkeletonIcon,
}
