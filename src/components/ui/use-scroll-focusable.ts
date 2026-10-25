"use client";

import * as React from "react";

/**
 * Makes a scroll container reachable from the keyboard only while it actually
 * overflows (WCAG 2.1.1, axe `scrollable-region-focusable`). A container whose
 * content fits stays out of the tab order.
 */
export function useScrollFocusable<T extends HTMLElement>(ref: React.RefObject<T | null>) {
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const overflows = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
      if (overflows) {
        if (!el.hasAttribute("tabindex")) {
          el.setAttribute("tabindex", "0");
          el.dataset.scrollFocusable = "";
        }
      } else if (el.dataset.scrollFocusable !== undefined) {
        el.removeAttribute("tabindex");
        delete el.dataset.scrollFocusable;
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => ro.disconnect();
  }, [ref]);
}
