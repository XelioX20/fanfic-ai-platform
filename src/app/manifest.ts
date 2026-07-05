import { MetadataRoute } from 'next'

/**
 * Web app manifest served at /manifest.webmanifest.
 *
 * Makes the site installable as a PWA on mobile (Android "Add to Home
 * Screen" gets an app-like icon + splash) and desktop. Standalone display
 * removes the browser chrome so the reader feels like a native app.
 *
 * Icons live at /public/icon-*.png. Both a 192px and 512px raster are
 * declared with `purpose: 'any'` (used verbatim) and a 512px maskable
 * variant (safe-area padded, so Android's adaptive icon can crop it
 * without eating the artwork). TWA / bubblewrap requires the 512px
 * `any` PNG at build time to generate the Android launcher icons.
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
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    categories: ['books', 'entertainment'],
  }
}
