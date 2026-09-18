export const LIVE_WS_URL = 'wss://gemini-live-proxy.ahmadsobhani1993.workers.dev/gemini-live'
export const TRANSCRIBE_MODEL = 'models/gemini-3.5-transcribe-live'

export interface TranscriptSegment {
  text: string
  start: number
  end: number
}

function parseStreamText(payload: any): string {
  if (!payload) return ''
  let text = ''

  // استخراج متن از پارت‌های نوبت مدل
  const parts = payload.serverContent?.modelTurn?.parts
  if (Array.isArray(parts)) {
    for (const p of parts) {
      if (typeof p?.text === 'string') text += p.text
    }
  }

  // استخراج متن از ساختارهای ترنسکریپت اختصاصی
  const directTranscript = payload.serverContent?.transcript || payload.serverContent?.interimTranscript
  if (typeof directTranscript === 'string') {
    text += directTranscript
  } else if (typeof directTranscript?.text === 'string') {
    text += directTranscript.text
  }

  return text
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
        console.log('%c[WS] Connecting...', 'color: orange')
        this.ws = new WebSocket(LIVE_WS_URL)
      } catch (err: any) {
        return reject(err)
      }

      this.ws.onopen = () => {
        console.log('%c[WS] Connected. Handshaking...', 'color: green')
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
        resolve()
      }

      this.ws.onmessage = (event) => {
        try {
          const res = JSON.parse(event.data)

          if (res.proxyError) {
            console.error('PROXY_ERR:', res.proxyError)
            this.onError?.(res.proxyError)
            return
          }

          // لاگ صریح محتوای متنی
          const fragment = parseStreamText(res)
          if (fragment) {
            console.log('%c[TRANSCRIBE TEXT]:', 'color: lime; font-weight: bold; font-size: 13px;', fragment)
            this.currentText += fragment
          }

          // ثبت نهایی سگمنت با رویداد اتمام نوبت
          if (res.serverContent?.turnComplete && this.currentText.trim()) {
            const segEnd = Math.max(this.segStart + 0.5, this.secondsSent)
            const seg: TranscriptSegment = {
              text: this.currentText.trim(),
              start: this.segStart,
              end: segEnd,
            }
            this.segments.push(seg)
            this.onSegment?.(seg)
            this.currentText = ''
            this.segStart = segEnd
            this.lastEnd = segEnd
          }
        } catch {}
      }

      this.ws.onerror = (e) => {
        console.error('LIVE_WS_ERR:', e)
        this.onError?.('خطای وب‌سوکت لایو')
      }

      this.ws.onclose = () => {
        if (this.currentText.trim()) {
          const segEnd = Math.max(this.segStart + 0.5, this.secondsSent)
          const seg: TranscriptSegment = {
            text: this.currentText.trim(),
            start: this.segStart,
            end: segEnd,
          }
          this.segments.push(seg)
          this.onSegment?.(seg)
          this.currentText = ''
        }
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

  async finish(timeoutMs = 6000): Promise<TranscriptSegment[]> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ clientContent: { turnComplete: true } }))
      } catch {}
      await new Promise((r) => setTimeout(r, Math.min(timeoutMs, 2500)))
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
