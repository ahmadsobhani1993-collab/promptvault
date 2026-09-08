import { TRANSCRIBE_MODEL } from './gemini-config'

export type TranscriptSegment = {
  text: string
  start: number
  end: number
}

export class LiveTranscriber {
  private ws: WebSocket | null = null
  private secondsSent = 0
  private lastEnd = 0
  private segments: TranscriptSegment[] = []
  onSegment?: (seg: TranscriptSegment) => void
  onError?: (msg: string) => void
  onClose?: () => void

  constructor(private model: string = TRANSCRIBE_MODEL, offset = 0) {
    this.secondsSent = offset
    this.lastEnd = offset
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket('wss://gemini-live-proxy.ahmadsobhani1993.workers.dev/gemini-live')
      let settled = false

      this.ws.onopen = () => {
        this.ws?.send(
          JSON.stringify({
            setup: {
              model: `models/${this.model}`,
              systemInstruction: {
                parts: [
                  {
                    text:
                      'You are a professional speech-to-text transcriber. Transcribe the audio verbatim, word for word, in the original spoken language (Persian, English, or any other). Do not translate, summarize, or add commentary. Output only the exact transcription. If you cannot hear clearly, output <unclear>. Do not generate greetings, questions, or responses.',
                  },
                ],
              },
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

        if (msg?.error) {
          const errText = msg.error?.message || JSON.stringify(msg.error)
          this.onError?.('Gemini: ' + errText)
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

        const text: string =
          msg?.serverContent?.modelTurn?.parts
            ?.map((p: any) => p.text)
            ?.filter(Boolean)
            ?.join(' ') ||
          msg?.serverContent?.inputTranscription?.text ||
          msg?.serverContent?.outputTranscription?.text ||
          ''

        if (text.trim()) {
          const seg: TranscriptSegment = {
            text: text.trim(),
            start: this.lastEnd,
            end: Math.max(this.lastEnd + 0.1, this.secondsSent),
          }
          this.lastEnd = seg.end
          this.segments.push(seg)
          this.onSegment?.(seg)
        }
      }

      this.ws.onerror = () => {
        this.onError?.('WebSocket error')
        if (!settled) {
          settled = true
          reject(new Error('WebSocket error'))
        }
      }

      this.ws.onclose = (e) => {
        console.log('[live] ws close:', e.code, e.reason)
        if (!settled) {
          settled = true
          reject(new Error(`اتصال بسته شد (کد ${e.code}) — دوباره تلاش کن`))
        }
        this.onClose?.()
      }
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

  async finish(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    try {
      this.ws.send(JSON.stringify({ clientContent: { turnComplete: true } }))
    } catch {}
    await new Promise((r) => setTimeout(r, 8000))
    this.ws?.close()
  }

  getSegments() {
    return this.segments
  }
}
