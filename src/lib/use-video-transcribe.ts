import { useRef, useState } from 'react'
import { LiveTranscriber, type TranscriptSegment } from './live-transcribe'
import { decodeToPcm16k, bufferToBase64Chunks } from './audio'
import { mkWords, type Seg } from './subtitle-studio'

const SESSION_SECONDS = 60

const splitIntoSentences = (text: string, start: number, end: number): Seg[] => {
  const allTokens = text.trim().split(/\s+/).filter(Boolean);
  if (!allTokens.length) return [];

  const WORDS_PER_SEG = 4;
  const chunks: string[] = [];
  for (let i = 0; i < allTokens.length; i += WORDS_PER_SEG) {
    chunks.push(allTokens.slice(i, i + WORDS_PER_SEG).join(' '));
  }

  const totalWords = allTokens.length;
  const dur = Math.max(0.6, end - start);
  const out: Seg[] = [];
  let cursor = start;

  chunks.forEach((chunkTxt) => {
    const wCount = chunkTxt.split(/\s+/).filter(Boolean).length;
    const d = (wCount / totalWords) * dur;
    const segEnd = cursor + d;
    out.push({
      text: chunkTxt,
      start: cursor,
      end: segEnd,
      words: mkWords(chunkTxt, cursor, segEnd)
    });
    cursor = segEnd;
  });

  return out;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const useVideoTranscribe = () => {
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [segments, setSegments] = useState<Seg[]>([])
  const stopRef = useRef(false)

  const run = async (file: File, speed: number) => {
    setSegments([]); setProgress(0); setBusy(true); stopRef.current = false
    const acc: Seg[] = []

    const wire = (t: LiveTranscriber, offset: number) => {
      t.onSegment = (seg: TranscriptSegment) => {
        const broken = splitIntoSentences(seg.text, seg.start + offset, seg.end + offset)
        acc.push(...broken)
        setSegments([...acc])
      }
      t.onError = (m) => { setStatus('❌ ' + m); stopRef.current = true; }
    }

    const connect = async (offset: number): Promise<LiveTranscriber> => {
      for (let a = 0; a < 3; a++) {
        const t = new LiveTranscriber(undefined, offset)
        wire(t, offset)
        try {
          await t.connect()
          return t
        } catch (e) { await sleep(1500) }
      }
      throw new Error('اتصال برقرار نشد')
    }

    try {
      setStatus('۱. دیکود صدا…')
      console.log('%c[AUDIO] Starting decode...', 'color: yellow'); const pcm = await decodeToPcm16k(file); console.log('%c[AUDIO DECODED BYTES]:', 'color: lime', pcm?.byteLength);
      const chunks = bufferToBase64Chunks(pcm, 1)
      const totalDuration = chunks.reduce((s, c) => s + c.seconds, 0)
      setStatus(`۲. ${chunks.length} بخش — ${totalDuration.toFixed(0)}s`)

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
          current = []; currentSec = 0
        }
      }
      if (current.length) sessions.push({ chunks: current, offset: sessionOffset })

      setStatus(`۳. ${sessions.length} session ترنسکریپت…`)
      let totalChunks = 0
      const totalAllChunks = chunks.length

      for (let s = 0; s < sessions.length; s++) {
        if (stopRef.current) break
        const sess = sessions[s]
        setStatus(`session ${s + 1}/${sessions.length} (از ${sess.offset.toFixed(0)}s)…`)
        
        const t = await connect(sess.offset)
        
        for (let i = 0; i < sess.chunks.length; i++) {
          if (stopRef.current) break
          if (!t.sendChunk(sess.chunks[i].data, sess.chunks[i].seconds)) {
            setStatus(`❌ chunk ${i + 1} session ${s + 1} ارسال نشد`)
            break
          }
          totalChunks++
          setProgress(Math.round((totalChunks / totalAllChunks) * 100))
        }
        
        await t.finish()
      }

      if (!status.startsWith('❌')) { setStatus(acc.length === 0 ? '⚠️ متنی دریافت نشد' : `✅ ${acc.length} کپشن — ${totalDuration.toFixed(0)}s`); }
    } catch (err: any) {
      setStatus('❌ ' + (err?.message || String(err)))
    } finally {
      setBusy(false)
    }
  }

  const stop = () => { stopRef.current = true }
  return { status, progress, busy, segments, setSegments, run, stop }
}
