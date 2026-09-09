export const TRANSCRIBE_MODEL = 'gemini-3.5-transcribe-live'

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
  private generationComplete = false
  private pendingInterim: { text: string; start: number } | null = null
  
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
                parts: [{ text: 'Transcribe the audio verbatim, word for word, in the original spoken language. Do not translate or summarize.' }],
              },
              generationConfig: { responseModalities: ['TEXT'] },
            },
          })
        )
      }

      this.ws.onmessage = (ev) => {
        let msg: any
        try { msg = JSON.parse(ev.data as string) } catch { return }

        if (msg?.error) {
          this.onError?.('Gemini: ' + (msg.error?.message || JSON.stringify(msg.error)))
          if (!settled) { settled = true; reject(new Error('Gemini error')) }
          return
        }
        if (msg.setupComplete) {
          if (!settled) { settled = true; resolve() }
          return
        }
        if (msg.voiceActivity) {
          if (msg.voiceActivity.type === 'ACTIVITY_START') this.generationComplete = false
          else if (msg.voiceActivity.type === 'ACTIVITY_END' && this.pendingInterim) {
            const seg: TranscriptSegment = {
              text: this.pendingInterim.text,
              start: this.pendingInterim.start,
              end: Math.max(this.pendingInterim.start + 0.1, this.secondsSent),
            }
            this.lastEnd = seg.end
            this.segments.push(seg)
            this.onSegment?.(seg)
            this.pendingInterim = null
          }
          return
        }
        if (msg.serverContent?.generationComplete) {
          this.generationComplete = true
          if (this.pendingInterim) {
            const seg: TranscriptSegment = {
              text: this.pendingInterim.text,
              start: this.pendingInterim.start,
              end: Math.max(this.pendingInterim.start + 0.1, this.secondsSent),
            }
            this.lastEnd = seg.end
            this.segments.push(seg)
            this.onSegment?.(seg)
            this.pendingInterim = null
          }
          return
        }
        const text = msg?.serverContent?.modelTurn?.parts?.map((p: any) => p.text)?.filter(Boolean)?.join(' ') ||
                     msg?.serverContent?.inputTranscription?.text ||
                     msg?.serverContent?.outputTranscription?.text || ''
        if (text.trim() && msg.serverContent?.inputTranscription) {
          const seg: TranscriptSegment = {
            text: text.trim(),
            start: this.lastEnd,
            end: Math.max(this.lastEnd + 0.1, this.secondsSent),
          }
          this.lastEnd = seg.end
          this.segments.push(seg)
          this.onSegment?.(seg)
          this.pendingInterim = null
          return
        }
        const interim = msg?.serverContent?.interimInputTranscription?.text || ''
        if (interim.trim()) this.pendingInterim = { text: interim.trim(), start: this.lastEnd }
      }

      this.ws.onerror = () => {
        this.onError?.('WebSocket error')
        if (!settled) { settled = true; reject(new Error('WebSocket error')) }
      }
      this.ws.onclose = (e) => {
        if (!settled) { settled = true; reject(new Error(`بسته شد (${e.code})`)) }
        this.onClose?.()
      }
    })
  }

  sendChunk(base64: string, seconds: number): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false
    this.ws.send(JSON.stringify({ realtimeInput: { mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: base64 }] } }))
    this.secondsSent += seconds
    return true
  }

  // پایان session: turnComplete + صبر برای generationComplete
  async finish(waitMs = 15000): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    try { this.ws.send(JSON.stringify({ clientContent: { turnComplete: true } })) } catch {}
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, waitMs)
      const check = () => { if (this.generationComplete) { clearTimeout(t); resolve() } else setTimeout(check, 300) }
      check()
    })
    if (this.pendingInterim) {
      const seg: TranscriptSegment = { text: this.pendingInterim.text, start: this.pendingInterim.start, end: Math.max(this.pendingInterim.start + 0.1, this.secondsSent) }
      this.lastEnd = seg.end; this.segments.push(seg); this.onSegment?.(seg); this.pendingInterim = null
    }
    try { this.ws?.close() } catch {}
  }

  isConnected() { return !!this.ws && this.ws.readyState === WebSocket.OPEN }
  getSegments() { return this.segments }
  getSecondsSent() { return this.secondsSent }
}
