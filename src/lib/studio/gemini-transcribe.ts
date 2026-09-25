import { CaptionSegment } from './types'

// استخراج صدای ویدیو بدون آپلود تصویر در کلاینت
export async function extractAudioFromVideo(videoFile: File): Promise<Blob> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  const arrayBuffer = await videoFile.arrayBuffer()
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

  // انکود ساده به WAV مونو با ریت 16000 مناسب هوش مصنوعی
  const offlineCtx = new OfflineAudioContext(1, audioBuffer.duration * 16000, 16000)
  const source = offlineCtx.createBufferSource()
  source.buffer = audioBuffer
  source.connect(offlineCtx.destination)
  source.start()

  const renderedBuffer = await offlineCtx.startRendering()
  const wavBlob = audioBufferToWav(renderedBuffer)
  return wavBlob
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = 1
  const sampleRate = buffer.sampleRate
  const format = 1 // PCM
  const bitDepth = 16

  const rawData = buffer.getChannelData(0)
  const dataLength = rawData.length * (bitDepth / 8)
  const headerLength = 44
  const totalLength = headerLength + dataLength

  const out = new DataView(new ArrayBuffer(totalLength))

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      out.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  out.setUint32(4, 36 + dataLength, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  out.setUint32(16, 16, true)
  out.setUint16(20, format, true)
  out.setUint16(22, numChannels, true)
  out.setUint32(24, sampleRate, true)
  out.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true)
  out.setUint16(32, numChannels * (bitDepth / 8), true)
  out.setUint16(34, bitDepth, true)
  writeString(36, 'data')
  out.setUint32(40, dataLength, true)

  let offset = 44
  for (let i = 0; i < rawData.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, rawData[i]))
    out.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }

  return new Blob([out.buffer], { type: 'audio/wav' })
}

export async function transcribeAudioWithGemini(audioBlob: Blob): Promise<CaptionSegment[]> {
  const formData = new FormData()
  formData.append('audio', audioBlob, 'audio.wav')

  const res = await fetch('/api/transcribe', {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    throw new Error('خطا در دریافت پاسخ از جمینای')
  }

  const data = await res.json()
  return data.segments || []
}
