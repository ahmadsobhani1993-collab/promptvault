export interface PcmChunk {
  data: string
  seconds: number
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

/**
 * دیکود‌شده → مونو → 16k → نرمال → chunk
 */
export async function prepareChunks(pcm: unknown): Promise<{ chunks: PcmChunk[]; avg: number; duration: number }> {
  const { f32: mixed, sampleRate } = toMonoFloat32(pcm)
  const f32 = await ensure16k(mixed, sampleRate)

  // میانگین دامنه (تشخیص سکوت)
  let sum = 0
  let n = 0
  const st = Math.max(1, Math.floor(f32.length / 20000))
  for (let i = 0; i < f32.length; i += st) {
    sum += Math.abs(f32[i])
    n++
  }
  const avg = n ? sum / n : 0

  // نرمال‌سازی peak — صدای ضعیف ویدیو را تقویت می‌کند
  let peak = 0
  for (let i = 0; i < f32.length; i++) peak = Math.max(peak, Math.abs(f32[i]))
  if (peak > 0.0001) {
    const gain = Math.min(0.95 / peak, 6)
    if (gain > 1.05) for (let i = 0; i < f32.length; i++) f32[i] *= gain
  }

  return { chunks: chunkFloat32(f32, 16000, 1), avg, duration: f32.length / 16000 }
}
