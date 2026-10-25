"use client";

/**
 * The Title Wall motion vocabulary (GSAP + Flip), for React.
 *
 * Rules (design-mocks/title-wall-v2/SYSTEM.md, Motion):
 * - Motion explains a change of state or acknowledges an action. Nothing
 *   animates on page load and no content is hidden waiting for script.
 * - Transforms and opacity only; Flip for layout changes.
 * - Reduced motion is owned by gsap.matchMedia(): the state still changes,
 *   instantly and without travel.
 *
 * Everything here runs on the client only (inside effects, handlers or
 * useGSAP), never during render or on the server.
 */

import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, RefObject } from "react";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { useGSAP } from "@gsap/react";

let registered = false;
let reduced = false;
let mm: gsap.MatchMedia | null = null;
const listeners = new Set<() => void>();

/** Registers plugins and the reduced-motion watcher once (client only). */
export function ensureMotion(): void {
  if (registered || typeof window === "undefined") return;
  registered = true;
  gsap.registerPlugin(useGSAP, Flip);
  reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  mm = gsap.matchMedia();
  mm.add(
    { reduce: "(prefers-reduced-motion: reduce)", full: "(prefers-reduced-motion: no-preference)" },
    (ctx) => {
      reduced = !!ctx.conditions?.reduce;
      document.documentElement.dataset.motion = reduced ? "reduced" : "full";
      listeners.forEach((l) => l());
    }
  );
}

/** True when the user asked for reduced motion. */
export function isReducedMotion(): boolean {
  ensureMotion();
  return reduced;
}

/** React hook form of isReducedMotion (false on the server). */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      ensureMotion();
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => isReducedMotion(),
    () => false
  );
}

export const EASE = { out: "power3.out", inOut: "power3.inOut", quick: "power2.out" } as const;
export const DUR = { press: 0.1, release: 0.22, tick: 0.32, fill: 0.45, flip: 0.5, panel: 0.3 } as const;

/* ------------------------------------------------------------------------ */
/* Press: things give under the finger (scale only, kept under reduced motion) */
/* ------------------------------------------------------------------------ */

const PRESSABLE =
  "[data-press], .tw-rail-item, .tw-preview, .tw-shelf-nav button, [data-slot='button']";

/**
 * Adds press feedback (scale 0.97) to every pressable element inside `scope`.
 * Buttons already scale in CSS; this covers custom tiles and links that opt in
 * with `data-press`.
 */
export function usePressFeedback(scope: RefObject<HTMLElement | null>, selector = PRESSABLE) {
  useGSAP(
    (_ctx, contextSafe) => {
      const root = scope.current;
      if (!root || !contextSafe) return;
      const down = contextSafe((e: PointerEvent) => {
        const el = (e.target as Element | null)?.closest<HTMLElement>(selector);
        if (!el || !root.contains(el)) return;
        if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return;
        gsap.to(el, { scale: 0.97, duration: DUR.press, ease: EASE.quick, overwrite: "auto" });
        const up = contextSafe(() => {
          gsap.to(el, { scale: 1, duration: DUR.release, ease: EASE.out, overwrite: "auto", clearProps: "transform" });
          window.removeEventListener("pointerup", up);
          window.removeEventListener("pointercancel", up);
        });
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", up);
      });
      root.addEventListener("pointerdown", down);
      return () => root.removeEventListener("pointerdown", down);
    },
    { scope }
  );
}

/* ------------------------------------------------------------------------ */
/* Small state tweens                                                        */
/* ------------------------------------------------------------------------ */

/** A field cell fills from its leading edge after its state changes. */
export function fillCell(cell: Element | null): void {
  if (!cell || isReducedMotion()) return;
  const fill = cell.querySelector(".tw-cell-fill");
  if (!fill) return;
  const vertical = !!cell.closest(".tw-spine");
  gsap.killTweensOf(fill);
  gsap.fromTo(
    fill,
    vertical ? { scaleY: 0 } : { scaleX: 0 },
    { scaleX: 1, scaleY: 1, duration: DUR.fill, ease: EASE.out, clearProps: "transform" }
  );
}

