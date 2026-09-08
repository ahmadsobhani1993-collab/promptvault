import { useRef, useState } from 'react'
import { LiveTranscriber, type TranscriptSegment } from './live-transcribe'
import { decodeToPcm16k, bufferToBase64Chunks } from './audio'
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
      const chunks = bufferToBase64Chunks(pcm, 2)
      const d0 = pcm.getChannelData(0)
      let sum = 0
      let n = 0
      for (let i = 0; i < d0.length; i += 997) { sum += Math.abs(d0[i]); n++ }
      const avg = n ? sum / n : 0
      if (avg < 0.001) { setStatus('❌ صدای قابل استفاده ندارد'); setBusy(false); return }

      setStatus('۲. اتصال WebSocket…')
      let t = await connect(0)

      setStatus('۳. ترنسکریپت زنده…')
      let sentSeconds = 0

      const ensureConn = async (): Promise<LiveTranscriber> => {
        if (t.isConnected()) return t
        setStatus('🔄 اتصال مجدد…')
        const nt = await connect(sentSeconds)
        t = nt
        setStatus('۳. ترنسکریپت زنده…')
        return nt
      }

      for (let i = 0; i < chunks.length; i++) {
        if (stopRef.current) break

        // قبل از هر chunk چک کن وصلیم
        t = await ensureConn()

        const ok = t.sendChunk(chunks[i].data, chunks[i].seconds)
        if (!ok) {
          // silent drop نشد → reconnect و retry
          setStatus(`⚠️ ارسال ${i + 1} ناموفق — reconnect`)
          await sleep(800)
          t = await ensureConn()
          const retry = t.sendChunk(chunks[i].data, chunks[i].seconds)
          if (!retry) {
            setStatus(`❌ chunk ${i + 1} اصلاً ارسال نشد`)
            break
          }
        }

        sentSeconds += chunks[i].seconds
        setProgress(Math.round(((i + 1) / chunks.length) * 100))
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
