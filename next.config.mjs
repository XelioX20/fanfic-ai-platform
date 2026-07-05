/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'ficbook.net' },
      { protocol: 'https', hostname: '*.ficbook.net' },
      { protocol: 'https', hostname: 'assets.teinon.net' },
      { protocol: 'https', hostname: '*.teinon.net' },
      // Cloudflare R2 public bucket serving user avatars.
      { protocol: 'https', hostname: '*.r2.dev' },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  },

  // Baseline security headers applied to every response. These are the
  // ones with no downsides — they don't break anything and Lighthouse /
  // Mozilla Observatory / SecurityHeaders.com flag their absence.
  //
  // NOT added on purpose:
  //   - Content-Security-Policy: needs careful curation of every third-party
  //     origin we load images/scripts from; wrong values silently break
  //     the app. Better to add it in one PR once we can devote testing to it.
  //   - Strict-Transport-Security: Vercel injects HSTS on its edge already,
  //     with preload; setting it here would be redundant / risk conflict.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Turn off the browser features we don't use, so extensions
          // + supply-chain compromises can't silently activate them.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
        ],
      },
      {
        // Digital Asset Links — Chrome fetches this to verify that our
        // Android TWA app is allowed to render our origin without the URL
        // bar. Must be served as application/json.
        source: '/.well-known/assetlinks.json',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
    ]
  },

  // Strip console.log from client bundles in production so leftover
  // diagnostic logs don't leak into user devtools or bloat bundles.
  // console.error / console.warn kept so genuine problems still surface.
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }
      : false,
  },

  // Explicit — React strict mode is on by default in Next 14 anyway.
  reactStrictMode: true,

  // Only import the icons/components actually referenced in each file
  // instead of pulling in the whole barrel index. lucide-react is used in
  // 24 files across the app — this saves ~30-120kB gzipped on every route.
  experimental: {
    optimizePackageImports: ['lucide-react', '@tanstack/react-query'],
  },
}

export default nextConfig
