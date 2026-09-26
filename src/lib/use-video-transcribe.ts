import { useState, useRef } from 'react'
import { decodeToPcm16k, bufferToBase64Chunks } from './audio'
import { mkWords, type Seg } from './subtitle-studio'
import { VideoLiveTranscriber, type VideoTranscriptSegment } from './video-live-transcribe'
import { extractAudioFromVideo } from './video-extract'

const SESSION_SECONDS = 60
const WORDS_PER_SEG = 5

const withTimeout = <T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms)),
  ])
}

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
    setStatus('در حال استخراج صوت...')
    setProgress(5)

    const anchorSecRef = { current: 0 }
    const committedWordsRef = { current: 0 }
    const builtSegmentsRef = { current: [] as Seg[] }

    try {
      let pcm: AudioBuffer | null = null

      // تلاش اول با تایم‌اوت محافظ ۶ ثانیه‌ای برای جلوگیری از Hang شدن سایلنت در MOV
      try {
        pcm = await withTimeout(
          decodeToPcm16k(file),
          6000,
          'Web Audio decoding timed out'
        )
      } catch (decodeErr) {
        console.warn('[Decoder] Fast decode failed or hung, falling back to FFmpeg...', decodeErr)
      }

      // فال‌بک تضمینی به FFmpeg در صورت شکست یا انقضای زمان
      if (!pcm) {
        setStatus('در حال رمزگشایی کانتینر ویدیو با موتور FFmpeg...')
        setProgress(10)

        const wavBlob = await extractAudioFromVideo(file, (p) => {
          // جلوگیری از پرش به عقب درصد پیشرفت
          setProgress((prev) => Math.max(prev, Math.max(10, 10 + Math.round(p * 0.1))))
        })

        // دیکود مجدد WAV خالص (WAV PCM 16k همیشه در جاوااسکریپت در کسری از ثانیه باز می‌شود)
        pcm = await decodeToPcm16k(wavBlob)
      }

      if (!pcm) throw new Error('استخراج اطلاعات صوتی ویدیو امکان‌پذیر نشد')

      const chunks = bufferToBase64Chunks(pcm, 1) || []
      const totalDuration = chunks.reduce((s, c) => s + (c.seconds || 0), 0)
      setStatus(`صوت تفکیک شد (${chunks.length} چانک) — اتصال به سرور هوش مصنوعی...`)
      setProgress(20)

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

        if (rawSeg.isFinal && previewNewTokens.length) {
          committedWordsRef.current = allTokens.length
          anchorSecRef.current = windowEnd
          builtSegmentsRef.current = [...builtSegmentsRef.current, ...previewSegs]
        }
      }

      for (let s = 0; s < sessions.length; s++) {
        if (stopRef.current) break
        const sess = sessions[s]

        setStatus(`سشن ${s + 1} از ${sessions.length}...`)
        const t = new VideoLiveTranscriber(undefined, sess.offset)

        t.onSegment = handleIncoming
        t.onError = (m) => { setStatus('خطا: ' + m) }

        await t.connect()

        for (let i = 0; i < sess.chunks.length; i++) {
          if (stopRef.current) break
          t.sendChunk(sess.chunks[i].data, sess.chunks[i].seconds)
          sentCount++
          setProgress(20 + Math.floor((sentCount / Math.max(chunks.length, 1)) * 75))
          await new Promise((r) => setTimeout(r, Math.min(sess.chunks[i].seconds * 1000, 800)))
        }

        await t.finish()
        if (sessionTextBuffer) {
          masterAccumulatedText = (masterAccumulatedText ? masterAccumulatedText + ' ' : '') + sessionTextBuffer
          sessionTextBuffer = ''
        }
      }

      const leftoverTokens = masterAccumulatedText.trim().split(/\s+/).filter(Boolean)
      if (leftoverTokens.length > committedWordsRef.current) {
        const newTokens = leftoverTokens.slice(committedWordsRef.current)
        const windowStart = anchorSecRef.current
        const windowEnd = Math.max(windowStart + 0.3, totalDuration)
        const finalSegs = splitTextToWindow(newTokens.join(' '), windowStart, windowEnd)
        builtSegmentsRef.current = [...builtSegmentsRef.current, ...finalSegs]
      }

      setSegments(builtSegmentsRef.current)
      setProgress(100)
      setStatus(
        builtSegmentsRef.current.length
          ? `تکمیل شد (${builtSegmentsRef.current.length} بخش زیرنویس)`
          : 'متنی در گفتار ویدیو یافت نشد'
      )
    } catch (err: any) {
      console.error('[TRANSCRIBE PIPELINE ERROR]:', err)
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
