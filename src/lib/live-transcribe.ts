export const TRANSCRIBE_MODEL = 'gemini-2.5-flash'

export interface TranscriptSegment {
  text: string
  start: number
  end: number
}

export class LiveTranscriber {
  private secondsSent = 0
  private lastEnd = 0
  private segments: TranscriptSegment[] = []
  private chunkBuffer: string[] = []

  onSegment?: (seg: TranscriptSegment) => void
  onError?: (msg: string) => void
  onClose?: () => void

  constructor(private model: string = TRANSCRIBE_MODEL, offset = 0) {
    this.secondsSent = offset
    this.lastEnd = offset
  }

  async connect(): Promise<void> {
    return Promise.resolve()
  }

  sendChunk(base64Data: string, durationSec: number): boolean {
    this.chunkBuffer.push(base64Data)
    this.secondsSent += durationSec
    return true
  }

  async finish(): Promise<TranscriptSegment[]> {
    if (this.chunkBuffer.length === 0) return this.segments

    const fullBase64 = this.chunkBuffer.join('')
    this.chunkBuffer = []

    try {
      const res = await fetch('https://gemini-live-proxy.ahmadsobhani1993.workers.dev/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: 'audio/wav',
                    data: fullBase64,
                  },
                },
                {
                  text: 'Transcribe every spoken word in this audio verbatim in its original language. Output only the transcript.',
                },
              ],
            },
          ],
        }),
      })

      if (!res.ok) {
        const errBody = await res.text()
        console.error('TRANSCRIBE_WORKER_ERROR:', res.status, errBody)
        throw new Error(`Worker status ${res.status}: ${errBody.slice(0, 150)}`)
      }

      const json = await res.json()
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''

      if (text) {
        const seg: TranscriptSegment = {
          text,
          start: this.lastEnd,
          end: Math.max(this.lastEnd + 0.5, this.secondsSent),
        }
        this.lastEnd = seg.end
        this.segments.push(seg)
        this.onSegment?.(seg)
      }
    } catch (err: any) {
      console.error(err)
      this.onError?.(err?.message || 'خطا در ارتباط با سرور')
    }

    this.onClose?.()
    return this.segments
  }

  close() {
    this.onClose?.()
  }
}