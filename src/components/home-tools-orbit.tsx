'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { Locale } from '@/lib/i18n'
import { localizedPath } from '@/lib/locale-path'

const tools = [
  { href: '/transcribe', key: 'transcribe', fa: 'تبدیل صوت به متن', en: 'Audio to Text' },
  { href: '/subtitle', key: 'subtitle', fa: 'استودیو زیرنویس', en: 'Subtitle Studio' },
  { href: '/audio-enhancer', key: 'enhance', fa: 'تقویت و شفاف‌ساز صدا', en: 'Audio Enhancer' },
  { href: '/tools/bg-remover', key: 'remove-bg', fa: 'حذف پس‌زمینه', en: 'Background Remover' },
  { href: '/pdf-to-word', key: 'pdf', fa: 'تبدیل PDF به ورد', en: 'PDF to Word' },
] as const

type ToolKey = (typeof tools)[number]['key']

function ToolGlyph({ name }: { name: ToolKey }) {
  if (name === 'transcribe') {
    return (
      <svg aria-hidden viewBox="0 0 48 48" fill="none" className="h-10 w-10 md:h-12 md:w-12">
        <path d="M5 24h3m4-8v16m5-22v28m5-19v10m5-15v20m5-15v10m5-7v4m4-3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="m11 8 .7 2.3L14 11l-2.3.7L11 14l-.7-2.3L8 11l2.3-.7L11 8Zm27 24 .6 1.8 1.9.7-1.9.6-.6 1.9-.7-1.9-1.8-.6 1.8-.7.7-1.8Z" fill="currentColor" />
        <circle cx="17" cy="7" r=".8" fill="currentColor" /><circle cx="34" cy="13" r=".8" fill="currentColor" />
      </svg>
    )
  }
  if (name === 'subtitle') {
    return (
      <svg aria-hidden viewBox="0 0 48 48" fill="none" className="h-10 w-10 md:h-12 md:w-12">
        <rect x="5" y="7" width="38" height="27" rx="4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 13h32M20 17l10 5-10 5V17Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M12 39h10m4 0h10m-23-4h23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="m37 5 .6 1.8 1.9.7-1.9.6L37 10l-.6-1.9-1.9-.6 1.9-.7L37 5Z" fill="currentColor" />
      </svg>
    )
  }
  if (name === 'enhance') {
    return (
      <svg aria-hidden viewBox="0 0 48 48" fill="none" className="h-10 w-10 md:h-12 md:w-12">
        <path d="M4 25h5l4-9 6 18 6-24 6 24 5-15 4 6h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m24 10 8 14-8 14-8-14 8-14Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="m37 7 .8 2.2L40 10l-2.2.8L37 13l-.8-2.2L34 10l2.2-.8L37 7Z" fill="currentColor" />
        <circle cx="10" cy="12" r="1" fill="currentColor" />
      </svg>
    )
  }
  if (name === 'remove-bg') {
    return (
      <svg aria-hidden viewBox="0 0 48 48" fill="none" className="h-10 w-10 md:h-12 md:w-12">
        <path d="M20 9a9 9 0 0 0-5 16v4c-4 1.2-6 4-7 8h19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20 9c5 0 9 4 9 9v2l-4 3 4 3v3c0 3-2 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m33 13 .7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1Zm5 13 .5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5Z" fill="currentColor" />
        <circle cx="34" cy="36" r="1" fill="currentColor" /><circle cx="40" cy="9" r="1" fill="currentColor" />
      </svg>
    )
  }
  return (
    <svg aria-hidden viewBox="0 0 48 48" fill="none" className="h-10 w-10 md:h-12 md:w-12">
      <path d="M11 5h18l9 9v29H11a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M28 6v10h10" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14 29v-8h4a2.2 2.2 0 0 1 0 4.4h-4m9 3.6v-8h2a4 4 0 0 1 0 8h-2Zm9-8h5m-5 0v8m0-4h4" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 34h17M14 38h11m9-14 3 3 4-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m36 17 .6 1.8 1.9.7-1.9.6-.6 1.9-.7-1.9-1.8-.6 1.8-.7.7-1.8Z" fill="currentColor" />
    </svg>
  )
}

