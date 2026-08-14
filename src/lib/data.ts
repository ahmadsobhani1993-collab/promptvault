import type { Locale } from '@/lib/i18n'

export const L = (locale: Locale, fa: string, en: string) =>
  locale === 'fa' ? fa : en

export type PromptType = 'image' | 'video' | 'text' | 'code' | 'audio'

export const typeLabel: Record<PromptType, { fa: string; en: string }> = {
  image: { fa: 'تصویر', en: 'Image' },
  video: { fa: 'ویدیو', en: 'Video' },
  text: { fa: 'متن', en: 'Text' },
  code: { fa: 'کد', en: 'Code' },
  audio: { fa: 'موسیقی', en: 'Music' },
}

export interface Prompt {
  slug: string
  titleFa: string
  titleEn: string
  img: string
  model: string
  type: PromptType
  category: string
  sub: string
  tagsFa: string[]
  tagsEn: string[]
  prompt: string
  likes: string
  saves: string
  views: string
}

export interface Category {
  slug: string
  icon: string
  fa: string
  en: string
  descFa: string
  descEn: string
  subs: { slug: string; fa: string; en: string }[]
}

export interface Article {
  slug: string
  titleFa: string
  titleEn: string
  descFa: string
  descEn: string
  img: string
  tagFa: string
  tagEn: string
  dateFa: string
  dateEn: string
  readFa: string
  readEn: string
  contentFa: string[]
  contentEn: string[]
}

export const categories: Category[] = [
  {
    slug: 'image',
    icon: 'camera',
    fa: 'تصویر',
    en: 'Image',
    descFa: 'پرتره، محصول، کاراکتر و هنرهای تصویری',
    descEn: 'Portraits, product, character and visual arts',
    subs: [
      { slug: 'photography', fa: 'عکاسی', en: 'Photography' },
      { slug: 'product', fa: 'محصول', en: 'Product' },
      { slug: 'character', fa: 'کاراکتر', en: 'Character' },
    ],
  },
  {
    slug: 'video',
    icon: 'play',
    fa: 'ویدیو',
    en: 'Video',
    descFa: 'تیزر، فیلم کوتاه و موشن',
    descEn: 'Teasers, short films and motion',
    subs: [
      { slug: 'cinematic', fa: 'سینمایی', en: 'Cinematic' },
      { slug: 'shortfilm', fa: 'فیلم کوتاه', en: 'Short Film' },
    ],
  },
  {
    slug: 'text',
    icon: 'file',
    fa: 'متن',
    en: 'Text',
    descFa: 'نویسندگی، تبلیغات و تولید محتوا',
    descEn: 'Writing, ads and content creation',
    subs: [
      { slug: 'writing', fa: 'نویسندگی', en: 'Writing' },
      { slug: 'marketing', fa: 'تبلیغات', en: 'Marketing' },
    ],
  },
  {
    slug: 'code',
    icon: 'code',
    fa: 'کد',
    en: 'Code',
    descFa: 'تولید کد، دیباگ و معماری نرم‌افزار',
    descEn: 'Code generation, debugging and architecture',
    subs: [
      { slug: 'frontend', fa: 'فرانت‌اند', en: 'Frontend' },
      { slug: 'debug', fa: 'دیباگ', en: 'Debug' },
    ],
  },
  {
    slug: 'music',
    icon: 'music',
    fa: 'موسیقی',
    en: 'Music',
    descFa: 'موسیقی فیلم، امبینت و آهنگسازی',
    descEn: 'Soundtrack, ambient and composition',
    subs: [
      { slug: 'soundtrack', fa: 'موسیقی فیلم', en: 'Soundtrack' },
      { slug: 'ambient', fa: 'امبینت', en: 'Ambient' },
    ],
  },
  {
    slug: 'productivity',
    icon: 'gear',
    fa: 'بهره‌وری',
    en: 'Productivity',
    descFa: 'برنامه‌ریزی، یادگیری و مدیریت',
    descEn: 'Planning, learning and management',
    subs: [
      { slug: 'planning', fa: 'برنامه‌ریزی', en: 'Planning' },
      { slug: 'learning', fa: 'یادگیری', en: 'Learning' },
    ],
  },
]

