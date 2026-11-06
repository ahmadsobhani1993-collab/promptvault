import { TAG_VOCAB } from '@/lib/tag-vocabulary'
import type WebSocket from 'ws'

export { TAG_VOCAB } from '@/lib/tag-vocabulary'

export type GeminiResult = {
  titleFa: string; titleEn: string; descFa: string; descEn: string;
  usageFa: string; usageEn: string; categorySlug: string; subSlug: string | null;
  tagsFa: string[]; tagsEn: string[]; promptEn: string; promptFa: string;
}

export type BatchPromptItem = {
  id: number | string;
  rawText: string;
}

export type BatchResultItem = GeminiResult & {
  id: number | string;
  cleanPrompt: string;
}

const cleanTitle = (t: string) => t.replace(/^([\u0600-\u06FF\w]+)\s+\1/, '$1')

const TEXT_MODEL_CHAIN = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.6-flash',
  'gemini-3.8-flash',
] as const

export const MODEL_CHAIN = TEXT_MODEL_CHAIN
export const PDF_OCR_MODEL_CHAIN = TEXT_MODEL_CHAIN
export const CAPTION_MODEL_CHAIN = TEXT_MODEL_CHAIN
export const AI_NEWS_MODEL_CHAIN = TEXT_MODEL_CHAIN

export const AUDIO_TRANSCRIPTION_MODEL_CHAIN = [
  'gemini-3.5-transcribe',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.6-flash',
  'gemini-3.8-flash',
]

let globalKeyIndex = 0

export function getGeminiKeys(): string[] {
  const numberedKeys = Object.entries(process.env)
    .filter(([name, value]) => /^GEMINI_API_KEY_\d+$/.test(name) && Boolean(value?.trim()))
    .sort(([a], [b]) => Number(a.match(/\d+$/)?.[0]) - Number(b.match(/\d+$/)?.[0]))
    .map(([, value]) => value || '')
  const configured = [process.env.GEMINI_API_KEYS, process.env.GEMINI_API_KEY, ...numberedKeys]
  return [...new Set(configured.flatMap((value) => (value || '').split(',').map((key) => key.trim())).filter((key) => key.length > 10))]
}

const GEMINI_LIVE_PROXY_URL =
  process.env.GEMINI_LIVE_PROXY_URL || 'wss://gemini-live-proxy.ahmadsobhani1993.workers.dev/gemini-live'
const TRANSCRIPTION_MODEL = 'gemini-3.5-transcribe-live'

function mergeTranscriptionUpdate(previous: string, update: string): string {
  const current = previous.replace(/\s+/g, ' ').trim()
  const incoming = update.replace(/\s+/g, ' ').trim()
  if (!current) return incoming
  if (!incoming || current.startsWith(incoming)) return current
  if (incoming.startsWith(current)) return incoming

  const currentWords = current.split(' ')
  const incomingWords = incoming.split(' ')
  const normalize = (word: string) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').toLocaleLowerCase()
  const maxOverlap = Math.min(20, currentWords.length, incomingWords.length)
  for (let count = maxOverlap; count > 0; count--) {
    const tail = currentWords.slice(-count).map(normalize).join(' ')
    const head = incomingWords.slice(0, count).map(normalize).join(' ')
    if (tail === head) return [...currentWords, ...incomingWords.slice(count)].join(' ')
  }
  return `${current} ${incoming}`
}

