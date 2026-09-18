import { useState, useRef } from 'react'
import { decodeToPcm16k, bufferToBase64Chunks } from './audio'
import { mkWords, type Seg } from './subtitle-studio'
import { VideoLiveTranscriber, type VideoTranscriptSegment } from './video-live-transcribe'

const SESSION_SECONDS = 60

const splitIntoSentences = (text: string, start: number, end: number): Seg[] => {
  const allTokens = text.trim().split(/\s+/).filter(Boolean)
  if (!allTokens.length) return []

  const WORDS_PER_SEG = 4
  const chunks: string[] = []
  for (let i = 0; i < allTokens.length; i += WORDS_PER_SEG) {
    chunks.push(allTokens.slice(i, i + WORDS_PER_SEG).join(' '))
  }

  const totalWords = allTokens.length
  const dur = Math.max(0.6, end - start)
  const out: Seg[] = []
  let cursor = start

  chunks.forEach((chunkTxt) => {
    const wCount = chunkTxt.split(/\s+/).filter(Boolean).length
    const d = (wCount / totalWords) * dur
    const segEnd = cursor + d
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
  const stopRef = useRef<boolean>(false)

  const stop = () => {
    stopRef.current = true
    setStatus('عملیات متوقف شد')
  }

  const transcribeVideo = async (
    file: File | Blob,
    onSegments: (segments: Seg[]) => void
  ) => {
    stopRef.current = false
    setStatus('در حال آماده‌سازی صوت از ویدیو...')
    setProgress(5)

    try {
      console.log('%c[VIDEO-PIPELINE: STEP 1] Video File Received:', 'color: #ec4899; font-weight: bold;', {
        sizeBytes: file.size,
        type: file.type,
      })

      const pcm = await decodeToPcm16k(file)
      console.log('%c[AUDIO DECODED DURATION]:', 'color: lime;', pcm.duration + 's')

      const chunks = bufferToBase64Chunks(pcm, 1)
      console.log('%c[VIDEO-PIPELINE: STEP 2] Audio Split into Chunks:', 'color: #ec4899; font-weight: bold;', {
        totalChunks: chunks.length,
        totalAudioSec: pcm.duration,
      })

      const totalDuration = chunks.reduce((s, c) => s + c.seconds, 0)
      setStatus(`صوت استخراج شد (${chunks.length} چانک) — شروع اتصال به جمینای لایو...`)
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

      const acc: Seg[] = []
      let sentCount = 0

      for (let s = 0; s < sessions.length; s++) {
        if (stopRef.current) break
        const sess = sessions[s]

        setStatus(`در حال برقراری اتصال سشن ${s + 1}/${sessions.length}...`)
        const t = new VideoLiveTranscriber(undefined, sess.offset)

        t.onSegment = (rawSeg: VideoTranscriptSegment) => {
          const broken = splitIntoSentences(rawSeg.text, rawSeg.start, rawSeg.end)
          for (const item of broken) {
            acc.push(item)
          }
          onSegments([...acc])
        }

        t.onError = (m) => {
          console.error('[VIDEO TRANSCRIBE RUNNER ERROR]:', m)
          setStatus('خطا: ' + m)
        }

        await t.connect()

        for (let i = 0; i < sess.chunks.length; i++) {
          if (stopRef.current) break
          t.sendChunk(sess.chunks[i].data, sess.chunks[i].seconds)
          sentCount++
          setProgress(15 + Math.floor((sentCount / chunks.length) * 75))
          // تنظیم فاصله زمانی هماهنگ با پردازش ریل‌تایم وب‌سوکت
          await new Promise((r) => setTimeout(r, Math.min(sess.chunks[i].seconds * 1000, 800)))
        }

        setStatus(`در حال دریافت نتایج نهایی سشن ${s + 1}...`)
        await t.finish()
      }

      setProgress(100)
      if (acc.length === 0) {
        setStatus('متنی دریافت نشد')
      } else {
        setStatus(`تکمیل شد: ${acc.length} کپشن — ${totalDuration.toFixed(0)} ثانیه`)
      }
    } catch (err: any) {
      console.error('[VIDEO TRANSCRIBE ERROR]:', err)
      setStatus('خطا در پردازش ویدیو: ' + (err.message || err))
    }
  }

  return {
    status,
    progress,
    stop,
    transcribeVideo,
  }
}
