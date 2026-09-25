export interface SubtitleSegment {
  id?: string
  start: number
  end: number
  text: string
}

function pad(num: number, size = 2): string {
  let s = String(num)
  while (s.length < size) s = '0' + s
  return s
}

function formatSrtTime(seconds: number): string {
  const ms = Math.floor((seconds % 1) * 1000)
  const totalSec = Math.floor(seconds)
  const s = totalSec % 60
  const m = Math.floor(totalSec / 60) % 60
  const h = Math.floor(totalSec / 3600)
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`
}

function formatVttTime(seconds: number): string {
  const ms = Math.floor((seconds % 1) * 1000)
  const totalSec = Math.floor(seconds)
  const s = totalSec % 60
  const m = Math.floor(totalSec / 60) % 60
  const h = Math.floor(totalSec / 3600)
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`
}

export function toSrt(segments: SubtitleSegment[]): string {
  if (!segments || !segments.length) return ''
  return segments
    .map((seg, index) => {
      return `${index + 1}\n${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end)}\n${seg.text.trim()}\n`
    })
    .join('\n')
}

export function toVtt(segments: SubtitleSegment[]): string {
  if (!segments || !segments.length) return 'WEBVTT\n'
  const body = segments
    .map((seg, index) => {
      return `${index + 1}\n${formatVttTime(seg.start)} --> ${formatVttTime(seg.end)}\n${seg.text.trim()}`
    })
    .join('\n\n')
  return `WEBVTT\n\n${body}\n`
}

export function toTxt(segments: { text: string }[]): string {
  if (!segments || !segments.length) return ''
  return segments
    .map((s) => s.text.trim())
    .filter(Boolean)
    .join('\n')
}

export function download(filename: string, content: string, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