async function transcribeWithKey(
  pcm: Buffer,
  language: 'fa' | 'en' | 'auto',
  apiKey: string | null,
  signal?: AbortSignal,
  requestId?: string,
  connectTimeoutMs = 15000,
  viaProxy = false
): Promise<string> {
  process.env.WS_NO_BUFFER_UTIL = '1'
  const { default: WebSocketClient } = await import('ws')
  const log = (event: string, details: Record<string, string | number | boolean | undefined> = {}) => {
    console.info('[Gemini Transcription]', JSON.stringify({ requestId, event, ...details }))
  }
  const wsUrl = new URL(GEMINI_LIVE_PROXY_URL)
  const socket = new WebSocketClient(wsUrl)
  let transcript = ''
  let setupComplete = false
  let audioEnded = false
  let settled = false
  let sentChunks = 0
  let serverMessages = 0
  let setupTimeout: ReturnType<typeof setTimeout> | undefined
  let responseTimeout: ReturnType<typeof setTimeout> | undefined
  let transcriptQuietTimeout: ReturnType<typeof setTimeout> | undefined

  return new Promise<string>((resolve, reject) => {
    const cleanup = () => {
      if (setupTimeout) clearTimeout(setupTimeout)
      if (responseTimeout) clearTimeout(responseTimeout)
      if (transcriptQuietTimeout) clearTimeout(transcriptQuietTimeout)
      signal?.removeEventListener('abort', onAbort)
      socket.removeAllListeners()
      if (socket.readyState === WebSocketClient.OPEN || socket.readyState === WebSocketClient.CONNECTING) {
        socket.close()
      }
    }
    const finish = () => {
      if (settled) return
      settled = true
      const text = transcript.replace(/\s+/g, ' ').trim()
      log('transcription_complete', { sentChunks, transcriptChars: text.length })
      cleanup()
      resolve(text)
    }
    const fail = (error: Error, event: string) => {
      if (settled) return
      settled = true
      log(event, {
        message: error.message,
        setupComplete,
        sentChunks,
        serverMessages,
        transcriptChars: transcript.length,
      })
      cleanup()
      reject(error)
    }
    const onAbort = () => fail(new Error('Transcription was cancelled.'), 'request_aborted')
    const finishAfterTranscript = () => {
      if (transcriptQuietTimeout) clearTimeout(transcriptQuietTimeout)
      transcriptQuietTimeout = setTimeout(finish, 2500)
    }
    const sendAudio = async () => {
      const bytesPerChunk = 3200
      for (let offset = 0; offset < pcm.length; offset += bytesPerChunk) {
        if (signal?.aborted || settled) return
        if (socket.readyState !== WebSocketClient.OPEN) {
          throw new Error('Gemini WebSocket closed while sending audio.')
        }
        const chunk = pcm.subarray(offset, Math.min(offset + bytesPerChunk, pcm.length))
        socket.send(JSON.stringify({
          realtimeInput: {
            audio: { data: chunk.toString('base64'), mimeType: 'audio/pcm;rate=16000' },
          },
        }))
        sentChunks++
        if (offset + bytesPerChunk < pcm.length) {
          await new Promise((done) => setTimeout(done, Math.ceil(chunk.length / 32)))
        }
      }
      if (settled || socket.readyState !== WebSocketClient.OPEN) return
      audioEnded = true
      socket.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }))
      log('audio_sent', { sentChunks, audioSeconds: Math.round(pcm.length / 320) / 1000 })
      responseTimeout = setTimeout(() => {
        if (transcript) finish()
        else fail(new Error('مدل رونویسی پس از دریافت صوت متنی برنگرداند.'), 'transcript_timeout_empty')
      }, 35000)
      if (transcript) finishAfterTranscript()
    }

    signal?.addEventListener('abort', onAbort, { once: true })
    if (signal?.aborted) {
      onAbort()
      return
    }
    setupTimeout = setTimeout(() => {
      const message = setupComplete
        ? 'Gemini did not return a transcript after receiving audio.'
        : 'Gemini Live connection did not complete setup.'
      fail(new Error(message), 'setup_timeout')
    }, connectTimeoutMs)

    log('connect_start', {
      model: 'gemini-live-proxy',
      route: 'cloudflare_proxy',
      audioBytes: pcm.length,
      audioSeconds: Math.round(pcm.length / 320) / 1000,
    })
    socket.on('open', () => {
      log('websocket_open')
      socket.send(JSON.stringify({
        setup: {
          model: `models/${TRANSCRIPTION_MODEL}`,
          generationConfig: { responseModalities: ['TEXT'] },
          inputAudioTranscription: {
            languageCodes: language === 'fa' ? ['fa-IR'] : language === 'en' ? ['en-US'] : [],
          },
        },
      }))
      log('setup_sent')
    })
    socket.on('message', (data) => {
      serverMessages++
      let message: any
      try {
        message = JSON.parse(data.toString())
      } catch {
        fail(new Error('Gemini returned an invalid WebSocket response.'), 'invalid_response')
        return
      }
      if (message.error) {
        const errorMessage = message.error.message || JSON.stringify(message.error)
        fail(new Error(errorMessage), 'server_error')
        return
      }
      if (message.setupComplete && !setupComplete) {
        setupComplete = true
        if (setupTimeout) clearTimeout(setupTimeout)
        log('setup_complete')
        void sendAudio().catch((error: unknown) => {
          fail(error instanceof Error ? error : new Error(String(error)), 'audio_send_error')
        })
      }

      const text = message.serverContent?.inputTranscription?.text
      if (text?.trim()) {
        transcript = mergeTranscriptionUpdate(transcript, text)
        log('transcript_received', { textChars: text.trim().length, transcriptChars: transcript.length })
        if (audioEnded) finishAfterTranscript()
      }
      if (message.serverContent?.turnComplete && transcript) finish()
    })
    socket.on('error', (error) => fail(error, 'websocket_error'))
    socket.on('close', (code, reason) => {
      if (settled) return
      const closeReason = reason.toString()
      if (transcript) finish()
      else fail(
        new Error(`Gemini WebSocket closed (code ${code})${closeReason ? `: ${closeReason}` : ''}`),
        'websocket_close'
      )
    })
  })
}

