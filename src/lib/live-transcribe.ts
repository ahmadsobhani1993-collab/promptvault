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
  private isConnected = false

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
        // ارسال پیام handshake لایو به BidiGenerateContent
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
        this.isConnected = true
        resolve()
      }

      this.ws.onmessage = (event) => {
        try {
          const res = JSON.parse(event.data)
          if (res.proxyError) {
            console.error('WS_PROXY_ERROR:', res.proxyError)
            this.onError?.(res.proxyError)
            return
          }

          // دریافت تکست استریم شده از مدل
          const parts = res.serverContent?.modelTurn?.parts
          if (parts && Array.isArray(parts)) {
            for (const part of parts) {
              if (part.text) {
                this.currentText += part.text
              }
            }
          }

          // پایان یک عبارت گفتاری
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
        } catch (e) {
          // فریم‌های غیر JSON یا سیگنال‌های داخلی
        }
      }

      this.ws.onerror = (e) => {
        console.error('LIVE_WS_ERROR:', e)
        this.onError?.('خطا در وب‌سوکت ترنسکرایب لایو')
      }

      this.ws.onclose = () => {
        this.isConnected = false
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
      // ارسال چانک صوتی با استاندارد realtimeInput در Bidi
      const msg = {
        realtimeInput: {
          mediaChunks: [
            {
              mimeType: 'audio/pcm;rate=16000',
              data: base64Pcm,
            },
          ],
        },
      }
      this.ws.send(JSON.stringify(msg))
      this.secondsSent += durationSec
      return true
    } catch {
      return false
    }
  }

  async finish(timeoutMs = 6000): Promise<TranscriptSegment[]> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
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
