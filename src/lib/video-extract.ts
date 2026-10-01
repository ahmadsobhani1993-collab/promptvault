import { FFmpeg } from '@ffmpeg/ffmpeg'

async function fetchFile(f: File | Blob): Promise<Uint8Array> {
  return new Uint8Array(await f.arrayBuffer())
}

let ffmpeg: FFmpeg | null = null
let activeProgressCallback: ((percent: number) => void) | null = null

export function setFFmpegProgressCallback(callback: ((percent: number) => void) | null): void {
  activeProgressCallback = callback
}

export async function loadFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  
  let lastErr: unknown = null
  try {
    const ff = new FFmpeg()
    const base = `${origin}/api/ffmpeg`
    await ff.load({
      classWorkerURL: `${base}/worker.js`,
      coreURL: `${base}/ffmpeg-core.js`,
      wasmURL: `${base}/ffmpeg-core.wasm`,
    })

    ff.on('progress', ({ progress }) => {
      if (activeProgressCallback) activeProgressCallback(Math.round(progress * 100))
    })

    ffmpeg = ff
    console.log('[FFmpeg] ✅ با موفقیت از مسیر ESM هم‌مبدأ لود شد.')
    return ffmpeg
  } catch (e) {
    console.warn('[FFmpeg] Same-origin ESM load failed:', e)
    lastErr = e
  }

  throw new Error(`FFmpeg load failed: ${lastErr instanceof Error ? lastErr.message : 'unknown error'}`)
}

export async function extractAudioFromVideo(
  videoFile: File | Blob,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const ff = await loadFFmpeg()
  activeProgressCallback = onProgress || null

  const name = (videoFile as File)?.name || 'input.mov'
  const ext = name.match(/\.[^.]+$/)?.[0] || '.mov'
  const inputName = `input_${Date.now()}${ext}`
  const outputName = `output_${Date.now()}.wav`

  try {
    await ff.writeFile(inputName, await fetchFile(videoFile))
    await ff.exec(['-i', inputName, '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', outputName])
    const data = await ff.readFile(outputName)
    
    const blobPart = data instanceof Uint8Array ? (data.slice().buffer as ArrayBuffer) : data
    return new Blob([blobPart], { type: 'audio/wav' })
  } catch (error) {
    console.error('[FFmpeg] Audio extraction failed:', error)
    throw new Error('استخراج صدا با شکست مواجه شد.')
  } finally {
    await ff.deleteFile(inputName).catch(() => {})
    await ff.deleteFile(outputName).catch(() => {})
    activeProgressCallback = null
  }
}

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/') || /\.(mov|mp4|m4v|mkv|webm|avi)$/i.test(file.name)
}