import { mkWords, type Seg } from './subtitle-studio'

type Region = { start: number; end: number }
const HOP = 0.02 // فریم 20ms

function toMono(pcm: any): Float32Array {
  if (typeof pcm?.getChannelData === 'function') {
    const len = pcm.length as number
    const chs = Math.max(1, pcm.numberOfChannels as number)
    const mix = new Float32Array(len)
    for (let c = 0; c < chs; c++) {
      const d = pcm.getChannelData(c) as Float32Array
      for (let i = 0; i < len; i++) mix[i] += d[i] / chs
    }
    return mix
  }
  if (pcm instanceof Float32Array) return pcm
  if (pcm instanceof Int16Array) {
    const f = new Float32Array(pcm.length)
    for (let i = 0; i < pcm.length; i++) f[i] = pcm[i] / 32768
    return f
  }
  if (pcm instanceof ArrayBuffer) return toMono(new Int16Array(pcm))
  return new Float32Array(0)
}

function computeEnv(f32: Float32Array, sr: number): Float32Array {
  const hop = Math.max(1, Math.floor(sr * HOP))
  const n = Math.floor(f32.length / hop)
  const env = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let sum = 0
    const o = i * hop
    const end = Math.min(o + hop, f32.length)
    for (let j = o; j < end; j += 2) sum += f32[j] * f32[j]
    env[i] = Math.sqrt(sum / Math.max(1, (end - o) / 2))
  }
  return env
}

function regionsFromEnv(env: Float32Array): { regions: Region[]; thr: number } {
  const sorted = Array.from(env).sort((a, b) => a - b)
  const p25 = sorted[Math.floor(sorted.length * 0.25)] || 0
  const p90 = sorted[Math.floor(sorted.length * 0.9)] || 0
  const thr = Math.max(0.006, p25 + (p90 - p25) * 0.3)

  const raw: Region[] = []
  let cur: Region | null = null
  let hang = 0
  for (let i = 0; i < env.length; i++) {
    const t = i * HOP
    if (env[i] > thr) {
      if (!cur) cur = { start: t, end: t + HOP }
      else cur.end = t + HOP
      hang = 4
    } else if (cur) {
      cur.end = t + HOP
      if (--hang <= 0) { raw.push(cur); cur = null }
    }
  }
  if (cur) raw.push(cur)

  const out: Region[] = []
  for (const r of raw) {
    const last = out[out.length - 1]
    if (last && r.start - last.end < 0.25) last.end = r.end
    else if (r.end - r.start >= 0.12) out.push(r)
  }
  return { regions: out.length ? out : [{ start: 0, end: env.length * HOP }], thr }
}

/**
 * هم‌ترازی اجباری جملات/کلمات روی انرژی صدا
 */
export function alignSegments(segs: Seg[], pcm: unknown): Seg[] {
  if (!segs.length) return segs
  const f32 = toMono(pcm)
  if (!f32.length) return segs
  const sr = (pcm as any)?.sampleRate || 16000
  const env = computeEnv(f32, sr)
  const { regions, thr } = regionsFromEnv(env)
  const totalSpeech = regions.reduce((a, r) => a + (r.end - r.start), 0)

  // ─── DP: نگاشت یکنوا جمله‌ها روی بازه‌های گفتار ───
  const wc = segs.map((s) => s.text.split(/\s+/).filter(Boolean).length)
  const totalW = wc.reduce((a, b) => a + b, 0) || 1
  const exp = wc.map((w) => (w / totalW) * totalSpeech)
  const rdur = regions.map((r) => r.end - r.start)
  const n = segs.length
  const m = regions.length
  const INF = Number.MAX_SAFE_INTEGER / 4
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(INF))
  const ch: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(-1))
  dp[0][0] = 0
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      let best = INF
      let bk = -1
      let dur = 0
      for (let k = j; k >= 1 && j - k <= 10; k--) {
        dur += rdur[k - 1]
        const e = Math.max(0.3, exp[i - 1])
        const r = (dur - e) / e
        const c = dp[i - 1][k - 1] + r * r
        if (c < best) { best = c; bk = k - 1 }
      }
      if (m < n && dp[i - 1][j] < best) { best = dp[i - 1][j]; bk = j }
      dp[i][j] = best
      ch[i][j] = bk
    }
  }
  const spans: { a: number; b: number }[] = new Array(n)
  let jj = m
  for (let i = n; i >= 1; i--) {
    const bk = ch[i][jj]
    spans[i - 1] = { a: bk, b: jj }
    jj = bk
  }

  // ─── نگاشت معکوس زمان voiced + snap به onset ───
  const voicedCum = new Float32Array(env.length + 1)
  for (let i = 0; i < env.length; i++) voicedCum[i + 1] = voicedCum[i] + (env[i] > thr ? HOP : 0)

  const timeAtVoiced = (target: number, loF: number, hiF: number) => {
    const base = voicedCum[loF]
    const total = voicedCum[hiF] - base
    if (total <= 0) return loF * HOP
    const want = base + Math.min(total, Math.max(0, target))
    let lo = loF
    let hi = hiF
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (voicedCum[mid + 1] < want) lo = mid + 1
      else hi = mid
    }
    return lo * HOP
  }

  const onsetSnap = (t: number) => {
    const c = Math.round(t / HOP)
    for (let d = 0; d <= 4; d++) {
      for (const s of [d, -d]) {
        const i = c + s
        if (i >= 0 && i < env.length && env[i] > thr) return i * HOP
      }
    }
    return t
  }

  const out: Seg[] = segs.map((s, idx) => {
    const { a, b } = spans[idx]
    if (a === b) {
      // بدون بازه اختصاصی → fallback تناسبی
      const before = segs.slice(0, idx).reduce((x, y) => x + y.text.length, 0)
      const all = segs.reduce((x, y) => x + y.text.length, 0) || 1
      const tt = (before / all) * (env.length * HOP)
      const end = tt + Math.max(0.5, exp[idx])
      return { ...s, start: tt, end, words: mkWords(s.text, tt, end) }
    }

    const loF = Math.max(0, Math.floor(regions[a].start / HOP))
    const hiF = Math.min(env.length, Math.ceil(regions[b - 1].end / HOP))
    const words = s.text.split(/\s+/).filter(Boolean)
    const lens = words.map((w) => w.length)
    const tl = lens.reduce((x, y) => x + y, 0) || 1
    const spanVoiced = voicedCum[hiF] - voicedCum[loF]

    let acc = 0
    const ws: number[] = []
    const we: number[] = []
    for (let k = 0; k < words.length; k++) {
      const st = onsetSnap(timeAtVoiced(acc, loF, hiF))
      acc += (lens[k] / tl) * spanVoiced
      const en = Math.max(st + 0.12, timeAtVoiced(acc, loF, hiF))
      ws.push(st)
      we.push(en)
    }
    return {
      ...s,
      start: ws[0],
      end: we[we.length - 1],
      words: words.map((w, k) => ({ w, start: ws[k], end: we[k] })),
    }
  })

  // ─── تضمین یکنوایی (بدون هم‌پوشانی) ───
  for (let i = 1; i < out.length; i++) {
    if (out[i].start < out[i - 1].end) {
      const mid = (out[i - 1].end + out[i].start) / 2
      out[i - 1] = { ...out[i - 1], end: mid, words: mkWords(out[i - 1].text, out[i - 1].start, mid) }
      out[i] = { ...out[i], start: mid, words: mkWords(out[i].text, mid, out[i].end) }
    }
  }
  return out
}