/** A new row arrives (a sent message, a history line): rises a few px and fades in. */
export function arrive(targets: gsap.TweenTarget): void {
  if (isReducedMotion()) return;
  gsap.fromTo(
    targets,
    { autoAlpha: 0, y: 10 },
    { autoAlpha: 1, y: 0, duration: 0.32, ease: EASE.out, stagger: 0.05, clearProps: "opacity,visibility,transform" }
  );
}

/** A changed label swaps in (Send reminder -> Reminder sent). */
export function swapIn(el: Element | null): void {
  if (!el || isReducedMotion()) return;
  gsap.fromTo(el, { y: 6, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.24, ease: EASE.out, clearProps: "opacity,visibility,transform" });
}

/**
 * A count rolls to its new value. Call after React has rendered the new number:
 * it animates the element's text in from the direction of change.
 */
export function rollNumber(el: HTMLElement | null, direction: 1 | -1): void {
  if (!el || isReducedMotion()) return;
  gsap.fromTo(el, { yPercent: 60 * direction, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: DUR.tick, ease: EASE.out, clearProps: "opacity,visibility,transform" });
}

/**
 * "Up next": a bar drains over `seconds`, then onDone runs. Returns a cancel
 * function, or null under reduced motion (show a "Next" button instead).
 */
export function upNextCountdown(bar: HTMLElement, seconds: number, onDone: () => void): (() => void) | null {
  if (isReducedMotion()) return null;
  const tween = gsap.fromTo(
    bar,
    { scaleX: 1 },
    { scaleX: 0, duration: seconds, ease: "none", transformOrigin: "left center", onComplete: onDone }
  );
  return () => {
    tween.kill();
    gsap.set(bar, { clearProps: "transform" });
  };
}

/* ------------------------------------------------------------------------ */
/* Flip                                                                      */
/* ------------------------------------------------------------------------ */

/**
 * Records `targets`, runs `mutate()` (a synchronous DOM change), then animates
 * them from where they were. For React state changes use useFlipLayout.
 */
export function flipLayout(targets: gsap.DOMTarget, mutate: () => void, vars: Flip.FromToVars = {}) {
  if (isReducedMotion()) {
    mutate();
    return null;
  }
  const state = Flip.getState(targets);
  mutate();
  return Flip.from(state, { duration: DUR.flip, ease: EASE.inOut, nested: true, prune: true, ...vars });
}

/**
 * Flip across a React re-render: call `capture()` right before the state
 * change; the layout effect animates from the captured state after React
 * commits. `deps` should be the state that changes the layout.
 */
