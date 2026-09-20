export function formatAudioTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

export type ProcessingOptions = {
  attenuationLevel: number // 5 تا 100
  loudnessNormalization: boolean
  voiceEq: boolean
}

export const SAMPLE_RATE = 48000
let corePromise: Promise<any> | null = null

/**
 * مقداردهی رسمی کلاس DeepFilterNet3Core از پکیج npm
 */
export async function getInitializedCore(attenuationLevel: number, onLog?: (msg: string) => void) {
  if (!corePromise) {
    corePromise = (async () => {
      onLog?.('در حال ایمپورت رسمی ماژول deepfilternet3-noise-filter...')
      console.log('[DFN3] Importing deepfilternet3-noise-filter module...')

      // ایمپورت رسمی ماژول کامپایل‌شده
      const { DeepFilterNet3Core } = await import('deepfilternet3-noise-filter')

      onLog?.('در حال مقداردهی هسته DeepFilterNet3...')
      console.log('[DFN3] Initializing DeepFilterNet3Core...')

      const core = new DeepFilterNet3Core({
        sampleRate: SAMPLE_RATE,
        noiseReductionLevel: attenuationLevel,
      })

      await core.initialize()
      console.log('[DFN3] DeepFilterNet3Core successfully initialized.')
      return core
    })()
  }

  const core = await corePromise
  core.setSuppressionLevel(attenuationLevel)
  return core
}

/**
 * پردازش آفلاین استاندارد با AudioWorklet رسمی پکیج (دقیقاً مشابه boredland/noise)
 */
export async function processAudioBuffer(
  inputBuffer: AudioBuffer,
  options: ProcessingOptions,
  maxDurationSeconds: number | null,
  onProgress?: (pct: number, status: string) => void
): Promise<AudioBuffer> {
  const log = (msg: string, pct = 0) => {
    console.log(`[DFN3 Step] ${msg}`)
    onProgress?.(pct, msg)
  }

  log('در حال آماده‌سازی خط لوله صوتی...', 10)

  const targetDuration = maxDurationSeconds
    ? Math.min(inputBuffer.duration, maxDurationSeconds)
    : inputBuffer.duration

  const totalSamples = Math.ceil(targetDuration * SAMPLE_RATE)

  // مقداردهی هسته رسمی
  log('در حال بارگذاری مدل هوش مصنوعی DeepFilterNet3...', 25)
  const core = await getInitializedCore(options.attenuationLevel, (m) => log(m, 30))

  log('آماده‌سازی OfflineAudioContext و AudioWorkletNode...', 45)
  const offlineCtx = new OfflineAudioContext(1, totalSamples, SAMPLE_RATE)

  const source = offlineCtx.createBufferSource()
  // استخراج کانال مونو
  const monoBuffer = offlineCtx.createBuffer(1, totalSamples, SAMPLE_RATE)
  monoBuffer.getChannelData(0).set(inputBuffer.getChannelData(0).subarray(0, totalSamples))
  source.buffer = monoBuffer

  let currentNode: AudioNode = source

  // اتصال به نود فیلتر رسمی DeepFilterNet3
  const filterNode = await core.createAudioWorkletNode(offlineCtx)
  currentNode.connect(filterNode)
  currentNode = filterNode

  // اعمال Voice EQ
  if (options.voiceEq) {
    log('اعمال تنظیمات اکولایزر کلام...', 55)
    const highpass = offlineCtx.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = 80
    highpass.Q.value = 0.7
    currentNode.connect(highpass)
    currentNode = highpass

    const presence = offlineCtx.createBiquadFilter()
    presence.type = 'peaking'
    presence.frequency.value = 3000
    presence.gain.value = 3.0
    presence.Q.value = 1.0
    currentNode.connect(presence)
    currentNode = presence
  }

  // اعمال نرمال‌سازی بلندی صدا (کمپرسور ملایم)
  if (options.loudnessNormalization) {
    const comp = offlineCtx.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.knee.value = 12
    comp.ratio.value = 2.5
    comp.attack.value = 0.005
    comp.release.value = 0.15
    currentNode.connect(comp)
    currentNode = comp
  }

  currentNode.connect(offlineCtx.destination)
  source.start(0)

  log('در حال رندر و حذف نویز آفلاین با شتاب‌دهنده...', 65)
  const renderedBuffer = await offlineCtx.startRendering()

  // کنترل پیک صدا
  if (options.loudnessNormalization) {
    const data = renderedBuffer.getChannelData(0)
    let peak = 0
    for (let i = 0; i < data.length; i++) {
      const a = Math.abs(data[i])
      if (a > peak) peak = a
    }
    if (peak > 0.01) {
      const gain = 0.85 / peak
      for (let i = 0; i < data.length; i++) {
        data[i] *= gain
      }
    }
  }

  log('پردازش با موفقیت پایان یافت!', 100)
  return renderedBuffer
}

/**
 * فشرده‌سازی و دانلود خروجی در فرمت‌های MP3, M4A, WAV
 */
export async function bufferToStandardAudio(
  buffer: AudioBuffer,
  originalFileName: string,
  chosenFormat?: string
): Promise<{ blob: Blob; fileName: string }> {
  const extMatch = originalFileName.match(/\.([0-9a-z]+)$/i)
  const originalExt = extMatch ? extMatch[1].toLowerCase() : 'mp3'
  const targetExt = (
    chosenFormat || (['mp3', 'm4a', 'aac', 'webm'].includes(originalExt) ? originalExt : 'mp3')
  ).toLowerCase()
  const baseName = originalFileName.replace(/\.[^/.]+$/, '')

  if (['mp3', 'm4a', 'aac', 'webm'].includes(targetExt) && typeof MediaRecorder !== 'undefined') {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE })
      const dest = audioCtx.createMediaStreamDestination()
      const source = audioCtx.createBufferSource()
      source.buffer = buffer
      source.connect(dest)

      let mimeType = 'audio/webm;codecs=opus'
      if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4'
      else if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm'

      const recorder = new MediaRecorder(dest.stream, {
        mimeType,
        audioBitsPerSecond: 128000,
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
        fileName: `${baseName}_enhanced.${targetExt === 'm4a' ? 'm4a' : 'mp3'}`,
      }
    } catch {}
  }

  // خروجی WAV استاندارد
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
    fileName: `${baseName}_enhanced.wav`,
  }
}
