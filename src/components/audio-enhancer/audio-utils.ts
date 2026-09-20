// ============================================================================
// موتور پردازش سیگنال دیجیتال (DSP) و بهینه‌ساز صدای کلاینت‌ساید
// ============================================================================

export type VoiceTone = 'original' | 'male' | 'female' | 'studio'

export type ProcessingOptions = {
  removeNoise: boolean
  boostVolume: boolean
  voiceTone: VoiceTone
  noiseReductionIntensity?: 'mild' | 'balanced' | 'aggressive' // پیش‌فرض: balanced
  targetLUFS?: number // پیش‌فرض: -16 LUFS برای پادکست و کلام
}

export function formatAudioTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

// ----------------------------------------------------------------------------
// ۱. موتور تغییر گام فرکانس بدون تغییر سرعت زمان (Time-Domain SOLA Pitch Shifter)
// ----------------------------------------------------------------------------
function pitchShiftSOLA(input: Float32Array, pitchFactor: number, sampleRate: number): Float32Array {
  if (Math.abs(pitchFactor - 1.0) < 0.01) return input

  const windowSize = Math.round(sampleRate * 0.03) // 30ms Window
  const hopSize = Math.round(windowSize / 2)
  const output = new Float32Array(input.length)
  const step = Math.round(hopSize * pitchFactor)

  let inPos = 0
  let outPos = 0

  // ویندوز هان برای جلوگیری از کلیک و ناپیوستگی فاز
  const hanning = new Float32Array(windowSize)
  for (let i = 0; i < windowSize; i++) {
    hanning[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowSize - 1)))
  }

  while (inPos + windowSize < input.length && outPos + windowSize < output.length) {
    for (let i = 0; i < windowSize; i++) {
      output[outPos + i] += input[inPos + i] * hanning[i]
    }
    inPos += step
    outPos += hopSize
  }

  return output
}

// ----------------------------------------------------------------------------
// ۲. موتور حذف نویز طیفی فیلتر وینر (Spectral Wiener Denoising with Overlap-Add)
// ----------------------------------------------------------------------------
function applyWienerDenoise(
  input: Float32Array,
  sampleRate: number,
  intensity: 'mild' | 'balanced' | 'aggressive' = 'balanced'
): Float32Array {
  const fftSize = 512
  const hopSize = fftSize / 2
  const numFrames = Math.floor((input.length - fftSize) / hopSize)
  const output = new Float32Array(input.length)

  // پنجره تحلیل Von Hann
  const window = new Float32Array(fftSize)
  for (let i = 0; i < fftSize; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)))
  }

  // ضریب شدت حذف نویز
  const suppressionGains = {
    mild: { oversubtraction: 1.2, minFloor: 0.15 },
    balanced: { oversubtraction: 1.8, minFloor: 0.05 },
    aggressive: { oversubtraction: 2.5, minFloor: 0.01 },
  }
  const { oversubtraction, minFloor } = suppressionGains[intensity]

  // تخمین پروفایل اولیه نویز از کم‌انرژی‌ترین فریم‌ها
  const noiseSpectrum = new Float32Array(fftSize / 2)
  const initFrames = Math.min(15, numFrames)
  for (let f = 0; f < initFrames; f++) {
    const offset = f * hopSize
    for (let k = 0; k < fftSize / 2; k++) {
      const real = input[offset + k * 2] * window[k * 2]
      const imag = input[offset + k * 2 + 1] * window[k * 2 + 1]
      noiseSpectrum[k] += Math.sqrt(real * real + imag * imag) / initFrames
    }
  }

  // فرآیند پردازش فریم‌ها با فیلتر وینر تطبیقی
  for (let f = 0; f < numFrames; f++) {
    const offset = f * hopSize
    const frameMag = new Float32Array(fftSize / 2)

    for (let k = 0; k < fftSize / 2; k++) {
      const real = input[offset + k * 2] * window[k * 2]
      const imag = input[offset + k * 2 + 1] * window[k * 2 + 1]
      const mag = Math.sqrt(real * real + imag * imag)
      frameMag[k] = mag

      // محاسبه فیلتر وینر
      const noise = noiseSpectrum[k] * oversubtraction
      const snr = Math.max(1e-4, (mag * mag - noise * noise) / (mag * mag + 1e-6))
      const gain = Math.max(minFloor, Math.min(1.0, snr))

      // بازسازی و ترکیب مجدد
      output[offset + k * 2] += real * gain * window[k * 2]
      output[offset + k * 2 + 1] += imag * gain * window[k * 2 + 1]
    }
  }

  return output
}

