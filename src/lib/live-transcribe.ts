// مدل اختصاصی استخراج زیرنویس و صوت
export const TRANSCRIBE_MODEL = 'gemini-3.5-transcribe-live'

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

    // اولویت اول با مدل تخصصی ترنسکرایب و در صورت خطا مدل پشتیبان
    const targetModels = [this.model, 'gemini-2.5-flash']
    let transcribedText = ''

    for (const m of targetModels) {
      try {
        const res = await fetch('https://gemini-live-proxy.ahmadsobhani1993.workers.dev/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: m,
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: 'audio/mp3',
                      data: fullBase64,
                    },
                  },
                  {
                    text: 'Please transcribe the exact spoken words in this audio verbatim in its original language. Output only the plain text transcript without explanations.',
                  },
                ],
              },
            ],
          }),
        })

        if (!res.ok) continue

        const json = await res.json()
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
        if (text) {
          transcribedText = text
          break
        }
      } catch {
        continue
      }
    }

    if (transcribedText) {
      const seg: TranscriptSegment = {
        text: transcribedText,
        start: this.lastEnd,
        end: Math.max(this.lastEnd + 0.5, this.secondsSent),
      }
      this.lastEnd = seg.end
      this.segments.push(seg)
      this.onSegment?.(seg)
    } else {
      this.onError?.('پاسخی از مدل‌های ترنسکرایب دریافت نشد.')
    }

    this.onClose?.()
    return this.segments
  }

  close() {
    this.onClose?.()
  }
}