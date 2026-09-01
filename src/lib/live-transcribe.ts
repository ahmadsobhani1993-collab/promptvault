export interface TranscriptSegment {
  text: string
  start: number
  end: number
}

export const TRANSCRIBE_MODEL = 'gemini-3.5-transcribe-live'

const WS_BASE =
  'wss://gemini-live-proxy.ahmadsobhani1993.workers.dev/gemini-live'

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

  constructor(private apiKey: string = '', private model: string = TRANSCRIBE_MODEL) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.apiKey
        ? `${WS_BASE}?key=${encodeURIComponent(this.apiKey)}`
        : WS_BASE

      this.ws = new WebSocket(wsUrl)
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
                      'Transcribe the audio verbatim, word for word, in the original spoken language (Persian, English, or any other). Do not translate, summarize, or omit anything.',
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

        this.onRawMessage(msg)

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

      this.ws.onclose = (e) => {
        console.log('[live] ws close:', e.code, e.reason)
        if (!settled) {
          settled = true
          reject(new Error(`اتصال بسته شد (کد ${e.code}) — دوباره تلاش کن`))
        }
        this.onClose()
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
