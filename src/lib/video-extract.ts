import { FFmpeg } from '@ffmpeg/ffmpeg'

async function toBlobURL(url: string, type: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch failed: ${url} (${res.status})`)
  const buf = await res.arrayBuffer()
  return URL.createObjectURL(new Blob([buf], { type }))
}

async function fetchFile(f: File): Promise<Uint8Array> {
  return new Uint8Array(await f.arrayBuffer())
}

// اول self-host (سریع و مطمئن)، بعد CDN ها
const CORE_SOURCES = [
  '/ffmpeg',
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm',
  'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm',
]

let ffmpeg: FFmpeg | null = null

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
      ffmpeg = ff
      console.log('[ffmpeg] loaded from:', base)
      return ffmpeg
    } catch (e) {
      console.warn('[ffmpeg] source failed:', base, e)
      lastErr = e
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('FFmpeg load failed')
}

/**
 * استخراج صدا از ویدیو به صورت WAV mono 16kHz
 */
export async function extractAudioFromVideo(
  videoFile: File,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const ff = await loadFFmpeg()

  if (onProgress) {
    ff.on('progress', ({ progress }) => {
      onProgress(Math.round(progress * 100))
    })
  }

  const inputName = 'input' + (videoFile.name.match(/\.[^.]+$/)?.[0] || '.mp4')
  const outputName = 'output.wav'

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
}

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/')
}

export function isAudioFile(file: File): boolean {
  return file.type.startsWith('audio/')
}
