import { FFmpeg } from '@ffmpeg/ffmpeg'

// جایگزین @ffmpeg/util — بدون وابستگی اضافه
async function toBlobURL(url: string, type: string): Promise<string> {
  const buf = await (await fetch(url)).arrayBuffer()
  return URL.createObjectURL(new Blob([buf], { type }))
}

async function fetchFile(f: File): Promise<Uint8Array> {
  return new Uint8Array(await f.arrayBuffer())
}

let ffmpeg: FFmpeg | null = null

export async function loadFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg

  ffmpeg = new FFmpeg()

  // CDN برای core فایل‌ها
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  })

  return ffmpeg
}

/**
 * استخراج صدا از ویدیو به صورت WAV mono 16kHz
 * خروجی: Blob (audio/wav)
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

  // تبدیل به WAV mono 16kHz (فرمت مورد نیاز Gemini)
  await ff.exec([
    '-i', inputName,
    '-vn',                    // بدون ویدیو
    '-acodec', 'pcm_s16le',   // PCM 16-bit
    '-ar', '16000',           // 16kHz
    '-ac', '1',               // mono
    outputName,
  ])

  const data = await ff.readFile(outputName)

  // پاکسازی
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
