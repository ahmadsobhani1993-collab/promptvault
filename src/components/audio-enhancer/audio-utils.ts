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

const SAMPLE_RATE = 48000

let coreInstance: any = null

async function getDeepFilterCore() {
  if (coreInstance) return coreInstance

  // لود داینامیک اسکریپت کامپایل‌شده از دامنه خودتان
  if (!(window as any).DeepFilterNet3Core) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = '/lib/deepfilternet3.js'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('بارگذاری کتابخانه deepfilternet3.js با خطا مواجه شد.'))
      document.head.appendChild(script)
    })
  }

  const DeepFilterNet3Core =
    (window as any).DeepFilterNet3Core || (window as any).deepfilternet3?.DeepFilterNet3Core

  if (!DeepFilterNet3Core) {
    throw new Error('کلاس DeepFilterNet3Core در اسکریپت یافت نشد.')
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

export async function processAudioBuffer(
  inputBuffer: AudioBuffer,
  options: ProcessingOptions,
  onProgress?: (pct: number, status: string) => void
): Promise<AudioBuffer> {
  onProgress?.(10, 'آماده‌سازی موتور هوش مصنوعی DeepFilterNet3...')

  // دیکود و ترکیب مونو با نرخ ۴۸ کیلوهرتز
  const offlineCtx = new OfflineAudioContext(1, Math.ceil(inputBuffer.duration * SAMPLE_RATE), SAMPLE_RATE)
  const sourceNode = offlineCtx.createBufferSource()
  sourceNode.buffer = inputBuffer

  let currentNode: AudioNode = sourceNode

  if (options.removeNoise) {
    onProgress?.(25, 'راه‌اندازی شبکه عصبی و مدل ONNX...')
    const core = await getDeepFilterCore()

    const attenuation =
      options.noiseReductionIntensity === 'aggressive' ? 100 :
      options.noiseReductionIntensity === 'mild' ? 50 : 80

    core.setSuppressionLevel(attenuation)

    onProgress?.(45, 'ایجاد گره پردازش در AudioWorklet...')
    const filterNode = await core.createAudioWorkletNode(offlineCtx)

    currentNode.connect(filterNode)
    currentNode = filterNode
  }

  // اکولایزر ملایم استودیویی برای شفافیت کلام
  const highpass = offlineCtx.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = 80
  highpass.Q.value = 0.7
  currentNode.connect(highpass)
  currentNode = highpass

  const presence = offlineCtx.createBiquadFilter()
  presence.type = 'peaking'
  presence.frequency.value = 3000
  presence.gain.value = 2.5
  presence.Q.value = 1.0
  currentNode.connect(presence)
  currentNode = presence

  // افزایش حجم هوشمند
  if (options.boostVolume) {
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
  sourceNode.start(0)

  onProgress?.(65, 'در حال تفکیک امواج صوتی با هوش مصنوعی...')
  const renderedBuffer = await offlineCtx.startRendering()

  // نرمال‌سازی دقیق پیک خروجی
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

  onProgress?.(100, 'پایان پردازش استودیویی!')
  return renderedBuffer
}

export async function bufferToStandardAudio(
  buffer: AudioBuffer,
  originalFileName: string
): Promise<{ blob: Blob; fileName: string }> {
  const extMatch = originalFileName.match(/\.([0-9a-z]+)$/i)
  const originalExt = extMatch ? extMatch[1].toLowerCase() : 'wav'
  const baseName = originalFileName.replace(/\.[^/.]+$/, '')

  if (['mp3', 'm4a', 'aac', 'webm'].includes(originalExt) && typeof MediaRecorder !== 'undefined') {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 48000 })
      const dest = audioCtx.createMediaStreamDestination()
      const source = audioCtx.createBufferSource()
      source.buffer = buffer
      source.connect(dest)

      let mimeType = 'audio/webm;codecs=opus'
      if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4'
      else if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm'

      const recorder = new MediaRecorder(dest.stream, {
        mimeType,
        audioBitsPerSecond: 160000,
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
        fileName: `enhanced_${baseName}.${originalExt}`,
      }
    } catch {}
  }

  // خروجی WAV مونو استاندارد
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
