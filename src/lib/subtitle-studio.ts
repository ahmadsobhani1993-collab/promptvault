import type { TranscriptSegment } from './live-transcribe'

export type Word = { w: string; start: number; end: number }
export type Fx = 'none' | 'pop' | 'zoomIn' | 'zoomOut' | 'slide'
export type TextDirection = 'auto' | 'rtl' | 'ltr'
export type TextAlign = 'left' | 'center' | 'right'
export type Seg = TranscriptSegment & { words: Word[]; fx?: Fx; hl?: string }

export type Style = {
  fontId: string
  size: number
  color: string
  bgOpacity: number
  outline: boolean
  x: number | null
  y: number | null
  karaoke: boolean
  hlColor: string
  direction?: TextDirection
  align?: TextAlign
}

export const DEFAULT_STYLE: Style = {
  fontId: 'Vazirmatn',
  size: 6,
  color: '#ffffff',
  bgOpacity: 0.55,
  outline: true,
  x: null,
  y: null,
  karaoke: true,
  hlColor: '#ffe14d',
  direction: 'auto',
  align: 'center',
}

export const FONTS = [
  { id: 'Vazirmatn', label: 'وزیرمتن' },
  { id: 'Lalezar', label: 'لاله‌زار' },
  { id: 'Markazi Text', label: 'مرکزی' },
  { id: 'Noto Nastaliq Urdu', label: 'نستعلیق' },
  { id: 'Noto Kufi Arabic', label: 'کوفی' },
  { id: 'Cairo', label: 'قاهره' },
  { id: 'Tajawal', label: 'تجوال' },
  { id: 'Readex Pro', label: 'ریدکس' },
  { id: 'IBM Plex Sans Arabic', label: 'پلکس' },
  { id: 'Amiri', label: 'امیری' },
  { id: 'Reem Kufi', label: 'ریم کوفی' },
  { id: 'Aref Ruqaa', label: 'رقعه' },
  { id: 'Gulzar', label: 'گلزار' },
  { id: 'Jomhuria', label: 'جمهوری' },
]

export const PRESETS = [
  { id: 'viral', label: '🔥 وایرال', fontId: 'Lalezar', size: 8, color: '#ffffff', bgOpacity: 0, outline: true, karaoke: true, hlColor: '#ffe14d' },
  { id: 'minimal', label: '⬜ مینیمال', fontId: 'Vazirmatn', size: 5, color: '#ffffff', bgOpacity: 0.55, outline: false, karaoke: false, hlColor: '#ffe14d' },
  { id: 'podcast', label: '🎙 پادکست', fontId: 'Readex Pro', size: 6, color: '#ffffff', bgOpacity: 0.7, outline: false, karaoke: true, hlColor: '#7CFC00' },
  { id: 'cinema', label: '🎬 سینمایی', fontId: 'Amiri', size: 5, color: '#f5f5f4', bgOpacity: 0, outline: true, karaoke: false, hlColor: '#ffe14d' },
  { id: 'news', label: '📰 خبری', fontId: 'Noto Kufi Arabic', size: 6, color: '#ffffff', bgOpacity: 0.85, outline: false, karaoke: false, hlColor: '#ff5555' },
]

export const HL_COLORS = ['', '#e11d48', '#f59e0b', '#16a34a', '#2563eb', '#7c3aed']

export const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
]

export const mkWords = (text: string, start: number, end: number): Word[] => {
  const toks = text.trim().split(/\s+/).filter(Boolean)
  if (!toks.length) return []

  const lens = toks.map((t) => t.length)
  const total = lens.reduce((a, b) => a + b, 0) || 1
  const span = Math.max(0, end - start)
  let cursor = start

  return toks.map((w, i) => {
    const d = Math.max(0.08, (lens[i] / total) * span)
    const item = { w, start: cursor, end: Math.min(end, cursor + d) }
    cursor += d
    return item
  })
}

export const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] => {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ['']

  const lines: string[] = []
  let line = ''

  const pushBroken = (word: string) => {
    let part = ''
    for (const ch of word) {
      const test = part + ch
      if (part && ctx.measureText(test).width > maxWidth) {
        lines.push(part)
        part = ch
      } else {
        part = test
      }
    }
    line = part
  }

  for (const word of words) {
    if (ctx.measureText(word).width > maxWidth) {
      if (line) {
        lines.push(line)
        line = ''
      }
      pushBroken(word)
      continue
    }

    const test = line ? `${line} ${word}` : word
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }

  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

export const easeOutBack = (x: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

export const easeOutCubic = (x: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3)

export type AnimationState = {
  scale: number
  translateX: number
  translateY: number
  opacity: number
}

/**
 * Single animation engine used by both the editor preview and Canvas export.
 * Keeping this in one place prevents CSS/Canvas from quietly disagreeing.
 */
export const getAnimationState = (
  fx: Fx | undefined,
  elapsed: number,
  segmentDuration: number,
  videoWidth: number
): AnimationState => {
  const t = Math.max(0, elapsed)
  const dur = Math.max(0.1, segmentDuration)
  const state: AnimationState = { scale: 1, translateX: 0, translateY: 0, opacity: 1 }

  if (!fx || fx === 'none') return state

  if (fx === 'pop') {
    const p = Math.min(1, t / 0.35)
    if (p <= 0.6) {
      const q = easeOutCubic(p / 0.6)
      state.scale = 0.5 + (1.1 - 0.5) * q
      state.opacity = q
    } else {
      const q = easeOutCubic((p - 0.6) / 0.4)
      state.scale = 1.1 + (1 - 1.1) * q
      state.opacity = 1
    }
    return state
  }

  if (fx === 'zoomIn') {
    const p = Math.min(1, t / dur)
    state.scale = 0.8 + 0.4 * p
    return state
  }

  if (fx === 'zoomOut') {
    const p = Math.min(1, t / dur)
    state.scale = 1.2 - 0.4 * p
    return state
  }

  if (fx === 'slide') {
    const p = Math.min(1, t / 0.4)
    const q = easeOutCubic(p)
    state.translateX = -(videoWidth * (40 / 960)) * (1 - q)
    state.opacity = q
    return state
  }

  return state
}

export const detectTextDirection = (text: string): Exclude<TextDirection, 'auto'> => {
  const rtl = /[\u0590-\u08FF\uFB1D-\uFDFD\uFE70-\uFEFC]/
  return rtl.test(text) ? 'rtl' : 'ltr'
}

export const resolveDirection = (
  direction: TextDirection | undefined,
  text: string
): Exclude<TextDirection, 'auto'> => {
  if (direction === 'rtl' || direction === 'ltr') return direction
  return detectTextDirection(text)
}

export const resolveAlign = (
  align: TextAlign | undefined,
  direction: Exclude<TextDirection, 'auto'>
): TextAlign => {
  if (align === 'left' || align === 'right' || align === 'center') return align
  return direction === 'rtl' ? 'right' : 'left'
}

export const loadFont = async (id: string) => {
  if (typeof document === 'undefined') return

  const lid = 'gf-' + id.replace(/\s+/g, '-')
  if (!document.getElementById(lid)) {
    const l = document.createElement('link')
    l.id = lid
    l.rel = 'stylesheet'
    l.href = `https://fonts.googleapis.com/css2?family=${id.replace(/ /g, '+')}:wght@400;700;800&display=swap`
    document.head.appendChild(l)
  }

  try {
    await (document as any).fonts?.load(`800 40px "${id}"`)
  } catch {}
}
