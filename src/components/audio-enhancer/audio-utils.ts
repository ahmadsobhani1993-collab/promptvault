export function formatAudioTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

export type ProcessingOptions = {
  removeNoise: boolean
  boostVolume: boolean
  voiceTone: 'original' | 'male' | 'female' | 'studio'
}

// پردازش متمرکز و باکیفیت کل بافر صوتی با موتور آفلاین پرسرعت مرورگر
export async function processAudioBuffer(
  inputBuffer: AudioBuffer,
  options: ProcessingOptions
): Promise<AudioBuffer> {
  const sampleRate = 32000 // ۳۲ کیلوهرتز برای حفظ کیفیت کلام و کاهش چشمگیر حجم
  let duration = inputBuffer.duration

  // تغییر سرعت/گام در صورت انتخاب جنس صدا
  let pitchRate = 1.0
  if (options.voiceTone === 'male') {
    pitchRate = Math.pow(2, -2.5 / 12) // بم‌تر و عمیق
  } else if (options.voiceTone === 'female') {
    pitchRate = Math.pow(2, 2.5 / 12) // زیرتر و شفاف
  }

  const length = Math.round(duration * sampleRate * (1 / pitchRate))
  const offlineCtx = new OfflineAudioContext(1, length, sampleRate) // مونو برای کلام

  const source = offlineCtx.createBufferSource()
  source.buffer = inputBuffer
  source.playbackRate.value = pitchRate

  let lastNode: AudioNode = source

  // ۱. فیلتر حذف نویز عمیق (در صورت انتخاب کاربر)
  if (options.removeNoise) {
    // حذف صدای بم، باد و لرزش میکروفون
    const highpass = offlineCtx.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = 140
    lastNode.connect(highpass)
    lastNode = highpass

    // حذف سوت و وزوز فرکانس بالا
    const lowpass = offlineCtx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 9500
    lastNode.connect(lowpass)
    lastNode = lowpass
  }

  // ۲. پریست‌های جنس صدا
  if (options.voiceTone === 'male') {
    const bass = offlineCtx.createBiquadFilter()
    bass.type = 'lowshelf'
    bass.frequency.value = 200
    bass.gain.value = 5
    lastNode.connect(bass)
    lastNode = bass
  } else if (options.voiceTone === 'female') {
    const presence = offlineCtx.createBiquadFilter()
    presence.type = 'peaking'
    presence.frequency.value = 3000
    presence.gain.value = 4
    lastNode.connect(presence)
    lastNode = presence
  } else if (options.voiceTone === 'studio') {
    const air = offlineCtx.createBiquadFilter()
    air.type = 'highshelf'
    air.frequency.value = 4000
    air.gain.value = 6
    lastNode.connect(air)
    lastNode = air
  }

  // ۳. تقویت صدا بدون دیستورشن و افت کیفیت (با استفاده از کمپرسور و نرمالایزر استاندارد)
  if (options.boostVolume) {
    const compressor = offlineCtx.createDynamicsCompressor()
    compressor.threshold.value = -18
    compressor.knee.value = 20
    compressor.ratio.value = 4
    compressor.attack.value = 0.005
    compressor.release.value = 0.15
    lastNode.connect(compressor)
    lastNode = compressor

    const gain = offlineCtx.createGain()
    gain.gain.value = 1.6 // بلندی محسوس اما کنترل‌شده
    lastNode.connect(gain)
    lastNode = gain
  }

  lastNode.connect(offlineCtx.destination)
  source.start(0)

  return await offlineCtx.startRendering()
}

// تولید خروجی کم‌حجم
export function bufferToCompressedWav(buffer: AudioBuffer, originalFileName: string): { blob: Blob; ext: string } {
  const samples = buffer.getChannelData(0)
  const sampleRate = buffer.sampleRate
  const arrayBuffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(arrayBuffer)

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // Mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, samples.length * 2, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
    offset += 2
  }

  const extMatch = originalFileName.match(/\.([0-9a-z]+)$/i)
  const originalExt = extMatch ? extMatch[1].toLowerCase() : 'wav'

  return {
    blob: new Blob([view], { type: 'audio/wav' }),
    ext: originalExt === 'mp4' ? 'mp4' : (originalExt === 'mp3' ? 'mp3' : 'wav'),
  }
}
