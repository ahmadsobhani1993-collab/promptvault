export function formatAudioTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

export type ProcessingOptions = {
  removeNoise: boolean
  boostVolume: boolean
  voiceTone?: 'original' | 'male' | 'female' | 'studio'
  noiseReductionIntensity?: 'mild' | 'balanced' | 'aggressive'
}

// ----------------------------------------------------------------------------
// زنجیره رندر سخت‌افزاری Web Audio (کاملاً روان، بدون تیک‌تیک و بدون لگ)
// ----------------------------------------------------------------------------
export async function processAudioBuffer(
  inputBuffer: AudioBuffer,
  options: ProcessingOptions
): Promise<AudioBuffer> {
  const sampleRate = inputBuffer.sampleRate
  const channels = inputBuffer.numberOfChannels
  const offlineCtx = new OfflineAudioContext(channels, inputBuffer.length, sampleRate)

  const source = offlineCtx.createBufferSource()
  source.buffer = inputBuffer

  let currentNode: AudioNode = source

  // ۱. حذف نویز بدون تیک‌تیک با فیلتر شیب‌دار چندمرحله‌ای (24dB/Octave Cascaded Filters)
  if (options.removeNoise) {
    const intensity = options.noiseReductionIntensity || 'balanced'
    const hpFreq = intensity === 'aggressive' ? 120 : intensity === 'mild' ? 75 : 95
    const lpFreq = intensity === 'aggressive' ? 8000 : intensity === 'mild' ? 11000 : 9200

    // دو استیج High-Pass متوالی برای حذف کامل صدای هوم، باد، فن و لرزش زیر صدا بدون قطعی کلمات
    const hp1 = offlineCtx.createBiquadFilter()
    hp1.type = 'highpass'
    hp1.frequency.value = hpFreq
    hp1.Q.value = 0.707
    currentNode.connect(hp1)

    const hp2 = offlineCtx.createBiquadFilter()
    hp2.type = 'highpass'
    hp2.frequency.value = hpFreq
    hp2.Q.value = 0.707
    hp1.connect(hp2)

    // فیلتر شیب‌دار Low-Pass برای حذف قطعی هیس، ویزویز و فرکانس‌های مزاحم بالا
    const lp1 = offlineCtx.createBiquadFilter()
    lp1.type = 'lowpass'
    lp1.frequency.value = lpFreq
    lp1.Q.value = 0.707
    hp2.connect(lp1)

    const lp2 = offlineCtx.createBiquadFilter()
    lp2.type = 'lowpass'
    lp2.frequency.value = lpFreq
    lp2.Q.value = 0.707
    lp1.connect(lp2)

    currentNode = lp2
  }

  // ۲. اصلاح شفافیت استودیویی (حذف هوای گرفته و تقویت حضور کلام)
  const deMud = offlineCtx.createBiquadFilter()
  deMud.type = 'peaking'
  deMud.frequency.value = 450
  deMud.gain.value = -2.5
  deMud.Q.value = 1.0
  currentNode.connect(deMud)

  const clarity = offlineCtx.createBiquadFilter()
  clarity.type = 'peaking'
  clarity.frequency.value = 3200
  clarity.gain.value = 3.2
  clarity.Q.value = 1.2
  deMud.connect(clarity)
  currentNode = clarity

  // ۳. افزایش بلندی صدا با Dynamic Compressor پایدار (بدون نویز پامپینگ)
  if (options.boostVolume) {
    const comp = offlineCtx.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.knee.value = 18
    comp.ratio.value = 3.0
    comp.attack.value = 0.005
    comp.release.value = 0.12
    currentNode.connect(comp)

    const makeUpGain = offlineCtx.createGain()
    makeUpGain.gain.value = 1.35
    comp.connect(makeUpGain)
    currentNode = makeUpGain
  }

  // ۴. لیمیتر محافظ پیک خروجی برای جلوگیری از هرگونه دیستورشن و کلیک
  const limiter = offlineCtx.createDynamicsCompressor()
  limiter.threshold.value = -0.5
  limiter.knee.value = 0.0
  limiter.ratio.value = 20.0
  limiter.attack.value = 0.001
  limiter.release.value = 0.05
  currentNode.connect(limiter)

  limiter.connect(offlineCtx.destination)
  source.start(0)

  return await offlineCtx.startRendering()
}

// ----------------------------------------------------------------------------
// ذخیره با فرمت اصلی و بهینه
// ----------------------------------------------------------------------------
export async function bufferToStandardAudio(
  buffer: AudioBuffer,
  originalFileName: string
): Promise<{ blob: Blob; fileName: string }> {
  const extMatch = originalFileName.match(/\.([0-9a-z]+)$/i)
  const originalExt = extMatch ? extMatch[1].toLowerCase() : 'wav'
  const baseName = originalFileName.replace(/\.[^/.]+$/, '')

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
        fileName: `enhanced_${baseName}.${originalExt}`,
      }
    } catch {}
  }

  // خروجی استاندارد WAV
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const length = buffer.length
  const arrayBuffer = new ArrayBuffer(44 + length * numChannels * 2)
  const view = new DataView(arrayBuffer)

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + length * numChannels * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * 2, true)
  view.setUint16(32, numChannels * 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, length * numChannels * 2, true)

  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(c)[i]))
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
      offset += 2
    }
  }

  return {
    blob: new Blob([view], { type: 'audio/wav' }),
    fileName: `enhanced_${baseName}.${originalExt === 'mp4' ? 'mp4' : (originalExt === 'mp3' ? 'mp3' : 'wav')}`,
  }
}
