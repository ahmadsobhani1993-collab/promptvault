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
  private isDone = false

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
        console.log('%c[VIDEO-WS: STEP 1] Connecting...', 'color: #3b82f6; font-weight: bold;')
        this.ws = new WebSocket(LIVE_WS_URL)
      } catch (err: any) {
        console.error('[VIDEO-WS: INIT ERROR]:', err)
        return reject(err)
      }

      this.ws.onopen = () => {
        console.log('%c[VIDEO-WS: STEP 2] Connected! Sending Setup...', 'color: #10b981; font-weight: bold;')
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
          console.log('%c[VIDEO-WS: INCOMING FRAME]:', 'color: #c084fc;', res)

          if (res.setupComplete) {
            console.log('%c[VIDEO-WS: STEP 3] Handshake Confirmed (setupComplete)!', 'color: #06b6d4; font-weight: bold;')
            resolve()
            return
          }

          if (res.proxyError) {
            console.error('[VIDEO-WS: PROXY ERROR]:', res.proxyError)
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
            console.log('%c[VIDEO-WS: LIVE CAPTION]:', 'color: #22c55e; font-size: 13px; font-weight: bold;', txt)
            this.fullAccumulated = txt
            const segEnd = Math.max(this.segStart + 1.0, this.secondsSent)
            const seg: VideoTranscriptSegment = {
              text: txt,
              start: this.segStart,
              end: segEnd,
            }
            this.onSegment?.(seg)
          }

          if (res.serverContent?.generationComplete || res.serverContent?.turnComplete) {
            console.log('%c[VIDEO-WS: SERVER TURN COMPLETE]', 'color: #38bdf8; font-weight: bold;')
            this.isDone = true
          }
        } catch (e) {
          console.warn('[VIDEO-WS: PARSE ERR]:', e)
        }
      }

      this.ws.onerror = (e) => {
        console.error('[VIDEO-WS: SOCKET ERROR]:', e)
        this.onError?.('خطای وب‌سوکت لایو ویدیو')
      }

      this.ws.onclose = (ev) => {
        console.warn('%c[VIDEO-WS: CLOSED]:', 'color: #94a3b8;', `Code: ${ev.code}, Reason: "${ev.reason}"`)
        this.onClose?.()
      }
    })
  }

  sendChunk(base64Pcm: string, durationSec: number): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[VIDEO-WS: CHUNK DROP] Socket closed.')
      return false
    }
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
      console.log(`%c[VIDEO-WS: CHUNK SENT] +${durationSec.toFixed(2)}s | Total: ${this.secondsSent.toFixed(2)}s`, 'color: #60a5fa;')
      return true
    } catch {
      return false
    }
  }

  async finish(maxWaitMs = 12000): Promise<VideoTranscriptSegment[]> {
    console.log('%c[VIDEO-WS: FINISHING...] Sending clientContent turnComplete', 'color: #f59e0b; font-weight: bold;')
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ clientContent: { turnComplete: true } }))
      } catch {}

      // صبر هوشمند تا دریافت کامل خروجی سرور بدون بستن اجباری
      const startTime = Date.now()
      while (!this.isDone && Date.now() - startTime < maxWaitMs) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) break
        await new Promise((r) => setTimeout(r, 400))
      }

      console.log('%c[VIDEO-WS: CLOSING INTENTIONALLY]', 'color: #f59e0b;')
      try {
        this.ws.close()
      } catch {}
    }
    console.log('%c[VIDEO-WS: FINAL SEGMENTS EMITTED]:', 'color: #10b981; font-weight: bold;', this.fullAccumulated ? 1 : 0)
    return this.segments
  }

  close() {
    try {
      this.ws?.close()
    } catch {}
  }
}
