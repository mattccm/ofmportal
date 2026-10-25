"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { isReducedMotion } from "@/components/title-wall/motion";

/**
 * One group of templates as a shelf: the group's heading (with its own
 * controls beside it), then a snap-scrolling row where the next card peeks.
 * Mirrors the title-wall Shelf, with a header slot for group actions and a
 * drop target so a template card can be dragged onto another group.
 */
export interface TemplateShelfProps {
  /** The heading, or an inline rename form while renaming */
  heading: React.ReactNode;
  headingId: string;
  sub?: React.ReactNode;
  /** Group menu and other controls, after the heading */
  actions?: React.ReactNode;
  /** Cards, each with a key; `ids` gives each one's template id for dragging */
  children: React.ReactNode;
  ids: string[];
  empty?: React.ReactNode;
  /** Dragging: is a card currently being dragged onto this shelf */
  dropActive?: boolean;
  /** Can a card be dragged at all */
  draggable?: boolean;
  onCardDragStart?: (id: string) => void;
  onCardDragEnd?: () => void;
  onDragOverShelf?: () => void;
  onDragLeaveShelf?: () => void;
  onDropOnShelf?: (id: string) => void;
}

const DRAG_TYPE = "application/x-ccm-template";

export function TemplateShelf({
  heading,
  headingId,
  sub,
  actions,
  children,
  ids,
  empty,
  dropActive = false,
  draggable = false,
  onCardDragStart,
  onCardDragEnd,
  onDragOverShelf,
  onDragLeaveShelf,
  onDropOnShelf,
}: TemplateShelfProps) {
  const scroller = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState({ start: true, end: true });
  const items = React.Children.toArray(children).filter(React.isValidElement);

  const measure = React.useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 2,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
    });
  }, []);

  React.useEffect(() => {
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

  // Left/Right/Home/End move between cards when focus is inside one
  const onKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    if ((e.target as Element).matches("input, textarea, select, [role='menuitem']")) return;
    const li = (e.target as Element).closest<HTMLElement>(".tw-shelf-item");
    if (!li) return;
    const all = [...e.currentTarget.querySelectorAll<HTMLElement>(":scope > .tw-shelf-item")];
    const i = all.indexOf(li);
    const next =
      e.key === "ArrowRight" ? all[i + 1] : e.key === "ArrowLeft" ? all[i - 1] : e.key === "Home" ? all[0] : all[all.length - 1];
    if (!next) return;
    e.preventDefault();
    const target = next.querySelector<HTMLElement>("a[href], button:not([disabled])");
    (target ?? next).focus({ preventScroll: true });
    next.scrollIntoView({ block: "nearest", inline: "nearest", behavior: isReducedMotion() ? "auto" : "smooth" });
  };

  const dropProps = onDropOnShelf
    ? {
        onDragOver: (e: React.DragEvent) => {
          if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          onDragOverShelf?.();
        },
        onDragLeave: (e: React.DragEvent) => {
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          onDragLeaveShelf?.();
        },
        onDrop: (e: React.DragEvent) => {
          const id = e.dataTransfer.getData(DRAG_TYPE);
          if (!id) return;
          e.preventDefault();
          onDropOnShelf(id);
        },
      }
    : {};

  const overflow = !(edges.start && edges.end);

  return (
    <section className="tw-shelf" aria-labelledby={headingId} {...dropProps}>
      <div className="tw-shelf-h flex-wrap">
        {heading}
        {sub && <span className="tw-shelf-sub">{sub}</span>}
        {actions}
        {overflow && (
          <div className="tw-shelf-nav">
            <button
              type="button"
              className="grid size-9 place-items-center rounded-md border border-ctl text-foreground transition-colors hover:border-ctl-hi hover:bg-tile-hi focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:border-line disabled:text-ink-2 max-sm:size-10"
              onClick={() => page(-1)}
              disabled={edges.start}
              aria-label="Previous templates"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="grid size-9 place-items-center rounded-md border border-ctl text-foreground transition-colors hover:border-ctl-hi hover:bg-tile-hi focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:border-line disabled:text-ink-2 max-sm:size-10"
              onClick={() => page(1)}
              disabled={edges.end}
              aria-label="Next templates"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      <div
        className={cn(
          "rounded-[var(--tw-r-tile)] outline outline-[1.5px] outline-offset-[3px] outline-dashed outline-transparent transition-[outline-color] duration-150",
          dropActive && "outline-ctl-hi"
        )}
      >
        {items.length === 0 && empty ? (
          empty
        ) : (
          <div ref={scroller} className="tw-shelf-scroller">
            <ul className="tw-shelf-track" onKeyDown={onKeyDown}>
              {items.map((child, i) => {
                const id = ids[i];
                return (
                  <li
                    key={child.key ?? i}
                    className="tw-shelf-item"
                    draggable={draggable && !!id}
                    onDragStart={
                      draggable && id
                        ? (e) => {
                            e.dataTransfer.setData(DRAG_TYPE, id);
                            e.dataTransfer.effectAllowed = "move";
                            onCardDragStart?.(id);
                          }
                        : undefined
                    }
                    onDragEnd={draggable ? () => onCardDragEnd?.() : undefined}
                  >
                    {child}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
