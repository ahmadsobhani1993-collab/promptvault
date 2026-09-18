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
        console.log('%c[VIDEO-WS: STEP 1] Connecting...', 'color: #3b82f6; font-weight: bold;', LIVE_WS_URL)
        this.ws = new WebSocket(LIVE_WS_URL)
      } catch (err: any) {
        console.error('%c[VIDEO-WS: ERROR 1] WebSocket init failed:', 'color: red;', err)
        return reject(err)
      }

      this.ws.onopen = () => {
        console.log('%c[VIDEO-WS: STEP 2] Connected! Sending Setup Payload...', 'color: #10b981; font-weight: bold;')
        const setupMsg = {
          setup: {
            model: this.model,
            generationConfig: {
              responseModalities: ['TEXT'],
              temperature: 0.1,
            },
          },
        }
        console.log('%c[VIDEO-WS: OUTGOING SETUP]:', 'color: #6ee7b7;', setupMsg)
        this.ws?.send(JSON.stringify(setupMsg))
      }

      this.ws.onmessage = (event) => {
        try {
          const res = JSON.parse(event.data)
          console.log('%c[VIDEO-WS: INCOMING FRAME]:', 'color: #a855f7;', res)

          if (res.setupComplete) {
            console.log('%c[VIDEO-WS: STEP 3] Handshake Confirmed (setupComplete)!', 'color: #06b6d4; font-weight: bold;')
            resolve()
            return
          }

          if (res.proxyError) {
            console.error('%c[VIDEO-WS: PROXY ERROR]:', 'color: #ef4444; font-weight: bold;', res.proxyError)
            this.onError?.(res.proxyError)
            return
          }

          // استخراج متن از inputTranscription یا modelTurn
          let txt = ''
          if (res.serverContent?.inputTranscription?.text) {
            txt = res.serverContent.inputTranscription.text
            console.log('%c[VIDEO-WS: MATCHED inputTranscription]:', 'color: #22c55e; font-weight: bold;', txt)
          } else if (res.serverContent?.modelTurn?.parts) {
            for (const p of res.serverContent.modelTurn.parts) {
              if (p.text) txt += p.text
            }
            if (txt) {
              console.log('%c[VIDEO-WS: MATCHED modelTurn]:', 'color: #22c55e; font-weight: bold;', txt)
            }
          }

          if (txt.trim()) {
            const segEnd = Math.max(this.segStart + 1.0, this.secondsSent)
            const seg: VideoTranscriptSegment = {
              text: txt.trim(),
              start: this.segStart,
              end: segEnd,
            }
            console.log('%c[VIDEO-WS: EMITTING SEGMENT]:', 'color: #facc15; font-weight: bold;', seg)
            this.segments.push(seg)
            this.onSegment?.(seg)
            this.segStart = segEnd
            this.lastEnd = segEnd
          }
        } catch (err) {
          console.warn('%c[VIDEO-WS: PARSE ERROR]:', 'color: orange;', err, event.data)
        }
      }

      this.ws.onerror = (e) => {
        console.error('%c[VIDEO-WS: SOCKET ERROR]:', 'color: red; font-weight: bold;', e)
        this.onError?.('خطای وب‌سوکت لایو ویدیو')
      }

      this.ws.onclose = (e) => {
        console.warn('%c[VIDEO-WS: CLOSED]:', 'color: #94a3b8; font-weight: bold;', `Code: ${e.code}, Reason: "${e.reason}"`)
        this.onClose?.()
      }
    })
  }

  sendChunk(base64Pcm: string, durationSec: number): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('%c[VIDEO-WS: CHUNK DROP] Socket not open! State:', 'color: red;', this.ws?.readyState)
      return false
    }
    try {
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
      console.log(`%c[VIDEO-WS: CHUNK SENT] +${durationSec.toFixed(2)}s | Total Sent: ${this.secondsSent.toFixed(2)}s | Base64 Length: ${base64Pcm.length}`, 'color: #38bdf8;')
      return true
    } catch (err) {
      console.error('%c[VIDEO-WS: SEND ERROR]:', 'color: red;', err)
      return false
    }
  }

  async finish(timeoutMs = 8000): Promise<VideoTranscriptSegment[]> {
    console.log('%c[VIDEO-WS: FINISHING...] Sending clientContent.turnComplete', 'color: #f59e0b; font-weight: bold;')
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ clientContent: { turnComplete: true } }))
      } catch {}
      console.log(`%c[VIDEO-WS: WAITING...] Draining responses for 3500ms...`, 'color: #f59e0b;')
      await new Promise((r) => setTimeout(r, Math.min(timeoutMs, 3500)))
      try {
        console.log('%c[VIDEO-WS: CLOSING SOCKET]', 'color: #f59e0b;')
        this.ws.close()
      } catch {}
    }
    console.log('%c[VIDEO-WS: FINAL SEGMENTS COUNT]:', 'color: #10b981; font-weight: bold;', this.segments.length)
    return this.segments
  }

  close() {
    try {
      this.ws?.close()
    } catch {}
  }
}
