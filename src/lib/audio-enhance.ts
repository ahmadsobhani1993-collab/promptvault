export interface PcmChunk {
  data: string
  seconds: number
}

export interface WavPart {
  data: string
  start: number
  end: number
}

function toMonoFloat32(pcm: any): { f32: Float32Array; sampleRate: number } {
  if (typeof pcm?.getChannelData === 'function') {
    const len = pcm.length as number
    const chs = Math.max(1, pcm.numberOfChannels as number)
    const mix = new Float32Array(len)
    for (let c = 0; c < chs; c++) {
      const d = pcm.getChannelData(c) as Float32Array
      for (let i = 0; i < len; i++) mix[i] += d[i] / chs
    }
    return { f32: mix, sampleRate: pcm.sampleRate as number }
  }
  if (pcm instanceof Float32Array) return { f32: pcm, sampleRate: 16000 }
  if (pcm instanceof Int16Array) {
    const f = new Float32Array(pcm.length)
    for (let i = 0; i < pcm.length; i++) f[i] = pcm[i] / 32768
    return { f32: f, sampleRate: 16000 }
  }
  if (pcm instanceof ArrayBuffer) return toMonoFloat32(new Int16Array(pcm))
  if (pcm?.buffer instanceof ArrayBuffer) return toMonoFloat32(new Float32Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 4)))
  return { f32: new Float32Array(0), sampleRate: 16000 }
}

async function ensure16k(f32: Float32Array, sr: number): Promise<Float32Array> {
  if (sr === 16000 || f32.length === 0) return f32
  const outLen = Math.ceil((f32.length * 16000) / sr)
  const ctx = new OfflineAudioContext(1, outLen, 16000)
  const buf = ctx.createBuffer(1, f32.length, sr)
  buf.copyToChannel(f32, 0)
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.connect(ctx.destination)
  src.start()
  const out = await ctx.startRendering()
  return out.getChannelData(0)
}

/**
 * نرمال‌سازی peak — صدای ضعیف را تقویت می‌کند (تا ۸ برابر)
 * خروجی: Float32Array جدید (mutable نیست)
 */
function normalizePeak(f32: Float32Array, targetPeak = 0.95, maxGain = 8): Float32Array {
  let peak = 0
  for (let i = 0; i < f32.length; i++) peak = Math.max(peak, Math.abs(f32[i]))
  if (peak < 0.0001) return f32
  const gain = Math.min(targetPeak / peak, maxGain)
  if (gain <= 1.05) return f32
  const out = new Float32Array(f32.length)
  for (let i = 0; i < f32.length; i++) out[i] = f32[i] * gain
  console.log('[audio-enhance] normalized: peak', peak.toFixed(4), '→ gain', gain.toFixed(2))
  return out
}

function chunkFloat32(f32: Float32Array, sampleRate: number, sec = 1): PcmChunk[] {
  const per = Math.floor(sampleRate * sec)
  const chunks: PcmChunk[] = []
  for (let o = 0; o < f32.length; o += per) {
    const slice = f32.subarray(o, Math.min(o + per, f32.length))
    const i16 = new Int16Array(slice.length)
    for (let i = 0; i < slice.length; i++) {
      const v = Math.max(-1, Math.min(1, slice[i]))
      i16[i] = v < 0 ? v * 0x8000 : v * 0x7fff
    }
    const bytes = new Uint8Array(i16.buffer)
    let bin = ''
    const CH = 0x8000
    for (let i = 0; i < bytes.length; i += CH) {
      bin += String.fromCharCode(...bytes.subarray(i, i + CH))
    }
    chunks.push({ data: btoa(bin), seconds: slice.length / sampleRate })
  }
  return chunks
}

function f32ToWavBase64(f32: Float32Array, sr: number): string {
  const n = f32.length
  const buf = new ArrayBuffer(44 + n * 2)
  const v = new DataView(buf)
  const wstr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i))
  }
  wstr(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); wstr(8, 'WAVE'); wstr(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  wstr(36, 'data'); v.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) {
    const x = Math.max(-1, Math.min(1, f32[i]))
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true)
  }
  const bytes = new Uint8Array(buf)
  let bin = ''
  const CH = 0x8000
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH))
  return btoa(bin)
}

