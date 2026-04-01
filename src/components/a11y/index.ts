/**
 * Accessibility Components
 *
 * A comprehensive set of components and utilities for building
 * accessible applications. Includes skip links, focus management,
 * live announcements, and accessibility settings.
 */

// Skip Links
export {
  SkipLink,
  SkipLinks,
  MainContent,
  MainNav,
} from './skip-link';

// Focus Management
export {
  FocusTrap,
  FocusScope,
  useFocusTrap,
} from './focus-trap';

// Live Announcements
export {
  LiveAnnouncerProvider,
  useLiveAnnouncer,
  AriaLiveRegion,
  AriaAlert,
  AriaStatus,
  useLoadingAnnouncement,
  useFormAnnouncement,
  useNavigationAnnouncement,
  useListAnnouncement,
  type Announcement,
  type AnnouncementPoliteness,
} from './live-announcer';

// Accessibility Settings
export {
  AccessibilityProvider,
  AccessibilitySettingsPanel,
  AccessibilityQuickToggle,
  useAccessibility,
  type AccessibilitySettings,
} from './accessibility-settings';

// Visually Hidden
export { VisuallyHidden } from './visually-hidden';

// Keyboard Only
export { KeyboardOnly, useKeyboardOnly, KeyboardOnlyProvider, KeyboardFocusRing, FocusVisible, KeyboardShortcut } from './keyboard-only';

// Accessible Icon Button
export {
  AccessibleIconButton,
  AccessibleButtonGroup,
  AccessibleToggleButton,
  iconButtonVariants,
} from './accessible-icon-button';

// Headings
export {
  Heading,
  HeadingSection,
  useHeadingLevel,
  H1,
  H2,
  H3,
  H4,
  H5,
  H6,
  PageTitle,
  SectionTitle,
  CardTitle,
  headingVariants,
} from './heading';

// Color Blind Filters
export { ColorBlindFilters } from './color-blind-filters';
