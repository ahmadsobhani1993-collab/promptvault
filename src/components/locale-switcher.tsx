'use client'

export default function LocaleSwitcher() {
  const current = document.cookie.match(/locale=(fa|en)/)?.[1] || 'fa'

  const set = (v: string) => {
    document.cookie = 'locale=' + v + '; path=/; max-age=31536000'
    window.location.reload()
  }

  return (
    <>
      {/* دسکتاپ: دو دکمه جدا */}
      <div className="hidden md:flex items-center gap-1 rounded-full border border-line bg-elevated px-1.5 py-1 text-xs">
        <button
          type="button"
          onClick={() => set('fa')}
          className={`rounded-full px-2.5 py-0.5 font-bold transition-colors ${
            current === 'fa' ? 'bg-gold/20 text-gold-bright' : 'text-ink-muted hover:text-gold-bright'
          }`}
        >
          فارسی
        </button>
        <button
          type="button"
          onClick={() => set('en')}
          className={`rounded-full px-2.5 py-0.5 font-bold transition-colors ${
            current === 'en' ? 'bg-gold/20 text-gold-bright' : 'text-ink-muted hover:text-gold-bright'
          }`}
        >
          English
        </button>
      </div>

      {/* موبایل: دکمه فشرده FA/EN */}
      <button
        type="button"
        onClick={() => set(current === 'fa' ? 'en' : 'fa')}
        className="md:hidden flex items-center gap-0.5 rounded-full border border-line bg-elevated px-2 py-1 text-[10px] font-bold transition-colors hover:border-gold/40"
      >
        <span className={current === 'fa' ? 'text-gold-bright' : 'text-ink-muted'}>FA</span>
        <span className="text-line/60">/</span>
        <span className={current === 'en' ? 'text-gold-bright' : 'text-ink-muted'}>EN</span>
      </button>
    </>
  )
}