export const MAX_AUDIO_MB = 20

import { loadFFmpeg } from './video-extract'

// هر فایل ورودی (mp4, mov, mkv, ...) را به یک WAV تک‌کاناله‌ی ۱۶کیلوهرتز تبدیل می‌کند.
// چرا این لایه لازم است: decodeAudioData در سافاری با کدک/کانتینر بعضی فایل‌های mov
// ضبط‌شده با آیفون مشکل دارد و «Decoding failed» می‌دهد؛ ولی یک WAV ساده همیشه و در همه‌ی
// مرورگرها بدون مشکل دیکود می‌شود. ffmpeg همین الان در پروژه برای export ویدیو استفاده
// می‌شود، همان را این‌جا هم به کار می‌گیریم تا مستقل از کدک اصلی صوت، خروجی یکسان بگیریم.
export async function extractAudioWav16k(file: Blob): Promise<Blob> {
  const ffmpeg = await loadFFmpeg()
  const suffix = typeof File !== 'undefined' && file instanceof File ? file.name.match(/\.[^.]+$/)?.[0] : null
  const inName = `audio_src_${Date.now()}${suffix || '.media'}`
  const outName = `audio_clean_16k_${Date.now()}.wav`

  try {
    await ffmpeg.writeFile(inName, new Uint8Array(await file.arrayBuffer()))
    await ffmpeg.exec(['-i', inName, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', '-f', 'wav', outName])
    const data = (await ffmpeg.readFile(outName)) as Uint8Array
    return new Blob([data.slice().buffer], { type: 'audio/wav' })
  } finally {
    await ffmpeg.deleteFile(inName).catch(() => {})
    await ffmpeg.deleteFile(outName).catch(() => {})
  }
}

async function extractCleanWav(file: Blob): Promise<ArrayBuffer> {
  const wavBlob = await extractAudioWav16k(file)

  // یک کپی مستقل برمی‌گردانیم تا decodeAudioData به backing buffer مشترک وابسته نباشد.
  return wavBlob.arrayBuffer()
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

export async function readPcm16kMonoWav(wavBlob: Blob): Promise<Int16Array> {
  const buffer = await wavBlob.arrayBuffer()
  const view = new DataView(buffer)
  if (view.getUint32(0, false) !== 0x52494646 || view.getUint32(8, false) !== 0x57415645) throw new Error('فایل صوت استخراج‌شده WAV معتبر نیست.')
  if (view.getUint16(20, true) !== 1 || view.getUint16(22, true) !== 1 || view.getUint32(24, true) !== 16000 || view.getUint16(34, true) !== 16) {
    throw new Error('فرمت WAV باید PCM تک‌کانالهٔ 16kHz باشد.')
  }
  let offset = 12
  let dataOffset = -1
  let dataLength = 0
  while (offset + 8 <= view.byteLength) {
    const id = String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3))
    const length = view.getUint32(offset + 4, true)
    if (id === 'data') { dataOffset = offset + 8; dataLength = length; break }
    offset += 8 + length + (length % 2)
  }
  if (dataOffset < 0 || dataLength % 2 !== 0 || dataOffset + dataLength > view.byteLength) throw new Error('بخش PCM در WAV پیدا نشد.')
  return new Int16Array(buffer.slice(dataOffset, dataOffset + dataLength))
}

export function encodePcm16kWav(samples: Float32Array | Int16Array, startSample = 0, endSample = samples.length): Blob {
  const start = Math.max(0, Math.min(samples.length, Math.floor(startSample)))
  const end = Math.max(start, Math.min(samples.length, Math.floor(endSample)))
  const pcm = new Int16Array(end - start)
  if (samples instanceof Int16Array) pcm.set(samples.subarray(start, end))
  else for (let i = start; i < end; i++) pcm[i - start] = Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767)))

  const buffer = new ArrayBuffer(44 + pcm.byteLength)
  const view = new DataView(buffer)
  const writeString = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)) }
  writeString(0, 'RIFF'); view.setUint32(4, 36 + pcm.byteLength, true); writeString(8, 'WAVE')
  writeString(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true)
  view.setUint16(22, 1, true); view.setUint32(24, 16000, true); view.setUint32(28, 32000, true)
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); writeString(36, 'data')
  view.setUint32(40, pcm.byteLength, true)
  new Uint8Array(buffer, 44).set(new Uint8Array(pcm.buffer))
  return new Blob([buffer], { type: 'audio/wav' })
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
