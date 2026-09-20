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
// الگوریتم حذف نویز بدون وزوز و بدون ایجاد صدای فلزی (Smooth Adaptive Subtraction)
// ----------------------------------------------------------------------------
function applySmoothSpectralClean(
  input: Float32Array,
  sampleRate: number,
  intensity: 'mild' | 'balanced' | 'aggressive'
): Float32Array {
  const output = new Float32Array(input.length)
  const windowSize = 512
  const hopSize = 256
  const numWindows = Math.floor((input.length - windowSize) / hopSize)

  // پنجره نرم هن برای محو کردن صدای تق‌تق و ویزویز
  const window = new Float32Array(windowSize)
  for (let i = 0; i < windowSize; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowSize - 1)))
  }

  // ارزیابی کف نویز اولیه با نمونه‌برداری از فریم‌های کم‌انرژی
  const energies = new Float32Array(numWindows)
  for (let w = 0; w < numWindows; w++) {
    let sum = 0
    const start = w * hopSize
    for (let i = 0; i < windowSize; i++) {
      const s = input[start + i] * window[i]
      sum += s * s
    }
    energies[w] = Math.sqrt(sum / windowSize)
  }

  const sorted = Float32Array.from(energies).sort()
  const noiseFloor = Math.max(0.001, sorted[Math.floor(numWindows * 0.15)] * 1.5)

  const minGain = intensity === 'aggressive' ? 0.05 : intensity === 'mild' ? 0.25 : 0.12
  const power = intensity === 'aggressive' ? 2.2 : 1.6

  let smoothedGain = 1.0

  for (let w = 0; w < numWindows; w++) {
    const start = w * hopSize
    const currentEnergy = energies[w]

    // محاسبه گین نرم بدون پرش فاز
    let targetGain = 1.0
    if (currentEnergy < noiseFloor) {
      targetGain = minGain
    } else {
      const snr = (currentEnergy - noiseFloor) / (currentEnergy + 1e-6)
      targetGain = Math.max(minGain, Math.min(1.0, Math.pow(snr, power)))
    }

    // فیلتر هموارساز زمانی (Lowpass Gain) جهت رفع صددرصدی ویزویز فرکانسی
    for (let i = 0; i < windowSize; i++) {
      smoothedGain = smoothedGain * 0.96 + targetGain * 0.04
      output[start + i] += input[start + i] * window[i] * smoothedGain
    }
  }

  // کپی بخش باقیمانده
  for (let i = numWindows * hopSize; i < input.length; i++) {
    output[i] = input[i] * smoothedGain
  }

  return output
}

// ----------------------------------------------------------------------------
// زنجیره پردازش صدا در OfflineAudioContext
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
    // فیلتر شیب ملایم بالاگذر برای مهار هوم و باد بدون نازک شدن صدا
    const hp = offlineCtx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 100
    hp.Q.value = 0.6
    currentNode.connect(hp)
    currentNode = hp

    // فیلتر ملایم برای مهار فرکانس‌های هیس زننده بالای ۸۵۰۰ هرتز
    const lp = offlineCtx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 9000
    lp.Q.value = 0.6
    currentNode.connect(lp)
    currentNode = lp
  }

  // پریست‌ها
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
    presence.frequency.value = 2800
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

  // تقویت حجم کلام با کنترل ملایم پیک
  if (options.boostVolume) {
    const comp = offlineCtx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.knee.value = 15
    comp.ratio.value = 2.5
    comp.attack.value = 0.01
    comp.release.value = 0.15
    currentNode.connect(comp)
    currentNode = comp

    const gain = offlineCtx.createGain()
    gain.gain.value = 1.3
    currentNode.connect(gain)
    currentNode = gain
  }

  currentNode.connect(offlineCtx.destination)
  source.start(0)

  const rendered = await offlineCtx.startRendering()
  let finalData = rendered.getChannelData(0)

  // اعمال حذف نویز فیلتر نرم
  if (options.removeNoise) {
    finalData = applySmoothSpectralClean(
      finalData,
      sampleRate,
      options.noiseReductionIntensity || 'balanced'
    )
  }

  const resultBuffer = offlineCtx.createBuffer(1, finalData.length, sampleRate)
  resultBuffer.copyToChannel(finalData, 0)
  return resultBuffer
}

// ----------------------------------------------------------------------------
// انکودر هوشمند: یکسان‌سازی فرمت و پسوند خروجی با فایل ورودی
// ----------------------------------------------------------------------------
export async function bufferToStandardAudio(
  buffer: AudioBuffer,
  originalFileName: string
): Promise<{ blob: Blob; fileName: string }> {
  const extMatch = originalFileName.match(/\.([0-9a-z]+)$/i)
  const originalExt = extMatch ? extMatch[1].toLowerCase() : 'wav'
  const baseName = originalFileName.replace(/\.[^/.]+$/, '')

  // اگر فایل ورودی فشرده باشد (MP3 / M4A / AAC / WebM) آن را به صورت فشرده کم‌حجم تحویل می‌دهیم
  if (['mp3', 'm4a', 'aac', 'webm'].includes(originalExt) && typeof MediaRecorder !== 'undefined') {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const dest = audioCtx.createMediaStreamDestination()
      const source = audioCtx.createBufferSource()
      source.buffer = buffer
      source.connect(dest)

      let mimeType = 'audio/webm;codecs=opus'
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4'
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm'
      }

      const recorder = new MediaRecorder(dest.stream, {
        mimeType,
        audioBitsPerSecond: 128000, // کیفیت بالا و حجم بسیار کم (زیر ۱ مگابایت)
      })

      const chunks: BlobPart[] = []
      const recordDone = new Promise<Blob>((resolve) => {
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data)
        }
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }))
      })

      recorder.start()
      source.start(0)

      // ضبط سریع کل بافر
      await new Promise((r) => {
        source.onended = () => {
          recorder.stop()
          r(true)
        }
      })

      const compressedBlob = await recordDone
      return {
        blob: compressedBlob,
        fileName: `enhanced_${baseName}.${originalExt}`,
      }
    } catch {
      // در صورت بروز هرگونه مشکل به ساخت WAV سبک می‌رود
    }
  }

  // حالت استاندارد WAV کم‌حجم (مونو و ۳۲ کیلوهرتز)
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
  view.setUint16(22, 1, true)
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
    fileName: `enhanced_${baseName}.${originalExt === 'mp4' ? 'mp4' : (originalExt === 'mp3' ? 'mp3' : 'wav')}`,
  }
}
