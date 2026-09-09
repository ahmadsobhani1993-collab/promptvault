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
  private pendingText = ''
  
  onSegment?: (seg: TranscriptSegment) => void
  onError?: (msg: string) => void
  onClose?: () => void
  onGenerationComplete?: () => void

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
                    text: 'Transcribe the audio verbatim, word for word, in the original spoken language. Do not translate or summarize.',
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

        // Track generation complete
        if (msg.serverContent?.generationComplete) {
          this.generationComplete = true
          this.onGenerationComplete?.()
          
          // Flush pending text
          if (this.pendingText.trim()) {
            const seg: TranscriptSegment = {
              text: this.pendingText.trim(),
              start: this.lastEnd,
              end: Math.max(this.lastEnd + 0.1, this.secondsSent),
            }
            this.lastEnd = seg.end
            this.segments.push(seg)
            this.onSegment?.(seg)
            this.pendingText = ''
          }
          return
        }

        // Get text from any source
        const text: string =
          msg?.serverContent?.modelTurn?.parts
            ?.map((p: any) => p.text)
            ?.filter(Boolean)
            ?.join(' ') ||
          msg?.serverContent?.inputTranscription?.text ||
          msg?.serverContent?.interimInputTranscription?.text ||
          msg?.serverContent?.outputTranscription?.text ||
          ''

        if (text.trim()) {
          // If it's interim, just update pending
          if (msg.serverContent?.interimInputTranscription) {
            this.pendingText = text.trim()
          } else {
            // Final transcription
            const seg: TranscriptSegment = {
              text: text.trim(),
              start: this.lastEnd,
              end: Math.max(this.lastEnd + 0.1, this.secondsSent),
            }
            this.lastEnd = seg.end
            this.segments.push(seg)
            this.onSegment?.(seg)
            this.pendingText = ''
          }
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
          reject(new Error(`اتصال بسته شد (کد ${e.code})`))
        }
        this.onClose?.()
      }
    })
  }

  sendChunk(base64: string, seconds: number): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false
    this.ws.send(
      JSON.stringify({
        realtimeInput: {
          mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: base64 }],
        },
      })
    )
    this.secondsSent += seconds
    return true
  }

  async finish(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    try {
      this.ws.send(JSON.stringify({ clientContent: { turnComplete: true } }))
    } catch {}
    
    // Wait for generationComplete or timeout
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        console.log('[live] finish timeout after 15s')
        resolve()
      }, 15000)
      
      const checkComplete = () => {
        if (this.generationComplete) {
          clearTimeout(timeout)
          resolve()
        } else {
          setTimeout(checkComplete, 100)
        }
      }
      checkComplete()
    })
    
    this.ws?.close()
  }

  isConnected(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN
  }

  getSegments() {
    return this.segments
  }
}
