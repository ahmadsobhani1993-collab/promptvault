'use client'
import { useLocale } from '@/lib/use-locale'
import { L } from '@/lib/l'

const TONES = [
  { id: 'engaging', labelFa: '🔥 جذاب و اکسپلوری', labelEn: '🔥 Engaging', detailFa: 'قلاب کنجکاوکننده و دعوت طبیعی به تعامل', detailEn: 'A curiosity hook and a natural invitation to engage' },
  { id: 'professional', labelFa: '🧠 تخصصی و آموزشی', labelEn: '🧠 Professional and educational', detailFa: 'شفاف، مفید و حرفه‌ای', detailEn: 'Clear, useful, and professional' },
  { id: 'friendly', labelFa: '☕ صمیمی و داستانی', labelEn: '☕ Friendly and story-driven', detailFa: 'گرم و خودمانی، مثل گفت‌وگو با دوست', detailEn: 'Warm and casual, like talking with a friend' },
  { id: 'minimal', labelFa: '⚡ مینیمال و کوتاه', labelEn: '⚡ Minimal and concise', detailFa: 'موجز و مستقیم', detailEn: 'Brief and direct' },
]

interface Props {
  generatingTone: string | null
  caption: string
  hashtags: string
  onGenerate: (tone: string) => void
  onChange: (caption: string, hashtags: string) => void
  onClose: () => void
  onCopy: () => void
}

export default function InstagramCaptionPanel({ generatingTone, caption, hashtags, onGenerate, onChange, onClose, onCopy }: Props) {
  const locale = useLocale()
  const isEn = locale === 'en'
  const value = caption + (hashtags ? `\n\n${hashtags}` : '')

  return (
    <div className="fixed inset-0 z-[110] bg-black/75" onMouseDown={onClose}>
      <section
        dir={isEn ? 'ltr' : 'rtl'}
        onMouseDown={event => event.stopPropagation()}
        className="absolute inset-y-0 right-0 flex w-full max-w-[480px] flex-col overflow-y-auto border-l border-stone-800 bg-[#12100d] shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-800 bg-[#12100d] p-4">
          <div>
            <h2 className="text-sm font-black text-white">{L(locale, 'کپشن اینستاگرام', 'Instagram caption')}</h2>
            <p className="mt-1 text-[10px] text-stone-500">{L(locale, 'از متن زیرنویس، یک پاراگراف کوتاه و هشتگ بسازید', 'Turn your subtitles into a short caption and hashtags')}</p>
          </div>
          <button type="button" aria-label={L(locale, 'بستن', 'Close')} onClick={onClose} className="rounded-lg bg-stone-800 px-3 py-1.5 text-white">✕</button>
        </header>

        <div className="space-y-5 p-4">
          <section>
            <h3 className="mb-2 text-xs font-bold text-white">{L(locale, 'لحن کپشن را انتخاب کنید', 'Choose a caption tone')}</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {TONES.map(tone => (
                <button
                  key={tone.id}
                  type="button"
                  onClick={() => onGenerate(tone.id)}
                  disabled={Boolean(generatingTone)}
                  className="rounded-xl border border-stone-800 bg-stone-900/70 p-3 text-right transition hover:border-purple-400/60 hover:bg-purple-500/10 disabled:cursor-wait disabled:opacity-50"
                >
                  <span className="block text-xs font-bold text-purple-200">
                    {generatingTone === tone.id ? L(locale, 'در حال تولید…', 'Generating…') : isEn ? tone.labelEn : tone.labelFa}
                  </span>
                  <span className="mt-1 block text-[10px] text-stone-500">{isEn ? tone.detailEn : tone.detailFa}</span>
                </button>
              ))}
            </div>
          </section>

          {generatingTone && <p role="status" className="rounded-lg bg-purple-500/10 p-3 text-xs text-purple-200">{L(locale, 'در حال ساخت کپشن با Gemini…', 'Generating a caption with Gemini…')}</p>}

          {(caption || hashtags) && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-bold text-white">{L(locale, 'کپشن آمادهٔ انتشار', 'Caption ready to publish')}</h3>
                <span className="text-[10px] text-stone-500">{L(locale, 'قابل ویرایش', 'Editable')}</span>
              </div>
              <textarea
                autoFocus
                aria-label={L(locale, 'کپشن و هشتگ‌های اینستاگرام', 'Instagram caption and hashtags')}
                value={value}
                onChange={event => {
                  const parts = event.target.value.split(/\n\s*\n/)
                  onChange(parts[0] || '', parts.slice(1).join('\n\n'))
                }}
                className="min-h-40 w-full resize-y rounded-xl border border-stone-700 bg-black/50 p-3 text-sm leading-7 text-white outline-none focus:border-purple-400"
                dir="auto"
              />
              <button type="button" onClick={onCopy} className="mt-2 w-full rounded-xl border border-purple-400/30 bg-purple-500/10 py-2.5 text-xs font-bold text-purple-200 transition hover:bg-purple-500/20">
                {L(locale, '📋 کپی کپشن و هشتگ‌ها', '📋 Copy caption and hashtags')}
              </button>
            </section>
          )}

          {!caption && !generatingTone && (
            <p className="rounded-xl border border-dashed border-stone-700 p-4 text-center text-xs leading-6 text-stone-500">
              {L(locale, 'یکی از لحن‌ها را انتخاب کنید تا متن زیرنویس ویدیو به کپشن کوتاه اینستاگرام و هشتگ‌های مرتبط تبدیل شود.', 'Choose a tone to turn your video subtitles into a short Instagram caption and relevant hashtags.')}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
