import lamejs from "@breezystack/lamejs";

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

function mixToMono(audioBuffer: AudioBuffer, targetLength: number): Float32Array {
  const numChannels = audioBuffer.numberOfChannels
  const mono = new Float32Array(targetLength)
  const len = Math.min(audioBuffer.length, targetLength)

  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      mono[i] += channelData[i] / numChannels
    }
  }
  return mono
}

export async function getInitializedCore(attenuationLevel: number, onLog?: (msg: string) => void) {
  if (!corePromise) {
    corePromise = (async () => {
      onLog?.('در حال بارگذاری ماژول رسمی DeepFilterNet3...')
      console.log('[DFN3] Importing module...')

      const { DeepFilterNet3Core } = await import('deepfilternet3-noise-filter')

      onLog?.('در حال اتصال به فایل‌های مدل در سرور محلی...')
      const localCdnUrl = `${window.location.origin}/models/deepfilter`
      console.log(`[DFN3] Loading assets from: ${localCdnUrl}`)

      const core = new DeepFilterNet3Core({
        sampleRate: SAMPLE_RATE,
        noiseReductionLevel: attenuationLevel,
        assetConfig: {
          cdnUrl: localCdnUrl,
        },
      })

      await core.initialize()
      console.log('[DFN3] Initialized successfully.')
      return core
    })().catch((err) => {
      corePromise = null
      console.error('[DFN3 Init Failed]', err)
      throw err
    })
  }

  const core = await corePromise
  core.setSuppressionLevel(attenuationLevel)
  return core
}

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

  log('آماده‌سازی بافر صوتی...', 10)

  const targetDuration = maxDurationSeconds
    ? Math.min(inputBuffer.duration, maxDurationSeconds)
    : inputBuffer.duration

  const totalSamples = Math.ceil(targetDuration * SAMPLE_RATE)

  log('در حال دریافت هسته هوش مصنوعی...', 25)
  const core = await getInitializedCore(options.attenuationLevel, (m) => log(m, 30))

  log('ساخت گراف صوتی OfflineAudioContext...', 45)
  const offlineCtx = new OfflineAudioContext(1, totalSamples, SAMPLE_RATE)

  const monoSamples = mixToMono(inputBuffer, totalSamples)
  const monoBuffer = offlineCtx.createBuffer(1, totalSamples, SAMPLE_RATE)
  monoBuffer.getChannelData(0).set(monoSamples)

  const source = offlineCtx.createBufferSource()
  source.buffer = monoBuffer

  let currentNode: AudioNode = source

  log('ایجاد AudioWorkletNode رسمی...', 50)
  const filterNode = await core.createAudioWorkletNode(offlineCtx)
  currentNode.connect(filterNode)
  currentNode = filterNode

  if (options.voiceEq) {
    log('اعمال Voice EQ...', 60)
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
  }

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

  log('در حال رندر آفلاین امواج صوتی...', 70)
  const renderedBuffer = await offlineCtx.startRendering()

  // تست تشخیصی کاهش کف نویز
  const out = renderedBuffer.getChannelData(0)
  const inp = monoBuffer.getChannelData(0)

  const blockRms = (x: Float32Array, block = 4800) => {
    const r: number[] = []
    for (let i = 0; i + block <= x.length; i += block) {
      let s = 0
      for (let j = 0; j < block; j++) s += x[i + j] * x[i + j]
      r.push(Math.sqrt(s / block))
    }
    return r.sort((a, b) => a - b)
  }

  const db = (v: number) => 20 * Math.log10(v + 1e-9)
  const a = blockRms(inp), b = blockRms(out)
  const q = Math.floor(a.length * 0.1)

  const testReport = {
    noiseFloorInDb: db(a[q]),
    noiseFloorOutDb: db(b[q]),
    dropDb: db(a[q]) - db(b[q]),
  }
  console.log('[DFN3 Noise Floor Verification]', testReport)

  if (options.loudnessNormalization) {
    let peak = 0
    for (let i = 0; i < out.length; i++) {
      const absVal = Math.abs(out[i])
      if (absVal > peak) peak = absVal
    }
    if (peak > 0.01) {
      const gain = 0.85 / peak
      for (let i = 0; i < out.length; i++) {
        out[i] *= gain
      }
    }
  }

  log('پردازش با موفقیت انجام شد!', 100)
  return renderedBuffer
}

function floatToInt16(samples: Float32Array): Int16Array {
  const int16 = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    int16[i] = Math.max(-1, Math.min(1, samples[i])) * 0x7fff
  }
  return int16
}

export async function bufferToStandardAudio(
  buffer: AudioBuffer,
  originalFileName: string,
  format: 'mp3' | 'wav' = 'mp3'
): Promise<{ blob: Blob; fileName: string }> {
  const baseName = originalFileName.replace(/\.[^/.]+$/, '')
  const samples = buffer.getChannelData(0)

  if (format === 'mp3') {
    const mp3enc = new (lamejs as any).Mp3Encoder(1, SAMPLE_RATE, 192)
    const int16 = floatToInt16(samples)
    const chunks: Uint8Array[] = []
    const blockSize = 1152

    for (let i = 0; i < int16.length; i += blockSize) {
      const buf = mp3enc.encodeBuffer(int16.subarray(i, i + blockSize))
      if (buf.length > 0) chunks.push(buf)
    }
    const end = mp3enc.flush()
    if (end.length > 0) chunks.push(end)

    return {
      blob: new Blob(chunks, { type: 'audio/mpeg' }),
      fileName: `${baseName}_enhanced.mp3`,
    }
  }

  // خروجی WAV
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
