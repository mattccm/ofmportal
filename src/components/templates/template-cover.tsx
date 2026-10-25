"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatDay } from "@/components/title-wall";

/**
 * A template as a typeset title card on the shelf: the name set as display
 * lettering, then (after the title, never above it) how often it has been
 * used and when last, a short description, the fields it carries and a foot.
 * Templates carry no spine: the coloured edge belongs to request title cards.
 */

export interface TemplateCoverField {
  label: string;
  spec?: string;
}

export interface TemplateCoverProps {
  name: string;
  usageCount: number;
  lastUsedAt?: string | Date | null;
  description?: string | null;
  fields?: TemplateCoverField[];
  /** Foot line, defaults to "N fields" / "Blank" */
  foot?: ReactNode;
  /** Render as a pressable button (composer) */
  onPress?: () => void;
  pressed?: boolean;
  /** Render as a link (templates list) */
  href?: string;
  /** Folded into the composer's compact row */
  compact?: boolean;
  /** Another template is picked: step back to the dim tone */
  dim?: boolean;
  /** Inactive template */
  muted?: boolean;
  /** Small actions under the foot (sit above the card's link) */
  actions?: ReactNode;
  /** Extra line after the usage line ("Inactive", category) */
  aside?: ReactNode;
  className?: string;
  headingLevel?: "h2" | "h3";
  ariaLabel?: string;
}

function usageLine(count: number, last?: string | Date | null): string {
  if (!count) return "Not used yet";
  const times = count === 1 ? "Used once" : `Used ${count} times`;
  return last ? `${times} · last ${formatDay(last)}` : times;
}

export function TemplateCover({
  name,
  usageCount,
  lastUsedAt,
  description,
  fields = [],
  foot,
  onPress,
  pressed,
  href,
  compact = false,
  dim = false,
  muted = false,
  actions,
  aside,
  className,
  headingLevel = "h3",
  ariaLabel,
}: TemplateCoverProps) {
  const H = headingLevel;
  const len = name.length <= 14 ? "s" : name.length <= 24 ? "m" : "l";
  const footText = foot ?? (fields.length ? `${fields.length} ${fields.length === 1 ? "field" : "fields"}` : "Blank");

  const titleCls = cn(
    "m-0 font-extrabold text-ink [overflow-wrap:anywhere] [text-wrap:balance]",
    compact
      ? "truncate text-[17px] leading-[1.4] tracking-[-0.01em]"
      : cn(
          "line-clamp-2 leading-none",
          len === "s" && "text-[clamp(30px,14cqi,44px)] tracking-[-0.035em]",
          len === "m" && "text-[clamp(26px,11cqi,38px)] tracking-[-0.035em]",
          len === "l" && "text-[clamp(22px,8.5cqi,30px)] tracking-[-0.025em]"
        )
  );

  const hit = "after:absolute after:inset-0 after:rounded-[inherit] after:content-[''] focus-visible:outline-none";

  const title = href ? (
    <Link href={href} className={hit} aria-label={ariaLabel}>
      {name}
    </Link>
  ) : onPress ? (
    <button
      type="button"
      onClick={onPress}
      aria-pressed={pressed}
      aria-label={ariaLabel}
      className={cn(hit, "text-left !bg-transparent")}
    >
      {name}
    </button>
  ) : (
    name
  );

  return (
    <article
      className={cn(
        "group/tc relative flex min-w-0 flex-col rounded-[var(--tw-r-tile)] [container-type:inline-size]",
        "outline outline-[1.5px] -outline-offset-[1.5px] outline-transparent transition-[background-color,outline-color] duration-200 ease-out",
        "has-[:focus-visible]:outline-acc",
        compact ? "h-[92px] px-3.5 py-3" : "h-full px-[18px] py-4 sm:min-h-[236px]",
        pressed ? "bg-tile-hi outline-acc" : dim ? "bg-tile-dim hover:bg-tile" : "bg-tile hover:bg-tile-hi",
        muted && !pressed && "bg-tile-dim",
        className
      )}
      data-press=""
    >
      {compact ? (
        <H className={titleCls} title={name}>
          {title}
        </H>
      ) : (
        <div className="flex min-h-[58px] items-start">
          <H className={titleCls} title={name}>
            {title}
          </H>
        </div>
      )}
      {!compact && (
        <p className="mt-1.5 truncate text-sm font-medium text-ink-2">
          {usageLine(usageCount, lastUsedAt)}
          {aside}
        </p>
      )}
      {!compact && description && (
        <p className="mt-2 line-clamp-2 max-w-[48ch] text-sm text-ink-2">{description}</p>
      )}
      {!compact && fields.length > 0 && (
        <ul className="mt-2.5 hidden flex-col gap-px text-[13px] leading-normal sm:flex">
          {fields.slice(0, 6).map((f, i) => (
            <li key={i} className="flex min-w-0 items-center gap-2">
              <i className="tw-cell size-2.5 shrink-0" data-state="waiting" aria-hidden="true">
                <span className="tw-cell-fill" />
              </i>
              <b className="truncate font-medium">{f.label || "Untitled field"}</b>
              {f.spec && (
                <em className="ml-auto max-w-[62%] truncate pl-2.5 text-right not-italic text-ink-2">{f.spec}</em>
              )}
            </li>
          ))}
          {fields.length > 6 && <li className="text-ink-2">and {fields.length - 6} more</li>}
        </ul>
      )}
      <p
        className={cn(
          "mt-auto",
          compact ? "pt-1 text-[13px] text-ink-2" : "pt-2.5 text-sm font-semibold"
        )}
      >
        {footText}
      </p>
      {actions && <div className="relative z-[1] mt-2 flex flex-wrap gap-2">{actions}</div>}
    </article>
  );
}
