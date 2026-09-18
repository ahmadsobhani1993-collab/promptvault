export const LIVE_WS_URL = 'wss://gemini-live-proxy.ahmadsobhani1993.workers.dev/gemini-live'
export const TRANSCRIBE_MODEL = 'models/gemini-3.5-transcribe-live'

export interface TranscriptSegment {
  text: string
  start: number
  end: number
}

export class LiveTranscriber {
  private ws: WebSocket | null = null
  private secondsSent = 0
  private lastEnd = 0
  private segments: TranscriptSegment[] = []
  private currentText = ''
  private segStart = 0

  onSegment?: (seg: TranscriptSegment) => void
  onError?: (msg: string) => void
  onClose?: () => void

  constructor(private model: string = TRANSCRIBE_MODEL, offset = 0) {
    this.secondsSent = offset
    this.lastEnd = offset
    this.segStart = offset
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(LIVE_WS_URL)
      } catch (err: any) {
        return reject(err)
      }

      this.ws.onopen = () => {
        const setupMsg = {
          setup: {
            model: this.model,
            generationConfig: {
              responseModalities: ['TEXT'],
              temperature: 0.1,
            },
          },
        }
        this.ws?.send(JSON.stringify(setupMsg))
      }

      this.ws.onmessage = (event) => {
        try {
          const res = JSON.parse(event.data)

          // پس از تایید ستاپ، اجازه ارسال صوت را می‌دهیم
          if (res.setupComplete) {
            resolve()
            return
          }

          if (res.proxyError) {
            this.onError?.(res.proxyError)
            return
          }

          // استخراج دقیق بر اساس ساختار ارسالی مدل جمینای لایو
          let txt = ''
          if (res.serverContent?.inputTranscription?.text) {
            txt = res.serverContent.inputTranscription.text
          } else if (res.serverContent?.modelTurn?.parts) {
            for (const p of res.serverContent.modelTurn.parts) {
              if (p.text) txt += p.text
            }
          }

          if (txt.trim()) {
            const segEnd = Math.max(this.segStart + 1.0, this.secondsSent)
            const seg: TranscriptSegment = {
              text: txt.trim(),
              start: this.segStart,
              end: segEnd,
            }
            this.segments.push(seg)
            this.onSegment?.(seg)
            this.segStart = segEnd
            this.lastEnd = segEnd
          }
        } catch {}
      }

      this.ws.onerror = () => {
        this.onError?.('خطای اتصال به وب‌سوکت لایو')
      }

      this.ws.onclose = () => {
        this.onClose?.()
      }
    })
  }

  sendChunk(base64Pcm: string, durationSec: number): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false
    try {
      this.ws.send(
        JSON.stringify({
          realtimeInput: {
            mediaChunks: [
              {
                mimeType: 'audio/pcm;rate=16000',
                data: base64Pcm,
              },
            ],
          },
        })
      )
      this.secondsSent += durationSec
      return true
    } catch {
      return false
    }
  }

  async finish(timeoutMs = 8000): Promise<TranscriptSegment[]> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ clientContent: { turnComplete: true } }))
      } catch {}
      await new Promise((r) => setTimeout(r, Math.min(timeoutMs, 4000)))
      try {
        this.ws.close()
      } catch {}
    }
    return this.segments
  }

  close() {
    try {
      this.ws?.close()
    } catch {}
  }
}
