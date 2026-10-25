/**
 * Single source of truth for the product identity. Agency-specific branding
 * (logo, saved settings) lives in src/lib/branding.ts and falls back to these.
 *
 * Colours follow the Title Wall world (src/app/globals.css): a deep neutral
 * ground, one yellow accent for the primary action and focus, and no green.
 */
export const BRAND = {
  /** Short name used in copy, SMS prefixes and the authenticator app */
  name: "CCM",
  /** Product name used in page titles, the PWA manifest and email headers */
  productName: "CCM Portal",
  /** Legal entity shown in email footers */
  legalName: "Content Creation Management Pty Ltd",
  /** The accent: primary actions and focus (matches --tw-acc). Always paired with dark ink. */
  primaryColor: "#ffd23f",
  /** Ink that sits on the accent (matches --tw-acc-ink) */
  primaryInk: "#0e0f12",
  /** Tile tone, one step up from the ground (matches --tw-tile) */
  secondaryColor: "#1b1d22",
  /** Neutral light grey, the confirm colour (matches --tw-confirm) */
  accentColor: "#d3d7de",
  /** The ground: browser chrome, PWA background, email headers (matches --tw-ground) */
  groundColor: "#0e0f12",
  /** Running ink on the ground (matches --tw-ink) */
  inkColor: "#eceef2",
  logoPath: "/ccm-logo.png",
} as const;
