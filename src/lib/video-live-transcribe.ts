export const LIVE_WS_URL = 'wss://gemini-live-proxy.ahmadsobhani1993.workers.dev/gemini-live'
export const TRANSCRIBE_MODEL = 'models/gemini-3.5-transcribe-live'

export interface VideoTranscriptSegment {
  text: string
  start: number
  end: number
}

export class VideoLiveTranscriber {
  private ws: WebSocket | null = null
  private secondsSent = 0
  private lastEnd = 0
  private segments: VideoTranscriptSegment[] = []
  private segStart = 0
  private lastText = ''

  onSegment?: (seg: VideoTranscriptSegment) => void
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
        console.log('%c[VIDEO-WS: STEP 1] Connecting...', 'color: #3b82f6; font-weight: bold;')
        this.ws = new WebSocket(LIVE_WS_URL)
      } catch (err: any) {
        return reject(err)
      }

      this.ws.onopen = () => {
        console.log('%c[VIDEO-WS: STEP 2] Connected! Sending Setup...', 'color: #10b981;')
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

          if (res.setupComplete) {
            console.log('%c[VIDEO-WS: STEP 3] Handshake Confirmed!', 'color: #06b6d4; font-weight: bold;')
            resolve()
            return
          }

          if (res.proxyError) {
            this.onError?.(res.proxyError)
            return
          }

          // استخراج مستقیم از کلید زنده interimInputTranscription و inputTranscription
          let txt = ''
          if (res.serverContent?.interimInputTranscription?.text) {
            txt = res.serverContent.interimInputTranscription.text
          } else if (res.serverContent?.inputTranscription?.text) {
            txt = res.serverContent.inputTranscription.text
          } else if (res.serverContent?.modelTurn?.parts) {
            for (const p of res.serverContent.modelTurn.parts) {
              if (p.text) txt += p.text
            }
          }

          txt = (txt || '').trim()

          // دریافت و افزودن قطعات جدید کلمات
          if (txt && txt !== this.lastText) {
            console.log('%c[VIDEO-WS: CAPTION EMITTED]:', 'color: #22c55e; font-size: 14px; font-weight: bold;', txt)
            this.lastText = txt
            const segEnd = Math.max(this.segStart + 1.0, this.secondsSent)
            const seg: VideoTranscriptSegment = {
              text: txt,
              start: this.segStart,
              end: segEnd,
            }
            this.segments.push(seg)
            this.onSegment?.(seg)
            this.segStart = segEnd
            this.lastEnd = segEnd
          }
        } catch (e) {
          console.warn('[VIDEO-WS: PARSE ERR]:', e)
        }
      }

      this.ws.onerror = () => {
        this.onError?.('خطای وب‌سوکت لایو ویدیو')
      }

      this.ws.onclose = (ev) => {
        console.log('%c[VIDEO-WS: CLOSED]:', 'color: gray;', ev.code, ev.reason)
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

  async finish(timeoutMs = 9000): Promise<VideoTranscriptSegment[]> {
    console.log('%c[VIDEO-WS: FINISHING...] Waiting for pending transcripts...', 'color: #f59e0b;')
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ clientContent: { turnComplete: true } }))
      } catch {}
      await new Promise((r) => setTimeout(r, Math.min(timeoutMs, 4000)))
      try {
        this.ws.close()
      } catch {}
    }
    console.log('%c[VIDEO-WS: FINAL SEGMENTS]:', 'color: #10b981; font-weight: bold;', this.segments.length)
    return this.segments
  }

  close() {
    try {
      this.ws?.close()
    } catch {}
  }
}
