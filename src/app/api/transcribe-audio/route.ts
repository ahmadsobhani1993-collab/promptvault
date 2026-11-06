import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { transcribeAudio } from '@/lib/gemini'

export const runtime = 'nodejs'
export const maxDuration = 110

const MAX_AUDIO_BYTES = 5 * 1024 * 1024
const MAX_PCM_BYTES = 16000 * 2 * 60
function extractPcm16kMono(wav: Buffer): Buffer {
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('فایل صوتی WAV معتبر نیست.')
  }

  let offset = 12
  let isPcm16kMono = false
  let pcm: Buffer | null = null
  while (offset + 8 <= wav.length) {
    const chunkId = wav.toString('ascii', offset, offset + 4)
    const chunkSize = wav.readUInt32LE(offset + 4)
    const chunkStart = offset + 8
    const chunkEnd = chunkStart + chunkSize
    if (chunkEnd > wav.length) throw new Error('ساختار فایل WAV ناقص است.')

    if (chunkId === 'fmt ' && chunkSize >= 16) {
      isPcm16kMono =
        wav.readUInt16LE(chunkStart) === 1 &&
        wav.readUInt16LE(chunkStart + 2) === 1 &&
        wav.readUInt32LE(chunkStart + 4) === 16000 &&
        wav.readUInt16LE(chunkStart + 14) === 16
    } else if (chunkId === 'data') {
      pcm = wav.subarray(chunkStart, chunkEnd)
    }
    offset = chunkEnd + (chunkSize % 2)
  }

  if (!isPcm16kMono || !pcm?.length) {
    throw new Error('فایل باید WAV تک‌کانالهٔ PCM با نرخ ۱۶ کیلوهرتز باشد.')
  }
  return pcm
}

export async function POST(request: Request) {
  const requestId = request.headers.get('x-transcription-request-id')?.slice(0, 80) || crypto.randomUUID()
  const startedAt = Date.now()
  try {
    console.info('[Audio Transcription API]', JSON.stringify({ requestId, event: 'request_received' }))
    const session = await auth()
    if (!session?.user?.id) {
      console.warn('[Audio Transcription API]', JSON.stringify({ requestId, event: 'unauthorized' }))
      return NextResponse.json({ error: 'برای رونویسی ابتدا وارد حساب کاربری شوید.' }, { status: 401 })
    }

    const formData = await request.formData()
    const audio = formData.get('audio')
    const language = formData.get('language')

    if (!(audio instanceof File) || audio.type !== 'audio/wav' || audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
      console.warn('[Audio Transcription API]', JSON.stringify({ requestId, event: 'invalid_audio', size: audio instanceof File ? audio.size : 0 }))
      return NextResponse.json({ error: 'قطعهٔ صوتی نامعتبر است یا از حد مجاز بزرگ‌تر است.' }, { status: 400 })
    }
    if (language !== 'fa' && language !== 'en' && language !== 'auto') {
      console.warn('[Audio Transcription API]', JSON.stringify({ requestId, event: 'invalid_language' }))
      return NextResponse.json({ error: 'زبان گفتار معتبر نیست.' }, { status: 400 })
    }

    const wav = Buffer.from(await audio.arrayBuffer())
    const pcm = extractPcm16kMono(wav)
    if (pcm.length > MAX_PCM_BYTES) {
      return NextResponse.json({ error: 'هر قطعهٔ صوتی باید حداکثر ۶۰ ثانیه باشد.' }, { status: 400 })
    }
    console.info('[Audio Transcription API]', JSON.stringify({
      requestId,
      event: 'audio_validated',
      wavBytes: wav.length,
      pcmBytes: pcm.length,
      audioSeconds: Math.round(pcm.length / 320) / 1000,
      language,
    }))
    const { text, model } = await transcribeAudio(pcm, language, request.signal, requestId)

    console.info('[Audio Transcription API]', JSON.stringify({ requestId, event: 'request_success', model, transcriptChars: text.length, elapsedMs: Date.now() - startedAt }))
    return NextResponse.json({ text: text.trim(), model })
  } catch (error) {
    console.error('[Audio Transcription API]', JSON.stringify({
      requestId,
      event: 'request_failed',
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    }))
    const message = error instanceof Error ? error.message : 'رونویسی صوت انجام نشد.'
    return NextResponse.json({ error: message, requestId }, { status: 502 })
  }
}
