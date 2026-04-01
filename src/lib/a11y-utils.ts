/**
 * Accessibility Utilities
 *
 * A collection of utilities for improving accessibility in the application.
 * Includes screen reader announcements, focus management, and keyboard navigation helpers.
 */

// ============================================
// TYPES
// ============================================

export type LiveRegionPoliteness = 'polite' | 'assertive' | 'off';

export interface AnnounceOptions {
  /** Politeness level for the announcement */
  politeness?: LiveRegionPoliteness;
  /** Delay before announcement (ms) */
  delay?: number;
  /** Clear the announcement after this duration (ms) */
  clearAfter?: number;
}

export interface FocusOptions {
  /** Prevent scrolling when focusing */
  preventScroll?: boolean;
  /** Delay before focusing (ms) */
  delay?: number;
}

// ============================================
// CONSTANTS
// ============================================

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
  'audio[controls]',
  'video[controls]',
  'details > summary',
].join(', ');

const TABBABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]:not([tabindex="-1"])',
].join(', ');

// ============================================
// SCREEN READER ANNOUNCEMENTS
// ============================================

let liveRegion: HTMLElement | null = null;

/**
 * Creates or returns the live region element for announcements
 */
function getOrCreateLiveRegion(politeness: LiveRegionPoliteness = 'polite'): HTMLElement {
  const existingRegion = document.getElementById(`sr-live-region-${politeness}`);
  if (existingRegion) {
    return existingRegion;
  }

  const region = document.createElement('div');
  region.id = `sr-live-region-${politeness}`;
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', politeness);
  region.setAttribute('aria-atomic', 'true');
  region.className = 'sr-only';

  // Visually hidden but accessible to screen readers
  Object.assign(region.style, {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: '0',
  });

  document.body.appendChild(region);
  return region;
}

/**
 * Announces a message to screen readers using aria-live regions
 *
 * @param message - The message to announce
 * @param options - Options for the announcement
 * @returns A function to clear the announcement
 */
export function announce(
  message: string,
  options: AnnounceOptions = {}
): () => void {
  const { politeness = 'polite', delay = 0, clearAfter = 5000 } = options;

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let clearTimeoutId: ReturnType<typeof setTimeout> | null = null;

  const doAnnounce = () => {
    const region = getOrCreateLiveRegion(politeness);

    // Clear previous content first to ensure new content is announced
    region.textContent = '';

    // Set new content after a brief delay to ensure it's announced
    requestAnimationFrame(() => {
      region.textContent = message;
    });

    // Clear the announcement after specified duration
    if (clearAfter > 0) {
      clearTimeoutId = setTimeout(() => {
        region.textContent = '';
      }, clearAfter);
    }
  };

  if (delay > 0) {
    timeoutId = setTimeout(doAnnounce, delay);
  } else {
    doAnnounce();
  }

  // Return cleanup function
  return () => {
    if (timeoutId) clearTimeout(timeoutId);
    if (clearTimeoutId) clearTimeout(clearTimeoutId);
    const region = document.getElementById(`sr-live-region-${politeness}`);
    if (region) region.textContent = '';
  };
}

/**
 * Announces an assertive message (interrupts current speech)
 */
export function announceAssertive(message: string, options?: Omit<AnnounceOptions, 'politeness'>) {
  return announce(message, { ...options, politeness: 'assertive' });
}

/**
 * Announces a polite message (waits for current speech to finish)
 */
export function announcePolite(message: string, options?: Omit<AnnounceOptions, 'politeness'>) {
  return announce(message, { ...options, politeness: 'polite' });
}

// ============================================
// FOCUS MANAGEMENT
// ============================================

/**
 * Gets all focusable elements within a container
 */
export function getFocusableElements(
  container: HTMLElement = document.body,
  includeHidden = false
): HTMLElement[] {
  const elements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);

  return Array.from(elements).filter((el) => {
    if (includeHidden) return true;
    return el.offsetParent !== null && !el.hasAttribute('inert');
  });
}

/**
 * Gets all tabbable elements within a container
 */
export function getTabbableElements(
  container: HTMLElement = document.body,
  includeHidden = false
): HTMLElement[] {
  const elements = container.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR);

  return Array.from(elements).filter((el) => {
    if (includeHidden) return true;
    return el.offsetParent !== null && !el.hasAttribute('inert');
  });
}

/**
 * Focuses the first focusable element in a container
 */
