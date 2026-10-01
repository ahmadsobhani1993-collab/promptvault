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
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
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
      // ۱. هدرهای امنیتی عمومی برای تمام مسیرها (دست‌نخورده)
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      // . هدرهای اختصاصی برای FFmpeg (جدید و امن)
      {
        source: '/ffmpeg/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ]
  },
}

export default nextConfig
