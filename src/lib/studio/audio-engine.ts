import { DenoiseSettings } from './types'

export class AudioEngine {
  private ctx: AudioContext | null = null
  private source: MediaElementAudioSourceNode | null = null
  private biquadFilter: BiquadFilterNode | null = null
  private gainNode: GainNode | null = null

  public init(videoElement: HTMLVideoElement) {
    if (this.ctx) return
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    this.ctx = new AudioCtx()
    this.source = this.ctx.createMediaElementSource(videoElement)

    // فیلتر پایین‌گذر برای مهار نویز فرکانس بالا (Denoise)
    this.biquadFilter = this.ctx.createBiquadFilter()
    this.biquadFilter.type = 'lowpass'
    this.biquadFilter.frequency.value = 20000

    this.gainNode = this.ctx.createGain()
    this.gainNode.gain.value = 1.0

    this.source.connect(this.biquadFilter)
    this.biquadFilter.connect(this.gainNode)
    this.gainNode.connect(this.ctx.destination)
  }

  public applySettings(settings: DenoiseSettings) {
    if (!this.ctx || !this.biquadFilter || !this.gainNode) return

    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }

    if (settings.enabled) {
      // هرچه اینتنسیتی بیشتر شود فرکانس‌های بالای نویز بیشتر بریده می‌شوند
      const freq = Math.max(3000, 20000 - settings.intensity * 150)
      this.biquadFilter.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05)
    } else {
      this.biquadFilter.frequency.setTargetAtTime(20000, this.ctx.currentTime, 0.05)
    }

    const targetGain = (settings.volume / 100)
    this.gainNode.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05)
  }
}
