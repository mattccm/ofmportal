"use client";

import { Children, isValidElement, useCallback, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode, Ref } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { isReducedMotion } from "./motion";

export interface ShelfProps {
  /** The row's name, e.g. "Due this week" (an h2) */
  title: string;
  /** One finding after the name, e.g. "4 requests due in the next 7 days" */
  sub?: ReactNode;
  /** Tiles. Give each child a `key`; pass `itemIds` to make the shelf a focus-wall row. */
  children: ReactNode;
  /** Ids for each child in order: sets data-id so useFocusWall can address them */
  itemIds?: string[];
  /** The focused item's id on a focus wall (renders data-focused) */
  focusedId?: string | null;
  /** Show previous / next buttons when the row overflows (default true) */
  showNav?: boolean;
  /** Shown instead of the track when there are no children */
  empty?: ReactNode;
  /** Heading level (default h2) */
  headingLevel?: "h2" | "h3";
  className?: string;
}

/**
 * A horizontally scrolling row of tiles. Widths are fractional on purpose
 * (about 4.3 tiles on a desktop, 1.15 on a phone) so the next title is always
 * cut at the edge: the row says "there is more" without arrows. Scroll snaps
 * to tile edges; Left/Right/Home/End move between tiles from the keyboard;
 * optional previous / next buttons page by a screenful.
 *
 * @example
 * <Shelf title="Due this week" sub="4 requests due in the next 7 days">
 *   {requests.map((r) => <TitleCard key={r.id} {...toCard(r)} />)}
 * </Shelf>
 */
export function Shelf({
  title,
  sub,
  children,
  itemIds,
  focusedId,
  showNav = true,
  empty,
  headingLevel = "h2",
  className,
}: ShelfProps) {
  const H = headingLevel;
  const headingId = useId();
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const items = Children.toArray(children).filter(isValidElement);

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 2,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
    });
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const frame = requestAnimationFrame(measure);
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [measure, items.length]);

  const page = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>(".tw-shelf-item");
    const step = first ? first.offsetWidth + 16 : el.clientWidth * 0.8;
    const whole = Math.max(1, Math.floor(el.clientWidth / step));
    el.scrollBy({ left: dir * whole * step, behavior: isReducedMotion() ? "auto" : "smooth" });
  };

  // Arrow keys move between tiles when focus is inside one. A wall built with
  // useFocusWall handles its own keys; this is the plain-shelf fallback.
  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (itemIds) return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    if ((e.target as Element).matches("input, textarea, select")) return;
    const li = (e.target as Element).closest<HTMLElement>(".tw-shelf-item");
    if (!li) return;
    const all = [...e.currentTarget.querySelectorAll<HTMLElement>(":scope > .tw-shelf-item")];
    const i = all.indexOf(li);
    const next =
      e.key === "ArrowRight" ? all[i + 1] : e.key === "ArrowLeft" ? all[i - 1] : e.key === "Home" ? all[0] : all[all.length - 1];
    if (!next) return;
    e.preventDefault();
    const target = next.querySelector<HTMLElement>("a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])");
    (target ?? next).focus({ preventScroll: true });
    next.scrollIntoView({ block: "nearest", inline: "nearest", behavior: isReducedMotion() ? "auto" : "smooth" });
  };

  const overflow = !(edges.start && edges.end);

  return (
    <section className={cn("tw-shelf", className)} aria-labelledby={headingId}>
      <div className="tw-shelf-h">
        <H id={headingId}>{title}</H>
        {sub && <span className="tw-shelf-sub">{sub}</span>}
        {showNav && overflow && (
          <div className="tw-shelf-nav">
            <button
              type="button"
              className="grid size-9 place-items-center rounded-md border border-ctl text-foreground transition-colors hover:border-ctl-hi hover:bg-tile-hi focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:border-line disabled:text-ink-2 max-sm:size-10"
              onClick={() => page(-1)}
              disabled={edges.start}
              aria-label={`Previous in ${title}`}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="grid size-9 place-items-center rounded-md border border-ctl text-foreground transition-colors hover:border-ctl-hi hover:bg-tile-hi focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:border-line disabled:text-ink-2 max-sm:size-10"
              onClick={() => page(1)}
              disabled={edges.end}
              aria-label={`Next in ${title}`}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      {items.length === 0 && empty ? (
        empty
      ) : (
        <div ref={scroller} className="tw-shelf-scroller">
          <ul className="tw-shelf-track" data-wall-row onKeyDown={onKeyDown}>
            {items.map((child, i) => {
              const id = itemIds?.[i];
              return (
                <li
                  key={child.key ?? i}
                  className="tw-shelf-item"
                  data-wall-item={id ? "" : undefined}
                  data-id={id}
                  data-focused={id && focusedId === id ? "true" : undefined}
                >
                  {child}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

export interface WallProps {
  children: ReactNode;
  className?: string;
  /** Accessible name for the wall region */
  label?: string;
}

/**
 * The container for several shelves that share one focus (useFocusWall).
 * It renders the `tw-wall` hook for the "wall steps back" styling.
 */
export function Wall({ children, className, label, ref }: WallProps & { ref?: Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} className={cn("tw-wall", className)} role="region" aria-label={label}>
      {children}
    </div>
  );
}
