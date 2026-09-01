export interface TranscriptSegment {
  text: string
  start: number
  end: number
}

// مدل Live — اگر ارور invalid model آمد، ID دقیق را از AI Studio جایگزین کن
export const TRANSCRIBE_MODEL = 'gemini-3.0-flash-live'

// Cloudflare Worker proxy — کلید Gemini داخل Worker تزریق می‌شود، نه اینجا
const WS_BASE =
  'wss://gemini-live-proxy.ahmadsobhani1993.workers.dev/gemini-live'

// برای سازگاری با rest-transcribe (حالت REST fallback)
export async function getGeminiKey(): Promise<string> {
  const res = await fetch('/api/gemini/key')
  if (!res.ok) throw new Error('Gemini key fetch failed')
  const data = await res.json()
  return data.key
}

export class LiveTranscriber {
  private ws: WebSocket | null = null
  private secondsSent = 0
  private lastEnd = 0
  private segments: TranscriptSegment[] = []

  onSegment: (seg: TranscriptSegment) => void = () => {}
  onError: (msg: string) => void = () => {}
  onClose: () => void = () => {}
  onRawMessage: (msg: any) => void = () => {}

  // apiKey دیگر استفاده نمی‌شود (Worker کلید دارد) — فقط برای سازگاری امضا
  constructor(private apiKey?: string, private model: string = TRANSCRIBE_MODEL) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_BASE) // بدون ?key=
      let settled = false

      this.ws.onopen = () => {
        this.ws?.send(
          JSON.stringify({
            setup: {
              model: `models/${this.model}`,
              generationConfig: { responseModalities: ['TEXT'] },
            },
          })
        )
      }

      this.ws.onmessage = (ev) => {
        let msg: any
        try {
          msg = JSON.parse(ev.data as string)
        } catch {
          return
        }

        this.onRawMessage(msg)

        // خطاهای Gemini (مثلاً مدل اشتباه / کلید بد)
        if (msg?.error) {
          const errText = msg.error?.message || JSON.stringify(msg.error)
          this.onError('Gemini: ' + errText)
          if (!settled) {
            settled = true
            reject(new Error('Gemini: ' + errText))
          }
          return
        }

        if (msg.setupComplete) {
          if (!settled) {
            settled = true
            resolve()
          }
          return
        }

        const text =
          msg?.serverContent?.modelTurn?.parts
            ?.map((p: any) => p.text)
            ?.filter(Boolean)
            ?.join(' ') || ''

        if (text.trim()) {
          const seg: TranscriptSegment = {
            text: text.trim(),
            start: this.lastEnd,
            end: Math.max(this.lastEnd + 0.1, this.secondsSent),
          }
          this.lastEnd = seg.end
          this.segments.push(seg)
          this.onSegment(seg)
        }
      }

      this.ws.onerror = () => {
        this.onError('WebSocket error')
        if (!settled) {
          settled = true
          reject(new Error('WebSocket error'))
        }
      }

      this.ws.onclose = () => this.onClose()
    })
  }

  sendChunk(base64: string, seconds: number) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(
      JSON.stringify({
        realtimeInput: {
          mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: base64 }],
        },
      })
    )
    this.secondsSent += seconds
  }

  finish() {
    setTimeout(() => this.ws?.close(), 2000)
  }

  getSegments() {
    return this.segments
  }
}
