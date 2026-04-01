import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CCM Content Portal',
    short_name: 'CCM',
    description: 'CCM content collection and management portal',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0f',
    theme_color: '#7c3aed',
    orientation: 'portrait-primary',
    scope: '/',
    lang: 'en',
    dir: 'ltr',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/icons/icon-72x72.png',
        sizes: '72x72',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-96x96.png',
        sizes: '96x96',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-128x128.png',
        sizes: '128x128',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-144x144.png',
        sizes: '144x144',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-152x152.png',
        sizes: '152x152',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-384x384.png',
        sizes: '384x384',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    screenshots: [
      {
        src: '/screenshots/dashboard.png',
        sizes: '1280x720',
        type: 'image/png',
        form_factor: 'wide',
        label: 'Dashboard view',
      },
      {
        src: '/screenshots/mobile-dashboard.png',
        sizes: '390x844',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Mobile dashboard view',
      },
    ],
    shortcuts: [
      {
        name: 'Dashboard',
        short_name: 'Dashboard',
        description: 'View your dashboard',
        url: '/dashboard',
        icons: [
          {
            src: '/icons/shortcut-dashboard.png',
            sizes: '96x96',
            type: 'image/png',
          },
        ],
      },
      {
        name: 'New Request',
        short_name: 'New Request',
        description: 'Create a new content request',
        url: '/dashboard/requests/new',
        icons: [
          {
            src: '/icons/shortcut-request.png',
            sizes: '96x96',
            type: 'image/png',
          },
        ],
      },
      {
        name: 'Messages',
        short_name: 'Messages',
        description: 'View your messages',
        url: '/dashboard/messages',
        icons: [
          {
            src: '/icons/shortcut-messages.png',
            sizes: '96x96',
            type: 'image/png',
          },
        ],
      },
    ],
    related_applications: [],
    prefer_related_applications: false,
  }
}
