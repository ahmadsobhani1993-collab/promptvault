export function formatAudioTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

export type ProcessingOptions = {
  removeNoise: boolean
  boostVolume: boolean
  noiseReductionIntensity?: 'mild' | 'balanced' | 'aggressive'
}

export const SAMPLE_RATE = 48000

let coreInstance: any = null

export async function getDeepFilterCore() {
  if (coreInstance) return coreInstance

  let DeepFilterNet3Core: any = null

  try {
    const mod = await import(/* webpackIgnore: true */ '/lib/deepfilternet3.js')
    DeepFilterNet3Core = mod.DeepFilterNet3Core || mod.default?.DeepFilterNet3Core || mod.default
  } catch (err) {
    console.warn('تلاش برای لود از طریق window:', err)
  }

  if (!DeepFilterNet3Core) {
    DeepFilterNet3Core =
      (window as any).DeepFilterNet3Core ||
      (window as any).deepfilternet3?.DeepFilterNet3Core ||
      (window as any).mezonNoiseSuppression?.DeepFilterNet3Core
  }

  if (!DeepFilterNet3Core) {
    throw new Error('کلاس DeepFilterNet3Core یافت نشد. لطفاً بررسی کنید فایل public/lib/deepfilternet3.js وجود داشته باشد.')
  }

  const modelBaseUrl = new URL('/model', window.location.href).toString()

  const core = new DeepFilterNet3Core({
    sampleRate: SAMPLE_RATE,
    noiseReductionLevel: 80,
    assetConfig: { cdnUrl: modelBaseUrl },
  })

  await core.initialize()
  coreInstance = core
  return coreInstance
}

// ----------------------------------------------------------------------------
// پردازش بافر صوتی (پشتیبانی از کل فایل یا ۶۰ ثانیه اول)
// ----------------------------------------------------------------------------
export async function processAudioBuffer(
  inputBuffer: AudioBuffer,
  options: ProcessingOptions,
  maxDurationSeconds: number | null,
  onProgress?: (pct: number, status: string) => void
): Promise<AudioBuffer> {
  const targetDuration = maxDurationSeconds
    ? Math.min(inputBuffer.duration, maxDurationSeconds)
    : inputBuffer.duration

  const targetLength = Math.ceil(targetDuration * SAMPLE_RATE)

  onProgress?.(10, 'آماده‌سازی بافر و محیط پردازش...')
  const offlineCtx = new OfflineAudioContext(1, targetLength, SAMPLE_RATE)

  const sourceNode = offlineCtx.createBufferSource()
  sourceNode.buffer = inputBuffer

  let currentNode: AudioNode = sourceNode

  if (options.removeNoise) {
    onProgress?.(30, 'بارگذاری مدل هوش مصنوعی DeepFilterNet3...')
    const core = await getDeepFilterCore()

    const attenuation =
      options.noiseReductionIntensity === 'aggressive' ? 100 :
      options.noiseReductionIntensity === 'mild' ? 50 : 80

    core.setSuppressionLevel(attenuation)

    onProgress?.(50, 'ایجاد فیلتر پردازش در AudioWorklet...')
    const filterNode = await core.createAudioWorkletNode(offlineCtx)

    currentNode.connect(filterNode)
    currentNode = filterNode
  }

  // تنظیم ملایم شفافیت استودیویی
  const highpass = offlineCtx.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = 80
  highpass.Q.value = 0.7
  currentNode.connect(highpass)
  currentNode = highpass

  const presence = offlineCtx.createBiquadFilter()
  presence.type = 'peaking'
  presence.frequency.value = 3200
  presence.gain.value = 2.5
  presence.Q.value = 1.0
  currentNode.connect(presence)
  currentNode = presence

  // افزایش حجم هوشمند
  if (options.boostVolume) {
    const comp = offlineCtx.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.knee.value = 14
    comp.ratio.value = 2.5
    comp.attack.value = 0.005
    comp.release.value = 0.15
    currentNode.connect(comp)
    currentNode = comp
  }

  currentNode.connect(offlineCtx.destination)
  sourceNode.start(0)

  onProgress?.(70, 'در حال تفکیک امواج و حذف نویز با شبکه عصبی...')
  const renderedBuffer = await offlineCtx.startRendering()

  // پیک کنترل شده
  if (options.boostVolume) {
    const data = renderedBuffer.getChannelData(0)
    let peak = 0
    for (let i = 0; i < data.length; i++) {
      const a = Math.abs(data[i])
      if (a > peak) peak = a
    }
    if (peak > 0.01) {
      const targetGain = 0.85 / peak
      for (let i = 0; i < data.length; i++) {
        data[i] *= targetGain
      }
    }
  }

  onProgress?.(100, 'پردازش با موفقیت پایان یافت!')
  return renderedBuffer
}

// ----------------------------------------------------------------------------
// استخراج فایل خروجی با حفظ حجم بهینه (MP3, M4A, WAV)
// ----------------------------------------------------------------------------
export async function bufferToStandardAudio(
  buffer: AudioBuffer,
  originalFileName: string,
  chosenFormat?: string
): Promise<{ blob: Blob; fileName: string }> {
  const extMatch = originalFileName.match(/\.([0-9a-z]+)$/i)
  const originalExt = extMatch ? extMatch[1].toLowerCase() : 'wav'
  const targetExt = (chosenFormat || (['mp3', 'm4a', 'aac', 'webm'].includes(originalExt) ? originalExt : 'wav')).toLowerCase()
  const baseName = originalFileName.replace(/\.[^/.]+$/, '')

  // ۱. انکود سبک به صورت فشرده برای حجم کم (زیر ۱ الی ۲ مگابایت)
  if (['mp3', 'm4a', 'aac', 'webm', 'ogg'].includes(targetExt) && typeof MediaRecorder !== 'undefined') {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE })
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
        audioBitsPerSecond: 128000, // فشرده و شفاف
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

      await new Promise((r) => {
        source.onended = () => {
          recorder.stop()
          r(true)
        }
      })

      const compressedBlob = await recordDone
      return {
        blob: compressedBlob,
        fileName: `enhanced_${baseName}.${targetExt === 'mp3' ? 'mp3' : targetExt === 'm4a' ? 'm4a' : 'webm'}`,
      }
    } catch {}
  }

  // ۲. خروجی استاندارد WAV (در صورتی که WAV انتخاب شده باشد)
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
