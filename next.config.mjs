/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'ficbook.net' },
      { protocol: 'https', hostname: '*.ficbook.net' },
      { protocol: 'https', hostname: 'assets.teinon.net' },
      { protocol: 'https', hostname: '*.teinon.net' },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  },
}

export default nextConfig
