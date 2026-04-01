// Branding utilities and types for portal customization

export interface BrandingSettings {
  // Logo settings
  logoLight: string | null;  // URL or base64 for light mode logo
  logoDark: string | null;   // URL or base64 for dark mode logo
  logoFavicon: string | null; // URL or base64 for favicon

  // Color settings
  primaryColor: string;      // Primary brand color (hex)
  secondaryColor: string;    // Secondary brand color (hex)
  accentColor: string;       // Accent color for highlights (hex)

  // Domain settings
  subdomain: string | null;  // e.g., "myagency" for myagency.uploadportal.com
  customDomain: string | null; // e.g., "portal.myagency.com"

  // Email customization
  emailFromName: string;     // Sender name for emails
  emailReplyTo: string | null; // Reply-to email address
  emailSignature: string;    // HTML/Text signature for emails
  emailLogoEnabled: boolean; // Show logo in emails

  // Portal text customization
  portalTitle: string;       // Custom portal title
  welcomeMessage: string;    // Custom welcome message
  supportEmail: string | null; // Support contact email
  supportUrl: string | null;   // Support/help URL

  // Index signature for useAutosave compatibility
  [key: string]: unknown;
}

export const DEFAULT_BRANDING: BrandingSettings = {
  logoLight: "/ccm-logo.png",
  logoDark: "/ccm-logo.png",
  logoFavicon: "/ccm-logo.png",
  primaryColor: "#7c3aed", // Violet-600
  secondaryColor: "#8b5cf6", // Violet-500
  accentColor: "#a855f7", // Purple-500
  subdomain: null,
  customDomain: null,
  emailFromName: "CCM",
  emailReplyTo: null,
  emailSignature: "Sent via CCM Content Portal",
  emailLogoEnabled: true,
  portalTitle: "CCM Content Portal",
  welcomeMessage: "Welcome to the CCM Content Portal",
  supportEmail: null,
  supportUrl: null,
};

// Convert hex color to HSL for CSS variables
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  // Remove # if present
  hex = hex.replace(/^#/, "");

  // Parse hex values
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

// Convert HSL to hex
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// Validate hex color
export function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

// Generate CSS variables from branding settings
export function generateBrandingCssVariables(branding: BrandingSettings): string {
  const primary = hexToHsl(branding.primaryColor);
  const secondary = hexToHsl(branding.secondaryColor);
  const accent = hexToHsl(branding.accentColor);

  return `
    --brand-primary: ${primary.h} ${primary.s}% ${primary.l}%;
    --brand-secondary: ${secondary.h} ${secondary.s}% ${secondary.l}%;
    --brand-accent: ${accent.h} ${accent.s}% ${accent.l}%;
  `;
}

// Get contrast color (black or white) for a given background
export function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace(/^#/, "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? "#000000" : "#ffffff";
}

// Validate subdomain format
export function isValidSubdomain(subdomain: string): boolean {
  // Must be 3-63 characters, alphanumeric and hyphens, not start/end with hyphen
  return /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/.test(subdomain.toLowerCase());
}

// Validate custom domain format
export function isValidDomain(domain: string): boolean {
  return /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/.test(domain.toLowerCase());
}

// Generate storage key for branding assets
export function generateBrandingAssetKey(agencyId: string, assetType: string, filename: string): string {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `branding/${agencyId}/${assetType}/${timestamp}-${sanitizedFilename}`;
}
