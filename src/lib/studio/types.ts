export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:5'
export type ContentFit = 'fit' | 'fill'
export type TextAlignment = 'right' | 'center' | 'left'
export type TemplateCategory =
  | 'All'
  | 'Popular'
  | 'Dynamic'
  | 'Music'
  | 'Progress'
  | 'Standard'
  | 'Fantasy'
  | 'Cinema'
  | 'Text Effect'

export interface WordTiming {
  text: string
  start: number
  end: number
}

export interface CaptionSegment {
  id: string
  start: number
  end: number
  text: string
  translatedText?: string
  words?: WordTiming[]
}

export interface StyleConfig {
  fontFamily: string
  fontSize: number
  fontWeight: 'normal' | 'bold' | '900'
  italic: boolean
  underline: boolean
  textColor: string
  hasBg: boolean
  bgColor: string
  bgRadius: number
  hasShadow: boolean
  shadowColor: string
  shadowBlur: number
  shadowX: number
  shadowY: number
  hasBgShadow: boolean
  activeWordColor: string
  activeWordBgColor: string
  hasActiveWordBg: boolean
  alignment: TextAlignment
  aspectRatio: AspectRatio
  contentFit: ContentFit
  templateId: string
  // Music & Progress extras
  showProgressBar: boolean
  progressColor: string
  showWaveform: boolean
  waveformColor: string
}

export interface TemplateItem {
  id: string
  name: string
  category: TemplateCategory
  isNew?: boolean
  previewBg: string
  style: Partial<StyleConfig>
}

export interface DenoiseSettings {
  enabled: boolean
  intensity: number // 0 to 100
  volume: number // 0 to 200%
}

export interface SocialPostPlan {
  platform: 'instagram' | 'telegram' | 'youtube_shorts'
  hook: string
  caption: string
  hashtags: string[]
}
