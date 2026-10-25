"use client";

import * as React from "react";

const warned = new Set<string>();

/**
 * Development only: warns once per control when a rendered control has no
 * accessible name (no text, aria-label, aria-labelledby or title). Icon-only
 * buttons and Base UI switches/checkboxes are the usual offenders; a
 * `<Label htmlFor>` does not name a Base UI switch or checkbox.
 */
export function useWarnIfUnnamed(
  ref: React.RefObject<HTMLElement | null>,
  component: string,
  enabled = true
) {
  React.useEffect(() => {
    if (process.env.NODE_ENV === "production" || !enabled) return;
    const el = ref.current;
    if (!el) return;
    const named =
      el.getAttribute("aria-label")?.trim() ||
      el.getAttribute("aria-labelledby")?.trim() ||
      el.getAttribute("title")?.trim() ||
      el.textContent?.trim() ||
      el.querySelector("img[alt]:not([alt=''])");
    if (named) return;
    const key = `${component}:${el.outerHTML.slice(0, 160)}`;
    if (warned.has(key)) return;
    warned.add(key);
    console.warn(
      `[a11y] ${component} has no accessible name. Add aria-label (the words a sighted user sees) or aria-labelledby.`,
      el
    );
  });
}

function assignRef<T>(ref: React.Ref<T> | undefined, node: T | null) {
  if (typeof ref === "function") ref(node);
  else if (ref) (ref as React.RefObject<T | null>).current = node;
}

/** Combines a local ref with a forwarded one. */
export function useMergedRef<T>(localRef: React.RefObject<T | null>, forwardedRef?: React.Ref<T>) {
  return React.useCallback(
    (node: T | null) => {
      assignRef(localRef, node);
      assignRef(forwardedRef, node);
    },
    [localRef, forwardedRef]
  );
}