function ToolNode({ tool, locale, index, active, onActivate, onDeactivate }: {
  tool: (typeof tools)[number]
  locale: Locale
  index: number
  active: boolean
  onActivate: (key: ToolKey) => void
  onDeactivate: () => void
}) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / tools.length
  const x = 50 + Math.cos(angle) * 39
  const y = 50 + Math.sin(angle) * 36
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPress = useRef(false)

  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current)
  }, [])

  function handlePointerDown(event: PointerEvent<HTMLAnchorElement>) {
    if (event.pointerType !== 'touch') return
    longPress.current = false
    holdTimer.current = setTimeout(() => {
      longPress.current = true
      onActivate(tool.key)
    }, 450)
  }

  function clearHoldTimer() {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }

  return (
    <div className="tools-orbit-node-position" style={{ left: `${x}%`, top: `${y}%` }}>
      <div className="tools-orbit-counter">
        <div className="tools-orbit-upright">
          <Link
            href={localizedPath(locale, tool.href)}
            aria-label={locale === 'fa' ? tool.fa : tool.en}
            onPointerDown={handlePointerDown}
            onPointerUp={clearHoldTimer}
            onPointerCancel={clearHoldTimer}
            onContextMenu={(event) => event.preventDefault()}
            onPointerEnter={(event) => {
              if (event.pointerType === 'mouse') onActivate(tool.key)
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === 'mouse') onDeactivate()
            }}
            onBlur={onDeactivate}
            onClick={(event) => {
              clearHoldTimer()
              if (longPress.current) {
                event.preventDefault()
                longPress.current = false
                return
              }
              onDeactivate()
            }}
            className={`tool-orbit-node group relative grid h-20 w-20 touch-manipulation place-items-center rounded-full border border-[#D4AF37]/45 bg-[#0A0A0D] text-[#E5C158] shadow-[inset_0_0_18px_rgba(212,175,55,0.07),0_0_20px_rgba(212,175,55,0.12)] transition duration-300 hover:scale-110 hover:border-amber-400/80 hover:shadow-[0_0_25px_rgba(212,175,55,0.25)] focus-visible:scale-110 focus-visible:border-amber-400/80 focus-visible:outline-none focus-visible:shadow-[0_0_25px_rgba(212,175,55,0.25)] md:h-24 md:w-24 ${active ? 'tool-orbit-node-active' : ''}`}
          >
            <span aria-hidden className="pointer-events-none absolute inset-[5px] rounded-full border border-amber-100/10" />
            <ToolGlyph name={tool.key} />
            <span
              className="tool-orbit-label pointer-events-none absolute left-1/2 top-full z-30 mt-3 w-max max-w-[min(260px,78vw)] -translate-x-1/2 rounded-xl border border-amber-400/30 bg-[#0E0E12]/90 px-4 py-2.5 text-center text-xs text-stone-100 opacity-0 shadow-[0_8px_32px_rgba(0,0,0,0.55)] backdrop-blur-md transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
              dir={locale === 'fa' ? 'rtl' : 'ltr'}
            >
              <span className="block font-bold">{tool.fa}</span>
              <span className="mt-1 block text-[10px] tracking-wide text-amber-100/65" dir="ltr">{tool.en}</span>
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function HomeToolsOrbit({ locale }: { locale: Locale }) {
  const [activeTool, setActiveTool] = useState<ToolKey | null>(null)
  const [hasBeenVisible, setHasBeenVisible] = useState(false)
  const orbitRef = useRef<HTMLDivElement>(null)
  const orbitSvgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const orbit = orbitRef.current
    const svg = orbitSvgRef.current
    if (!orbit || !svg) return

    svg.pauseAnimations()
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setHasBeenVisible(true)
        observer.disconnect()
      },
      { threshold: 0.1 }
    )
    observer.observe(orbit)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (activeTool || !hasBeenVisible) orbitSvgRef.current?.pauseAnimations()
    else orbitSvgRef.current?.unpauseAnimations()
  }, [activeTool, hasBeenVisible])

  return (
    <section id="tools" data-section className="snap-section border-t border-line/40 py-10 md:py-14">
      <h2 className="sr-only">{locale === 'fa' ? 'ابزارها' : 'Tools'}</h2>
      <div className="container-app">
        <div
          ref={orbitRef}
          className={`tools-orbit relative mx-auto h-[430px] max-w-5xl sm:h-[500px] md:h-[560px] ${hasBeenVisible ? 'is-in-view' : ''}`}
        >
          <div className="tools-orbit-perspective absolute inset-0">
            <div className="tools-orbit-plane">
              <div className="tools-orbit-spinner">
                <svg ref={orbitSvgRef} aria-hidden className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 1000 560" fill="none" preserveAspectRatio="none">
                  <g className="tools-orbit-rings">
                    <ellipse cx="500" cy="280" rx="455" ry="250" stroke="rgba(212,175,55,0.13)" />
                    <ellipse cx="500" cy="280" rx="380" ry="210" stroke="rgba(212,175,55,0.19)" strokeDasharray="1 6" />
                    <ellipse cx="500" cy="280" rx="300" ry="166" stroke="rgba(212,175,55,0.2)" />
                    <ellipse cx="500" cy="280" rx="218" ry="120" stroke="rgba(212,175,55,0.14)" />
                    <ellipse cx="500" cy="280" rx="455" ry="250" stroke="rgba(212,175,55,0.35)" strokeWidth="1.5" className="tools-orbit-energy" />
                  </g>
                  {tools.map((tool, index) => {
                    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / tools.length
                    return (
                      <line
                        key={tool.key}
                        className={`tools-orbit-connector ${activeTool === tool.key ? 'is-visible' : ''}`}
                        x1="500"
                        y1="280"
                        x2={500 + Math.cos(angle) * 390}
                        y2={280 + Math.sin(angle) * 198}
                      />
                    )
                  })}
                  <circle className="tools-orbit-satellite" r="3" fill="#F3E5AB" filter="url(#orbit-glow)"><animateMotion dur="32s" repeatCount="indefinite" path="M 45 280 a 455 250 0 1 0 910 0 a 455 250 0 1 0 -910 0" /></circle>
                  <circle className="tools-orbit-satellite" r="2.5" fill="#D4AF37" filter="url(#orbit-glow)"><animateMotion dur="27s" begin="-8s" repeatCount="indefinite" path="M 120 280 a 380 210 0 1 1 760 0 a 380 210 0 1 1 -760 0" /></circle>
                  <circle className="tools-orbit-satellite" r="2" fill="#F3E5AB" filter="url(#orbit-glow)"><animateMotion dur="24s" begin="-13s" repeatCount="indefinite" path="M 200 280 a 300 166 0 1 0 600 0 a 300 166 0 1 0 -600 0" /></circle>
                  <circle className="tools-orbit-satellite" r="2" fill="#D4AF37" filter="url(#orbit-glow)"><animateMotion dur="21s" begin="-6s" repeatCount="indefinite" path="M 282 280 a 218 120 0 1 1 436 0 a 218 120 0 1 1 -436 0" /></circle>
                  <defs>
                    <filter id="orbit-glow" x="-250%" y="-250%" width="600%" height="600%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                </svg>

                {tools.map((tool, index) => (
                  <ToolNode
                    key={tool.href}
                    tool={tool}
                    locale={locale}
                    index={index}
                    active={activeTool === tool.key}
                    onActivate={setActiveTool}
                    onDeactivate={() => setActiveTool(null)}
                  />
                ))}
              </div>
              <div className="tools-orbit-core-position absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <div aria-hidden className="tools-orbit-core relative grid h-[76px] w-[76px] place-items-center rounded-full border border-amber-400/30 bg-[#0B0B0E] text-[#E5C158] shadow-[0_0_32px_rgba(212,175,55,0.2)] md:h-24 md:w-24">
                  <span className="absolute inset-2 rounded-full border border-amber-200/15" />
                  <svg viewBox="0 0 48 48" fill="none" className="relative h-10 w-10 md:h-12 md:w-12">
                    <path d="M5 25h5l4-10 6 19 6-23 6 23 5-15 4 6h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="m24 5 .9 3.1L28 9l-3.1.9L24 13l-.9-3.1L20 9l3.1-.9L24 5Zm15 24 .7 2.3L42 32l-2.3.7L39 35l-.7-2.3L36 32l2.3-.7.7-2.3Z" fill="currentColor" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
