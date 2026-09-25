import { CaptionSegment } from './types'

function pad(num: number, size = 2): string {
  let s = String(num)
  while (s.length < size) s = '0' + s
  return s
}

export function formatTimeSRT(seconds: number): string {
  const ms = Math.floor((seconds % 1) * 1000)
  const totalSec = Math.floor(seconds)
  const s = totalSec % 60
  const m = Math.floor(totalSec / 60) % 60
  const h = Math.floor(totalSec / 3600)
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`
}

function parseTimeToSeconds(timeStr: string): number {
  const normalized = timeStr.trim().replace(',', '.')
  const parts = normalized.split(':')
  if (parts.length === 3) {
    const h = parseFloat(parts[0]) || 0
    const m = parseFloat(parts[1]) || 0
    const s = parseFloat(parts[2]) || 0
    return h * 3600 + m * 60 + s
  }
  return 0
}

export function parseSRT(content: string): CaptionSegment[] {
  const clean = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const blocks = clean.split(/\n\n+/).filter(Boolean)
  const segments: CaptionSegment[] = []

  blocks.forEach((block, idx) => {
    const lines = block.split('\n').filter(Boolean)
    if (lines.length < 2) return

    let timeLineIndex = lines[0].includes('-->') ? 0 : 1
    if (!lines[timeLineIndex] || !lines[timeLineIndex].includes('-->')) return

    const [startStr, endStr] = lines[timeLineIndex].split('-->')
    const start = parseTimeToSeconds(startStr)
    const end = parseTimeToSeconds(endStr)
    const textLines = lines.slice(timeLineIndex + 1).join('\n').trim()

    if (textLines) {
      const words = textLines.split(/\s+/).map((w, wIdx, arr) => {
        const step = (end - start) / Math.max(arr.length, 1)
        return {
          text: w,
          start: start + wIdx * step,
          end: start + (wIdx + 1) * step,
        }
      })

      segments.push({
        id: `seg_${Date.now()}_${idx}`,
        start,
        end,
        text: textLines,
        words,
      })
    }
  })

  return segments
}

export function exportSRT(segments: CaptionSegment[], useTranslated = false): string {
  return segments
    .map((seg, idx) => {
      const text = useTranslated && seg.translatedText ? seg.translatedText : seg.text
      return `${idx + 1}\n${formatTimeSRT(seg.start)} --> ${formatTimeSRT(seg.end)}\n${text.trim()}\n`
    })
    .join('\n')
}
