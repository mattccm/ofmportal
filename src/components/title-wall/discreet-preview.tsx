"use client";

import { useState } from "react";
import { EyeOff, Image as ImageIcon, Play, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePeek } from "./motion";

export interface DiscreetPreviewProps {
  /**
   * The preview image URL (a signed thumbnail or poster). It is NOT requested
   * until the preview is revealed: no <img> is rendered before that.
   */
  src?: string | null;
  /** What the preview shows, for the revealed image's alt text and the button label */
  label: string;
  kind?: "photo" | "video" | "text";
  /** Short caption in the corner: "0:24", "3 photos" */
  caption?: string;
  /** A dominant colour of the upload, drawn as a blurred tone field before reveal */
  tone?: string;
  /**
   * Controlled reveal (a page-level "Show previews" toggle). When omitted the
   * preview manages its own state: click toggles, press-and-hold peeks.
   */
  revealed?: boolean;
  onRevealedChange?: (revealed: boolean) => void;
  /** Press-and-hold delay before a peek (ms) */
  holdMs?: number;
  /** Aspect ratio of the plate, e.g. "4 / 3" (default "1 / 1") */
  aspect?: string;
  className?: string;
}

/**
 * A discreet preview. By default it is a flat tone plate with an eye-off
 * icon: nothing of the content is shown and the image is not even loaded.
 * Click (or Space/Enter) toggles it; press and hold, or hold P, peeks for as
 * long as it is held. Pass `revealed` to drive it from a "Show previews"
 * control. With no `src` it renders the empty state ("Nothing yet").
 *
 * @example
 * <DiscreetPreview src={signedThumbUrl} label="Teaser clip" kind="video" caption="0:24" aspect="16 / 9" />
 */
export function DiscreetPreview({
  src,
  label,
  kind = "photo",
  caption,
  tone,
  revealed,
  onRevealedChange,
  holdMs = 280,
  aspect = "1 / 1",
  className,
}: DiscreetPreviewProps) {
  const [own, setOwn] = useState(false);
  const { peeking, handlers, consumeHold } = usePeek(holdMs);
  const controlled = revealed !== undefined;
  const on = (controlled ? revealed : own) || peeking;
  const KindIcon = kind === "video" ? Play : kind === "text" ? Type : ImageIcon;

  if (!src && kind !== "text") {
    return (
      <span
        className={cn("tw-preview", className)}
        data-empty="true"
        style={{ aspectRatio: aspect }}
        aria-hidden="true"
      >
        Nothing yet
      </span>
    );
  }

  const toggle = () => {
    if (consumeHold()) return;
    const next = !(controlled ? revealed : own);
    if (!controlled) setOwn(next);
    onRevealedChange?.(next);
  };

  return (
    <button
      type="button"
      className={cn("tw-preview", className)}
      data-revealed={on ? "true" : "false"}
      style={{ aspectRatio: aspect }}
      aria-pressed={on}
      aria-label={`${on ? "Hide" : "Show"} preview of ${label}`}
      onClick={toggle}
      {...handlers}
    >
      {!on && tone && <span className="tw-preview-tone" style={{ backgroundColor: tone }} aria-hidden="true" />}
      {on && src ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URLs; next/image would cache them
        <img className="tw-preview-img" src={src} alt={label} decoding="async" draggable={false} />
      ) : (
        <EyeOff className="tw-preview-eye" aria-hidden="true" strokeWidth={1.5} />
      )}
      {caption && (
        <span className="tw-preview-kind" aria-hidden="true">
          <KindIcon className="size-3" strokeWidth={1.75} />
          {caption}
        </span>
      )}
    </button>
  );
}
