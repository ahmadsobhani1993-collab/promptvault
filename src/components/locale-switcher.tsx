'use client'

export default function LocaleSwitcher() {
  const set = (v: string) => {
    document.cookie = 'locale=' + v + '; path=/; max-age=31536000'
    window.location.reload()
  }
  return (
    <div className="flex items-center gap-1 rounded-full border border-line bg-elevated px-1.5 py-1 text-[10px]">
      <button type="button" onClick={() => set('fa')} className="rounded-full px-2 py-0.5 transition-colors hover:text-gold-bright">فا</button>
      <button type="button" onClick={() => set('en')} className="rounded-full px-2 py-0.5 transition-colors hover:text-gold-bright">EN</button>
    </div>
  )
}
