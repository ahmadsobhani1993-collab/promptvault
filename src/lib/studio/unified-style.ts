export type AspectRatio = 'original' | '9:16' | '16:9' | '1:1' | '4:5'
export type ContentFit = 'contain' | 'cover'
export type TextAlignment = 'center' | 'right' | 'left'
export type SubtitleAnimation = 'none' | 'pop' | 'zoomIn' | 'zoomOut'
export type WatermarkType = 'text' | 'sticker'

export interface WatermarkOverlay {
  id: string
  type: WatermarkType
  value: string
  x: number
  y: number
  size: number
  opacity: number
  color: string
  rotation: number
  fontFamily?: string
}

export interface WordTiming {
  text: string
  start: number
  end: number
}

export interface StudioSegment {
  id: string
  start: number
  end: number
  text: string
  words?: WordTiming[]
}

export interface StudioStyleConfig {
  fontId?: string
  aspectRatio: AspectRatio
  contentFit: ContentFit

  fontFamily: string
  fontSizePercent: number
  fontWeight: 'normal' | 'bold' | '900'
  italic: boolean
  alignment: TextAlignment

  textColor: string
  activeWordColor: string

  hasBg: boolean
  bgColor: string
  bgOpacity: number
  bgRadius: number
  bgBorderColor: string
  bgBorderWidth: number
  bgPaddingX: number
  bgPaddingY: number

  hasActiveWordBg: boolean
  activeWordBgColor: string

  hasShadow: boolean
  shadowColor: string
  shadowBlur: number
  shadowX: number
  shadowY: number

  hasTextStroke: boolean
  textStrokeColor: string
  textStrokeWidth: number

  positionXPercent: number
  positionYPercent: number
  subtitleAnimation: SubtitleAnimation
  watermarks: WatermarkOverlay[]
  templateId: string
}

export const DEFAULT_STUDIO_STYLE: StudioStyleConfig = {
  aspectRatio: 'original',
  contentFit: 'contain',
  fontFamily: 'Vazirmatn',
  fontSizePercent: 4.8,
  fontWeight: 'bold',
  italic: false,
  alignment: 'center',
  textColor: '#FFFFFF',
  activeWordColor: '#F59E0B',
  hasBg: true,
  bgColor: 'rgba(0, 0, 0, 0.75)',
  bgOpacity: 0.75,
  bgRadius: 14,
  bgBorderColor: '#ffffff',
  bgBorderWidth: 0,
  bgPaddingX: 18,
  bgPaddingY: 10,
  hasActiveWordBg: false,
  activeWordBgColor: 'rgba(245, 158, 11, 0.28)',
  hasShadow: true,
  shadowColor: 'rgba(0, 0, 0, 0.95)',
  shadowBlur: 8,
  shadowX: 0,
  shadowY: 3,
  hasTextStroke: false,
  textStrokeColor: '#000000',
  textStrokeWidth: 2,
  positionXPercent: 50,
  positionYPercent: 82,
  subtitleAnimation: 'none',
  watermarks: [],
  templateId: 'pop-classic-gold',
}

const STORAGE_KEY = 'promptvault_studio_style_v2'

export function getStoredStyle(): StudioStyleConfig {
  if (typeof window === 'undefined') return DEFAULT_STUDIO_STYLE
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STUDIO_STYLE
    const stored = JSON.parse(raw)
    const supportedFonts = new Set(['Vazirmatn', 'Estedad', 'Readex Pro', 'IBM Plex Sans Arabic', 'Noto Kufi Arabic', 'Lalezar', 'Amiri', 'Noto Nastaliq Urdu'])
    const requestedFont = stored.fontId ?? stored.fontFamily
    const fontFamily = supportedFonts.has(requestedFont) ? requestedFont : DEFAULT_STUDIO_STYLE.fontFamily
    return {
      ...DEFAULT_STUDIO_STYLE,
      ...stored,
      fontId: fontFamily,
      fontFamily,
      fontSizePercent: stored.fontSizePercent ?? stored.size ?? DEFAULT_STUDIO_STYLE.fontSizePercent,
      textColor: stored.textColor ?? stored.color ?? DEFAULT_STUDIO_STYLE.textColor,
      activeWordColor: stored.activeWordColor ?? stored.hlColor ?? DEFAULT_STUDIO_STYLE.activeWordColor,
      hasBg: stored.hasBg ?? (stored.bgOpacity == null ? DEFAULT_STUDIO_STYLE.hasBg : Number(stored.bgOpacity) > 0),
      bgOpacity: stored.bgOpacity ?? DEFAULT_STUDIO_STYLE.bgOpacity,
      bgBorderColor: stored.bgBorderColor ?? DEFAULT_STUDIO_STYLE.bgBorderColor,
      bgBorderWidth: stored.bgBorderWidth ?? DEFAULT_STUDIO_STYLE.bgBorderWidth,
      hasShadow: stored.hasShadow ?? stored.outline ?? DEFAULT_STUDIO_STYLE.hasShadow,
      shadowColor: stored.shadowColor ?? stored.textShadowColor ?? DEFAULT_STUDIO_STYLE.shadowColor,
      shadowBlur: stored.shadowBlur ?? stored.textShadowBlur ?? DEFAULT_STUDIO_STYLE.shadowBlur,
      hasTextStroke: stored.hasTextStroke ?? false,
      textStrokeColor: stored.textStrokeColor ?? '#000000',
      textStrokeWidth: stored.textStrokeWidth ?? 2,
      watermarks: Array.isArray(stored.watermarks) ? stored.watermarks : [],
      templateId: stored.templateId ?? stored.template ?? DEFAULT_STUDIO_STYLE.templateId,
      positionXPercent: stored.positionXPercent ?? stored.x ?? DEFAULT_STUDIO_STYLE.positionXPercent,
      positionYPercent: stored.positionYPercent ?? stored.y ?? DEFAULT_STUDIO_STYLE.positionYPercent,
    }
  } catch {
    return DEFAULT_STUDIO_STYLE
  }
}

