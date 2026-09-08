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
    const flag = { closed: false, closeTime: 0 }

    const wire = (t: LiveTranscriber, offset: number) => {
      flag.closed = false
      flag.closeTime = 0
      t.onSegment = (seg: TranscriptSegment) => {
        const broken = splitIntoSentences(seg.text, seg.start + offset, seg.end + offset)
        acc.push(...broken)
        setSegments([...acc])
        console.log('[transcribe] segment:', seg.text.slice(0, 50), 'at', seg.start.toFixed(1))
      }
      t.onError = (m) => {
        console.error('[transcribe] error:', m)
        setStatus('❌ ' + m)
      }
      t.onClose = (e?: { code?: number; reason?: string }) => {
        flag.closed = true
        flag.closeTime = Date.now()
        console.warn('[transcribe] ws closed:', e?.code, e?.reason)
      }
    }

    const connect = async (offset: number): Promise<LiveTranscriber> => {
      let lastErr: any = null
      for (let a = 0; a < 3; a++) {
        const t = new LiveTranscriber(undefined, offset)
        tRef.current = t
        wire(t, offset)
        try {
          setStatus(`اتصال ${a + 1}/3…`)
          await Promise.race([
            t.connect(),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000)),
          ])
          console.log('[transcribe] connected at offset', offset)
          return t
        } catch (e) {
          lastErr = e
          console.warn('[transcribe] connect attempt', a + 1, 'failed:', e)
          await sleep(1500)
        }
      }
      throw lastErr || new Error('اتصال برقرار نشد')
    }

    try {
      setStatus('۱. دیکود صدا…')
      const pcm = await decodeToPcm16k(file)
      const chunks = bufferToBase64Chunks(pcm, 1)
      console.log('[transcribe] total chunks:', chunks.length, 'duration:', chunks.reduce((s, c) => s + c.seconds, 0).toFixed(1) + 's')

      const d0 = pcm.getChannelData(0)
      let sum = 0, n = 0
      for (let i = 0; i < d0.length; i += 997) { sum += Math.abs(d0[i]); n++ }
      const avg = n ? sum / n : 0
      if (avg < 0.001) { setStatus('❌ صدا ندارد'); setBusy(false); return }

      setStatus('۲. اتصال WebSocket…')
      let t = await connect(0)

      setStatus('۳. ترنسکریپت…')
      let sentSeconds = 0
      let sentChunks = 0
      let reconnects = 0

      for (let i = 0; i < chunks.length; i++) {
        if (stopRef.current) break

        // چک اتصال قبل از هر chunk
        if (flag.closed || !t.isConnected()) {
          reconnects++
          console.log('[transcribe] reconnecting after chunk', i, 'at', sentSeconds.toFixed(1) + 's')
          setStatus(`🔄 اتصال مجدد (${reconnects})…`)
          t = await connect(sentSeconds)
          setStatus('۳. ترنسکریپت…')
        }

        const ok = t.sendChunk(chunks[i].data, chunks[i].seconds)
        if (!ok) {
          console.error('[transcribe] send failed at chunk', i)
          setStatus(`❌ ارسال chunk ${i + 1} ناموفق`)
          break
        }

        sentSeconds += chunks[i].seconds
        sentChunks++
        setProgress(Math.round(((i + 1) / chunks.length) * 100))

        if (i % 10 === 0) {
          console.log('[transcribe] progress:', i + 1, '/', chunks.length, 'sent:', sentSeconds.toFixed(1) + 's')
        }

        // pacing: real-time
        await sleep(chunks[i].seconds * 1000)
      }

      console.log('[transcribe] finished:', sentChunks, 'chunks sent,', reconnects, 'reconnects')
      setStatus('۴. پایان…')
      await t.finish()

      setStatus(acc.length === 0 ? '⚠️ متنی دریافت نشد' : `✅ ${acc.length} کپشن — ${sentSeconds.toFixed(0)}s از ${chunks.reduce((s, c) => s + c.seconds, 0).toFixed(0)}s`)
    } catch (err: any) {
      console.error('[transcribe] fatal error:', err)
      setStatus('❌ ' + (err?.message || String(err)))
    } finally {
      setBusy(false)
    }
  }

  const stop = () => { stopRef.current = true; tRef.current?.finish() }

  return { status, progress, busy, segments, setSegments, run, stop }
}
