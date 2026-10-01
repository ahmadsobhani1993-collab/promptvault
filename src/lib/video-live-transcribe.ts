export const LIVE_WS_URL = 'wss://gemini-live-proxy.ahmadsobhani1993.workers.dev/gemini-live'
export const TRANSCRIBE_MODEL = 'models/gemini-3.5-transcribe-live'

export interface VideoTranscriptSegment {
  text: string
  start: number
  end: number
  isFinal: boolean
}

export class VideoLiveTranscriber {
  private ws: WebSocket | null = null
  private secondsSent = 0
  private segments: VideoTranscriptSegment[] = []
  private segStart = 0
  private currentTurnText = ''
  private committedText = ''
  private setupSettled = false
  private lastCommittedTurnText = ''
  private finishResolver: (() => void) | null = null

  onSegment?: (seg: VideoTranscriptSegment) => void
  onError?: (msg: string) => void
  onClose?: () => void

  constructor(
    private model: string = TRANSCRIBE_MODEL, 
    offset = 0, 
    private language: string = 'auto'
  ) {
    this.secondsSent = offset
    this.segStart = offset
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false
      const setupTimeout = window.setTimeout(() => {
        if (settled) return
        settled = true
        this.ws?.close()
        reject(new Error('Cloudflare Gemini Live در مهلت ۲۰ ثانیه‌ای آماده نشد.'))
      }, 20000)

      try {
        this.ws = new WebSocket(LIVE_WS_URL)
      } catch (err: any) {
        window.clearTimeout(setupTimeout)
        return reject(err)
      }

      this.ws.onopen = () => {
        const setupMsg = {
          setup: {
            model: this.model || TRANSCRIBE_MODEL,
            systemInstruction: {
              parts: [{
                text: `Transcribe the incoming audio verbatim. ${this.language === 'fa' ? 'The speech is Persian (Farsi); preserve colloquial Persian exactly.' : this.language === 'en' ? 'The speech is English; preserve the original wording.' : 'Detect the spoken language and preserve the original wording; do not translate.'} Do not summarize, invent, repeat, explain, or output timestamps. Omit silence and non-speech sounds.`,
              }],
            },
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
          if (event.data instanceof Blob) {
            const reader = new FileReader()
            reader.onload = () => {
              this.processMessage(reader.result as string, resolve, reject, settled, setupTimeout)
            }
            return
          }
          this.processMessage(event.data, resolve, reject, settled, setupTimeout)
        } catch (err) {
          console.error('[VideoLiveTranscriber] Parse error:', err)
        }
      }

      this.ws.onerror = () => {
        this.onError?.('خطای وب‌سوکت لایو ویدیو')
        if (!settled) {
          settled = true
          window.clearTimeout(setupTimeout)
          reject(new Error('اتصال به Cloudflare Gemini Live برقرار نشد.'))
        }
      }

      this.ws.onclose = () => {
        this.onClose?.()
      }
    })
  }

  private processMessage(dataStr: string, resolve: () => void, reject: (reason: any) => void, settled: boolean, setupTimeout: number) {
    const res = JSON.parse(dataStr)

    if (res.setupComplete) {
      this.setupSettled = true
      if (settled) return
      settled = true
      window.clearTimeout(setupTimeout)
      resolve()
      return
    }

    if (res.proxyError) {
      this.onError?.(res.proxyError)
      if (!this.setupSettled && !settled) {
        settled = true
        window.clearTimeout(setupTimeout)
        reject(new Error(res.proxyError))
      }
      return
    }

    const commitTurn = (text: string) => {
      const finalText = text.trim()
      if (!finalText || finalText === this.lastCommittedTurnText) return
      
      this.lastCommittedTurnText = finalText
      this.committedText = this.committedText ? `${this.committedText} ${finalText}` : finalText
      this.currentTurnText = ''
      
      const segEnd = Math.max(this.segStart + 0.5, this.secondsSent)
      const segment: VideoTranscriptSegment = {
        text: this.committedText,
        start: this.segStart,
        end: segEnd,
        isFinal: true,
      }
      
      this.segments.push(segment)
      this.onSegment?.(segment)
      this.segStart = segEnd
    }

    let incoming = ''
    let isFinal = false

    if (res.serverContent?.inputTranscription?.text) {
      incoming = res.serverContent.inputTranscription.text
      isFinal = true
    } else if (res.serverContent?.interimInputTranscription?.text) {
      incoming = res.serverContent.interimInputTranscription.text
      isFinal = false
    } else if (res.serverContent?.modelTurn?.parts) {
      incoming = res.serverContent.modelTurn.parts.map((part: any) => String(part.text || '')).join(' ').trim()
      isFinal = Boolean(res.serverContent.turnComplete)
    }

    if (incoming) {
      const normalized = incoming.trim()
      if (isFinal) {
        commitTurn(normalized)
      } else {
        this.currentTurnText = normalized
      }

      const fullCombined = this.committedText ? `${this.committedText} ${this.currentTurnText}`.trim() : this.currentTurnText
      const segEnd = Math.max(this.segStart + 0.5, this.secondsSent)
      
      if (!isFinal) {
        this.onSegment?.({ text: fullCombined, start: this.segStart, end: segEnd, isFinal: false })
      }
    }

    if (res.serverContent?.turnComplete) {
      if (this.currentTurnText) commitTurn(this.currentTurnText)
      this.finishResolver?.()
      this.finishResolver = null
    }
  }

  sendChunk(base64Pcm: string, durationSec: number): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false
    try {
      this.ws.send(JSON.stringify({
        realtimeInput: {
          mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: base64Pcm }],
        },
      }))
      this.secondsSent += durationSec
      return true
    } catch {
      return false
    }
  }

  async finish(drainMs = 8000): Promise<VideoTranscriptSegment[]> {
    console.log('[VideoLiveTranscriber] Finishing transcription...')
    
    // ✅ اصلاح حیاتی: ۲ ثانیه صبر می‌کنیم تا جمینای آخرین کلمات را پردازش و ارسال کند
    await new Promise(resolve => setTimeout(resolve, 2000))

    // اگر متنی در حالت موقت باقی مانده، آن را نهایی می‌کنیم
    if (this.currentTurnText && this.currentTurnText.trim()) {
      const finalText = this.currentTurnText.trim()
      const segEnd = Math.max(this.segStart + 0.5, this.secondsSent)
      
      this.segments.push({
        text: finalText,
        start: this.segStart,
        end: segEnd,
        isFinal: true,
      })
      
      this.committedText = this.committedText ? `${this.committedText} ${finalText}` : finalText
      this.currentTurnText = ''
    }
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const turnComplete = new Promise<void>((resolve) => { this.finishResolver = resolve })
      try {
        this.ws.send(JSON.stringify({ clientContent: { turnComplete: true } }))
      } catch {}
      
      await Promise.race([
        turnComplete,
        new Promise<void>((resolve) => window.setTimeout(resolve, drainMs)),
      ])
      
      try { this.ws.close() } catch {}
    }
    
    return this.segments
  }

  close() {
    try { this.ws?.close() } catch {}
  }

  getTranscript(): string {
    return this.committedText.trim()
  }
}