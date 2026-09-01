export interface TranscriptSegment {
  text: string
  start: number
  end: number
}
// ID دقیق از خروجی دستور بالا (بدون پیشوند models/)
export const TRANSCRIBE_MODEL = 'gemini-3.5-transcribe-live' // ← خروجی واقعی را بگذار


const WS_BASE =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'

// دریافت همان GEMINI_API_KEY موجود از سرور (بدون متغیر جدید)
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

  constructor(private apiKey: string, private model: string = TRANSCRIBE_MODEL) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${WS_BASE}?key=${this.apiKey}`)

      this.ws.onopen = () => {
        this.ws!.send(
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

        if (msg.setupComplete) {
          resolve()
          return
        }

        const text = msg?.serverContent?.modelTurn?.parts?.[0]?.text
        if (typeof text === 'string' && text.trim()) {
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
        reject(new Error('WebSocket error'))
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
