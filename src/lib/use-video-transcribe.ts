import { useState, useRef } from 'react'
import { decodeToPcm16k, bufferToBase64Chunks } from './audio'
import { mkWords, type Seg } from './subtitle-studio'
import { VideoLiveTranscriber, type VideoTranscriptSegment } from './video-live-transcribe'

const SESSION_SECONDS = 60

const splitTextToSegments = (fullText: string, totalSec: number): Seg[] => {
  if (!fullText || typeof fullText !== 'string') return []
  const allTokens = fullText.trim().split(/\s+/).filter(Boolean)
  if (!allTokens.length) return []

  const WORDS_PER_SEG = 5
  const chunks: string[] = []
  for (let i = 0; i < allTokens.length; i += WORDS_PER_SEG) {
    chunks.push(allTokens.slice(i, i + WORDS_PER_SEG).join(' '))
  }

  const dur = Math.max(totalSec, 1)
  const totalWords = allTokens.length
  const out: Seg[] = []
  let cursor = 0

  chunks.forEach((chunkTxt) => {
    const wCount = chunkTxt.split(/\s+/).filter(Boolean).length
    const d = (wCount / totalWords) * dur
    const segEnd = Math.min(cursor + d, totalSec)
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

    try {
      console.log('%c[VIDEO-PIPELINE: STEP 1] Video File Received:', 'color: #ec4899; font-weight: bold;', {
        sizeBytes: file.size,
        type: file.type,
      })

      const pcm = await decodeToPcm16k(file)
      if (!pcm) throw new Error('خطا در دیکود صدای ویدیو')

      console.log('%c[AUDIO DECODED DURATION]:', 'color: lime; font-weight: bold;', pcm.duration + 's')

      const chunks = bufferToBase64Chunks(pcm, 1) || []
      console.log('%c[VIDEO-PIPELINE: STEP 2] Audio Split into Chunks:', 'color: #ec4899; font-weight: bold;', {
        totalChunks: chunks.length,
        totalAudioSec: pcm.duration,
      })

      const totalDuration = chunks.reduce((s, c) => s + (c.seconds || 0), 0)
      setStatus(`صوت استخراج شد (${chunks.length} چانک) — در حال ارسال به جمینای...`)
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

      let latestFullText = ''
      let sentCount = 0

      for (let s = 0; s < sessions.length; s++) {
        if (stopRef.current) break
        const sess = sessions[s]

        setStatus(`سشن ${s + 1}/${sessions.length}...`)
        const t = new VideoLiveTranscriber(undefined, sess.offset)

        t.onSegment = (rawSeg: VideoTranscriptSegment) => {
          if (!rawSeg?.text) return
          latestFullText = rawSeg.text
          console.log('%c[VIDEO-PIPELINE: RE-CALCULATING CAPTIONS]:', 'color: #facc15;', latestFullText)
          const parsed = splitTextToSegments(latestFullText, totalDuration)
          setSegments(parsed)
        }

        t.onError = (m) => {
          setStatus('خطا: ' + m)
        }

        await t.connect()

        for (let i = 0; i < sess.chunks.length; i++) {
          if (stopRef.current) break
          t.sendChunk(sess.chunks[i].data, sess.chunks[i].seconds)
          sentCount++
          setProgress(15 + Math.floor((sentCount / Math.max(chunks.length, 1)) * 75))
          await new Promise((r) => setTimeout(r, Math.min(sess.chunks[i].seconds * 1000, 800)))
        }

        setStatus(`در حال انتظار برای پاسخ نهایی جمینای...`)
        await t.finish()
      }

      if (latestFullText) {
        const finalSegments = splitTextToSegments(latestFullText, totalDuration)
        setSegments(finalSegments)
        console.log('%c[VIDEO-PIPELINE: COMPLETED SUCCESSFULLY]:', 'color: #10b981; font-weight: bold;', finalSegments)
        setStatus(`تکمیل شد (${finalSegments.length} کپشن — ${totalDuration.toFixed(0)} ثانیه)`)
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
