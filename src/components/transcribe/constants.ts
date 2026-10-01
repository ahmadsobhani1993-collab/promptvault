import { Preset, FontOption } from './types'

// آستانه‌ی حداکثر سرعت خوانش (کاراکتر بر ثانیه) — یک‌جا تعریف شده،
// همه‌ی فایل‌های دیگر (SubtitleEditor, Timeline, CaptionList و ...)
// باید همین ثابت را import کنند، نه عدد ۱۷ را جدا hardcode کنند.
export const MAX_CPS = 17

export const PRESETS: Preset[] = [
  { id: 'viral', name: '🔥 وایرال', fontId: 'Lalezar', size: 7, color: '#ffffff', bgColor: 'rgba(0,0,0,.72)', bgOpacity: .72, outline: true, karaoke: true, hlColor: '#ffe14d', textShadowBlur: 8, textShadowColor: 'rgba(0,0,0,.85)', bgRadius: 10 },
  { id: 'minimal', name: 'مینیمال', fontId: 'Vazirmatn', size: 5.5, color: '#ffffff', bgColor: 'rgba(0,0,0,.45)', bgOpacity: .45, outline: false, karaoke: false, hlColor: '#ffe14d', textShadowBlur: 4, textShadowColor: 'rgba(0,0,0,.7)', bgRadius: 8 },
  { id: 'podcast', name: '🎙 پادکست', fontId: 'Readex Pro', size: 6, color: '#ffffff', bgColor: 'rgba(0,0,0,.7)', bgOpacity: .7, outline: false, karaoke: true, hlColor: '#7CFC00', textShadowBlur: 5, textShadowColor: 'rgba(0,0,0,.8)', bgRadius: 10 },
  { id: 'cinema', name: '🎬 سینمایی', fontId: 'Amiri', size: 4.8, color: '#f5f5f4', bgColor: 'rgba(0,0,0,.35)', bgOpacity: .35, outline: true, karaoke: false, hlColor: '#ffd700', textShadowBlur: 7, textShadowColor: 'rgba(0,0,0,.85)', bgRadius: 6 },
  { id: 'news', name: '📰 خبری', fontId: 'Noto Kufi Arabic', size: 5.8, color: '#ffffff', bgColor: 'rgba(0,0,0,.85)', bgOpacity: .85, outline: false, karaoke: false, hlColor: '#ff5555', textShadowBlur: 3, textShadowColor: 'rgba(0,0,0,.8)', bgRadius: 5 },
  { id: 'neon', name: '⚡ نئون', fontId: 'Readex Pro', size: 6, color: '#ffffff', bgColor: 'rgba(0,0,0,.55)', bgOpacity: .55, outline: true, karaoke: true, hlColor: '#00e5ff', textShadowBlur: 12, textShadowColor: 'rgba(0,229,255,.65)', bgRadius: 12 },
  { id: 'luxury', name: '💎 لوکس', fontId: 'Amiri', size: 5.2, color: '#f8e7a1', bgColor: 'rgba(0,0,0,.5)', bgOpacity: .5, outline: false, karaoke: false, hlColor: '#ffd700', textShadowBlur: 8, textShadowColor: 'rgba(0,0,0,.8)', bgRadius: 8 },
  { id: 'bold', name: '💥 بولد', fontId: 'Lalezar', size: 7.5, color: '#ffffff', bgColor: 'rgba(0,0,0,.82)', bgOpacity: .82, outline: true, karaoke: true, hlColor: '#ff5252', textShadowBlur: 9, textShadowColor: 'rgba(255,0,0,.45)', bgRadius: 7 },
  { id: 'pastel', name: '🌸 پاستل', fontId: 'Vazirmatn', size: 5.3, color: '#ffd0df', bgColor: 'rgba(255,105,180,.16)', bgOpacity: .16, outline: false, karaoke: false, hlColor: '#ff69b4', textShadowBlur: 4, textShadowColor: 'rgba(0,0,0,.5)', bgRadius: 18 },
  { id: 'tech', name: '🤖 تکنولوژی', fontId: 'Readex Pro', size: 5.5, color: '#e9faff', bgColor: 'rgba(0,180,255,.12)', bgOpacity: .12, outline: true, karaoke: true, hlColor: '#00d4ff', textShadowBlur: 8, textShadowColor: 'rgba(0,180,255,.55)', bgRadius: 12 },
]

export const FONTS: FontOption[] = [
  { id: 'Vazirmatn', label: 'وزیرمتن', category: 'مدرن' },
  { id: 'Estedad', label: 'استعداد', category: 'مدرن' },
  { id: 'Readex Pro', label: 'ریدکس پرو', category: 'دیجیتال' },
  { id: 'IBM Plex Sans Arabic', label: 'پلکس', category: 'تمیز' },
  { id: 'Noto Kufi Arabic', label: 'کوفی', category: 'نمایشی' },
  { id: 'Lalezar', label: 'لاله‌زار', category: 'نمایشی' },
  { id: 'Amiri', label: 'امیری', category: 'ادبی' },
  { id: 'Noto Nastaliq Urdu', label: 'نستعلیق', category: 'ادبی' },
]