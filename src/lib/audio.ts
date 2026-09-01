export const MAX_AUDIO_MB = 20

// دیکود هر فایل صوتی به PCM 16kHz mono (بدون FFmpeg)
export async function decodeToPcm16k(file: Blob): Promise<AudioBuffer> {
  const arr = await file.arrayBuffer()
  const Ctx = window.AudioContext || (window as any).webkitAudioContext
  const tmp = new Ctx()
  const decoded = await tmp.decodeAudioData(arr)
  await tmp.close()

  const rate = 16000
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate)
  const src = offline.createBufferSource()
  src.buffer = decoded
  src.connect(offline.destination)
  src.start()
  return offline.startRendering()
}

// تبدیل به chunk های ۱ ثانیه‌ای base64 (PCM16)
export function bufferToBase64Chunks(
  buf: AudioBuffer,
  chunkSec = 1
): { data: string; seconds: number }[] {
  const samples = buf.getChannelData(0)
  const rate = buf.sampleRate
  const chunkLen = rate * chunkSec
  const out: { data: string; seconds: number }[] = []

  for (let i = 0; i < samples.length; i += chunkLen) {
    const slice = samples.subarray(i, Math.min(i + chunkLen, samples.length))
    const pcm16 = new Int16Array(slice.length)
    for (let j = 0; j < slice.length; j++) {
      pcm16[j] = Math.max(-32768, Math.min(32767, Math.round(slice[j] * 32767)))
    }

    let binary = ''
    const bytes = new Uint8Array(pcm16.buffer)
    for (let k = 0; k < bytes.length; k += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(k, k + 0x8000))
    }
    out.push({ data: btoa(binary), seconds: slice.length / rate })
  }
  return out
}
