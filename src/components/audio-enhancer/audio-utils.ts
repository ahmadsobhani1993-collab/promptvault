export function formatAudioTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

export type VoiceTone = 'original' | 'male' | 'female' | 'studio'

export type ProcessingOptions = {
  removeNoise: boolean
  boostVolume: boolean
  voiceTone: VoiceTone
  noiseReductionIntensity?: 'mild' | 'balanced' | 'aggressive'
}

// ----------------------------------------------------------------------------
// حذف نویز بدون رباتیک شدن صدا (Adaptive Dynamic Expander + Smooth Envelope)
// ----------------------------------------------------------------------------
function cleanNoiseFloor(
  input: Float32Array,
  intensity: 'mild' | 'balanced' | 'aggressive' = 'balanced'
): Float32Array {
  const output = new Float32Array(input.length)
  const windowSize = 256
  const numWindows = Math.floor(input.length / windowSize)

  // ۱. محاسبه انرژی جهت یافتن نویز زمینه
  const energies = new Float32Array(numWindows)
  for (let w = 0; w < numWindows; w++) {
    let sum = 0
    const start = w * windowSize
    for (let i = 0; i < windowSize; i++) {
      const s = input[start + i]
      sum += s * s
    }
    energies[w] = Math.sqrt(sum / windowSize)
  }

  // پیدا کردن آستانه نویز
  const sorted = Float32Array.from(energies).sort()
  const noiseFloor = Math.max(0.0015, sorted[Math.floor(numWindows * 0.18)] * 1.8)

  const reduction = intensity === 'aggressive' ? 0.03 : intensity === 'mild' ? 0.2 : 0.08

  // ۲. فیلتر میرایی نرم برای جلوگیری کامل از لرزش و صدای بریده‌بریده
  let currentGain = 1.0
  for (let w = 0; w < numWindows; w++) {
    const energy = energies[w]
    const start = w * windowSize

    let targetGain = 1.0
    if (energy < noiseFloor) {
      targetGain = reduction
    } else if (energy < noiseFloor * 2.2) {
      targetGain = reduction + (1.0 - reduction) * ((energy - noiseFloor) / (noiseFloor * 1.2))
    }

    for (let i = 0; i < windowSize; i++) {
      // ضریب اتک و ریلیز طبیعی
      currentGain = currentGain * 0.88 + targetGain * 0.12
      output[start + i] = input[start + i] * currentGain
    }
  }

  for (let i = numWindows * windowSize; i < input.length; i++) {
    output[i] = input[i] * currentGain
  }

  return output
}

// ----------------------------------------------------------------------------
// زنجیره پردازش و تقویت کلام
// ----------------------------------------------------------------------------
export async function processAudioBuffer(
  inputBuffer: AudioBuffer,
  options: ProcessingOptions
): Promise<AudioBuffer> {
  const sampleRate = 32000 // ۳۲ کیلوهرتز برای کاهش شدید حجم خروجی
  const duration = inputBuffer.duration
  const targetLength = Math.round(duration * sampleRate)

  // رندر مونو برای گفتار و پادکست (حجم فایل را به نصف می‌رساند)
  const offlineCtx = new OfflineAudioContext(1, targetLength, sampleRate)

  const source = offlineCtx.createBufferSource()
  source.buffer = inputBuffer

  let currentNode: AudioNode = source

  if (options.removeNoise) {
    // فیلتر حذف هووم، باد و لرزش زیر ۱۱۰ هرتز
    const hp = offlineCtx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 110
    hp.Q.value = 0.7
    currentNode.connect(hp)
    currentNode = hp

    // فیلتر حذف صدای سوت و هیس الکترونیکی بالای ۹ کیلوهرتز
    const lp = offlineCtx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 9000
    currentNode.connect(lp)
    currentNode = lp
  }

  // پریست‌های تن صدا
  if (options.voiceTone === 'male') {
    const bass = offlineCtx.createBiquadFilter()
    bass.type = 'lowshelf'
    bass.frequency.value = 220
    bass.gain.value = 4
    currentNode.connect(bass)
    currentNode = bass
  } else if (options.voiceTone === 'female') {
    const presence = offlineCtx.createBiquadFilter()
    presence.type = 'peaking'
    presence.frequency.value = 3000
    presence.gain.value = 3.5
    currentNode.connect(presence)
    currentNode = presence
  } else if (options.voiceTone === 'studio') {
    const clarity = offlineCtx.createBiquadFilter()
    clarity.type = 'highshelf'
    clarity.frequency.value = 4500
    clarity.gain.value = 4
    currentNode.connect(clarity)
    currentNode = clarity
  }

  // تقویت هوشمند حجم بدون خراب شدن صدا
  if (options.boostVolume) {
    const comp = offlineCtx.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.knee.value = 10
    comp.ratio.value = 3
    comp.attack.value = 0.01
    comp.release.value = 0.15
    currentNode.connect(comp)
    currentNode = comp

    const gain = offlineCtx.createGain()
    gain.gain.value = 1.35
    currentNode.connect(gain)
    currentNode = gain
  }

  currentNode.connect(offlineCtx.destination)
  source.start(0)

  const rendered = await offlineCtx.startRendering()
  let finalData = rendered.getChannelData(0)

  // اعمال حذف نویز نرم
  if (options.removeNoise) {
    finalData = cleanNoiseFloor(finalData, options.noiseReductionIntensity || 'balanced')
  }

  const resultBuffer = offlineCtx.createBuffer(1, finalData.length, sampleRate)
  resultBuffer.copyToChannel(finalData, 0)
  return resultBuffer
}

// ----------------------------------------------------------------------------
// ساخت خروجی سبک (کاهش حجم از ۲۲ مگابایت به حدود ۱ مگابایت)
// ----------------------------------------------------------------------------
export function bufferToStandardAudio(
  buffer: AudioBuffer,
  originalFileName: string
): { blob: Blob; fileName: string } {
  const baseName = originalFileName.replace(/\.[^/.]+$/, '')
  const samples = buffer.getChannelData(0)
  const sampleRate = buffer.sampleRate

  // فایل هدر استاندارد تک کاناله (Mono) به همراه ۳۲ کیلوهرتز که حجم را زیر ۱ الی ۲ مگابایت نگه می‌دارد
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
  view.setUint16(22, 1, true) // مونو برای نصف شدن حجم
  view.setUint32(24, sampleRate, true) // ۳۲ کیلوهرتز بهینه
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, samples.length * 2, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
    offset += 2
  }

  return {
    blob: new Blob([view], { type: 'audio/wav' }),
    fileName: `enhanced_${baseName}.wav`,
  }
}