/**
 * مسیر صدا (Live WS): دیکود → مونو → 16k → نرمال → chunk 1s PCM
 */
export async function prepareChunks(pcm: unknown): Promise<{ chunks: PcmChunk[]; avg: number; duration: number }> {
  const { f32: mixed, sampleRate } = toMonoFloat32(pcm)
  let f32 = await ensure16k(mixed, sampleRate)

  // نرمال‌سازی
  f32 = normalizePeak(f32, 0.95, 6)

  // میانگین دامنه (تشخیص سکوت)
  let sum = 0
  let n = 0
  const st = Math.max(1, Math.floor(f32.length / 20000))
  for (let i = 0; i < f32.length; i += st) {
    sum += Math.abs(f32[i])
    n++
  }
  const avg = n ? sum / n : 0

  return { chunks: chunkFloat32(f32, 16000, 1), avg, duration: f32.length / 16000 }
}

/**
 * مسیر ویدیو (REST): دیکود → مونو → 16k → نرمال → chunk 30s WAV
 * 🔑 نرمال‌سازی قوی‌تر برای ویدیوهای کم‌صدا
 */
export async function prepareWavChunks(pcm: unknown, sec = 30): Promise<WavPart[]> {
  const { f32: mixed, sampleRate } = toMonoFloat32(pcm)
  let f32 = await ensure16k(mixed, sampleRate)

  // نرمال‌سازی قوی‌تر (تا ۸ برابر) برای ویدیوهایی که صدای ضعیف دارند
  f32 = normalizePeak(f32, 0.95, 8)

  const per = 16000 * sec
  const parts: WavPart[] = []
  for (let o = 0; o < f32.length; o += per) {
    const slice = f32.subarray(o, Math.min(o + per, f32.length))
    parts.push({
      data: f32ToWavBase64(slice, 16000),
      start: o / 16000,
      end: Math.min(f32.length, o + per) / 16000,
    })
  }
  return parts
}

/**
 * تشخیص بازه‌های گفتار از روی انرژی صدا
 * (برای هم‌ترازی زیرنویس با زمان واقعی صحبت)
 */
export async function getSpeechRegions(pcm: unknown): Promise<{ start: number; end: number }[]> {
  const { f32, sampleRate } = toMonoFloat32(pcm)
  const sr = sampleRate
  const frameSec = 0.25
  const frame = Math.floor(sr * frameSec)

  // انرژی هر فریم
  const energies: number[] = []
  for (let o = 0; o < f32.length; o += frame) {
    let sum = 0
    let n = 0
    for (let i = o; i < Math.min(o + frame, f32.length); i += 4) {
      sum += Math.abs(f32[i])
      n++
    }
    energies.push(n ? sum / n : 0)
  }

  // آستانه تطبیقی
  const sorted = [...energies].sort((a, b) => a - b)
  const p75 = sorted[Math.floor(sorted.length * 0.75)] || 0
  const thr = Math.max(0.008, p75 * 0.35)

  // ساخت بازه‌ها با hang برای پر کردن مکث‌های ریز
  const raw: { start: number; end: number }[] = []
  let cur: { start: number; end: number } | null = null
  let hang = 0
  energies.forEach((e, i) => {
    const t = i * frameSec
    if (e > thr) {
      if (!cur) cur = { start: t, end: t + frameSec }
      else cur.end = t + frameSec
      hang = 3
    } else if (cur) {
      cur.end = t + frameSec
      hang--
      if (hang <= 0) {
        raw.push(cur)
        cur = null
      }
    }
  })
  if (cur) raw.push(cur)

  // ادغام فاصله‌های کوچک + حذف نویز
  const merged: { start: number; end: number }[] = []
  for (const r of raw) {
    const last = merged[merged.length - 1]
    if (last && r.start - last.end < 0.4) last.end = r.end
    else if (r.end - r.start > 0.3) merged.push(r)
  }

  return merged.length ? merged : [{ start: 0, end: f32.length / sr }]
}
