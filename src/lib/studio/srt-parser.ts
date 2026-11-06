import type { CaptionSegment } from '@/lib/studio/types'

function parseTimestamp(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):([0-5]\d):([0-5]\d)[,.](\d{1,3})$/)
  if (!match) return null

  const [, hours, minutes, seconds, fraction] = match
  const milliseconds = Number(fraction.padEnd(3, '0'))
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + milliseconds / 1000
}

function formatTimestamp(seconds: number): string {
  const safeMs = Math.max(0, Math.round(seconds * 1000))
  const hours = Math.floor(safeMs / 3_600_000)
  const minutes = Math.floor((safeMs % 3_600_000) / 60_000)
  const wholeSeconds = Math.floor((safeMs % 60_000) / 1000)
  const milliseconds = safeMs % 1000

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`
}

export function parseSRT(input: string): CaptionSegment[] {
  const normalized = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim()
  if (!normalized) return []

  const segments: CaptionSegment[] = []
  for (const block of normalized.split(/\n{2,}/)) {
    const lines = block.split('\n')
    const timingIndex = lines.findIndex((line) => line.includes('-->'))
    if (timingIndex < 0) continue

    const timing = lines[timingIndex].match(/^\s*(\S+)\s+-->\s+(\S+)/)
    if (!timing) continue

    const start = parseTimestamp(timing[1])
    const end = parseTimestamp(timing[2])
    const text = lines.slice(timingIndex + 1).join('\n').trim()
    if (start === null || end === null || end < start || !text) continue

    segments.push({ id: String(segments.length + 1), start, end, text })
  }

  return segments
}

export function exportSRT(segments: CaptionSegment[]): string {
  return segments
    .map((segment, index) => {
      const start = Number.isFinite(segment.start) ? segment.start : 0
      const end = Number.isFinite(segment.end) ? Math.max(start, segment.end) : start
      return `${index + 1}\n${formatTimestamp(start)} --> ${formatTimestamp(end)}\n${segment.text.trim()}`
    })
    .join('\n\n')
}
