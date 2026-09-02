import { useRef, useState } from 'react'
import { LiveTranscriber, type TranscriptSegment } from './live-transcribe'
import { decodeToPcm16k } from './audio'
import { prepareChunks, getSpeechRegions } from './audio-enhance'
import { mkWords, type Seg } from './subtitle-studio'

/**
 * هم‌ترازی جملات روی بازه‌های گفتار:
 * کلمات به‌ترتیب روی زمانِ واقعی صحبت (انرژی صدا) نشسته‌اند،
 * نه روی کل طول ویدیو → مکث‌ها حفظ می‌شوند.
 */
const retimeToSpeech = (segs: Seg[], regions: { start: number; end: number }[]): Seg[] => {
  const count = (s: string) => s.split(/\s+/).filter(Boolean).length
  const totalWords = segs.reduce((a, s) => a + count(s.text), 0) || 1
  const totalSpeech = regions.reduce((a, r) => a + (r.end - r.start), 0)

  const timeAtWord = (w: number) => {
    const target = (w / totalWords) * totalSpeech
    let acc = 0
    for (const r of regions) {
      const d = r.end - r.start
      if (acc + d >= target) return r.start + (target - acc)
      acc += d
    }
    return regions[regions.length - 1].end
  }

  let cursor = 0
  return segs.map((s) => {
    const w = count(s.text)
    const start = timeAtWord(cursor)
    const end = Math.max(start + 0.4, timeAtWord(cursor + w))
    cursor += w
    return { ...s, start, end, words: mkWords(s.text, start, end) }
  })
}

export const useVideoTranscribe = () => {
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [segments, setSegments] = useState<Seg[]>([])
  const tRef = useRef<LiveTranscriber | null>(null)
  const stopRef = useRef(false)

  const run = async (file: File, speed: number) => {
    setSegments([])
    setProgress(0)
    setBusy(true)
    stopRef.current = false
    const acc: Seg[] = []

    try {
      setStatus('۱. دیکود صدا (محلی)…')
      const pcm = await decodeToPcm16k(file)
      const { chunks, avg } = await prepareChunks(pcm)
      console.log('[audio] avg:', avg, 'chunks:', chunks.length)
      if (avg < 0.001) { setStatus('❌ صدای قابل استفاده ندارد'); setBusy(false); return }

      // 🔑 بازه‌های گفتار برای هم‌ترازی نهایی
      const regions = await getSpeechRegions(pcm)
      console.log('[align] speech regions:', regions.length)

      setStatus('۲. اتصال WebSocket…')
      const t = new LiveTranscriber()
      tRef.current = t
      t.onSegment = (seg: TranscriptSegment) => {
        acc.push({ ...seg, words: mkWords(seg.text, seg.start, seg.end) })
        setSegments([...acc])
      }
      t.onError = (m) => setStatus('❌ ' + m)

      await Promise.race([
        t.connect(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout اتصال')), 20000)),
      ])

      setStatus('۳. ترنسکریپت زنده…')
      for (let i = 0; i < chunks.length; i++) {
        if (stopRef.current) break
        t.sendChunk(chunks[i].data, chunks[i].seconds)
        setProgress(Math.round(((i + 1) / chunks.length) * 100))
        await new Promise((r) => setTimeout(r, 1000 / speed))
      }

      setStatus('۴. هم‌ترازی زیرنویس با صدا…')
      await t.finish()

      if (acc.length === 0) {
        setStatus('⚠️ متنی دریافت نشد — با سرعت 1x دوباره تلاش کن')
      } else {
        // 🔑 هم‌ترازی نهایی روی انرژی صدا
        const aligned = retimeToSpeech([...acc], regions)
        setSegments(aligned)
        setStatus('✅ آماده — ادیت کن و خروجی بگیر')
      }
    } catch (err: any) {
      setStatus('❌ ' + (err?.message || String(err)))
    } finally {
      setBusy(false)
    }
  }

  const stop = () => {
    stopRef.current = true
    tRef.current?.finish()
  }

  return { status, progress, busy, segments, setSegments, run, stop }
}