export function useFlipLayout(
  scope: RefObject<HTMLElement | null>,
  selector: string,
  deps: unknown[],
  vars: Flip.FromToVars = {}
) {
  ensureMotion();
  const pending = useRef<Flip.FlipState | null>(null);
  const capture = useCallback(() => {
    const root = scope.current;
    if (!root || isReducedMotion()) return;
    pending.current = Flip.getState(root.querySelectorAll(selector));
  }, [scope, selector]);

  useLayoutEffect(() => {
    const state = pending.current;
    pending.current = null;
    if (!state) return;
    const tl = Flip.from(state, { duration: DUR.flip, ease: EASE.inOut, simple: true, ...vars });
    return () => {
      tl.progress(1).kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return capture;
}

/* ------------------------------------------------------------------------ */
/* The signature: focus opens a title in place, the wall steps back           */
/* ------------------------------------------------------------------------ */

export interface FocusWallOptions {
  /** Called when a focused tile is opened (Enter, or a second click) */
  onOpen?: (id: string) => void;
  /** Screen-reader announcement for a focus change */
  announce?: (id: string | null) => void;
  /** Hover with a mouse focuses after this delay (ms). 0 disables hover focus. */
  hoverDelay?: number;
}

/**
 * Makes every `[data-wall-item]` (with a `data-id`) inside `[data-wall-row]`
 * rows of `wallRef` one roving grid:
 * - Arrow keys move along a row and between rows, Home/End jump in a row.
 * - Space expands or collapses the focused title; Enter opens it; Esc closes.
 * - Click focuses; a second click opens. A mouse hover focuses after a delay.
 *
 * The focused item gets `data-focused="true"` and widens in place with Flip;
 * the wall gets `data-has-focus="true"` so CSS darkens the other tiles'
 * surfaces (never their text). Under reduced motion it changes instantly.
 *
 * Shelf and TitleCard already carry the attributes; pass the wall element's
 * ref and render `data-focused` from `focusedId`.
 */
export function useFocusWall(wallRef: RefObject<HTMLElement | null>, opts: FocusWallOptions = {}) {
  const { onOpen, announce, hoverDelay = 260 } = opts;
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const capture = useFlipLayout(wallRef, "[data-wall-item]", [focusedId]);
  const hoverTimer = useRef<number>(0);
  const current = useRef<string | null>(null);
  useLayoutEffect(() => {
    current.current = focusedId;
  }, [focusedId]);

  const focus = useCallback(
    (id: string | null, { speak = true }: { speak?: boolean } = {}) => {
      if (id === current.current) return;
      capture();
      setFocusedId(id);
      if (speak) announce?.(id);
    },
    [capture, announce]
  );

  useLayoutEffect(() => {
    const wall = wallRef.current;
    if (!wall) return;
    wall.dataset.hasFocus = focusedId ? "true" : "false";
    if (!focusedId || isReducedMotion()) return;
    // the details of the opened title slide in after the tile has widened
    const item = wall.querySelector<HTMLElement>(`[data-wall-item][data-id="${CSS.escape(focusedId)}"]`);
    const det = item?.querySelector(".tw-tile-detail");
    if (det) {
      gsap.fromTo(det, { autoAlpha: 0, x: -8 }, { autoAlpha: 1, x: 0, duration: 0.3, delay: 0.18, ease: EASE.out, clearProps: "opacity,visibility,transform" });
    }
  }, [focusedId, wallRef]);

  useLayoutEffect(() => {
    const wall = wallRef.current;
    if (!wall) return;
    const rows = () =>
      [...wall.querySelectorAll<HTMLElement>("[data-wall-row]")].filter(
        (r) => r.offsetParent !== null && r.querySelector("[data-wall-item]")
      );
    const itemOf = (t: EventTarget | null) => (t as Element | null)?.closest<HTMLElement>("[data-wall-item]") ?? null;
    const focusTarget = (item: HTMLElement) =>
      item.querySelector<HTMLElement>("[data-wall-focus], a[href], button:not([disabled])") ?? item;

    const moveTo = (item: HTMLElement | undefined) => {
      if (!item?.dataset.id) return;
      focus(item.dataset.id);
      focusTarget(item).focus({ preventScroll: true });
      item.scrollIntoView({ block: "nearest", inline: "nearest", behavior: isReducedMotion() ? "auto" : "smooth" });
    };

    const onKey = (e: KeyboardEvent) => {
      const item = itemOf(e.target);
      if (!item) return;
      if ((e.target as Element).matches("input, textarea, select")) return;
      const id = item.dataset.id ?? null;
      if (e.key === "Escape" && current.current) {
        e.preventDefault();
        focus(null);
        return;
      }
      const row = item.closest<HTMLElement>("[data-wall-row]");
      if (!row) return;
      const sibs = [...row.querySelectorAll<HTMLElement>("[data-wall-item]")];
      const i = sibs.indexOf(item);
      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          moveTo(sibs[i + 1]);
          break;
        case "ArrowLeft":
          e.preventDefault();
          moveTo(sibs[i - 1]);
          break;
        case "Home":
          e.preventDefault();
          moveTo(sibs[0]);
          break;
        case "End":
          e.preventDefault();
          moveTo(sibs[sibs.length - 1]);
          break;
        case "ArrowDown":
        case "ArrowUp": {
          const rs = rows();
          const next = rs[rs.indexOf(row) + (e.key === "ArrowDown" ? 1 : -1)];
          if (!next) return;
          e.preventDefault();
          const x = item.getBoundingClientRect().left;
          const cands = [...next.querySelectorAll<HTMLElement>("[data-wall-item]")];
          const pick = cands.reduce((best, el) =>
            Math.abs(el.getBoundingClientRect().left - x) < Math.abs(best.getBoundingClientRect().left - x) ? el : best
          );
          moveTo(pick);
          break;
        }
        case " ":
          // Space on a link or button inside the tile keeps its own meaning
          if ((e.target as Element).matches("button")) return;
          e.preventDefault();
          focus(current.current === id ? null : id);
          break;
        case "Enter":
          if (id && current.current !== id) focus(id);
          if (id && onOpen) {
            e.preventDefault();
            onOpen(id);
          }
          break;
      }
    };

    const onClick = (e: MouseEvent) => {
      const item = itemOf(e.target);
      if (!item?.dataset.id) return;
      // the first click on a title focuses it; links inside open on the second
      if (current.current !== item.dataset.id) {
        if ((e.target as Element).closest("button")) return;
        e.preventDefault();
        focus(item.dataset.id);
      } else if (onOpen && !(e.target as Element).closest("a, button")) {
        onOpen(item.dataset.id);
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!hoverDelay || e.pointerType !== "mouse") return;
      const item = itemOf(e.target);
      window.clearTimeout(hoverTimer.current);
      if (!item?.dataset.id || item.dataset.id === current.current) return;
      const id = item.dataset.id;
      hoverTimer.current = window.setTimeout(() => focus(id, { speak: false }), hoverDelay);
    };
    const onLeave = () => window.clearTimeout(hoverTimer.current);

    wall.addEventListener("keydown", onKey);
    wall.addEventListener("click", onClick);
    wall.addEventListener("pointermove", onMove);
    wall.addEventListener("pointerleave", onLeave);
    return () => {
      wall.removeEventListener("keydown", onKey);
      wall.removeEventListener("click", onClick);
      wall.removeEventListener("pointermove", onMove);
      wall.removeEventListener("pointerleave", onLeave);
      window.clearTimeout(hoverTimer.current);
    };
  }, [wallRef, focus, onOpen, hoverDelay]);

  return { focusedId, focus };
}

/* ------------------------------------------------------------------------ */
/* Press and hold to peek (discreet previews)                                */
/* ------------------------------------------------------------------------ */

/**
 * Press and hold (or hold the P key) to peek. Returns handlers to spread on
 * the element plus `peeking`. A completed hold swallows the click that follows.
 */
export function usePeek(holdMs = 280) {
  const [peeking, setPeeking] = useState(false);
  const timer = useRef<number>(0);
  const held = useRef(false);

  const end = useCallback(() => {
    window.clearTimeout(timer.current);
    setPeeking(false);
  }, []);

  const handlers = {
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.button > 0) return;
      held.current = false;
      timer.current = window.setTimeout(() => {
        held.current = true;
        setPeeking(true);
      }, holdMs);
    },
    onPointerUp: end,
    onPointerLeave: end,
    onPointerCancel: end,
    onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
    onKeyDown: (e: ReactKeyboardEvent) => {
      if ((e.key === "p" || e.key === "P") && !e.repeat) {
        held.current = true;
        setPeeking(true);
      }
    },
    onKeyUp: (e: ReactKeyboardEvent) => {
      if (e.key === "p" || e.key === "P") end();
    },
  };

  /** True once if the last press was a hold (consume it to skip the click). */
  const consumeHold = useCallback(() => {
    const was = held.current;
    held.current = false;
    return was;
  }, []);

  return { peeking, handlers, consumeHold };
}

export { gsap, Flip, useGSAP };
