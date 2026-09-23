export const MAX_AUDIO_MB = 20

let cachedFFmpeg: any = null

async function getFFmpegForAudio(): Promise<any> {
  if (cachedFFmpeg && cachedFFmpeg.loaded) return cachedFFmpeg

  const { FFmpeg } = await import('@ffmpeg/ffmpeg')
  const { toBlobURL } = await import('@ffmpeg/util')

  const ffmpeg = new FFmpeg()
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
  const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript')
  const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
  await ffmpeg.load({ coreURL, wasmURL })

  cachedFFmpeg = ffmpeg
  return ffmpeg
}

// هر فایل ورودی (mp4, mov, mkv, ...) را به یک WAV تک‌کاناله‌ی ۱۶کیلوهرتز تبدیل می‌کند.
// چرا این لایه لازم است: decodeAudioData در سافاری با کدک/کانتینر بعضی فایل‌های mov
// ضبط‌شده با آیفون مشکل دارد و «Decoding failed» می‌دهد؛ ولی یک WAV ساده همیشه و در همه‌ی
// مرورگرها بدون مشکل دیکود می‌شود. ffmpeg همین الان در پروژه برای export ویدیو استفاده
// می‌شود، همان را این‌جا هم به کار می‌گیریم تا مستقل از کدک اصلی صوت، خروجی یکسان بگیریم.
async function extractCleanWav(file: Blob): Promise<ArrayBuffer> {
  const ffmpeg = await getFFmpegForAudio()
  const inName = 'audio_src_input'
  const outName = 'audio_clean_16k.wav'

  await ffmpeg.writeFile(inName, new Uint8Array(await file.arrayBuffer()))
  await ffmpeg.exec(['-i', inName, '-vn', '-ac', '1', '-ar', '16000', '-f', 'wav', outName])
  const data = (await ffmpeg.readFile(outName)) as Uint8Array

  await ffmpeg.deleteFile(inName).catch(() => {})
  await ffmpeg.deleteFile(outName).catch(() => {})

  // یک کپی واقعی از بافر برمی‌گردانیم تا به حافظه‌ی داخلی ffmpeg.wasm وابسته نماند
  return data.slice().buffer
}

export async function decodeToPcm16k(file: Blob): Promise<AudioBuffer> {
  const wavBuffer = await extractCleanWav(file)

  const Ctx = window.AudioContext || (window as any).webkitAudioContext
  const tmp = new Ctx()
  const decoded = await tmp.decodeAudioData(wavBuffer)
  await tmp.close()

  const rate = 16000
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate)
  const src = offline.createBufferSource()
  src.buffer = decoded
  src.connect(offline.destination)
  src.start()
  return offline.startRendering()
}

export function bufferToBase64Chunks(
  buf: AudioBuffer,
  chunkSec = 1
): { data: string; seconds: number }[] {
  const samples = buf.getChannelData(0)
  const rate = buf.sampleRate
  const chunkLen = Math.floor(rate * chunkSec)
  const out: { data: string; seconds: number }[] = []

  for (let i = 0; i < samples.length; i += chunkLen) {
    const slice = samples.subarray(i, Math.min(i + chunkLen, samples.length))
    const pcm16 = new Int16Array(slice.length)
    for (let j = 0; j < slice.length; j++) {
      pcm16[j] = Math.max(-32768, Math.min(32767, Math.round(slice[j] * 32767)))
    }

    // بایت‌های خالص خام PCM بدون هیچ‌گونه هدر WAV
    const pcmBytes = new Uint8Array(pcm16.buffer)
    let binary = ''
    for (let k = 0; k < pcmBytes.length; k += 0x8000) {
      binary += String.fromCharCode(...pcmBytes.subarray(k, k + 0x8000))
    }
    out.push({ data: btoa(binary), seconds: slice.length / rate })
  }
  return out
}
