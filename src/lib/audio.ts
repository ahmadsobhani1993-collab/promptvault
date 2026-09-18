export const MAX_AUDIO_MB = 20

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

function writeWavHeader(dataLength: number, sampleRate = 16000, numChannels = 1, bitsPerSample = 16): Uint8Array {
  const header = new ArrayBuffer(44)
  const view = new DataView(header)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true)
  view.setUint16(32, numChannels * (bitsPerSample / 8), true)
  view.setUint16(34, bitsPerSample, true)
  writeString(36, 'data')
  view.setUint32(40, dataLength, true)

  return new Uint8Array(header)
}

export function bufferToBase64Chunks(
  buf: AudioBuffer,
  chunkSec = 30
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

    const pcmBytes = new Uint8Array(pcm16.buffer)
    const header = writeWavHeader(pcmBytes.length, rate, 1, 16)
    const wavBytes = new Uint8Array(header.length + pcmBytes.length)
    wavBytes.set(header, 0)
    wavBytes.set(pcmBytes, header.length)

    let binary = ''
    for (let k = 0; k < wavBytes.length; k += 0x8000) {
      binary += String.fromCharCode(...wavBytes.subarray(k, k + 0x8000))
    }
    out.push({ data: btoa(binary), seconds: slice.length / rate })
  }
  return out
}
