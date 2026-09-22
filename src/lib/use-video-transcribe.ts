import { useState, useRef } from 'react'
import { decodeToPcm16k, bufferToBase64Chunks } from './audio'
import { mkWords, type Seg } from './subtitle-studio'
import { VideoLiveTranscriber, type VideoTranscriptSegment } from './video-live-transcribe'

const SESSION_SECONDS = 60
const WORDS_PER_SEG = 5

// این تابع فقط برای پخش یک تکه‌ی کوچک متن (چند کلمه‌ی تازه) روی یک
// بازه‌ی زمانی واقعی و کوچک استفاده می‌شود — نه برای کل ویدیو مثل قبل.
// خطای احتمالی حالا محدود به همین چند کلمه است، نه کل کلیپ.
const splitTextToWindow = (text: string, windowStart: number, windowEnd: number): Seg[] => {
  const tokens = text.trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return []

  const dur = Math.max(windowEnd - windowStart, 0.3)
  const chunks: string[] = []
  for (let i = 0; i < tokens.length; i += WORDS_PER_SEG) {
    chunks.push(tokens.slice(i, i + WORDS_PER_SEG).join(' '))
  }

  const totalWords = tokens.length
  const out: Seg[] = []
  let cursor = windowStart

  chunks.forEach((chunkTxt) => {
    const wCount = chunkTxt.split(/\s+/).filter(Boolean).length
    const d = (wCount / totalWords) * dur
    const segEnd = Math.min(cursor + d, windowEnd)
    out.push({
      text: chunkTxt,
      start: cursor,
      end: segEnd,
      words: typeof mkWords === 'function' ? mkWords(chunkTxt, cursor, segEnd) : [],
    })
    cursor = segEnd
  })

  return out
}