export const prompts: Prompt[] = [
  {
    slug: 'cinematic-portrait-rain',
    titleFa: 'پرتره سینمایی در باران',
    titleEn: 'Cinematic Portrait in Rain',
    img: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=800&auto=format&fit=crop',
    model: 'MJ',
    type: 'image',
    category: 'image',
    sub: 'photography',
    tagsFa: ['پرتره', 'سینمایی'],
    tagsEn: ['portrait', 'cinematic'],
    prompt:
      'Cinematic portrait of a woman in the rain at night, neon reflections, 85mm lens, f/1.8, soft rim light, film grain, moody color grade --ar 4:5 --v 6',
    likes: '248',
    saves: '1.2K',
    views: '8.7K',
  },
  {
    slug: 'luxury-product-shot',
    titleFa: 'عکاسی محصول لوکس',
    titleEn: 'Luxury Product Studio Shot',
    img: 'https://images.unsplash.com/photo-1541643600914-78b084683601?q=80&w=800&auto=format&fit=crop',
    model: 'FLUX',
    type: 'image',
    category: 'image',
    sub: 'product',
    tagsFa: ['محصول', 'لوکس'],
    tagsEn: ['product', 'luxury'],
    prompt:
      'Luxury perfume bottle on a black stone pedestal, dramatic studio lighting, gold accents, ultra sharp product photography, soft shadows --ar 4:5',
    likes: '312',
    saves: '1.8K',
    views: '9.1K',
  },
  {
    slug: 'dark-fantasy-character',
    titleFa: 'کاراکتر فانتزی تاریک',
    titleEn: 'Dark Fantasy Character',
    img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=800&auto=format&fit=crop',
    model: 'SD',
    type: 'image',
    category: 'image',
    sub: 'character',
    tagsFa: ['فانتزی', 'کاراکتر'],
    tagsEn: ['fantasy', 'character'],
    prompt:
      'Dark fantasy warrior character, weathered armor, ember particles, volumetric fog, concept art style, highly detailed --ar 1:1',
    likes: '198',
    saves: '940',
    views: '8.3K',
  },
  {
    slug: 'futuristic-architecture',
    titleFa: 'معماری آینده‌نگرانه',
    titleEn: 'Futuristic Architecture',
    img: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?q=80&w=800&auto=format&fit=crop',
    model: 'MJ',
    type: 'image',
    category: 'image',
    sub: 'photography',
    tagsFa: ['معماری', 'آینده'],
    tagsEn: ['architecture', 'future'],
    prompt:
      'Futuristic white architecture at sunset, sweeping curves, cinematic wide shot, photorealistic, golden hour light --ar 16:9',
    likes: '176',
    saves: '820',
    views: '7.7K',
  },
  {
    slug: 'vibrant-studio-portrait',
    titleFa: 'پرتره استودیویی رنگارنگ',
    titleEn: 'Vibrant Studio Portrait',
    img: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?q=80&w=800&auto=format&fit=crop',
    model: 'DALL·E',
    type: 'image',
    category: 'image',
    sub: 'photography',
    tagsFa: ['استودیو', 'رنگ'],
    tagsEn: ['studio', 'color'],
    prompt:
      'Studio portrait with colorful smoke background, bold glasses, high fashion editorial, crisp detail --ar 4:5',
    likes: '154',
    saves: '760',
    views: '6.9K',
  },
  {
    slug: 'cinematic-product-teaser',
    titleFa: 'تیزر سینمایی محصول',
    titleEn: 'Cinematic Product Teaser',
    img: 'https://images.unsplash.com/photo-1574717024653-61fd284d5c1c?q=80&w=800&auto=format&fit=crop',
    model: 'Veo',
    type: 'video',
    category: 'video',
    sub: 'cinematic',
    tagsFa: ['تیزر', 'سینمایی'],
    tagsEn: ['teaser', 'cinematic'],
    prompt:
      'Cinematic 10s product teaser: slow dolly-in, dramatic lighting, macro details, filmic color grade',
    likes: '201',
    saves: '1.1K',
    views: '7.2K',
  },
  {
    slug: 'neon-music-video',
    titleFa: 'موزیک ویدیوی نئونی',
    titleEn: 'Neon Music Video',
    img: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=800&auto=format&fit=crop',
    model: 'Runway',
    type: 'video',
    category: 'video',
    sub: 'shortfilm',
    tagsFa: ['نئون', 'موزیک'],
    tagsEn: ['neon', 'music'],
    prompt:
      'Neon-lit music video scene, retro-futuristic city, anamorphic lens flares, smooth camera motion',
    likes: '167',
    saves: '700',
    views: '6.1K',
  },
  {
    slug: 'ad-copywriting',
    titleFa: 'کپی‌رایتینگ تبلیغاتی',
    titleEn: 'Ad Copywriting',
    img: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?q=80&w=800&auto=format&fit=crop',
    model: 'ChatGPT',
    type: 'text',
    category: 'text',
    sub: 'marketing',
    tagsFa: ['تبلیغات', 'نویسندگی'],
    tagsEn: ['ads', 'writing'],
    prompt:
      'Write 5 persuasive ad headlines for a luxury skincare brand. Tone: confident and minimal. Under 8 words each.',
    likes: '143',
    saves: '650',
    views: '5.8K',
  },
  {
    slug: 'content-assistant',
    titleFa: 'دستیار تولید محتوا',
    titleEn: 'Content Creation Assistant',
    img: 'https://images.unsplash.com/photo-1471107340929-a87cd0f5b5f3?q=80&w=800&auto=format&fit=crop',
    model: 'Gemini',
    type: 'text',
    category: 'text',
    sub: 'writing',
    tagsFa: ['محتوا', 'شبکه اجتماعی'],
    tagsEn: ['content', 'social'],
    prompt:
      'Act as a senior content strategist. Create a 7-day content plan for an AI tools brand with hooks and CTAs.',
    likes: '129',
    saves: '580',
    views: '5.2K',
  },
  {
    slug: 'react-component-gen',
    titleFa: 'تولید کامپوننت React',
    titleEn: 'React Component Generator',
    img: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?q=80&w=800&auto=format&fit=crop',
    model: 'ChatGPT',
    type: 'code',
    category: 'code',
    sub: 'frontend',
    tagsFa: ['ری‌اکت', 'کامپوننت'],
    tagsEn: ['react', 'component'],
    prompt:
      'Generate a production-ready React component with TypeScript, Tailwind, accessibility, and loading states.',
    likes: '188',
    saves: '900',
    views: '6.6K',
  },
  {
    slug: 'smart-debug',
    titleFa: 'دیباگ هوشمند کد',
    titleEn: 'Smart Code Debugging',
    img: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=800&auto=format&fit=crop',
    model: 'Gemini',
    type: 'code',
    category: 'code',
    sub: 'debug',
    tagsFa: ['دیباگ', 'بهینه‌سازی'],
    tagsEn: ['debug', 'optimize'],
    prompt:
      'Find the bug in this code, explain the root cause, and provide an optimized fix with tests.',
    likes: '121',
    saves: '540',
    views: '4.9K',
  },
  {
    slug: 'film-score',
    titleFa: 'موسیقی متن فیلم',
    titleEn: 'Epic Film Score',
    img: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?q=80&w=800&auto=format&fit=crop',
    model: 'Suno',
    type: 'audio',
    category: 'music',
    sub: 'soundtrack',
    tagsFa: ['موسیقی فیلم', 'حماسی'],
    tagsEn: ['score', 'epic'],
    prompt:
      'Epic cinematic score, slow build, hybrid orchestra + synth, emotional climax at 1:30, 2 minutes total.',
    likes: '134',
    saves: '610',
    views: '5.4K',
  },
  {
    slug: 'week-planner',
    titleFa: 'برنامه‌ریزی هفته با AI',
    titleEn: 'AI Weekly Planner',
    img: 'https://images.unsplash.com/photo-1484480974693-6ca0b78fb3e6?q=80&w=800&auto=format&fit=crop',
    model: 'ChatGPT',
    type: 'text',
    category: 'productivity',
    sub: 'planning',
    tagsFa: ['برنامه‌ریزی', 'تمرکز'],
    tagsEn: ['planning', 'focus'],
    prompt:
      'Plan my week: 3 deep-work blocks daily, energy-based task mapping, and a Friday review ritual.',
    likes: '110',
    saves: '480',
    views: '4.4K',
  },
]

