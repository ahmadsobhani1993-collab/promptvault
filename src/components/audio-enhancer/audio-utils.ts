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
// هسته تبدیل فوریه سریع (Cooley-Tukey Radix-2 FFT)
// ----------------------------------------------------------------------------
function fft(real: Float32Array, imag: Float32Array) {
  const n = real.length
  let j = 0
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      const tr = real[i]
      real[i] = real[j]
      real[j] = tr
      const ti = imag[i]
      imag[i] = imag[j]
      imag[j] = ti
    }
    let k = n >> 1
    while (k <= j) {
      j -= k
      k >>= 1
    }
    j += k
  }

  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1
    const angle = (-2 * Math.PI) / len
    const wStepR = Math.cos(angle)
    const wStepI = Math.sin(angle)

    for (let i = 0; i < n; i += len) {
      let wr = 1
      let wi = 0
      for (let m = 0; m < half; m++) {
        const uR = real[i + m]
        const uI = imag[i + m]
        const vR = real[i + m + half] * wr - imag[i + m + half] * wi
        const vI = real[i + m + half] * wi + imag[i + m + half] * wr

        real[i + m] = uR + vR
        imag[i + m] = uI + vI
        real[i + m + half] = uR - vR
        imag[i + m + half] = uI - vI

        const nextWr = wr * wStepR - wi * wStepI
        wi = wr * wStepI + wi * wStepR
        wr = nextWr
      }
    }
  }
}

function ifft(real: Float32Array, imag: Float32Array) {
  const n = real.length
  for (let i = 0; i < n; i++) imag[i] = -imag[i]
  fft(real, imag)
  for (let i = 0; i < n; i++) {
    real[i] /= n
  }
}

// ----------------------------------------------------------------------------
// الگوریتم تفریق طیفی چندبانده (Berouti Spectral Subtraction) بدون افت کیفیت کلام
// ----------------------------------------------------------------------------
function spectralDenoise(
  input: Float32Array,
  sampleRate: number,
  intensity: 'mild' | 'balanced' | 'aggressive' = 'balanced'
): Float32Array {
  const fftSize = 512
  const hopSize = 256
  const numFrames = Math.floor((input.length - fftSize) / hopSize)
  const output = new Float32Array(input.length)

  // پنجره هن (Hann Window)
  const window = new Float32Array(fftSize)
  for (let i = 0; i < fftSize; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)))
  }

  const alpha = intensity === 'aggressive' ? 3.5 : intensity === 'mild' ? 1.5 : 2.2
  const beta = intensity === 'aggressive' ? 0.01 : 0.03

  // تخمین طیف اولیه نویز از سکوت فریم‌های ابتدایی
  const noisePower = new Float32Array(fftSize / 2 + 1)
  const initFrames = Math.min(15, numFrames)

  for (let f = 0; f < initFrames; f++) {
    const offset = f * hopSize
    const real = new Float32Array(fftSize)
    const imag = new Float32Array(fftSize)
    for (let i = 0; i < fftSize; i++) real[i] = input[offset + i] * window[i]

    fft(real, imag)

    for (let k = 0; k <= fftSize / 2; k++) {
      noisePower[k] += (real[k] * real[k] + imag[k] * imag[k]) / initFrames
    }
  }

  // پردازش سیگنال با حفظ فاز و تفریق دامنه
  const real = new Float32Array(fftSize)
  const imag = new Float32Array(fftSize)

  for (let f = 0; f < numFrames; f++) {
    const offset = f * hopSize
    for (let i = 0; i < fftSize; i++) {
      real[i] = input[offset + i] * window[i]
      imag[i] = 0
    }

    fft(real, imag)

    for (let k = 0; k <= fftSize / 2; k++) {
      const magSq = real[k] * real[k] + imag[k] * imag[k]
      const phase = Math.atan2(imag[k], real[k])

      // تفریق توانی طیفی
      let cleanMagSq = magSq - alpha * noisePower[k]
      if (cleanMagSq < beta * noisePower[k]) {
        cleanMagSq = beta * noisePower[k]
      }

      const cleanMag = Math.sqrt(cleanMagSq)
      real[k] = cleanMag * Math.cos(phase)
      imag[k] = cleanMag * Math.sin(phase)

      if (k > 0 && k < fftSize / 2) {
        real[fftSize - k] = real[k]
        imag[fftSize - k] = -imag[k]
      }
    }

    ifft(real, imag)

    // ترکیب همپوشان (Overlap-Add)
    for (let i = 0; i < fftSize; i++) {
      output[offset + i] += real[i] * window[i]
    }
  }

  return output
}

// ----------------------------------------------------------------------------
// زنجیره استودیو و اعمال تنظیمات
// ----------------------------------------------------------------------------
export async function processAudioBuffer(
  inputBuffer: AudioBuffer,
  options: ProcessingOptions
): Promise<AudioBuffer> {
  const sampleRate = inputBuffer.sampleRate
  const channels = inputBuffer.numberOfChannels
  const ctx = new OfflineAudioContext(channels, inputBuffer.length, sampleRate)
  const outBuffer = ctx.createBuffer(channels, inputBuffer.length, sampleRate)

  for (let c = 0; c < channels; c++) {
    let channelData = inputBuffer.getChannelData(c)

    // ۱. فیلتر حذف نویز طیفی
    if (options.removeNoise) {
      channelData = spectralDenoise(channelData, sampleRate, options.noiseReductionIntensity || 'balanced')
    }

    // ۲. پریست‌های فرکانسی
    if (options.voiceTone === 'male') {
      // بم پادکستی (Low-pass ملایم)
      for (let i = 1; i < channelData.length; i++) {
        channelData[i] = channelData[i] * 0.6 + channelData[i - 1] * 0.4
      }
    } else if (options.voiceTone === 'female') {
      // زیر و کریستالی
      for (let i = 1; i < channelData.length; i++) {
        channelData[i] = (channelData[i] - channelData[i - 1] * 0.4) * 1.1
      }
    } else if (options.voiceTone === 'studio') {
      // شفاف‌ساز کلام
      for (let i = 1; i < channelData.length; i++) {
        channelData[i] = channelData[i] * 0.9 + (channelData[i] - channelData[i - 1]) * 0.15
      }
    }

    // ۳. نرمال‌سازی Peak (جلوگیری از دیستورشن و نویز اضافی)
    if (options.boostVolume) {
      let maxPeak = 0
      for (let i = 0; i < channelData.length; i++) {
        const abs = Math.abs(channelData[i])
        if (abs > maxPeak) maxPeak = abs
      }
      if (maxPeak > 0.01) {
        const gain = Math.min(2.0, 0.8 / maxPeak)
        for (let i = 0; i < channelData.length; i++) {
          channelData[i] *= gain
        }
      }
    }

    outBuffer.copyToChannel(channelData, c)
  }

  return outBuffer
}

// ----------------------------------------------------------------------------
// ذخیره‌سازی فایل استاندارد WAV
// ----------------------------------------------------------------------------
export function bufferToStandardAudio(
  buffer: AudioBuffer,
  originalFileName: string
): { blob: Blob; fileName: string } {
  const baseName = originalFileName.replace(/\.[^/.]+$/, '')
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const length = buffer.length

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
  view.setUint16(20, 1, true)
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

  return {
    blob: new Blob([view], { type: 'audio/wav' }),
    fileName: `enhanced_${baseName}.wav`,
  }
}