export function useVideoTranscribe() {
  const [status, setStatus] = useState<string>('')
  const [progress, setProgress] = useState<number>(0)
  const [busy, setBusy] = useState<boolean>(false)
  const [segments, setSegments] = useState<Seg[]>([])
  const stopRef = useRef<boolean>(false)

  const stop = () => {
    stopRef.current = true
    setBusy(false)
    setStatus('عملیات متوقف شد')
  }

  const run = async (file: File | Blob) => {
    if (!file) return
    stopRef.current = false
    setBusy(true)
    setSegments([])
    setStatus('در حال استخراج صوت از ویدیو...')
    setProgress(5)

    // لنگر زمان واقعی: چقدر از متنِ تاکنون‌دریافت‌شده قطعاً زمان‌بندی و قفل شده
    const anchorSecRef = { current: 0 }
    const committedWordsRef = { current: 0 }
    const builtSegmentsRef = { current: [] as Seg[] }

    try {
      console.log('%c[VIDEO-PIPELINE: STEP 1] Video File Received:', 'color: #ec4899; font-weight: bold;', {
        sizeBytes: file.size,
        type: file.type,
      })

      const pcm = await decodeToPcm16k(file)
      if (!pcm) throw new Error('خطا در دیکود صدای ویدیو')

      const chunks = bufferToBase64Chunks(pcm, 1) || []
      const totalDuration = chunks.reduce((s, c) => s + (c.seconds || 0), 0)
      setStatus(`صوت استخراج شد (${chunks.length} چانک) — در حال ارسال...`)
      setProgress(15)

      const sessions: { chunks: typeof chunks; offset: number }[] = []
      let current: typeof chunks = []
      let currentSec = 0
      let sessionOffset = 0

      for (const c of chunks) {
        current.push(c)
        currentSec += c.seconds
        if (currentSec >= SESSION_SECONDS) {
          sessions.push({ chunks: current, offset: sessionOffset })
          sessionOffset += currentSec
          current = []
          currentSec = 0
        }
      }
      if (current.length) {
        sessions.push({ chunks: current, offset: sessionOffset })
      }

      let masterAccumulatedText = ''
      let sessionTextBuffer = ''
      let sentCount = 0

      // پردازش هر تکه‌ی تازه‌ی متن روی بازه‌ی زمانی واقعی خودش
      const handleIncoming = (rawSeg: VideoTranscriptSegment) => {
        sessionTextBuffer = rawSeg.text
        const currentCombined = (masterAccumulatedText ? masterAccumulatedText + ' ' : '') + sessionTextBuffer
        const allTokens = currentCombined.trim().split(/\s+/).filter(Boolean)

        const previewNewTokens = allTokens.slice(committedWordsRef.current)
        const windowStart = anchorSecRef.current
        const windowEnd = Math.max(windowStart + 0.3, rawSeg.end)

        const previewSegs = previewNewTokens.length
          ? splitTextToWindow(previewNewTokens.join(' '), windowStart, windowEnd)
          : []

        setSegments([...builtSegmentsRef.current, ...previewSegs])

        // فقط وقتی Gemini متن را قطعی اعلام کرده، لنگر زمانی را جلو می‌بریم
        // تا بازنگری‌های interim چیزی را که قبلاً قفل شده خراب نکنند
        if (rawSeg.isFinal && previewNewTokens.length) {
          committedWordsRef.current = allTokens.length
          anchorSecRef.current = windowEnd
          builtSegmentsRef.current = [...builtSegmentsRef.current, ...previewSegs]
        }
      }

      for (let s = 0; s < sessions.length; s++) {
        if (stopRef.current) break
        const sess = sessions[s]

        setStatus(`سشن ${s + 1}/${sessions.length}...`)
        const t = new VideoLiveTranscriber(undefined, sess.offset)

        t.onSegment = handleIncoming
        t.onError = (m) => { setStatus('خطا: ' + m) }

        await t.connect()

        for (let i = 0; i < sess.chunks.length; i++) {
          if (stopRef.current) break
          t.sendChunk(sess.chunks[i].data, sess.chunks[i].seconds)
          sentCount++
          setProgress(15 + Math.floor((sentCount / Math.max(chunks.length, 1)) * 75))
          await new Promise((r) => setTimeout(r, Math.min(sess.chunks[i].seconds * 1000, 800)))
        }

        setStatus(`در حال انتظار برای پردازش نهایی...`)
        await t.finish()
        if (sessionTextBuffer) {
          masterAccumulatedText = (masterAccumulatedText ? masterAccumulatedText + ' ' : '') + sessionTextBuffer
          sessionTextBuffer = ''
        }
      }

      // اگر بخشی از متن آخر هیچ‌وقت isFinal اعلام نشد (مثلاً سشن بدون turnComplete بسته شد)،
      // همان را هم با بهترین لنگر موجود قفل کن تا از دست نرود
      const leftoverTokens = masterAccumulatedText.trim().split(/\s+/).filter(Boolean)
      if (leftoverTokens.length > committedWordsRef.current) {
        const newTokens = leftoverTokens.slice(committedWordsRef.current)
        const windowStart = anchorSecRef.current
        const windowEnd = Math.max(windowStart + 0.3, totalDuration)
        const finalSegs = splitTextToWindow(newTokens.join(' '), windowStart, windowEnd)
        builtSegmentsRef.current = [...builtSegmentsRef.current, ...finalSegs]
      }

      setSegments(builtSegmentsRef.current)

      if (builtSegmentsRef.current.length) {
        console.log('%c[VIDEO-PIPELINE: ALL SEGMENTS SECURED]:', 'color: #10b981; font-weight: bold;', builtSegmentsRef.current)
        setStatus(`تکمیل شد (${builtSegmentsRef.current.length} کپشن — ${totalDuration.toFixed(0)} ثانیه)`)
      } else {
        setStatus('متنی دریافت نشد')
      }
      setProgress(100)
    } catch (err: any) {
      console.error('[VIDEO TRANSCRIBE ERROR]:', err)
      setStatus('خطا در پردازش ویدیو: ' + (err.message || err))
    } finally {
      setBusy(false)
    }
  }

  return {
    status,
    progress,
    busy,
    segments,
    setSegments,
    run,
    stop,
    transcribeVideo: run,
    transcribe: run,
  }
}