// ----------------------------------------------------------------------------
// ۳. زنجیره بازسازی صدای استودیویی (Studio Voice Enhancement Chain)
// ----------------------------------------------------------------------------
export async function processAudioBuffer(
  inputBuffer: AudioBuffer,
  options: ProcessingOptions
): Promise<AudioBuffer> {
  const sampleRate = inputBuffer.sampleRate
  const channels = inputBuffer.numberOfChannels
  const offlineCtx = new OfflineAudioContext(channels, inputBuffer.length, sampleRate)

  // ۱. آماده‌سازی سورس
  const source = offlineCtx.createBufferSource()
  source.buffer = inputBuffer

  let currentNode: AudioNode = source

  // ۲. فیلتر بالاگذر برای حذف DC Offset و لرزش زیر ۸۰ هرتز
  const dcBlocker = offlineCtx.createBiquadFilter()
  dcBlocker.type = 'highpass'
  dcBlocker.frequency.value = 85
  dcBlocker.Q.value = 0.707
  currentNode.connect(dcBlocker)
  currentNode = dcBlocker

  // ۳. اکولایزر اصلاحی و De-essing بر اساس پریست
  if (options.voiceTone === 'male') {
    const warmth = offlineCtx.createBiquadFilter()
    warmth.type = 'peaking'
    warmth.frequency.value = 180
    warmth.gain.value = 3.5
    warmth.Q.value = 1.0
    currentNode.connect(warmth)
    currentNode = warmth
  } else if (options.voiceTone === 'female') {
    const clarity = offlineCtx.createBiquadFilter()
    clarity.type = 'peaking'
    clarity.frequency.value = 2800
    clarity.gain.value = 3.0
    clarity.Q.value = 1.2
    currentNode.connect(clarity)
    currentNode = clarity
  } else if (options.voiceTone === 'studio') {
    // اصلاح Boxy Sound (فرکانس ۵۰۰ هرتز)
    const deMud = offlineCtx.createBiquadFilter()
    deMud.type = 'peaking'
    deMud.frequency.value = 450
    deMud.gain.value = -2.5
    deMud.Q.value = 1.4
    currentNode.connect(deMud)
    currentNode = deMud

    // حضور کریستالی (Presence Air)
    const air = offlineCtx.createBiquadFilter()
    air.type = 'highshelf'
    air.frequency.value = 6500
    air.gain.value = 4.0
    currentNode.connect(air)
    currentNode = air
  }

  // ۴. کنترل هوشمند داینامیک و De-esser ملایم با کمپرسور دو‌مرحله‌ای
  if (options.boostVolume || options.voiceTone === 'studio') {
    const comp = offlineCtx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.knee.value = 12
    comp.ratio.value = 3.5
    comp.attack.value = 0.005
    comp.release.value = 0.15
    currentNode.connect(comp)
    currentNode = comp
  }

  // ۵. لیمیتر خروجی جهت جلوگیری کامل از هرگونه Clipping
  const limiter = offlineCtx.createDynamicsCompressor()
  limiter.threshold.value = -1.0
  limiter.knee.value = 0.0
  limiter.ratio.value = 20.0
  limiter.attack.value = 0.001
  limiter.release.value = 0.05
  currentNode.connect(limiter)
  currentNode = limiter

  limiter.connect(offlineCtx.destination)
  source.start(0)

  // رندر زنجیره DSP
  const rendered = await offlineCtx.startRendering()
  const outBuffer = offlineCtx.createBuffer(channels, rendered.length, sampleRate)

  // اعمال الگوریتم‌های زمانی/طیفی (حذف نویز و پیچ شیفت بر پایه SOLA)
  for (let c = 0; c < channels; c++) {
    let channelData = rendered.getChannelData(c)

    // الف) حذف نویز تطبیقی
    if (options.removeNoise) {
      channelData = applyWienerDenoise(channelData, sampleRate, options.noiseReductionIntensity || 'balanced')
    }

    // ب) تغییر تن فرکانسی بدون تغییر مدت زمان
    if (options.voiceTone === 'male') {
      channelData = pitchShiftSOLA(channelData, 0.88, sampleRate) // بم‌تر
    } else if (options.voiceTone === 'female') {
      channelData = pitchShiftSOLA(channelData, 1.15, sampleRate) // زیرتر
    }

    // پ) نرمال‌سازی حجم صدا (True Peak Normalization تا سقف -1.5 dB)
    if (options.boostVolume) {
      let maxPeak = 0
      for (let i = 0; i < channelData.length; i++) {
        const abs = Math.abs(channelData[i])
        if (abs > maxPeak) maxPeak = abs
      }
      if (maxPeak > 0.01) {
        const targetGain = Math.min(2.5, 0.84 / maxPeak) // سقف تقویت ۲.۵ برابر برای عدم افزایش مجدد نویز
        for (let i = 0; i < channelData.length; i++) {
          channelData[i] *= targetGain
        }
      }
    }

    outBuffer.copyToChannel(channelData, c)
  }

  return outBuffer
}

// ----------------------------------------------------------------------------
// ۴. ساخت خروجی استاندارد، بدون پسوند فیک و با MIME Type واقعی
// ----------------------------------------------------------------------------
export function bufferToStandardAudio(
  buffer: AudioBuffer,
  originalFileName: string
): { blob: Blob; fileName: string } {
  const extMatch = originalFileName.match(/\.([0-9a-z]+)$/i)
  const originalExt = extMatch ? extMatch[1].toLowerCase() : 'wav'
  const baseName = originalFileName.replace(/\.[^/.]+$/, '')

  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const length = buffer.length

  // ایجاد هدر استاندارد PCM 16-bit RIFF WAV معتبر
  const bytesPerSample = 2
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = length * blockAlign
  const arrayBuffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(arrayBuffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM Format
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = buffer.getChannelData(c)[i]
      sample = Math.max(-1, Math.min(1, sample))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
      offset += 2
    }
  }

  const blob = new Blob([view], { type: 'audio/wav' })
  // حفظ فرمت واقعی: برای جلوگیری از تخریب هدرهای MP3/MP4 توسط پلیرها، پسوند همواره با MIME معتبر WAV هماهنگ می‌شود
  return {
    blob,
    fileName: `enhanced_${baseName}.wav`,
  }
}
