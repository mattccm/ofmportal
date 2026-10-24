import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/lib/brand";
import { AuthProvider } from "@/components/providers/auth-provider";
import { KeyboardShortcutsProvider } from "@/components/providers/keyboard-shortcuts-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider, ThemeScript } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { InstallPrompt } from "@/components/pwa/install-prompt";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BRAND.primaryColor },
    { media: "(prefers-color-scheme: dark)", color: BRAND.primaryColor },
  ],
};

const ICON_VERSION = "v=4";
const DESCRIPTION = `${BRAND.name} content collection and management portal`;

export const metadata: Metadata = {
  title: {
    default: BRAND.productName,
    template: "%s · " + BRAND.productName,
  },
  description: DESCRIPTION,
  applicationName: BRAND.productName,
  keywords: ["ccm", "content", "portal", "management", "upload", "creator"],
  authors: [{ name: BRAND.legalName }],
  creator: BRAND.name,
  publisher: BRAND.legalName,
  // Internal tool: keep it out of search engines
  robots: { index: false, follow: false },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: BRAND.name,
  },
  openGraph: {
    type: "website",
    siteName: BRAND.productName,
    title: BRAND.productName,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: BRAND.productName,
    description: DESCRIPTION,
  },
  icons: {
    icon: [
      { url: `/favicon.ico?${ICON_VERSION}`, sizes: "16x16 32x32 48x48" },
      { url: `/favicon.svg?${ICON_VERSION}`, type: "image/svg+xml" },
      { url: `/icons/icon-32x32.png?${ICON_VERSION}`, sizes: "32x32", type: "image/png" },
      { url: `/icons/icon-192x192.png?${ICON_VERSION}`, sizes: "192x192", type: "image/png" },
      { url: `/icons/icon-512x512.png?${ICON_VERSION}`, sizes: "512x512", type: "image/png" },
    ],
    shortcut: `/favicon.ico?${ICON_VERSION}`,
    apple: [
      { url: `/icons/apple-icon-180x180.png?${ICON_VERSION}`, sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.webmanifest",
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": BRAND.primaryColor,
    "msapplication-tap-highlight": "no",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${bricolage.variable} font-sans antialiased`}
      >
        <ThemeProvider
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <QueryProvider>
            <AuthProvider>
              <KeyboardShortcutsProvider>
                {children}
                <InstallPrompt />
                <Toaster
                  position="bottom-right"
                  toastOptions={{
                    style: {
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      color: 'var(--foreground)',
                    },
                  }}
                />
              </KeyboardShortcutsProvider>
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
