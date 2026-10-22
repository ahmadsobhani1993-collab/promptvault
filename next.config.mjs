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
    // ۱. صفر کردن مصرف CPU و محدودیت‌های ورسل
    unoptimized: true,
    // ۲. کش حداکثری ۱ ساله برای بهینه‌سازی کلاینت
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
      // هدرهای امنیتی عمومی
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      // هدرهای ایزولاسیون برای FFmpeg WebAssembly
      {
        source: '/ffmpeg/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
      // هدر کش ۱ ساله برای تمام فرمت‌های تصویری و ویدیویی در مرورگر
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