export function focusFirst(
  container: HTMLElement = document.body,
  options: FocusOptions = {}
): HTMLElement | null {
  const { preventScroll = false, delay = 0 } = options;
  const elements = getFocusableElements(container);
  const first = elements[0];

  if (first) {
    const focus = () => first.focus({ preventScroll });
    if (delay > 0) {
      setTimeout(focus, delay);
    } else {
      focus();
    }
  }

  return first || null;
}

/**
 * Focuses the last focusable element in a container
 */
export function focusLast(
  container: HTMLElement = document.body,
  options: FocusOptions = {}
): HTMLElement | null {
  const { preventScroll = false, delay = 0 } = options;
  const elements = getFocusableElements(container);
  const last = elements[elements.length - 1];

  if (last) {
    const focus = () => last.focus({ preventScroll });
    if (delay > 0) {
      setTimeout(focus, delay);
    } else {
      focus();
    }
  }

  return last || null;
}

/**
 * Focuses an element by ID
 */
export function focusById(
  id: string,
  options: FocusOptions = {}
): HTMLElement | null {
  const { preventScroll = false, delay = 0 } = options;
  const element = document.getElementById(id);

  if (element) {
    // Make element focusable if it isn't
    const isFocusable = element.matches(FOCUSABLE_SELECTOR);
    if (!isFocusable) {
      element.setAttribute('tabindex', '-1');
    }

    const focus = () => element.focus({ preventScroll });
    if (delay > 0) {
      setTimeout(focus, delay);
    } else {
      focus();
    }

    // Remove tabindex after blur if we added it
    if (!isFocusable) {
      element.addEventListener(
        'blur',
        () => element.removeAttribute('tabindex'),
        { once: true }
      );
    }
  }

  return element;
}

/**
 * Returns a focus restore function
 */
export function saveFocus(): () => void {
  const activeElement = document.activeElement as HTMLElement;

  return () => {
    if (activeElement && typeof activeElement.focus === 'function') {
      activeElement.focus();
    }
  };
}

// ============================================
// KEYBOARD NAVIGATION HELPERS
// ============================================

export type ArrowDirection = 'horizontal' | 'vertical' | 'both';

interface KeyboardNavigationOptions {
  /** Direction of arrow key navigation */
  direction?: ArrowDirection;
  /** Whether to loop at the ends */
  loop?: boolean;
  /** Whether to focus on hover */
  focusOnHover?: boolean;
  /** Callback when selection changes */
  onSelect?: (element: HTMLElement, index: number) => void;
  /** Custom selector for navigable elements */
  selector?: string;
}

/**
 * Creates a keyboard navigation handler for a container
 */
