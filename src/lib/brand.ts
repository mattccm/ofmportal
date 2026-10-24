/**
 * Single source of truth for the product identity. Agency-specific branding
 * (logo, colours saved in settings) lives in src/lib/branding.ts and falls
 * back to these values.
 */
export const BRAND = {
  /** Short name used in copy, SMS prefixes and the authenticator app */
  name: "CCM",
  /** Product name used in page titles, the PWA manifest and email headers */
  productName: "CCM Portal",
  /** Legal entity shown in email footers */
  legalName: "Content Creation Management Pty Ltd",
  /** Brand green (matches --primary in globals.css and the theme colour) */
  primaryColor: "#2f6a4a",
  secondaryColor: "#3f7f5c",
  accentColor: "#6aa884",
  logoPath: "/ccm-logo.png",
} as const;
