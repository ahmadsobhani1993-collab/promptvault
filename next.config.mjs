/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // فعال‌سازی کش طولانی‌مدت (۱ سال) برای جلوگیری از رندر مجدد روی ورسل
    minimumCacheTTL: 31536000,
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'promptfa.s3.eu-west1.arvanstorage.ir',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  outputFileTracingIncludes: {
    '/api/ffmpeg/[asset]': [
      './node_modules/@ffmpeg/ffmpeg/dist/esm/*.js',
      './node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js',
      './node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm',
    ],
  },
  async rewrites() {
    return [
      {
        source: '/en/prompts/:slug',
        destination: '/prompts/:slug',
      },
      {
        source: '/en/:path*',
        destination: '/:path*',
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/ffmpeg/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
      {
        source: '/(.*)\\.(jpg|jpeg|png|webp|avif|ico|svg|mp4)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
}

export default nextConfig