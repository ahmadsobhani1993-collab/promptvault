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
  const totalMs = Math.max(0, Math.round(seconds * 1000))
  const ms = totalMs % 1000
  const totalSec = Math.floor(totalMs / 1000)
  const s = totalSec % 60
  const m = Math.floor(totalSec / 60) % 60
  const h = Math.floor(totalSec / 3600)
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`
}

function formatVttTime(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000))
  const ms = totalMs % 1000
  const totalSec = Math.floor(totalMs / 1000)
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

function formatAssTime(seconds: number): string {
  const centiseconds = Math.round(Math.max(0, seconds) * 100)
  const hours = Math.floor(centiseconds / 360000)
  const minutes = Math.floor(centiseconds / 6000) % 60
  const remainingSeconds = Math.floor(centiseconds / 100) % 60
  const fraction = centiseconds % 100
  return `${hours}:${pad(minutes)}:${pad(remainingSeconds)}.${pad(fraction)}`
}

export function toAss(segments: SubtitleSegment[]): string {
  const header = `[Script Info]
ScriptType: v4.00+
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,1,2,30,30,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`
  const events = segments.map((segment) => {
    const text = segment.text.replace(/\r?\n/g, '\\N').replace(/\{/g, '\\{').replace(/\}/g, '\\}')
    return `Dialogue: 0,${formatAssTime(segment.start)},${formatAssTime(segment.end)},Default,,0,0,0,,${text}`
  })
  return `${header}\n${events.join('\n')}\n`
}

export function toJson(segments: SubtitleSegment[]): string {
  return `${JSON.stringify(segments, null, 2)}\n`
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
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
