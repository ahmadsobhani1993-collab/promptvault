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
// حذف نویز بدون لگ، بدون پرش فاز و کاملاً پیوسته (Zero-Stutter Smooth Filter)
// ----------------------------------------------------------------------------
function applySmoothSpectralClean(
  input: Float32Array,
  sampleRate: number,
  intensity: 'mild' | 'balanced' | 'aggressive'
): Float32Array {
  const output = new Float32Array(input.length)
  const frameSize = 512
  const numFrames = Math.floor(input.length / frameSize)

  // ۱. محاسبه انرژی فریم‌ها برای تخمین سطح نویز پایه
  const energies = new Float32Array(numFrames)
  for (let f = 0; f < numFrames; f++) {
    let sum = 0
    const start = f * frameSize
    for (let i = 0; i < frameSize; i++) {
      const s = input[start + i]
      sum += s * s
    }
    energies[f] = Math.sqrt(sum / frameSize)
  }

  const sorted = Float32Array.from(energies).sort()
  const noiseFloor = Math.max(0.001, sorted[Math.floor(numFrames * 0.15)] * 1.6)

  const minGain = intensity === 'aggressive' ? 0.05 : intensity === 'mild' ? 0.25 : 0.12
  const power = intensity === 'aggressive' ? 2.0 : 1.5

  // ۲. فیلتر هموارسازی سمپل‌به‌سمپل جهت رفع کامل لگ و تق‌تق
  let currentGain = 1.0

  for (let f = 0; f < numFrames; f++) {
    const start = f * frameSize
    const energy = energies[f]

    let targetGain = 1.0
    if (energy < noiseFloor) {
      targetGain = minGain
    } else {
      const snr = (energy - noiseFloor) / (energy + 1e-6)
      targetGain = Math.max(minGain, Math.min(1.0, Math.pow(snr, power)))
    }

    for (let i = 0; i < frameSize; i++) {
      // ضریب تطبیقی پیوسته برای حذف کامل لگ و لکنت صوتی
      currentGain = currentGain * 0.992 + targetGain * 0.008
      output[start + i] = input[start + i] * currentGain
    }
  }

  for (let i = numFrames * frameSize; i < input.length; i++) {
    output[i] = input[i] * currentGain
  }

  return output
}

// ----------------------------------------------------------------------------
// زنجیره پردازش و مسترینگ استودیویی کلام
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
    // فیلتر حذف صدای باد، هوم و لرزش بم
    const hp = offlineCtx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 95
    hp.Q.value = 0.55
    currentNode.connect(hp)
    currentNode = hp

    // فیلتر مهار فرکانس‌های هیس زننده بالا
    const lp = offlineCtx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 9200
    lp.Q.value = 0.55
    currentNode.connect(lp)
    currentNode = lp
  }

  // تنظیم دائمی کیفیت استودیویی (شفافیت کلام و حذف کدری Boxy Sound)
  const deMud = offlineCtx.createBiquadFilter()
  deMud.type = 'peaking'
  deMud.frequency.value = 450
  deMud.gain.value = -2.0
  deMud.Q.value = 1.0
  currentNode.connect(deMud)
  currentNode = deMud

  const presence = offlineCtx.createBiquadFilter()
  presence.type = 'highshelf'
  presence.frequency.value = 4200
  presence.gain.value = 3.8
  currentNode.connect(presence)
  currentNode = presence

  // افزایش حجم هوشمند با کمپرسور ملایم استودیویی
  if (options.boostVolume) {
    const comp = offlineCtx.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.knee.value = 15
    comp.ratio.value = 2.5
    comp.attack.value = 0.01
    comp.release.value = 0.15
    currentNode.connect(comp)
    currentNode = comp

    const gain = offlineCtx.createGain()
    gain.gain.value = 1.28
    currentNode.connect(gain)
    currentNode = gain
  }

  currentNode.connect(offlineCtx.destination)
  source.start(0)

  const rendered = await offlineCtx.startRendering()
  let finalData = rendered.getChannelData(0)

  // اعمال حذف نویز پیوسته
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
// ذخیره با فرمت واقعی و فشرده
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
