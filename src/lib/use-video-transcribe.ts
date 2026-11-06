import { useState, useRef } from 'react'
import type { Seg } from './subtitle-studio'
import { encodePcm16kWav, extractAudioWav16k, readPcm16kMonoWav } from './audio'
import { useLocale } from '@/lib/use-locale'
import { L } from '@/lib/l'

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
  const locale = useLocale()
  const isEn = locale === 'en'
  const t = (fa: string, en: string) => L(locale, fa, en)
  const [status, setStatus] = useState<string>('')
  const [progress, setProgress] = useState<number>(0)
  const [busy, setBusy] = useState<boolean>(false)
  const [segments, setSegments] = useState<Seg[]>([])
  
  const stopRef = useRef<boolean>(false)
  const operationIdRef = useRef(0)
  const runQueueRef = useRef<Promise<void>>(Promise.resolve())
  const activeRequestRef = useRef<XMLHttpRequest | null>(null)
  const activeTranscriptionRef = useRef<AbortController | null>(null)

  const stop = () => {
    stopRef.current = true
    operationIdRef.current++
    activeRequestRef.current?.abort()
    activeTranscriptionRef.current?.abort()
    activeRequestRef.current = null
    activeTranscriptionRef.current = null
    setBusy(false)
    setStatus(t('عملیات متوقف شد', 'Operation stopped'))
  }

  const run = async (file: File | Blob, language = 'auto') => {
    if (!file) return
    const operationId = ++operationIdRef.current
    const pipelineId = crypto.randomUUID()
    const isCurrentOperation = () => operationId === operationIdRef.current
    const previousRun = runQueueRef.current
    let releaseRun!: () => void
    runQueueRef.current = new Promise<void>((resolve) => { releaseRun = resolve })
    stopRef.current = false
    setBusy(true)
    setSegments([])
    setStatus(t('در حال استخراج WAV صوت از ویدیو...', 'Extracting audio from video…'))
    setProgress(5)

    await previousRun
    if (!isCurrentOperation()) {
      releaseRun()
      return
    }

    try {
      console.info('[Subtitle Transcription]', JSON.stringify({
        requestId: pipelineId,
        event: 'audio_extraction_start',
        fileBytes: file.size,
        language,
      }))
      const extractionStartedAt = Date.now()
      const fullAudioWav = await extractAudioWav16k(file)
      if (!isCurrentOperation() || stopRef.current) return
      
      const samples = await readPcm16kMonoWav(fullAudioWav)
      if (samples.length < 8000) throw new Error('از ویدیو صدای قابل پردازش استخراج نشد یا طول صدا کمتر از نیم ثانیه است.')
      setProgress(12)
      console.info('[Subtitle Transcription]', JSON.stringify({
        requestId: pipelineId,
        event: 'audio_extraction_complete',
        audioSeconds: Math.round(samples.length / 16) / 1000,
        wavBytes: fullAudioWav.size,
        elapsedMs: Date.now() - extractionStartedAt,
      }))

      const chunkSeconds = 30
      const overlapSeconds = 1
      const strideSamples = Math.round((chunkSeconds - overlapSeconds) * 16000)
      const chunkSamples = Math.round(chunkSeconds * 16000)
      const totalChunks = Math.max(1, Math.ceil(Math.max(0, samples.length - chunkSamples) / strideSamples) + 1)
      
      let transcript = ''
      let alignmentLanguage: 'fa' | 'en' = language === 'en' ? 'en' : 'fa'
      const transcriptChunks: { text: string; startSample: number; endSample: number }[] = []

      for (let index = 0, start = 0; start < samples.length; index++, start += strideSamples) {
        if (!isCurrentOperation() || stopRef.current) return
        const end = Math.min(samples.length, start + chunkSamples)
        const chunkProgressStart = 12 + (index / totalChunks) * 38
        const chunkProgressSpan = 38 / totalChunks
        setStatus(t(
          `در حال رونویسی صوت با مدل تخصصی Gemini، بخش ${index + 1} از ${totalChunks}...`,
          `Transcribing with Gemini's speech model, chunk ${index + 1} of ${totalChunks}…`
        ))
        setProgress(Math.floor(chunkProgressStart))
        const audioChunk = encodePcm16kWav(samples, start, end)
        const formData = new FormData()
        formData.append('audio', audioChunk, `audio-${index + 1}.wav`)
        formData.append('language', language)

        const controller = new AbortController()
        activeTranscriptionRef.current = controller
        const requestId = crypto.randomUUID()
        const requestStartedAt = Date.now()
        console.info('[Subtitle Transcription]', JSON.stringify({
          requestId,
          event: 'chunk_request_start',
          chunk: index + 1,
          chunkCount: totalChunks,
          audioSeconds: Math.round((end - start) / 16) / 1000,
        }))
        const expectedDurationMs = ((end - start) / 16000) * 1000 + 20000
        const progressTimer = window.setInterval(() => {
          if (!isCurrentOperation() || stopRef.current) return
          const elapsed = Math.min(1, (Date.now() - requestStartedAt) / expectedDurationMs)
          setProgress(Math.floor(chunkProgressStart + chunkProgressSpan * Math.min(0.85, elapsed * 0.85)))
        }, 1000)
        let response: Response
        let result: any
        try {
          response = await fetch('/api/transcribe-audio', {
            method: 'POST',
            body: formData,
            headers: { 'x-transcription-request-id': requestId },
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(100000)]),
          })
          result = await response.json()
          console.info('[Subtitle Transcription]', JSON.stringify({
            requestId,
            event: 'chunk_response',
            status: response.status,
            ok: response.ok,
            elapsedMs: Date.now() - requestStartedAt,
            transcriptChars: typeof result.text === 'string' ? result.text.length : 0,
            error: typeof result.error === 'string' ? result.error : undefined,
          }))
        } catch (error) {
          console.error('[Subtitle Transcription]', JSON.stringify({
            requestId,
            event: 'chunk_request_error',
            elapsedMs: Date.now() - requestStartedAt,
            error: error instanceof Error ? error.message : String(error),
          }))
          if (controller.signal.aborted) throw error
          if (error instanceof DOMException && error.name === 'TimeoutError') {
            throw new Error(t('مهلت پاسخ مدل رونویسی تمام شد؛ دوباره تلاش کنید.', 'The transcription model timed out. Please retry.'))
          }
          throw error
        } finally {
          window.clearInterval(progressTimer)
        }
        if (isCurrentOperation()) activeTranscriptionRef.current = null
        if (!response.ok) {
          throw new Error(result.error || `Gemini transcription failed (${response.status})`)
        }
        if (!isCurrentOperation() || stopRef.current) return

        const chunkTranscript = String(result.text || '').trim()
        setProgress(Math.floor(chunkProgressStart + chunkProgressSpan))
        
        if (language === 'auto' && /[\u0600-\u06FF]/.test(chunkTranscript)) alignmentLanguage = 'fa'
        else if (language === 'auto' && /[a-z]/i.test(chunkTranscript)) alignmentLanguage = 'en'
        
        transcript = mergeTranscriptChunk(transcript, chunkTranscript)
        transcriptChunks.push({ text: chunkTranscript, startSample: start, endSample: end })
      }

      if (!isCurrentOperation() || stopRef.current) return
      if (!transcript.trim()) throw new Error('Gemini متنی برای این صوت برنگرداند. صدای ویدیو را بررسی کنید و دوباره امتحان کنید.')

      setProgress(52)
      setStatus(t('متن Gemini آماده شد؛ قطعه‌های WAV برای هم‌ترازی محلی پردازش می‌شوند...', 'Gemini transcript ready; processing WAV chunks for local alignment…'))

      const ticketController = new AbortController()
      const ticketTimeout = window.setTimeout(() => ticketController.abort(), 15000)
      let ticketResponse: Response
      let ticket: any
      const ticketStartedAt = Date.now()
      console.info('[Subtitle Transcription]', JSON.stringify({ requestId: pipelineId, event: 'alignment_ticket_start' }))
      try {
        ticketResponse = await fetch('/api/alignment-ticket', {
          method: 'POST',
          signal: ticketController.signal,
        })
        ticket = await ticketResponse.json()
        console.info('[Subtitle Transcription]', JSON.stringify({
          requestId: pipelineId,
          event: 'alignment_ticket_response',
          status: ticketResponse.status,
          ok: ticketResponse.ok,
          elapsedMs: Date.now() - ticketStartedAt,
          error: typeof ticket.error === 'string' ? ticket.error : undefined,
        }))
      } catch (error) {
        console.error('[Subtitle Transcription]', JSON.stringify({
          requestId: pipelineId,
          event: 'alignment_ticket_error',
          elapsedMs: Date.now() - ticketStartedAt,
          error: error instanceof Error ? error.message : String(error),
        }))
        if (ticketController.signal.aborted) {
          throw new Error(t('دریافت مجوز سرویس هم‌ترازی بیش از ۱۵ ثانیه طول کشید.', 'Getting an alignment service ticket took over 15 seconds.'))
        }
        throw error
      } finally {
        window.clearTimeout(ticketTimeout)
      }
      if (!ticketResponse.ok) throw new Error(ticket.error || 'مجوز هم‌ترازی محلی صادر نشد.')
      if (!isCurrentOperation() || stopRef.current) return
      
      const alignedWords: WordTimestamp[] = []
      const normalizeWord = (word: string) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').toLowerCase()
      
      for (let index = 0; index < transcriptChunks.length; index++) {
        if (!isCurrentOperation() || stopRef.current) return
        const chunk = transcriptChunks[index]
        if (!chunk.text) continue
        
        const chunkWav = encodePcm16kWav(samples, chunk.startSample, chunk.endSample)
        const alignmentStartedAt = Date.now()
        console.info('[Subtitle Transcription]', JSON.stringify({
          requestId: pipelineId,
          event: 'alignment_chunk_start',
          chunk: index + 1,
          chunkCount: totalChunks,
          wavBytes: chunkWav.size,
          transcriptChars: chunk.text.length,
          language: alignmentLanguage,
        }))
        let alignment: AlignmentResult
        try {
          alignment = await requestAlignment(
            chunkWav,
            chunk.text,
            ticket,
            alignmentLanguage,
            ratio => {
              if (isCurrentOperation() && !stopRef.current) setProgress(52 + Math.round(((index + ratio) / totalChunks) * 43))
            },
            () => {
              if (isCurrentOperation() && !stopRef.current) setStatus(t(`هم‌ترازی محلی قطعهٔ ${index + 1} از ${totalChunks}...`, `Locally aligning chunk ${index + 1} of ${totalChunks}…`))
            },
            request => { if (isCurrentOperation()) activeRequestRef.current = request }
          )
          console.info('[Subtitle Transcription]', JSON.stringify({
            requestId: pipelineId,
            event: 'alignment_chunk_complete',
            chunk: index + 1,
            words: alignment.words?.length ?? 0,
            elapsedMs: Date.now() - alignmentStartedAt,
          }))
        } catch (error) {
          console.error('[Subtitle Transcription]', JSON.stringify({
            requestId: pipelineId,
            event: 'alignment_chunk_error',
            chunk: index + 1,
            elapsedMs: Date.now() - alignmentStartedAt,
            error: error instanceof Error ? error.message : String(error),
          }))
          throw error
        }
        
        if (!isCurrentOperation() || stopRef.current) return

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
      setStatus(t(`تکمیل شد (${finalSegments.length} بخش؛ متن Gemini و زمان‌بندی محلی با ${alignmentLanguage === 'fa' ? 'مدل فارسی' : 'مدل انگلیسی'})`, `Complete (${finalSegments.length} captions; Gemini transcript with local ${alignmentLanguage === 'fa' ? 'Persian' : 'English'} alignment)`))
      
    } catch (err: any) {
      console.error('[Subtitle Transcription]', JSON.stringify({
        requestId: pipelineId,
        event: 'pipeline_error',
        error: err instanceof Error ? err.message : String(err),
      }), err)
      if (isCurrentOperation() && !stopRef.current) setStatus(isEn ? 'Video processing failed: please try again or choose another video.' : 'خطا در پردازش ویدیو: ' + (err.message || err))
    } finally {
      releaseRun()
      if (isCurrentOperation()) {
        activeRequestRef.current = null
        activeTranscriptionRef.current = null
        setBusy(false)
      }
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