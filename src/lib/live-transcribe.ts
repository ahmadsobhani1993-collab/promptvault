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
  private lastActivityEnd = 0
  
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
        console.log('[live] ✅ WebSocket opened')
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
          console.log('[live] ✅ Setup complete')
          if (!settled) {
            settled = true
            resolve()
          }
          return
        }

        // Track voice activity
        if (msg.voiceActivity) {
          if (msg.voiceActivity.type === 'ACTIVITY_START') {
            // New speech started — reset generationComplete for this turn
            this.generationComplete = false
            console.log('[live] 🎤 Speech started at', msg.voiceActivity.audioOffset)
          } else if (msg.voiceActivity.type === 'ACTIVITY_END') {
            this.lastActivityEnd = parseFloat(msg.voiceActivity.audioOffset) || 0
            console.log('[live] 🔇 Speech ended at', msg.voiceActivity.audioOffset, '| Flushing pending:', this.pendingInterim?.text?.slice(0, 50))
            
            // Flush pending interim when speech ends
            if (this.pendingInterim) {
              const seg: TranscriptSegment = {
                text: this.pendingInterim.text,
                start: this.pendingInterim.start,
                end: Math.max(this.pendingInterim.start + 0.1, this.secondsSent),
              }
              this.lastEnd = seg.end
              this.segments.push(seg)
              console.log('[live] 💾 Flushed segment:', seg.text.slice(0, 50), 'at', seg.start.toFixed(1))
              this.onSegment?.(seg)
              this.pendingInterim = null
            }
          }
          return
        }

        if (msg.serverContent?.generationComplete) {
          console.log('[live] 🏁 Generation complete')
          this.generationComplete = true
          
          // Flush any remaining pending
          if (this.pendingInterim) {
            const seg: TranscriptSegment = {
              text: this.pendingInterim.text,
              start: this.pendingInterim.start,
              end: Math.max(this.pendingInterim.start + 0.1, this.secondsSent),
            }
            this.lastEnd = seg.end
            this.segments.push(seg)
            console.log('[live] 💾 Final flush:', seg.text.slice(0, 50))
            this.onSegment?.(seg)
            this.pendingInterim = null
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

        // Final transcription
        if (text.trim() && msg.serverContent?.inputTranscription) {
          const seg: TranscriptSegment = {
            text: text.trim(),
            start: this.lastEnd,
            end: Math.max(this.lastEnd + 0.1, this.secondsSent),
          }
          this.lastEnd = seg.end
          this.segments.push(seg)
          console.log('[live] 📝 Final:', seg.text.slice(0, 50), 'at', seg.start.toFixed(1))
          this.onSegment?.(seg)
          this.pendingInterim = null
          return
        }

        // Interim transcription
        const interimText: string = msg?.serverContent?.interimInputTranscription?.text || ''
        if (interimText.trim()) {
          this.pendingInterim = {
            text: interimText.trim(),
            start: this.lastEnd,
          }
        }
      }

      this.ws.onerror = () => {
        console.log('[live] ❌ WebSocket error')
        this.onError?.('WebSocket error')
        if (!settled) {
          settled = true
          reject(new Error('WebSocket error'))
        }
      }

      this.ws.onclose = (e) => {
        console.log('[live] 🔒 Closed:', e.code, '| Segments:', this.segments.length)
        if (!settled) {
          settled = true
          reject(new Error(`اتصال بسته شد (کد ${e.code})`))
        }
        this.onClose?.()
      }
    })
  }

  sendChunk(base64: string, seconds: number): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log('[live] ️ sendChunk failed')
      return false
    }
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
    console.log('[live] 🛑 finish() called')
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log('[live] ️ WS not open')
      return
    }
    try {
      this.ws.send(JSON.stringify({ clientContent: { turnComplete: true } }))
      console.log('[live] 📤 Sent turnComplete')
    } catch (e) {
      console.log('[live] ❌ Error:', e)
    }
    
    // Wait for generationComplete or timeout (30s)
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        console.log('[live]  Timeout 30s | Pending:', this.pendingInterim?.text?.slice(0, 50))
        resolve()
      }, 30000)
      
      const checkComplete = () => {
        if (this.generationComplete) {
          clearTimeout(timeout)
          console.log('[live] ✅ generationComplete received')
          resolve()
        } else {
          setTimeout(checkComplete, 500)
        }
      }
      checkComplete()
    })
    
    // Final flush
    if (this.pendingInterim) {
      const seg: TranscriptSegment = {
        text: this.pendingInterim.text,
        start: this.pendingInterim.start,
        end: Math.max(this.pendingInterim.start + 0.1, this.secondsSent),
      }
      this.lastEnd = seg.end
      this.segments.push(seg)
      console.log('[live] 💾 Final flush in finish():', seg.text.slice(0, 50))
      this.onSegment?.(seg)
      this.pendingInterim = null
    }
    
    console.log('[live] 🔌 Closing...')
    this.ws?.close()
  }

  isConnected(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN
  }

  getSegments() {
    return this.segments
  }
}
