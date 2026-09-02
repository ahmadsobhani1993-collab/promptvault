import type { TranscriptSegment } from './live-transcribe'

export type Word = { w: string; start: number; end: number }
export type Fx = 'none' | 'pop' | 'zoomIn' | 'zoomOut' | 'slide'
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
}

export const DEFAULT_STYLE: Style = {
  fontId: 'Vazirmatn', size: 6, color: '#ffffff', bgOpacity: 0.55,
  outline: true, x: null, y: null, karaoke: true, hlColor: '#ffe14d',
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
  const toks = text.split(/\s+/).filter(Boolean)
  const lens = toks.map((t) => t.length)
  const total = lens.reduce((a, b) => a + b, 0) || 1
  let c = start
  return toks.map((w, k) => {
    const d = Math.max(0.12, (lens[k] / total) * (end - start))
    const r = { w, start: c, end: c + d }
    c += d
    return r
  })
}

export const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w } else line = test
  }
  if (line) lines.push(line)
  return lines
}

export const easeOutBack = (x: number) => {
  const c1 = 1.70158, c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

export const loadFont = async (id: string) => {
  const lid = 'gf-' + id.replace(/\s+/g, '-')
  if (!document.getElementById(lid)) {
    const l = document.createElement('link')
    l.id = lid
    l.rel = 'stylesheet'
    l.href = `https://fonts.googleapis.com/css2?family=${id.replace(/ /g, '+')}:wght@400;700;800&display=swap`
    document.head.appendChild(l)
  }
  try { await (document as any).fonts?.load(`800 40px "${id}"`) } catch {}
}
