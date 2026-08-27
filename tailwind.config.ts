import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#050506',
        elevated: '#0B0B0D',
        surface: '#101014',
        'surface-hover': '#15151A',
        line: { DEFAULT: '#232329', subtle: '#1B1B20', strong: '#32333A' },
        ink: { DEFAULT: '#F4EFE6', muted: '#9B9BA4', faint: '#6E6E78', inverse: '#0A0A0B' },
        gold: { DEFAULT: '#C9A24B', bright: '#E8C877', deep: '#8C6B23', soft: 'rgba(201, 162, 75, 0.12)' },
        success: '#3DD68C',
        warning: '#F5B84D',
        danger: '#F0564A',
        info: '#6AA7FF',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-sora)', 'var(--font-inter)', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
      },
      borderRadius: { xl: '14px', '2xl': '18px', '3xl': '26px' },
      boxShadow: {
        card: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 0 0 1px #232329',
        'card-hover': '0 0 0 1px #32333A',
        'gold-glow': '0 0 32px rgba(201, 162, 75, 0.14)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'fade-in': 'fade-in 280ms ease-out both',
        'slide-up': 'slide-up 340ms ease-out both',
      },
      // سفارشی‌سازی استایل‌های Typography برای ادیتور
      typography: {
        gold: {
          css: {
            '--tw-prose-body': '#F4EFE6',
            '--tw-prose-headings': '#E8C877',
            '--tw-prose-links': '#C9A24B',
            '--tw-prose-bold': '#F4EFE6',
            '--tw-prose-counters': '#9B9BA4',
            '--tw-prose-bullets': '#C9A24B',
            '--tw-prose-quotes': '#F4EFE6',
            '--tw-prose-quote-borders': '#C9A24B',
            '--tw-prose-code': '#E8C877',
            '--tw-prose-hr': '#232329',
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

export default config