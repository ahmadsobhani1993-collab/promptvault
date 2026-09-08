import { useRef, useState } from 'react'
import { decodeToPcm16k } from './audio'
import { prepareChunks } from './audio-enhance'
import { mkWords, type Seg } from './subtitle-studio'

const ENDPOINT = 'https://gemini-live-proxy.ahmadsobhani1993.workers.dev/transcribe-stream'

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

// ۳ بار retry
async function callGemini(body: any, attempt = 0): Promise<any> {
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const j = await r.json()
    if (j.error && attempt < 3) {
      await sleep(1500 * (attempt + 1))
      return callGemini(body, attempt + 1)
    }
    return j
  } catch (e) {
    if (attempt < 3) {
      await sleep(1500 * (attempt + 1))
      return callGemini(body, attempt + 1)
    }
    throw e
  }
}

export const useVideoTranscribe = () => {
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [segments, setSegments] = useState<Seg[]>([])
  const stopRef = useRef(false)

  const run = async (file: File, speed: number) => {
    setSegments([])
    setProgress(0)
    setBusy(true)
    stopRef.current = false
    const acc: Seg[] = []

    try {
      setStatus('۱. دیکود صدا…')
      const pcm = await decodeToPcm16k(file)
      const { chunks, avg } = await prepareChunks(pcm)
      if (avg < 0.001) { setStatus('❌ صدا ندارد'); setBusy(false); return }

      setStatus(`۲. ارسال ${chunks.length} بخش به Gemini…`)
      let sentSeconds = 0

      for (let i = 0; i < chunks.length; i++) {
        if (stopRef.current) break

        const res = await callGemini({
          contents: [{
            parts: [{
              inlineData: { mimeType: 'audio/pcm;rate=16000', data: chunks[i].data }
            }]
          }],
          generationConfig: { responseModalities: ['TEXT'] },
        })

        const text = res?.candidates?.[0]?.content?.parts
          ?.map((p: any) => p.text)?.filter(Boolean)?.join(' ') || ''

        if (text.trim()) {
          const start = sentSeconds
          const end = sentSeconds + chunks[i].seconds
          acc.push(...splitIntoSentences(text.trim(), start, end))
          setSegments([...acc])
        }

        sentSeconds += chunks[i].seconds
        setProgress(Math.round(((i + 1) / chunks.length) * 100))
        setStatus(`۲. بخش ${i + 1}/${chunks.length} — ${text.slice(0, 40)}${text.length > 40 ? '…' : ''}`)

        // rate-limit respect
        await sleep(Math.max(200, 1000 / speed))
      }

      setStatus(acc.length === 0 ? '⚠️ متنی دریافت نشد' : `✅ ${acc.length} کپشن — زمان‌ها را تنظیم کن`)
    } catch (err: any) {
      setStatus('❌ ' + (err?.message || String(err)))
    } finally {
      setBusy(false)
    }
  }

  const stop = () => { stopRef.current = true }

  return { status, progress, busy, segments, setSegments, run, stop }
}
