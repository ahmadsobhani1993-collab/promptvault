'use client'

export default function PWAInstallButton() {
  const handleClick = () => {
    alert('📲 برای نصب:\n\n• Chrome موبایل: منوی سه‌نقطه → "Add to Home Screen"\n• Safari iOS: Share → "Add to Home Screen"\n• Chrome دسکتاپ: آیکون install در نوار آدرس')
  }

  return (
    <button
      onClick={handleClick}
      className="flex h-12 w-12 items-center justify-center rounded-full bg-gold text-black shadow-lg transition-all hover:scale-110"
      title="نصب اپلیکیشن"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-6 w-6">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  )
}
