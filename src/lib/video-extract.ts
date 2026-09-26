import { FFmpeg } from '@ffmpeg/ffmpeg'

async function toBlobURL(url: string, mimeType: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fetch failed: ${url} (status: ${res.status})`)
  const buf = await res.arrayBuffer()
  return URL.createObjectURL(new Blob([buf], { type: mimeType }))
}

async function fetchFile(f: File | Blob): Promise<Uint8Array> {
  return new Uint8Array(await f.arrayBuffer())
}

let ffmpeg: FFmpeg | null = null
let activeProgressCallback: ((percent: number) => void) | null = null

export async function loadFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  // اولویت مطلق با فایل‌های سلف‌هاست روی سرور خودتان در پوشه public/ffmpeg
  const CORE_SOURCES = [
    `${origin}/ffmpeg`,
    'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm',
    'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm',
  ]

  let lastErr: unknown = null

  for (const base of CORE_SOURCES) {
    try {
      const ff = new FFmpeg()

      // استفاده از application/javascript برای سازگاری کامل لودر با import.meta
      const coreBlob = await toBlobURL(`${base}/ffmpeg-core.js`, 'application/javascript')
      const wasmBlob = await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm')

      await ff.load({
        coreURL: coreBlob,
        wasmURL: wasmBlob,
      })

      // ثبت لیسنر درصد پیشرفت به صورت سراسری و بدون نشت حافظه
      ff.on('progress', ({ progress }) => {
        if (activeProgressCallback) {
          activeProgressCallback(Math.round(progress * 100))
        }
      })

      ffmpeg = ff
      return ffmpeg
    } catch (e) {
      console.warn(`[FFmpeg] تلاش برای لود از مسیر ${base} ناموفق بود:`, e)
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

    await ff.deleteFile(inputName).catch(() => {})
    await ff.deleteFile(outputName).catch(() => {})

    return new Blob([data], { type: 'audio/wav' })
  } finally {
    activeProgressCallback = null
  }
}

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/') || /\.(mov|mp4|m4v|mkv|webm|avi)$/i.test(file.name)
}
