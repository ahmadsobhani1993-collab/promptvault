export type AspectRatio = 'original' | '9:16' | '16:9' | '1:1' | '4:5'
export type ContentFit = 'contain' | 'cover'
export type TextAlignment = 'center' | 'right' | 'left'

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
  bgRadius: number
  bgPaddingX: number
  bgPaddingY: number

  hasActiveWordBg: boolean
  activeWordBgColor: string

  hasShadow: boolean
  shadowColor: string
  shadowBlur: number
  shadowX: number
  shadowY: number

  positionYPercent: number
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
  bgRadius: 14,
  bgPaddingX: 18,
  bgPaddingY: 10,
  hasActiveWordBg: false,
  activeWordBgColor: 'rgba(245, 158, 11, 0.28)',
  hasShadow: true,
  shadowColor: 'rgba(0, 0, 0, 0.95)',
  shadowBlur: 8,
  shadowX: 0,
  shadowY: 3,
  positionYPercent: 82,
  templateId: 'pop-classic-gold',
}

const STORAGE_KEY = 'promptvault_studio_style_v2'

export function getStoredStyle(): StudioStyleConfig {
  if (typeof window === 'undefined') return DEFAULT_STUDIO_STYLE
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STUDIO_STYLE
    return { ...DEFAULT_STUDIO_STYLE, ...JSON.parse(raw) }
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