export function createKeyboardNavigation(
  container: HTMLElement,
  options: KeyboardNavigationOptions = {}
) {
  const {
    direction = 'vertical',
    loop = true,
    selector = '[role="menuitem"], [role="option"], [role="tab"], button, a',
  } = options;

  const getItems = (): HTMLElement[] => {
    return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
      (el) => el.offsetParent !== null && !el.hasAttribute('disabled')
    );
  };

  const getCurrentIndex = (items: HTMLElement[]): number => {
    const activeElement = document.activeElement;
    return items.findIndex((item) => item === activeElement);
  };

  const focusItem = (items: HTMLElement[], index: number) => {
    const item = items[index];
    if (item) {
      item.focus();
      options.onSelect?.(item, index);
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const items = getItems();
    if (items.length === 0) return;

    const currentIndex = getCurrentIndex(items);
    let nextIndex = currentIndex;

    const isHorizontal = direction === 'horizontal' || direction === 'both';
    const isVertical = direction === 'vertical' || direction === 'both';

    switch (event.key) {
      case 'ArrowDown':
        if (isVertical) {
          event.preventDefault();
          nextIndex = currentIndex + 1;
          if (nextIndex >= items.length) {
            nextIndex = loop ? 0 : items.length - 1;
          }
        }
        break;

      case 'ArrowUp':
        if (isVertical) {
          event.preventDefault();
          nextIndex = currentIndex - 1;
          if (nextIndex < 0) {
            nextIndex = loop ? items.length - 1 : 0;
          }
        }
        break;

      case 'ArrowRight':
        if (isHorizontal) {
          event.preventDefault();
          nextIndex = currentIndex + 1;
          if (nextIndex >= items.length) {
            nextIndex = loop ? 0 : items.length - 1;
          }
        }
        break;

      case 'ArrowLeft':
        if (isHorizontal) {
          event.preventDefault();
          nextIndex = currentIndex - 1;
          if (nextIndex < 0) {
            nextIndex = loop ? items.length - 1 : 0;
          }
        }
        break;

      case 'Home':
        event.preventDefault();
        nextIndex = 0;
        break;

      case 'End':
        event.preventDefault();
        nextIndex = items.length - 1;
        break;

      default:
        return;
    }

    if (nextIndex !== currentIndex) {
      focusItem(items, nextIndex);
    }
  };

  // Add event listener
  container.addEventListener('keydown', handleKeyDown);

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Creates a roving tabindex handler
 */
export function createRovingTabindex(
  container: HTMLElement,
  selector: string = '[role="tab"], button'
) {
  const items = Array.from(container.querySelectorAll<HTMLElement>(selector));

  // Initialize: first item is focusable, others are not
  items.forEach((item, index) => {
    item.setAttribute('tabindex', index === 0 ? '0' : '-1');
  });

  const handleFocus = (event: FocusEvent) => {
    const target = event.target as HTMLElement;
    if (!items.includes(target)) return;

    // Update tabindex: only focused item is tabbable
    items.forEach((item) => {
      item.setAttribute('tabindex', item === target ? '0' : '-1');
    });
  };

  container.addEventListener('focusin', handleFocus);

  return () => {
    container.removeEventListener('focusin', handleFocus);
  };
}

// ============================================
// ACCESSIBILITY UTILITIES
// ============================================

/**
 * Generates a unique ID for accessibility purposes
 */
let idCounter = 0;
export function generateA11yId(prefix = 'a11y'): string {
  return `${prefix}-${++idCounter}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Checks if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Checks if user prefers high contrast
 */
export function prefersHighContrast(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(prefers-contrast: more)').matches ||
    window.matchMedia('(prefers-contrast: high)').matches ||
    window.matchMedia('(-ms-high-contrast: active)').matches
  );
}

/**
 * Checks if user prefers dark color scheme
 */
export function prefersDarkColorScheme(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Sets up listeners for accessibility preference changes
 */
export function watchA11yPreferences(callbacks: {
  onReducedMotionChange?: (prefers: boolean) => void;
  onHighContrastChange?: (prefers: boolean) => void;
  onDarkModeChange?: (prefers: boolean) => void;
}): () => void {
  if (typeof window === 'undefined') return () => {};

  const cleanups: (() => void)[] = [];

  if (callbacks.onReducedMotionChange) {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => callbacks.onReducedMotionChange!(e.matches);
    mediaQuery.addEventListener('change', handler);
    cleanups.push(() => mediaQuery.removeEventListener('change', handler));
  }

  if (callbacks.onHighContrastChange) {
    const mediaQuery = window.matchMedia('(prefers-contrast: more)');
    const handler = (e: MediaQueryListEvent) => callbacks.onHighContrastChange!(e.matches);
    mediaQuery.addEventListener('change', handler);
    cleanups.push(() => mediaQuery.removeEventListener('change', handler));
  }

  if (callbacks.onDarkModeChange) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => callbacks.onDarkModeChange!(e.matches);
    mediaQuery.addEventListener('change', handler);
    cleanups.push(() => mediaQuery.removeEventListener('change', handler));
  }

  return () => cleanups.forEach((cleanup) => cleanup());
}

/**
 * Makes an element inert (not focusable or interactive)
 */
export function setInert(element: HTMLElement, inert: boolean) {
  if (inert) {
    element.setAttribute('inert', '');
    element.setAttribute('aria-hidden', 'true');
  } else {
    element.removeAttribute('inert');
    element.removeAttribute('aria-hidden');
  }
}

/**
 * Creates an accessible description for an element
 */
export function createDescription(
  element: HTMLElement,
  description: string
): () => void {
  const id = generateA11yId('desc');

  const descElement = document.createElement('span');
  descElement.id = id;
  descElement.className = 'sr-only';
  descElement.textContent = description;

  element.setAttribute('aria-describedby', id);
  element.parentNode?.insertBefore(descElement, element.nextSibling);

  return () => {
    element.removeAttribute('aria-describedby');
    descElement.remove();
  };
}

// ============================================
// EXPORTS
// ============================================

export const a11y = {
  announce,
  announceAssertive,
  announcePolite,
  getFocusableElements,
  getTabbableElements,
  focusFirst,
  focusLast,
  focusById,
  saveFocus,
  createKeyboardNavigation,
  createRovingTabindex,
  generateA11yId,
  prefersReducedMotion,
  prefersHighContrast,
  prefersDarkColorScheme,
  watchA11yPreferences,
  setInert,
  createDescription,
};

export default a11y;
