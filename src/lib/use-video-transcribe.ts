import { useRef, useState } from 'react'
import { LiveTranscriber, type TranscriptSegment } from './live-transcribe'
import { decodeToPcm16k } from './audio'
import { prepareChunks } from './audio-enhance'
import { mkWords, type Seg } from './subtitle-studio'

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

      setStatus('۲. اتصال WebSocket…')
      const t = new LiveTranscriber()
      tRef.current = t
      t.onSegment = (seg: TranscriptSegment) => {
        const s: Seg = { ...seg, words: mkWords(seg.text, seg.start, seg.end) }
        acc.push(s)
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

      setStatus('۴. متن پایانی…')
      await t.finish()

      if (acc.length === 0) {
        setStatus('⚠️ متنی دریافت نشد — با سرعت 1x دوباره تلاش کن')
      } else {
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
