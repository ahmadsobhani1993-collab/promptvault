import { FFmpeg } from '@ffmpeg/ffmpeg'

async function toBlobURL(url: string, type: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch failed: ${url} (${res.status})`)
  const buf = await res.arrayBuffer()
  return URL.createObjectURL(new Blob([buf], { type }))
}

async function fetchFile(f: File | Blob): Promise<Uint8Array> {
  return new Uint8Array(await f.arrayBuffer())
}

const CORE_SOURCES = [
  '/ffmpeg',
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm',
  'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm',
]

let ffmpeg: FFmpeg | null = null
let activeProgressCallback: ((percent: number) => void) | null = null

export async function loadFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg

  let lastErr: unknown = null
  for (const base of CORE_SOURCES) {
    try {
      const ff = new FFmpeg()
      await ff.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
      })
      
      // ثبت لیسنر فقط یک‌بار برای کل طول عمر اینستنس سراسری
      ff.on('progress', ({ progress }) => {
        if (activeProgressCallback) {
          activeProgressCallback(Math.round(progress * 100))
        }
      })

      ffmpeg = ff
      return ffmpeg
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('FFmpeg load failed')
}

/**
 * استخراج صوت بدون نشت لیسنر و با ایمن‌سازی کامل
 */
export async function extractAudioFromVideo(
  videoFile: File | Blob,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const ff = await loadFFmpeg()

  // جایگزینی کالبک جاری بدون افزودن event listener تکراری
  activeProgressCallback = onProgress || null

  const name = (videoFile as File)?.name || 'input.mov'
  const ext = name.match(/\.[^.]+$/)?.[0] || '.mov'
  const inputName = `input_${Date.now()}${ext}`
  const outputName = `output_${Date.now()}.wav`

  try {
    await ff.writeFile(inputName, await fetchFile(videoFile))

    await ff.exec([
      '-i', inputName,
      '-vn',
      '-acodec', 'pcm_s16le',
      '-ar', '16000',
      '-ac', '1',
      outputName,
    ])

    const data = await ff.readFile(outputName)

    await ff.deleteFile(inputName)
    await ff.deleteFile(outputName)

    return new Blob([data], { type: 'audio/wav' })
  } finally {
    activeProgressCallback = null
  }
}

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/') || /\.(mov|mp4|m4v|mkv|webm|avi)$/i.test(file.name)
}
