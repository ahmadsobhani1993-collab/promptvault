export const LIVE_WS_URL = 'wss://gemini-live-proxy.ahmadsobhani1993.workers.dev/gemini-live'
export const TRANSCRIBE_MODEL = 'models/gemini-3.5-transcribe-live'

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
  private currentText = ''
  private segStart = 0

  onSegment?: (seg: TranscriptSegment) => void
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
        console.log('%c[WS] Connecting to:', 'color: orange', LIVE_WS_URL);
        this.ws = new WebSocket(LIVE_WS_URL);
      } catch (err: any) {
        return reject(err);
      }

      this.ws.onopen = () => {
        console.log('%c[WS] Connected! Sending setup...', 'color: green');
        const setupMsg = {
          setup: {
            model: this.model,
            generationConfig: {
              responseModalities: ['TEXT'],
              temperature: 0.1,
            },
          },
        };
        this.ws?.send(JSON.stringify(setupMsg));
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const res = JSON.parse(event.data);
          console.log('%c[WS INCOMING MSG]:', 'color: cyan', res);

          if (res.proxyError) {
            console.error('[WS Proxy Error]:', res.proxyError);
            this.onError?.(res.proxyError);
            return;
          }

          const parts = res.serverContent?.modelTurn?.parts;
          if (parts && Array.isArray(parts)) {
            for (const part of parts) {
              if (part.text) {
                console.log('%c[STREAM WORD]:', 'color: lime', part.text);
                this.currentText += part.text;
              }
            }
          }

          if (res.serverContent?.turnComplete && this.currentText.trim()) {
            const segEnd = Math.max(this.segStart + 0.5, this.secondsSent);
            const seg: TranscriptSegment = {
              text: this.currentText.trim(),
              start: this.segStart,
              end: segEnd,
            };
            this.segments.push(seg);
            this.onSegment?.(seg);
            this.currentText = '';
            this.segStart = segEnd;
            this.lastEnd = segEnd;
          }
        } catch (e) {
          console.warn('[WS Parse Error]:', e);
        }
      };

      this.ws.onerror = (e) => {
        console.error('[WS Error Event]:', e);
        this.onError?.('خطای وب‌سوکت لایو');
      };

      this.ws.onclose = (ev) => {
        console.log('%c[WS Closed]:', 'color: gray', ev.code, ev.reason);
        if (this.currentText.trim()) {
          const segEnd = Math.max(this.segStart + 0.5, this.secondsSent);
          const seg: TranscriptSegment = {
            text: this.currentText.trim(),
            start: this.segStart,
            end: segEnd,
          };
          this.segments.push(seg);
          this.onSegment?.(seg);
          this.currentText = '';
        }
        this.onClose?.();
      };
    });
  }

  sendChunk(base64Pcm: string, durationSec: number): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
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
      };
      this.ws.send(JSON.stringify(msg));
      this.secondsSent += durationSec;
      return true;
    } catch {
      return false;
    }
  }

  async finish(timeoutMs = 6000): Promise<TranscriptSegment[]> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // ارسال سیگنال اتمام نوبت ورودی به مدل تا جواب متنی را آزاد کند
      try {
        this.ws.send(JSON.stringify({ clientContent: { turnComplete: true } }));
      } catch {}
      await new Promise((r) => setTimeout(r, Math.min(timeoutMs, 2500)));
      try {
        this.ws.close();
      } catch {}
    }
    return this.segments;
  }

  close() {
    try {
      this.ws?.close();
    } catch {}
  }
}
