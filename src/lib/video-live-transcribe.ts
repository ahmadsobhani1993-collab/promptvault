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
  private segments: VideoTranscriptSegment[] = []
  private segStart = 0
  private fullAccumulated = ''

  onSegment?: (seg: VideoTranscriptSegment) => void
  onError?: (msg: string) => void
  onClose?: () => void

  constructor(private model: string = TRANSCRIBE_MODEL, offset = 0) {
    this.secondsSent = offset
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

          if (res.setupComplete) {
            resolve()
            return
          }

          if (res.proxyError) {
            this.onError?.(res.proxyError)
            return
          }

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

          if (txt) {
            this.fullAccumulated = txt
            const segEnd = Math.max(this.segStart + 1.0, this.secondsSent)
            const seg: VideoTranscriptSegment = {
              text: txt,
              start: this.segStart,
              end: segEnd,
            }
            this.onSegment?.(seg)
          }
        } catch {}
      }

      this.ws.onerror = () => {
        this.onError?.('خطای وب‌سوکت لایو ویدیو')
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

  async finish(drainMs = 4500): Promise<VideoTranscriptSegment[]> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ clientContent: { turnComplete: true } }))
      } catch {}
      // تاخیر لازم برای دریافت پکت‌های پایانی گفتار
      await new Promise((r) => setTimeout(r, drainMs))
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
