import { useState, useRef } from 'react'
import type { Seg } from './subtitle-studio'
import { encodePcm16kWav, extractAudioWav16k, readPcm16kMonoWav } from './audio'
import { VideoLiveTranscriber, TRANSCRIBE_MODEL } from './video-live-transcribe'

let segmentIdCounter = 0
const generateSegmentId = (): string => {
  segmentIdCounter++
  return `seg_${Date.now()}_${segmentIdCounter}_${Math.random().toString(36).substring(2, 7)}`
}

type WordTimestamp = { word: string; start: number; end: number }
type AlignmentResult = { words: WordTimestamp[]; language?: string; duration?: number }

function requestAlignment(
  audio: Blob, 
  transcript: string, 
  ticket: { serviceUrl: string; token: string }, 
  language: string, 
  onProgress: (ratio: number) => void, 
  onUploaded: () => void, 
  onRequest: (request: XMLHttpRequest | null) => void
): Promise<AlignmentResult> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    onRequest(request)
    request.open('POST', `${ticket.serviceUrl.replace(/\/$/, '')}/align?language=${encodeURIComponent(language)}`)
    request.setRequestHeader('Authorization', `Bearer ${ticket.token}`)
    
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total)
    }
    request.upload.onload = onUploaded
    request.onerror = () => { onRequest(null); reject(new Error('ارتباط با سرویس forced alignment برقرار نشد.')) }
    request.onabort = () => { onRequest(null); reject(new Error('پردازش متوقف شد.')) }
    
    request.onload = () => {
      onRequest(null)
      let data: any
      try { data = JSON.parse(request.responseText) } catch { data = {} }
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(data.detail || data.error || `خطای سرویس alignment (${request.status})`))
        return
      }
      resolve(data as AlignmentResult)
    }
    
    const form = new FormData()
    form.append('file', audio, 'extracted-audio.wav')
    form.append('transcript', transcript)
    request.send(form)
  })
}

function pcmChunkToBase64(samples: Int16Array, start: number, end: number): string {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset + start * 2, (end - start) * 2)
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + 0x8000)))
  }
  return btoa(binary)
}

