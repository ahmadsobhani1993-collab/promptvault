'use client'

export default function DownButton() {
  const onClick = () => {
    const sections = Array.from(
      document.querySelectorAll('[data-section]')
    ) as HTMLElement[]
    const y = window.scrollY
    const next = sections.find(
      (s) => s.offsetTop > y + window.innerHeight * 0.4
    )
    if (next) {
      next.scrollIntoView({ behavior: 'smooth' })
    } else {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Next section"
      className="glow-soft fixed bottom-6 left-1/2 z-40 grid h-11 w-11 -translate-x-1/2 place-items-center rounded-full border border-gold/60 bg-[#141008]/80 text-gold-bright backdrop-blur transition-colors hover:bg-[#1d1608]"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  )
}
