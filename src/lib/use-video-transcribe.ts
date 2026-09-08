import { useRef, useState } from 'react'
import { LiveTranscriber, type TranscriptSegment } from './live-transcribe'
import { decodeToPcm16k } from './audio'
import { prepareChunks } from './audio-enhance'
import { mkWords, type Seg } from './subtitle-studio'

const splitIntoSentences = (text: string, start: number, end: number): Seg[] => {
  const sentences = text.match(/[^.!?؟\n]+[.!?؟]?/g)?.map((s) => s.trim()).filter(Boolean) || [text]
  const words = sentences.map((s) => s.split(/\s+/).filter(Boolean).length)
  const totalW = words.reduce((a, b) => a + b, 0) || 1
  const dur = end - start
  const out: Seg[] = []
  let cursor = start
  sentences.forEach((txt, k) => {
    const d = Math.max(0.4, (words[k] / totalW) * dur)
    out.push({ text: txt, start: cursor, end: cursor + d, words: mkWords(txt, cursor, cursor + d) })
    cursor += d
  })
  return out
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

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
    const flag = { closed: false }

    const wire = (t: LiveTranscriber) => {
      flag.closed = false
      t.onSegment = (seg: TranscriptSegment) => {
        acc.push(...splitIntoSentences(seg.text, seg.start, seg.end))
        setSegments([...acc])
      }
      t.onError = (m) => setStatus('❌ ' + m)
      t.onClose = () => { flag.closed = true }
    }

    // اتصال با ۳ بار retry + offset زمانی برای ادامه پس از قطعی
    const connect = async (offset: number) => {
      let lastErr: any = null
      for (let a = 0; a < 3; a++) {
        const t = new LiveTranscriber(undefined, offset)
        tRef.current = t
        wire(t)
        try {
          await Promise.race([
            t.connect(),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout اتصال')), 15000)),
          ])
          return t
        } catch (e) {
          lastErr = e
          await sleep(1500)
        }
      }
      throw lastErr || new Error('اتصال برقرار نشد')
    }

    try {
      setStatus('۱. دیکود صدا (محلی)…')
      const pcm = await decodeToPcm16k(file)
      const { chunks, avg } = await prepareChunks(pcm)
      if (avg < 0.001) { setStatus('❌ صدای قابل استفاده ندارد'); setBusy(false); return }

      setStatus('۲. اتصال WebSocket…')
      let t = await connect(0)

      setStatus('۳. ترنسکریپت زنده…')
      let sentSeconds = 0
      for (let i = 0; i < chunks.length; i++) {
        if (stopRef.current) break
        if (flag.closed) {
          setStatus('🔄 اتصال مجدد…')
          t = await connect(sentSeconds)
          setStatus('۳. ترنسکریپت زنده…')
        }
        t.sendChunk(chunks[i].data, chunks[i].seconds)
        sentSeconds += chunks[i].seconds
        setProgress(Math.round(((i + 1) / chunks.length) * 100))
        // ✅ pacing درست: انتظار متناسب با طول chunk
        await sleep((chunks[i].seconds * 1000) / speed)
      }

      setStatus('۴. پایان…')
      await t.finish()

      setStatus(acc.length === 0 ? '⚠️ متنی دریافت نشد' : '✅ آماده — زمان‌ها را از transcript تنظیم کن')
    } catch (err: any) {
      setStatus('❌ ' + (err?.message || String(err)))
    } finally {
      setBusy(false)
    }
  }

  const stop = () => { stopRef.current = true; tRef.current?.finish() }

  return { status, progress, busy, segments, setSegments, run, stop }
}