const normalizeTokens = (text: string) => 
  text.split(/\s+/).filter(Boolean).map(token => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').toLowerCase()).filter(Boolean)

function mergeTranscriptChunk(previous: string, next: string): string {
  const oldTokens = previous.trim().split(/\s+/).filter(Boolean)
  const nextTokens = next.trim().split(/\s+/).filter(Boolean)
  if (!oldTokens.length) return nextTokens.join(' ')
  if (!nextTokens.length) return previous
  
  const oldNorm = normalizeTokens(oldTokens.join(' '))
  const nextNorm = normalizeTokens(nextTokens.join(' '))
  const maxOverlap = Math.min(12, oldNorm.length, nextNorm.length)
  let overlap = 0
  
  for (let count = maxOverlap; count > 0; count--) {
    if (oldNorm.slice(-count).join(' ') === nextNorm.slice(0, count).join(' ')) { 
      overlap = count
      break 
    }
  }
  return [...oldTokens, ...nextTokens.slice(overlap)].join(' ')
}

function groupTimedWords(words: WordTimestamp[]): Seg[] {
  const validWords = words
    .map(word => ({ 
      word: String(word.word || '').trim(), 
      start: Math.max(0, Number(word.start)), 
      end: Number(word.end) 
    }))
    .filter(word => word.word && Number.isFinite(word.start) && Number.isFinite(word.end) && word.end > word.start)
    
  const groups: WordTimestamp[][] = []
  let current: WordTimestamp[] = []
  
  for (const word of validWords) {
    const previous = current[current.length - 1]
    const pause = previous ? Math.max(0, word.start - previous.end) : 0
    const length = current.reduce((sum, item) => sum + item.word.length + 1, 0)
    
    if (current.length && (pause >= 0.45 || current.length >= 7 || length + word.word.length > 54)) {
      groups.push(current)
      current = []
    }
    current.push(word)
  }
  if (current.length) groups.push(current)
  
  return groups.map(group => ({
    id: generateSegmentId(),
    text: group.map(word => word.word).join(' '),
    start: group[0].start,
    end: group[group.length - 1].end,
    words: group.map(word => ({ w: word.word, start: word.start, end: word.end })),
  }))
}

export function useVideoTranscribe() {
  const [status, setStatus] = useState<string>('')
  const [progress, setProgress] = useState<number>(0)
  const [busy, setBusy] = useState<boolean>(false)
  const [segments, setSegments] = useState<Seg[]>([])
  
  const stopRef = useRef<boolean>(false)
  const activeRequestRef = useRef<XMLHttpRequest | null>(null)
  const activeLiveTranscriberRef = useRef<VideoLiveTranscriber | null>(null)

  const stop = () => {
    stopRef.current = true
    activeRequestRef.current?.abort()
    activeLiveTranscriberRef.current?.close()
    setBusy(false)
    setStatus('عملیات متوقف شد')
  }

  const run = async (file: File | Blob, language = 'auto') => {
    if (!file) return
    stopRef.current = false
    setBusy(true)
    setSegments([])
    setStatus('در حال استخراج WAV صوت از ویدیو...')
    setProgress(5)
    
    try {
      const fullAudioWav = await extractAudioWav16k(file)
      if (stopRef.current) return
      
      const samples = await readPcm16kMonoWav(fullAudioWav)
      if (samples.length < 8000) throw new Error('از ویدیو صدای قابل پردازش استخراج نشد یا طول صدا کمتر از نیم ثانیه است.')
      setProgress(12)

      const ticketResponse = await fetch('/api/alignment-ticket', { method: 'POST' })
      const ticket = await ticketResponse.json()
      if (!ticketResponse.ok) throw new Error(ticket.error || 'مجوز هم‌ترازی محلی صادر نشد.')
      if (stopRef.current) return

      const chunkSeconds = 60
      const overlapSeconds = 0
      const strideSamples = Math.round((chunkSeconds - overlapSeconds) * 16000)
      const chunkSamples = Math.round(chunkSeconds * 16000)
      const totalChunks = Math.max(1, Math.ceil(Math.max(0, samples.length - chunkSamples) / strideSamples) + 1)
      
      let transcript = ''
      let alignmentLanguage: 'fa' | 'en' = language === 'en' ? 'en' : 'fa'
      const transcriptChunks: { text: string; startSample: number; endSample: number }[] = []
      
      setStatus('در حال اتصال امن به Cloudflare Gemini Live...')

      for (let index = 0, start = 0; start < samples.length; index++, start += strideSamples) {
        if (stopRef.current) return
        const end = Math.min(samples.length, start + chunkSamples)
        
        // ✅ اصلاح حیاتی ۱: حذف undefined و ارسال صریح نام مدل
        const transcriber = new VideoLiveTranscriber(TRANSCRIBE_MODEL, start / 16000, language)
        activeLiveTranscriberRef.current = transcriber
        
        let receivedTranscript = false
        transcriber.onSegment = segment => {
          if (segment.text.trim()) {
            receivedTranscript = true
            setStatus(`دریافت متن از Gemini؛ بخش ${index + 1} از ${totalChunks}`)
          }
        }
        
        await transcriber.connect()
        
        // ✅ اصلاح حیاتی ۲: ارسال ۰.۲ ثانیه صدا در هر بار (به جای ۱ ثانیه)
        // این کار از پر شدن بافر WebSocket جلوگیری می‌کند و سینک را حفظ می‌کند
        const chunkDurationSec = 0.2 
        const pcmSamples = Math.round(chunkDurationSec * 16000) // 3200 samples
        
        setStatus(`ارسال صوت به Gemini Live؛ بخش ${index + 1} از ${totalChunks}`)
        
        for (let cursor = start; cursor < end; cursor += pcmSamples) {
          if (stopRef.current) { transcriber.close(); return }
          
          const pcmEnd = Math.min(end, cursor + pcmSamples)
          const duration = (pcmEnd - cursor) / 16000
          
          const sent = transcriber.sendChunk(pcmChunkToBase64(samples, cursor, pcmEnd), duration)
          if (!sent) throw new Error('ارسال قطعهٔ صوت به Cloudflare Gemini Live ناموفق بود.')
          
          const sessionRatio = (index + (pcmEnd - start) / (end - start)) / totalChunks
          setProgress(12 + Math.round(sessionRatio * 34))
          
          // ✅ تاخیر متناسب با حجم داده ارسال شده (نزدیک به Real-time)
          await new Promise(resolve => window.setTimeout(resolve, 200))
        }
        
        setStatus(`Gemini Live در حال نهایی‌کردن متن بخش ${index + 1}...`)
        await transcriber.finish()
        activeLiveTranscriberRef.current = null
        
        const chunkTranscript = transcriber.getTranscript().trim()
        if (!receivedTranscript && !chunkTranscript) {
          setStatus(`Gemini Live برای بخش ${index + 1} هنوز متنی نفرستاده؛ دریافت پاسخ نهایی را بررسی می‌کنم...`)
        }
        
        if (language === 'auto' && /[\u0600-\u06FF]/.test(chunkTranscript)) alignmentLanguage = 'fa'
        else if (language === 'auto' && /[a-z]/i.test(chunkTranscript)) alignmentLanguage = 'en'
        
        transcript = mergeTranscriptChunk(transcript, chunkTranscript)
        transcriptChunks.push({ text: chunkTranscript, startSample: start, endSample: end })
        setProgress(12 + Math.round(((index + 1) / totalChunks) * 38))
        setStatus(`Gemini: رونویسی صوت، قطعهٔ ${index + 1} از ${totalChunks}`)
      }

      if (stopRef.current) return
      if (!transcript.trim()) throw new Error('Cloudflare Gemini Live متنی برای این صوت برنگرداند. صدای ویدیو را بررسی کنید و دوباره امتحان کنید.')

      setProgress(52)
      setStatus('متن Gemini آماده شد؛ قطعه‌های WAV برای هم‌ترازی محلی پردازش می‌شوند...')
      
      const alignedWords: WordTimestamp[] = []
      const normalizeWord = (word: string) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').toLowerCase()
      
      for (let index = 0; index < transcriptChunks.length; index++) {
        if (stopRef.current) return
        const chunk = transcriptChunks[index]
        if (!chunk.text) continue
        
        const chunkWav = encodePcm16kWav(samples, chunk.startSample, chunk.endSample)
        const alignment = await requestAlignment(
          chunkWav, 
          chunk.text, 
          ticket, 
          alignmentLanguage, 
          ratio => {
            if (!stopRef.current) setProgress(52 + Math.round(((index + ratio) / totalChunks) * 43))
          }, 
          () => {
            if (!stopRef.current) setStatus(`هم‌ترازی محلی قطعهٔ ${index + 1} از ${totalChunks}...`)
          }, 
          request => { activeRequestRef.current = request }
        )
        
        if (stopRef.current) return

        const timeOffset = chunk.startSample / 16000
        for (const localWord of alignment.words || []) {
          const word = { word: localWord.word, start: localWord.start + timeOffset, end: localWord.end + timeOffset }
          const normalized = normalizeWord(word.word)
          
          const duplicate = alignedWords.slice(-14).some(previous =>
            normalizeWord(previous.word) === normalized && Math.abs(previous.start - word.start) < 0.55 && Math.abs(previous.end - word.end) < 0.75
          )
          
          if (normalized && !duplicate) alignedWords.push(word)
        }
      }

      alignedWords.sort((first, second) => first.start - second.start)
      const finalSegments = groupTimedWords(alignedWords)
      
      if (!finalSegments.length) throw new Error('forced alignment نتوانست واژه‌های transcript را روی صوت پیدا کند.')

      setSegments(finalSegments)
      setProgress(100)
      setStatus(`تکمیل شد (${finalSegments.length} بخش؛ متن Gemini و زمان‌بندی محلی با ${alignmentLanguage === 'fa' ? 'مدل فارسی' : 'مدل انگلیسی'})`)
      
    } catch (err: any) {
      console.error('[TRANSCRIBE PIPELINE ERROR]:', err)
      if (!stopRef.current) setStatus('خطا در پردازش ویدیو: ' + (err.message || err))
    } finally {
      activeRequestRef.current = null
      activeLiveTranscriberRef.current = null
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