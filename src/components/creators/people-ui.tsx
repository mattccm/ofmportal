import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Small in-world pieces shared by the people screens (Creators, creator
 * profile, Messages, Settings, Reminders, Team). Tokens only.
 */

/** The page head: a noun h1, the finding line under it, actions at the right (full width on a phone). */
export function PageHead({
  title,
  lede,
  actions,
  back,
  className,
}: {
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0 max-w-[72ch]">
        {back && <BackLink href={back.href} label={back.label} className="mb-3" />}
        <h1 className="text-[22px] font-bold leading-tight tracking-[-0.015em] text-ink sm:text-[26px]">{title}</h1>
        {lede && <p className="mt-1.5 text-[15px] leading-normal text-ink">{lede}</p>}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-col gap-2 max-sm:[&>*]:h-11 max-sm:[&>*]:w-full sm:flex-row sm:flex-wrap sm:justify-end">
          {actions}
        </div>
      )}
    </header>
  );
}

export function BackLink({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-9 items-center gap-1 rounded-md pr-2 text-sm text-ink-2 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className
      )}
    >
      <ChevronLeft className="size-4 text-icon" aria-hidden="true" />
      {label}
    </Link>
  );
}

/** A status pill: one per object. Tone carries state only. */
export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "late" | "ready" | "quiet" | "approved";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center whitespace-nowrap rounded-[6px] px-2 text-[12.5px] font-semibold leading-none",
        tone === "neutral" && "bg-tile-hi text-ink",
        tone === "quiet" && "border border-ctl text-ink-2",
        tone === "late" && "bg-late/14 text-late",
        tone === "ready" && "bg-ready/14 text-ready",
        tone === "approved" && "bg-approved/14 text-approved",
        className
      )}
    >
      {children}
    </span>
  );
}

/** Initials in a neutral disc (no photographs on the wall). */
export function Initials({ name, className }: { name: string; className?: string }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const text = parts.length ? (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() : "?";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-grid size-9 shrink-0 place-items-center rounded-full bg-tile-hi text-[12px] font-bold tracking-[0.02em] text-ink",
        className
      )}
    >
      {text}
    </span>
  );
}

/** An unread count badge */
export function UnreadCount({ n, className }: { n: number; className?: string }) {
  if (n <= 0) return null;
  return (
    <span
      className={cn(
        "inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-ink px-1 text-[12px] font-bold leading-none text-ground tabular-nums",
        className
      )}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

/**
 * Settings in two columns: a label column (title + description + optional
 * summary) beside a tile panel. Stacks on a phone.
 */
export function SettingsSection({
  title,
  description,
  aside,
  children,
  id,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-h` : undefined}
      className={cn(
        "grid gap-4 border-t border-line pt-8 lg:grid-cols-[minmax(240px,340px)_minmax(0,1fr)] lg:gap-10",
        className
      )}
    >
      <div className="min-w-0 lg:pt-2">
        <h2 id={id ? `${id}-h` : undefined} className="text-[17px] font-semibold leading-snug text-ink">
          {title}
        </h2>
        {description && <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{description}</p>}
        {aside && <div className="mt-4 text-sm text-ink">{aside}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** A tile panel (no border, no shadow). */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-[10px] bg-tile p-4 sm:p-5", className)}>{children}</div>;
}

/** Section head row on the ground: h2, one finding, optional end slot. */
export function SectionHead({
  title,
  sub,
  end,
  id,
  as: H = "h2",
}: {
  title: ReactNode;
  sub?: ReactNode;
  end?: ReactNode;
  id?: string;
  as?: "h2" | "h3";
}) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <H id={id} className="text-[17px] font-semibold leading-snug text-ink">
        {title}
      </H>
      {sub && <span className="text-sm text-ink-2">{sub}</span>}
      {end && <div className="ml-auto flex items-center gap-2">{end}</div>}
    </div>
  );
}

/** A real empty state: what is missing and what to do next. */
export function EmptyLine({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[10px] border border-dashed border-ctl px-4 py-4 text-sm text-ink-2", className)}>
      {children}
    </div>
  );
}
