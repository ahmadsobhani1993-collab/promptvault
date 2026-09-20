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
// حذف نویز پیوسته و نرم با Envelope Follower سمپل‌به‌سمپل (بدون تکه‌تکه شدن کلمات)
// ----------------------------------------------------------------------------
function cleanNoiseFloor(
  input: Float32Array,
  sampleRate: number,
  intensity: 'mild' | 'balanced' | 'aggressive' = 'balanced'
): Float32Array {
  const output = new Float32Array(input.length)

  // ۱. تخمین دقیق کف نویز بر اساس صدک پایینی انرژی کل سیگنال
  const blockSize = 512
  const numBlocks = Math.floor(input.length / blockSize)
  const blockEnergies = new Float32Array(numBlocks)

  for (let b = 0; b < numBlocks; b++) {
    let sum = 0
    const offset = b * blockSize
    for (let i = 0; i < blockSize; i++) {
      const s = input[offset + i]
      sum += s * s
    }
    blockEnergies[b] = Math.sqrt(sum / blockSize)
  }

  const sorted = Float32Array.from(blockEnergies).sort()
  // محاسبه سطح نویز زمینه
  const noiseFloor = Math.max(0.0012, sorted[Math.floor(numBlocks * 0.12)] * 1.5)

  // ضریب تضعیف در فواصل سکوت بر اساس شدت انتخابی
  const floorGain = intensity === 'aggressive' ? 0.08 : intensity === 'mild' ? 0.35 : 0.18

  // ۲. ضرایب اتک و ریلیز زمانی (Attack: باز شدن آنی ۲ میلی‌ثانیه | Release: بسته شدن نرم ۱۸۰ میلی‌ثانیه)
  const attackCoef = Math.exp(-1.0 / (sampleRate * 0.002))
  const releaseCoef = Math.exp(-1.0 / (sampleRate * 0.18))

  let envelope = 0.0
  let gainEnvelope = 1.0

  for (let i = 0; i < input.length; i++) {
    const absSample = Math.abs(input[i])

    // دنبال‌کننده پوش سیگنال (Envelope Follower)
    if (absSample > envelope) {
      envelope = attackCoef * envelope + (1.0 - attackCoef) * absSample
    } else {
      envelope = releaseCoef * envelope + (1.0 - releaseCoef) * absSample
    }

    // تعیین ضریب بر اساس سطح پوش انرژی
    let targetGain = 1.0
    if (envelope < noiseFloor) {
      targetGain = floorGain
    } else if (envelope < noiseFloor * 2.5) {
      const ratio = (envelope - noiseFloor) / (noiseFloor * 1.5)
      targetGain = floorGain + (1.0 - floorGain) * ratio
    }

    // هموارسازی ضریب بهره برای جلوگیری از کلیک و بریدگی صدا
    gainEnvelope = gainEnvelope * 0.995 + targetGain * 0.005
    output[i] = input[i] * gainEnvelope
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
  const sampleRate = 32000
  const duration = inputBuffer.duration
  const targetLength = Math.round(duration * sampleRate)

  const offlineCtx = new OfflineAudioContext(1, targetLength, sampleRate)
  const source = offlineCtx.createBufferSource()
  source.buffer = inputBuffer

  let currentNode: AudioNode = source

  if (options.removeNoise) {
    // فیلتر شیب ملایم بالاگذر برای حذف هوم و باد
    const hp = offlineCtx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 95
    hp.Q.value = 0.5
    currentNode.connect(hp)
    currentNode = hp

    // فیلتر پایین‌گذر برای حذف سوت و هیس شدید
    const lp = offlineCtx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 10000
    lp.Q.value = 0.5
    currentNode.connect(lp)
    currentNode = lp
  }

  // پریست‌های تن صدا
  if (options.voiceTone === 'male') {
    const bass = offlineCtx.createBiquadFilter()
    bass.type = 'lowshelf'
    bass.frequency.value = 220
    bass.gain.value = 3.5
    currentNode.connect(bass)
    currentNode = bass
  } else if (options.voiceTone === 'female') {
    const presence = offlineCtx.createBiquadFilter()
    presence.type = 'peaking'
    presence.frequency.value = 2800
    presence.gain.value = 3.0
    currentNode.connect(presence)
    currentNode = presence
  } else if (options.voiceTone === 'studio') {
    const clarity = offlineCtx.createBiquadFilter()
    clarity.type = 'highshelf'
    clarity.frequency.value = 4500
    clarity.gain.value = 3.5
    currentNode.connect(clarity)
    currentNode = clarity
  }

  // تقویت هوشمند با کمپرسور ملایم
  if (options.boostVolume) {
    const comp = offlineCtx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.knee.value = 12
    comp.ratio.value = 2.5
    comp.attack.value = 0.01
    comp.release.value = 0.2
    currentNode.connect(comp)
    currentNode = comp

    const gain = offlineCtx.createGain()
    gain.gain.value = 1.25
    currentNode.connect(gain)
    currentNode = gain
  }

  currentNode.connect(offlineCtx.destination)
  source.start(0)

  const rendered = await offlineCtx.startRendering()
  let finalData = rendered.getChannelData(0)

  // اعمال الگوریتم حذف نویز پیوسته
  if (options.removeNoise) {
    finalData = cleanNoiseFloor(finalData, sampleRate, options.noiseReductionIntensity || 'balanced')
  }

  const resultBuffer = offlineCtx.createBuffer(1, finalData.length, sampleRate)
  resultBuffer.copyToChannel(finalData, 0)
  return resultBuffer
}

// ----------------------------------------------------------------------------
// ساخت خروجی استاندارد و کم‌حجم
// ----------------------------------------------------------------------------
export function bufferToStandardAudio(
  buffer: AudioBuffer,
  originalFileName: string
): { blob: Blob; fileName: string } {
  const baseName = originalFileName.replace(/\.[^/.]+$/, '')
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
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true) // Mono
  view.setUint32(24, sampleRate, true)
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
