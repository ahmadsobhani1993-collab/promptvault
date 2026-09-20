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
let dfStateInstance: any = null

/**
 * راه‌اندازی و کش کردن موتور و مدل هوش مصنوعی DeepFilterNet3
 */
export async function initDeepFilter(): Promise<any> {
  if (dfStateInstance) return dfStateInstance

  // ۱. بارگذاری اسکریپت ران‌تایم WASM در صورت عدم وجود
  if (!(window as any).DfState) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = '/lib/deepfilternet3.js'
      script.onload = () => resolve()
      script.onerror = () =>
        reject(new Error('فایل public/lib/deepfilternet3.js در دسترس نیست یا لود نشد.'))
      document.head.appendChild(script)
    })
  }

  const { DfInit, DfState } = window as any
  if (!DfInit || !DfState) {
    throw new Error('کلاس DfState یا تابع DfInit در اسکریپت تعریف نشده است.')
  }

  // ۲. اینیشیالایز کردن ماژول WebAssembly با تزریق ایمپورت‌های wbg
  await DfInit('/model/v3/pkg/df_bg.wasm')

  // ۳. واکشی فایل مدل فشرده ONNX
  const modelResp = await fetch('/model/v3/models/DeepFilterNet3_onnx.tar.gz')
  if (!modelResp.ok) {
    throw new Error(`دانلود مدل ONNX با خطای ${modelResp.status} مواجه شد. لطفاً مسیر فایل را بررسی کنید.`)
  }

  const modelBuffer = await modelResp.arrayBuffer()
  const modelBytes = new Uint8Array(modelBuffer)

  // ۴. نمونه‌سازی از وضعیت استنتاج شبکه عصبی
  dfStateInstance = new DfState(modelBytes)
  return dfStateInstance
}

/**
 * پردازش صوتی با عبور دادن فریم‌های صدا از داخل مدل هوش مصنوعی
 * @param maxDurationSeconds در صورت ارسال عدد، تنها همان بازه (مثلاً ۶۰ ثانیه) پردازش می‌شود.
 */
export async function processAudioBuffer(
  inputBuffer: AudioBuffer,
  options: ProcessingOptions,
  maxDurationSeconds: number | null,
  onProgress?: (pct: number, status: string) => void
): Promise<AudioBuffer> {
  onProgress?.(10, 'در حال راه‌اندازی موتور و مدل عصبی DeepFilterNet3...')
  const dfState = await initDeepFilter()

  // اعمال درصد فیلتر نویز روی استیت مدل
  dfState.set_atten_lim(options.attenuationLevel)

  const targetDuration = maxDurationSeconds
    ? Math.min(inputBuffer.duration, maxDurationSeconds)
    : inputBuffer.duration

  const totalSamples = Math.ceil(targetDuration * SAMPLE_RATE)

  // ۱. رندر اولیه به کانال مونو با نرخ نمونه‌برداری استاندارد مدل (48kHz)
  const offlineCtx = new OfflineAudioContext(1, totalSamples, SAMPLE_RATE)
  const src = offlineCtx.createBufferSource()
  src.buffer = inputBuffer

  let currentNode: AudioNode = src

  // فیلتر شیب‌دار بم برای حذف لرزش‌ها و هوای اضافه زیر کلام
  if (options.voiceEq) {
    const hp = offlineCtx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 80
    hp.Q.value = 0.7
    currentNode.connect(hp)
    currentNode = hp

    const presence = offlineCtx.createBiquadFilter()
    presence.type = 'peaking'
    presence.frequency.value = 3200
    presence.gain.value = 2.5
    presence.Q.value = 1.0
    currentNode.connect(presence)
    currentNode = presence
  }

  currentNode.connect(offlineCtx.destination)
  src.start(0)

  onProgress?.(30, 'در حال آماده‌سازی فریم‌های صوتی...')
  const preProcessed = await offlineCtx.startRendering()
  const rawSamples = preProcessed.getChannelData(0)

  // ۲. پردازش استنتاج فریم‌به‌فریم با شبکه عصبی (اندازه فریم استاندارد: 480 سمپل = 10 میلی‌ثانیه)
  const FRAME_SIZE = 480
  const processedSamples = new Float32Array(rawSamples.length)
  const totalFrames = Math.floor(rawSamples.length / FRAME_SIZE)

  onProgress?.(45, 'در حال تفکیک کلام و حذف نویز با هوش مصنوعی...')

  for (let f = 0; f < totalFrames; f++) {
    const offset = f * FRAME_SIZE
    const frame = rawSamples.subarray(offset, offset + FRAME_SIZE)

    // پاس دادن مستقیم فریم به متد استنتاج باینری WASM
    const cleanedFrame = dfState.process(frame)
    processedSamples.set(cleanedFrame, offset)

    // به‌روزرسانی نوار پیشرفت و جلوگیری از فریز شدن UI مرورگر
    if (f % 60 === 0) {
      const pct = Math.round(45 + (f / totalFrames) * 45)
      onProgress?.(pct, `در حال پاک‌سازی امواج (${pct}%)...`)
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  // کپی بخش باقیمانده انتهای صوت
  const remainingSamples = rawSamples.length % FRAME_SIZE
  if (remainingSamples > 0) {
    const offset = totalFrames * FRAME_SIZE
    processedSamples.set(rawSamples.subarray(offset), offset)
  }

  // ۳. نرمال‌سازی دامنه و حجم صدا در صورت انتخاب کاربر (Peak Normalization ملایم)
  if (options.loudnessNormalization) {
    let peak = 0
    for (let i = 0; i < processedSamples.length; i++) {
      const abs = Math.abs(processedSamples[i])
      if (abs > peak) peak = abs
    }
    if (peak > 0.01) {
      const mult = 0.85 / peak
      for (let i = 0; i < processedSamples.length; i++) {
        processedSamples[i] *= mult
      }
    }
  }

  // ۴. ساخت AudioBuffer تمیز نهایی
  const outCtx = new OfflineAudioContext(1, totalSamples, SAMPLE_RATE)
  const outBuf = outCtx.createBuffer(1, processedSamples.length, SAMPLE_RATE)
  outBuf.getChannelData(0).set(processedSamples)

  onProgress?.(100, 'پردازش استودیویی با موفقیت انجام شد!')
  return outBuf
}

/**
 * خروجی گرفتن به صورت فایل کم‌حجم و استاندارد (MP3, M4A, WAV)
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

  // ۱. تولید خروجی فشرده با اینکودر داخلی سیستم (حجم فایل بسیار کم و زیر ۲ مگابایت می‌ماند)
  if (['mp3', 'm4a', 'aac', 'webm'].includes(targetExt) && typeof MediaRecorder !== 'undefined') {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: SAMPLE_RATE,
      })
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
        fileName: `${baseName}_enhanced.${targetExt === 'm4a' ? 'm4a' : 'mp3'}`,
      }
    } catch {
      // در صورت بروز هرگونه مشکل، به انکودر WAV fallback می‌شود
    }
  }

  // ۲. خروجی استاندارد WAV (مونو، ۱۶ بیت، ۴۸ کیلوهرتز)
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
  view.setUint16(20, 1, true) // PCM Linear
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
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return {
    blob: new Blob([view], { type: 'audio/wav' }),
    fileName: `${baseName}_enhanced.wav`,
  }
}