export function saveStoredStyle(style: StudioStyleConfig): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(style))
  } catch {}
}

export interface TemplateDefinition {
  id: string
  name: string
  category: string
  previewBg: string
  style: Partial<StudioStyleConfig>
}

export interface SavedSubtitleTemplate {
  id: string
  name: string
  style: Partial<StudioStyleConfig>
  savedAt: number
}

const CUSTOM_TEMPLATES_KEY = 'promptvault_custom_subtitle_templates_v1'

export function getSavedSubtitleTemplates(): SavedSubtitleTemplate[] {
  if (typeof window === 'undefined') return []
  try {
    const templates = JSON.parse(localStorage.getItem(CUSTOM_TEMPLATES_KEY) || '[]')
    return Array.isArray(templates) ? templates : []
  } catch {
    return []
  }
}

export function saveSubtitleTemplate(template: SavedSubtitleTemplate): SavedSubtitleTemplate[] {
  const templates = [template, ...getSavedSubtitleTemplates().filter(item => item.id !== template.id)].slice(0, 30)
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(templates))
  return templates
}

export function deleteSubtitleTemplate(id: string): SavedSubtitleTemplate[] {
  const templates = getSavedSubtitleTemplates().filter(template => template.id !== id)
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(templates))
  return templates
}

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'pop-classic-gold',
    name: 'طلایی مینیمال',
    category: 'Popular',
    previewBg: 'linear-gradient(135deg, #1f1a10, #382d0e)',
    style: {
      fontFamily: 'Vazirmatn',
      textColor: '#FFFFFF',
      activeWordColor: '#F59E0B',
      hasBg: false,
      hasShadow: true,
      shadowColor: 'rgba(0,0,0,0.95)',
      shadowBlur: 10,
      shadowX: 0,
      shadowY: 3,
      hasActiveWordBg: false,
      fontSizePercent: 5.0,
      alignment: 'center',
    },
  },
  {
    id: 'dyn-pulse-coral',
    name: 'باکس کورال مدرن',
    category: 'Dynamic',
    previewBg: 'linear-gradient(135deg, #2b1113, #4f1d22)',
    style: {
      fontFamily: 'Vazirmatn',
      textColor: '#FFFFFF',
      activeWordColor: '#FB7185',
      hasBg: true,
      bgColor: 'rgba(0, 0, 0, 0.82)',
      bgRadius: 14,
      bgPaddingX: 20,
      bgPaddingY: 10,
      hasShadow: false,
      hasActiveWordBg: true,
      activeWordBgColor: 'rgba(251, 113, 133, 0.32)',
      fontSizePercent: 4.8,
      alignment: 'center',
    },
  },
  {
    id: 'cinema-dark',
    name: 'سینمایی زرد',
    category: 'Cinema',
    previewBg: 'linear-gradient(135deg, #050505, #141414)',
    style: {
      fontFamily: 'Shabnam',
      textColor: '#FEF08A',
      activeWordColor: '#FACC15',
      hasBg: false,
      hasShadow: true,
      shadowColor: '#000000',
      shadowBlur: 14,
      shadowX: 0,
      shadowY: 4,
      hasActiveWordBg: false,
      fontSizePercent: 4.5,
      positionYPercent: 86,
      alignment: 'center',
    },
  },
  {
    id: 'fan-cyber-neon',
    name: 'سایبرپانک نئون',
    category: 'Fantasy',
    previewBg: 'linear-gradient(135deg, #240a34, #491169)',
    style: {
      fontFamily: 'Samim',
      textColor: '#FDF4FF',
      activeWordColor: '#C084FC',
      hasBg: true,
      bgColor: 'rgba(26, 4, 43, 0.85)',
      bgRadius: 16,
      hasShadow: true,
      shadowColor: '#A855F7',
      shadowBlur: 18,
      shadowX: 0,
      shadowY: 0,
      hasActiveWordBg: true,
      activeWordBgColor: 'rgba(192, 132, 252, 0.35)',
      fontSizePercent: 4.8,
      alignment: 'center',
    },
  },
  {
    id: 'std-clean-white',
    name: 'استاندارد سفید',
    category: 'Standard',
    previewBg: 'linear-gradient(135deg, #1c1917, #292524)',
    style: {
      fontFamily: 'Vazirmatn',
      textColor: '#FFFFFF',
      activeWordColor: '#FFFFFF',
      hasBg: true,
      bgColor: 'rgba(0, 0, 0, 0.85)',
      bgRadius: 8,
      bgPaddingX: 16,
      bgPaddingY: 8,
      hasShadow: false,
      hasActiveWordBg: false,
      fontSizePercent: 4.6,
      alignment: 'center',
    },
  },
]
