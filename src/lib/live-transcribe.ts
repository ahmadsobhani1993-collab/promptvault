export const TRANSCRIBE_MODEL = 'gemini-2.5-flash'

export interface TranscriptSegment {
  text: string
  start: number
  end: number
}

function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export class LiveTranscriber {
  private secondsSent = 0
  private lastEnd = 0
  private segments: TranscriptSegment[] = []
  private byteChunks: Uint8Array[] = []

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
    try {
      const bytes = base64ToBytes(base64Data)
      this.byteChunks.push(bytes)
      this.secondsSent += durationSec
      return true
    } catch {
      return false
    }
  }

  async finish(): Promise<TranscriptSegment[]> {
    if (this.byteChunks.length === 0) return this.segments

    // ادغام بایت‌های خالص
    const totalLen = this.byteChunks.reduce((acc, c) => acc + c.length, 0)
    const merged = new Uint8Array(totalLen)
    let offset = 0
    for (const c of this.byteChunks) {
      merged.set(c, offset)
      offset += c.length
    }
    this.byteChunks = []

    const validBase64 = bytesToBase64(merged)

    try {
      const res = await fetch('https://gemini-live-proxy.ahmadsobhani1993.workers.dev/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: 'audio/wav',
                    data: validBase64,
                  },
                },
                {
                  text: 'Please transcribe all spoken words in this audio verbatim into plain text. Return only the transcription.',
                },
              ],
            },
          ],
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        console.error('TRANSCRIBE_WORKER_ERROR:', res.status, err)
        throw new Error(`Worker status ${res.status}: ${err.slice(0, 100)}`)
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
      this.onError?.(err?.message || 'خطا در ارتباط با سرور')
    }

    this.onClose?.()
    return this.segments
  }

  close() {
    this.onClose?.()
  }
}