export const articles: Article[] = [
  {
    slug: 'midjourney-starter',
    titleFa: 'راهنمای شروع میدجرنی در ۱۰ دقیقه',
    titleEn: 'Midjourney Starter Guide in 10 Minutes',
    descFa: 'از ساخت اکانت تا اولین تصویر حرفه‌ای؛ هر آنچه برای شروع نیاز داری.',
    descEn: 'From account setup to your first pro image; everything you need to start.',
    img: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&auto=format&fit=crop',
    tagFa: 'میدجرنی',
    tagEn: 'Midjourney',
    dateFa: '۲۴ تیر ۱۴۰۵',
    dateEn: 'Jul 15, 2026',
    readFa: '۶ دقیقه',
    readEn: '6 min',
    contentFa: [
      'میدجرنی هنوز یکی از قدرتمندترین ابزارهای تولید تصویر است. برای شروع فقط به یک اکانت و کمی شناخت از ساختار پرامپت نیاز داری.',
      'ساختار پایه یک پرامپت خوب یعنی: سوژه اصلی، محیط، نور، لنز و سبک. همین پنج عنصر کیفیت خروجی را چند برابر می‌کند.',
      'در پایان، پارامترهایی مثل --ar برای نسبت تصویر و --v برای نسخه مدل را یاد بگیر تا کنترل کامل داشته باشی.',
    ],
    contentEn: [
      'Midjourney remains one of the most powerful image tools. To start, you only need an account and basic prompt structure knowledge.',
      'A good prompt base means: main subject, environment, light, lens, and style. These five elements multiply output quality.',
      'Finally, learn parameters like --ar for aspect ratio and --v for model version to take full control.',
    ],
  },
  {
    slug: 'better-prompts',
    titleFa: '۱۰ تکنیک نوشتن پرامپت بهتر',
    titleEn: '10 Prompt Writing Techniques',
    descFa: 'تکنیک‌هایی که تفاوت یک خروجی معمولی و یک خروجی حرفه‌ای را می‌سازند.',
    descEn: 'Techniques that make the difference between average and professional output.',
    img: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?q=80&w=1200&auto=format&fit=crop',
    tagFa: 'آموزش',
    tagEn: 'Tutorial',
    dateFa: '۱۸ تیر ۱۴۰۵',
    dateEn: 'Jul 9, 2026',
    readFa: '۸ دقیقه',
    readEn: '8 min',
    contentFa: [
      'شفافیت مهم‌تر از طولانی بودن است. به جای انبوهی از کلمات، دقیقاً بگو چه می‌خواهی و چه چیزی را نمی‌خواهی.',
      'از قیدهای قابل اندازه‌گیری استفاده کن: زاویه دوربین، نوع نور، پالت رنگی و حس کلی تصویر.',
      'همیشه یک نسخه پایه بساز و بعد با تغییر تک‌تک عناصر، اثر هر کدام را جداگانه ببین؛ این سریع‌ترین راه یادگیری است.',
    ],
    contentEn: [
      'Clarity beats length. Instead of piling words, say exactly what you want and what you do not want.',
      'Use measurable constraints: camera angle, light type, color palette, and overall mood.',
      'Always build a base version, then change one element at a time to see its effect; this is the fastest way to learn.',
    ],
  },
  {
    slug: 'flux-vs-sd',
    titleFa: 'مقایسه Flux و Stable Diffusion',
    titleEn: 'Flux vs Stable Diffusion',
    descFa: 'کدام مدل برای کدام کار؟ یک مقایسه کاربردی برای انتخاب درست.',
    descEn: 'Which model for which job? A practical comparison for the right choice.',
    img: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?q=80&w=1200&auto=format&fit=crop',
    tagFa: 'مقایسه',
    tagEn: 'Comparison',
    dateFa: '۱۰ تیر ۱۴۰۵',
    dateEn: 'Jul 1, 2026',
    readFa: '۷ دقیقه',
    readEn: '7 min',
    contentFa: [
      'Flux در رعایت دقیق پرامپت و متن داخل تصویر پیشتاز است و برای کارهای تجاری سریع عالی عمل می‌کند.',
      'Stable Diffusion با اکوسیستم LoRA و ControlNet هنوز بی‌رقیب‌ترین گزینه برای کنترل جزئیات و سبک‌های سفارشی است.',
      'قاعده ساده: سرعت و دقت پرامپت با Flux، کنترل عمیق و سفارشی‌سازی با SD.',
    ],
    contentEn: [
      'Flux leads in prompt adherence and in-image text, great for fast commercial work.',
      'Stable Diffusion with LoRA and ControlNet remains unbeatable for deep control and custom styles.',
      'Simple rule: speed and prompt accuracy with Flux; deep control and customization with SD.',
    ],
  },
]
