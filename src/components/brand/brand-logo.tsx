import Image from "next/image";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  /** Rendered width and height of the mark in CSS pixels */
  size?: number;
  /** Show BRAND.productName next to the mark */
  showWordmark?: boolean;
  /** Optional smaller line under the wordmark */
  tagline?: string;
  /** Classes for the outer wrapper */
  className?: string;
  /** Classes for the image itself (e.g. "dark:invert" so the black mark shows on dark surfaces) */
  imageClassName?: string;
  /** Classes for the wordmark text */
  wordmarkClassName?: string;
  /** Classes for the tagline text */
  taglineClassName?: string;
  priority?: boolean;
}

/**
 * The CCM mark (black on transparent) with an optional wordmark.
 * The PNG is black, so callers on dark surfaces should pass an invert filter
 * via imageClassName.
 */
export function BrandLogo({
  size = 32,
  showWordmark = false,
  tagline,
  className,
  imageClassName,
  wordmarkClassName,
  taglineClassName,
  priority = false,
}: BrandLogoProps) {
  const image = (
    <Image
      src={BRAND.logoPath}
      alt={showWordmark ? "" : BRAND.name}
      width={size}
      height={size}
      priority={priority}
      className={cn("shrink-0 object-contain", imageClassName)}
      style={{ width: size, height: size }}
    />
  );

  if (!showWordmark) {
    return <span className={cn("inline-flex shrink-0", className)}>{image}</span>;
  }

  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      {image}
      <span className="flex min-w-0 flex-col leading-tight">
        <span className={cn("truncate font-semibold tracking-tight", wordmarkClassName)}>
          {BRAND.productName}
        </span>
        {tagline ? (
          <span className={cn("truncate text-[11px] font-medium opacity-60", taglineClassName)}>
            {tagline}
          </span>
        ) : null}
      </span>
    </span>
  );
}
