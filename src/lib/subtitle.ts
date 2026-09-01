export interface SubtitleSegment {
  text: string
  start: number
  end: number
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

export function fmtTime(t: number, sep: ',' | '.') {
  const ms = Math.round((t % 1) * 1000)
  const s = Math.floor(t % 60)
  const m = Math.floor((t % 3600) / 60)
  const h = Math.floor(t / 3600)
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(ms, 3)}`
}

export const toSrt = (segs: SubtitleSegment[]) =>
  segs
    .map((s, i) => `${i + 1}\n${fmtTime(s.start, ',')} --> ${fmtTime(s.end, ',')}\n${s.text}`)
    .join('\n\n') + '\n'

export const toVtt = (segs: SubtitleSegment[]) =>
  'WEBVTT\n\n' +
  segs
    .map((s) => `${fmtTime(s.start, '.')} --> ${fmtTime(s.end, '.')}\n${s.text}`)
    .join('\n\n') + '\n'

export const toTxt = (segs: SubtitleSegment[]) => segs.map((s) => s.text).join('\n')

export function download(filename: string, content: string, mime = 'text/plain') {
  // BOM برای نمایش درست فارسی در ویندوز
  const blob = new Blob(['\uFEFF' + content], { type: mime + ';charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