function pcm16kMonoToWav(pcm: Buffer): Buffer {
  const wav = Buffer.alloc(44 + pcm.length)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(36 + pcm.length, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(16000, 24)
  wav.writeUInt32LE(32000, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(pcm.length, 40)
  pcm.copy(wav, 44)
  return wav
}

export async function transcribeAudio(
  pcm: Buffer,
  language: 'fa' | 'en' | 'auto',
  signal?: AbortSignal,
  requestId?: string
): Promise<{ text: string; model: string }> {
  const languageHint = language === 'fa'
    ? 'The audio is in Persian (Farsi).'
    : language === 'en'
      ? 'The audio is in English.'
      : 'Detect the spoken language automatically.'
  const instruction = `Transcribe the speech in this audio accurately. ${languageHint}
Return only the transcript, with no labels, commentary, or explanation.`
  const wav = pcm16kMonoToWav(pcm)

  console.info('[Gemini Transcription]', JSON.stringify({
    requestId,
    event: 'cloudflare_cascade_start',
    audioBytes: wav.length,
    audioSeconds: Math.round(pcm.length / 320) / 1000,
    modelCount: AUDIO_TRANSCRIPTION_MODEL_CHAIN.length,
  }))

  const result = await generateText({
    instruction,
    audioBase64: wav.toString('base64'),
    audioMime: 'audio/wav',
    modelChain: AUDIO_TRANSCRIPTION_MODEL_CHAIN,
    timeoutMs: 20000,
    totalTimeoutMs: 85000,
    signal,
  })

  console.info('[Gemini Transcription]', JSON.stringify({
    requestId,
    event: 'cloudflare_cascade_success',
    model: result.model,
    transcriptChars: result.text.length,
  }))
  return result
}

export async function generateText(opts: {
  instruction: string
  imgBase64?: string | null
  imgMime?: string
  audioBase64?: string | null
  audioMime?: string
  expectJson?: boolean
  modelChain?: readonly string[]
  timeoutMs?: number
  totalTimeoutMs?: number
  maxKeyAttempts?: number
  temperature?: number
  responseSchema?: Record<string, unknown>
  imageParts?: { base64: string; mimeType?: string }[]
  signal?: AbortSignal
}): Promise<{ text: string; model: string }> {
  const parts: any[] = [{ text: opts.instruction }]
  if (opts.imgBase64) {
    parts.push({
      inlineData: {
        mimeType: opts.imgMime || 'image/jpeg',
        data: opts.imgBase64.replace(/^data:[^;]+;base64,/, '').trim(),
      },
    })
  }
  if (opts.audioBase64) {
    parts.push({
      inlineData: {
        mimeType: opts.audioMime || 'audio/wav',
        data: opts.audioBase64.replace(/^data:[^;]+;base64,/, '').trim(),
      },
    })
  }
  for (const image of opts.imageParts ?? []) {
    parts.push({
      inlineData: {
        mimeType: image.mimeType || 'image/jpeg',
        data: image.base64.replace(/^data:[^;]+;base64,/, '').trim(),
      },
    })
  }
  const keys = getGeminiKeys()
  if (keys.length === 0) {
    throw new Error('GEMINI_FAILED: کلید API برای جمینای تنظیم نشده است')
  }
  const proxySecret = process.env.GEMINI_PROXY_SECRET?.trim()
  if (!proxySecret) {
    throw new Error(
      'GEMINI_FAILED: Cloudflare authentication is not configured. Set the same GEMINI_PROXY_SECRET on the Arvan app server and Cloudflare Worker.'
    )
  }
  const textProxyUrl = process.env.GEMINI_TEXT_PROXY_URL?.trim()
    || 'https://gemini-live-proxy.ahmadsobhani1993.workers.dev/gemini-generate'
  if (new URL(textProxyUrl).protocol !== 'https:') {
    throw new Error('GEMINI_FAILED: GEMINI_TEXT_PROXY_URL must use HTTPS')
  }

  const errors: string[] = []
  const keyAttempts = Math.min(keys.length, Math.max(1, opts.maxKeyAttempts ?? keys.length))
  const deadline = Date.now() + (opts.totalTimeoutMs ?? 100000)

  for (const model of opts.modelChain ?? MODEL_CHAIN) {
    for (let attempt = 0; attempt < keyAttempts; attempt++) {
      const remainingMs = deadline - Date.now()
      if (remainingMs <= 0) {
        errors.push('Cascade stopped at the total request timeout.')
        break
      }
      const keyIndex = (globalKeyIndex + attempt) % keys.length
      const key = keys[keyIndex]

      try {
        const payload: any = { contents: [{ parts }] }
        if (opts.expectJson || opts.temperature != null || opts.responseSchema) {
          payload.generationConfig = {}
          if (opts.expectJson || opts.responseSchema) payload.generationConfig.responseMimeType = 'application/json'
          if (opts.temperature != null) payload.generationConfig.temperature = opts.temperature
          if (opts.responseSchema) payload.generationConfig.responseSchema = opts.responseSchema
        }

        const res = await fetch(textProxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${proxySecret}`,
          },
          body: JSON.stringify({ model, apiKey: key, payload }),
          signal: opts.signal
            ? AbortSignal.any([opts.signal, AbortSignal.timeout(Math.min(opts.timeoutMs ?? 35000, remainingMs))])
            : AbortSignal.timeout(Math.min(opts.timeoutMs ?? 35000, remainingMs)),
        })

        const bodyText = await res.text()

        if (!res.ok) {
          errors.push(`${model}: HTTP ${res.status} ${bodyText.slice(0, 240)}`)
          if (
            res.status === 401 && /unauthorized/i.test(bodyText) ||
            res.status === 503 && /authorization is not configured/i.test(bodyText) ||
            res.status === 413
          ) {
            throw new Error(`Cloudflare gateway rejected the request: HTTP ${res.status}`)
          }
          continue
        }

        const json = JSON.parse(bodyText)
        const raw: string = (json?.candidates?.[0]?.content?.parts ?? [])
          .map((part: { text?: string }) => part.text || '')
          .join('')

        if (!raw) {
          errors.push(`${model}: Empty content`)
          continue
        }

        globalKeyIndex = (globalKeyIndex + 1) % keys.length
        return { text: raw, model }
      } catch (err: any) {
        if (opts.signal?.aborted) throw err
        if (err?.message?.startsWith('Cloudflare gateway rejected')) throw err
        const isTimeout = err?.name === 'TimeoutError' || String(err).includes('timeout')
        const msg = isTimeout ? `Timeout (>${opts.timeoutMs ?? 35000}ms)` : (err?.message || 'Network error')
        errors.push(`${model}: ${msg}`)
        continue
      }
    }
  }

  const locationUnsupported = /User location is not supported for the API use/i.test(errors.join(' '))
  const locationHint = locationUnsupported
    ? 'Google rejected the request from the Cloudflare Worker location'
    : ''
  throw new Error(`GEMINI_FAILED: ${locationHint ? `${locationHint}; ` : ''}${errors.join(' | ')}`)
}

export async function normalizePrompt(raw: string): Promise<string> {
  if (!raw || !raw.trim()) return raw
  try {
    const { text } = await generateText({
      instruction: 'Clean this prompt. Remove Telegram IDs, URLs, follow us text. Return ONLY the cleaned prompt:\n\n' + raw,
    })
    return text.trim() || raw.replace(/https?:\/\/\S+|@[\w_]+|(t\.me|telegram\.me)\S*/gi, '').trim()
  } catch {
    return raw.replace(/https?:\/\/\S+|@[\w_]+|(t\.me|telegram\.me)\S*/gi, '').trim()
  }
}

type Cat = { slug: string; subs?: { slug: string }[] }

export async function analyzeWithGemini(opts: {
  text: string
  imgBase64?: string | null
  imgMime?: string
  categories: Cat[]
  mode?: 'auto-import' | 'user-submit'
}): Promise<GeminiResult> {
  const isUserSubmit = opts.mode === 'user-submit'
  const catSlugs = opts.categories.map((c) => c.slug).join(', ')
  const vocabFa = TAG_VOCAB.map((t) => t.fa).join('، ')

  const instruction = isUserSubmit
    ? `You are a tagging assistant. Analyze this prompt and return JSON.
CRITICAL RULES:
1. Return JSON containing: titleFa, titleEn, descFa, descEn, usageFa, usageEn, promptEn.
2. ONLY generate 'tagsFa' (2-4 items strictly from: ${vocabFa}) and 'tagsEn'.
3. Choose the best 'categorySlug' (from: ${catSlugs}) and 'subSlug' (or null).
Input: ${opts.text.slice(0, 2000)}`
    : `You are an AI prompt curator. Analyze this prompt and return JSON.
CRITICAL RULES:
1. 'titleFa' MUST start with the word "پرامپت ".
2. Generate catchy 'titleFa'/'titleEn', short 'descFa'/'descEn', and 'usageFa'/'usageEn'.
3. 'promptEn' is the full prompt translated to English.
4. 'tagsFa' (2-4 items from: ${vocabFa}) and 'tagsEn'.
5. Choose 'categorySlug' (from: ${catSlugs}) and 'subSlug' (or null).
Input: ${opts.text.slice(0, 2000)}`

  const { text: raw } = await generateText({
    instruction,
    imgBase64: opts.imgBase64,
    imgMime: opts.imgMime,
    expectJson: true,
  })

  let parsed: any = {}
  try {
    const cleanedJson = raw.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim()
    const m = cleanedJson.match(/\{[\s\S]*\}/)
    parsed = m ? JSON.parse(m[0]) : JSON.parse(cleanedJson)
  } catch {
    parsed = {}
  }

  if (!isUserSubmit) {
    const baseTitle = String(parsed.titleFa || 'هوش مصنوعی').trim()
    parsed.titleFa = baseTitle.startsWith('پرامپت') ? baseTitle : `پرامپت ${baseTitle}`
  }

  const catOk = opts.categories.find((c) => c.slug === parsed.categorySlug)
  const categorySlug = catOk ? parsed.categorySlug : opts.categories[0]?.slug ?? 'image'

  const chosenCat = opts.categories.find((c) => c.slug === categorySlug)
  let subSlug: string | null = null
  if (parsed.subSlug && chosenCat && chosenCat.subs?.some((s) => s.slug === parsed.subSlug)) {
    subSlug = parsed.subSlug
  }

  const rawTags = Array.isArray(parsed.tagsFa) ? parsed.tagsFa : String(parsed.tagsFa ?? '').split(/[،,]/)
  const tagsFa: string[] = rawTags.map((t: any) => String(t).trim()).filter(Boolean).slice(0, 4)
  const tagsEn: string[] = tagsFa.map((fa) => {
    const v = TAG_VOCAB.find((t) => t.fa === fa)
    return v ? v.en : fa
  })

  return {
    titleFa: cleanTitle(String(parsed.titleFa || 'پرامپت هوش مصنوعی')),
    titleEn: cleanTitle(String(parsed.titleEn || 'AI Prompt')),
    descFa: String(parsed.descFa || ''),
    descEn: String(parsed.descEn || ''),
    usageFa: String(parsed.usageFa || ''),
    usageEn: String(parsed.usageEn || ''),
    categorySlug,
    subSlug,
    tagsFa,
    tagsEn,
    promptEn: String(parsed.promptEn || opts.text),
    promptFa: String(opts.text || parsed.promptEn || ''),
  }
}

// تابع اختصاصی و جدید برای Batching: دریافت تا ۱۰ پرامپت و پردازش در ۱ ریکوئست
export async function analyzeBatchWithGemini(opts: {
  items: BatchPromptItem[]
  categories: Cat[]
}): Promise<BatchResultItem[]> {
  if (!opts.items || opts.items.length === 0) return []

  const catSlugs = opts.categories.map((c) => c.slug).join(', ')
  const vocabFa = TAG_VOCAB.map((t) => t.fa).join('، ')

  const promptPayload = opts.items.map((it) => ({
    id: it.id,
    rawText: it.rawText.slice(0, 2000),
  }))

  const instruction = `You are an expert AI prompt curator and cleaner.
Process each item in the input array. For EACH item, you must:
1. 'cleanPrompt': Clean rawText by removing all Telegram links (@channel, t.me), URLs, advertisements, and emojis overload. Keep the core prompt completely intact.
2. 'titleFa': Catchy Persian title, MUST start with the word "پرامپت ".
3. 'titleEn': Catchy English title.
4. 'descFa' & 'descEn': Short description (1 sentence).
5. 'usageFa' & 'usageEn': Brief use-case guide.
6. 'promptEn': Full prompt translated to English (or preserved if already English).
7. 'tagsFa': 2-4 items strictly chosen from: [${vocabFa}].
8. 'tagsEn': English counterparts of tagsFa.
9. 'categorySlug': Best category from: [${catSlugs}].
10. 'subSlug': Matching sub-category or null.

Return ONLY a valid JSON ARRAY of objects with the exact key 'items':
{
  "items": [
    {
      "id": ...,
      "cleanPrompt": "...",
      "titleFa": "پرامپت ...",
      "titleEn": "...",
      "descFa": "...",
      "descEn": "...",
      "usageFa": "...",
      "usageEn": "...",
      "promptEn": "...",
      "tagsFa": ["..."],
      "tagsEn": ["..."],
      "categorySlug": "...",
      "subSlug": null
    }
  ]
}

Input items:
${JSON.stringify(promptPayload, null, 2)}`

  const { text: raw } = await generateText({
    instruction,
    expectJson: true,
  })

  let parsedItems: any[] = []
  try {
    const cleanedJson = raw.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim()
    const m = cleanedJson.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
    const jsonParsed = JSON.parse(m ? m[0] : cleanedJson)
    parsedItems = Array.isArray(jsonParsed) ? jsonParsed : (jsonParsed.items || [])
  } catch (err) {
    parsedItems = []
  }

  return opts.items.map((original) => {
    const found = parsedItems.find((p) => String(p.id) === String(original.id)) || {}
    const baseTitle = String(found.titleFa || 'هوش مصنوعی').trim()
    const titleFa = baseTitle.startsWith('پرامپت') ? baseTitle : `پرامپت ${baseTitle}`

    const catOk = opts.categories.find((c) => c.slug === found.categorySlug)
    const categorySlug = catOk ? found.categorySlug : opts.categories[0]?.slug ?? 'image'
    const chosenCat = opts.categories.find((c) => c.slug === categorySlug)
    let subSlug: string | null = null
    if (found.subSlug && chosenCat && chosenCat.subs?.some((s) => s.slug === found.subSlug)) {
      subSlug = found.subSlug
    }

    const rawTags = Array.isArray(found.tagsFa) ? found.tagsFa : String(found.tagsFa ?? '').split(/[،,]/)
    const tagsFa: string[] = rawTags.map((t: any) => String(t).trim()).filter(Boolean).slice(0, 4)
    const tagsEn: string[] = tagsFa.map((fa) => {
      const v = TAG_VOCAB.find((t) => t.fa === fa)
      return v ? v.en : fa
    })

    const cleanPrompt = String(found.cleanPrompt || original.rawText.replace(/https?:\/\/\S+|@[\w_]+|(t\.me|telegram\.me)\S*/gi, '').trim())

    return {
      id: original.id,
      cleanPrompt,
      titleFa: cleanTitle(titleFa),
      titleEn: cleanTitle(String(found.titleEn || 'AI Prompt')),
      descFa: String(found.descFa || ''),
      descEn: String(found.descEn || ''),
      usageFa: String(found.usageFa || ''),
      usageEn: String(found.usageEn || ''),
      categorySlug,
      subSlug,
      tagsFa,
      tagsEn,
      promptEn: String(found.promptEn || cleanPrompt),
      promptFa: cleanPrompt,
    }
  })
}