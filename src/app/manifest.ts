import { MetadataRoute } from 'next'

/**
 * Web app manifest served at /manifest.webmanifest.
 *
 * Makes the site installable as a PWA on mobile (Android "Add to Home
 * Screen" gets an app-like icon + splash) and desktop. Standalone display
 * removes the browser chrome so the reader feels like a native app.
 *
 * Icons intentionally reference SVG paths that Next resolves through the
 * app/icon.svg / app/apple-icon.svg convention. If those aren't defined
 * yet, browsers fall back to the site favicon — the manifest still
 * validates and the "install" prompt still fires.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fanfic AI',
    short_name: 'Fanfic AI',
    description: 'Читалка фанфиков с ficbook.net — синхронизация якорей и избранного между устройствами',
    lang: 'ru',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#09090b', // zinc-950 — matches dark theme
    theme_color: '#7c3aed',      // violet-600 — brand accent
    icons: [
      {
        src: '/icon',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    categories: ['books', 'entertainment'],
  }
}
