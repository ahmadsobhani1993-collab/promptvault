export type Locale = 'fa' | 'en'

export interface Dict {
  nav: {
    explore: string
    prompts: string
    categories: string
    creators: string
    blog: string
  }
  submit: string
  login: string
  logout: string
  heroLabel: string
  heroSubtitle: string
  searchPlaceholder: string
  trending: string
  categoriesTitle: string
  blogSection: string
  readMore: string
  copyPrompt: string
  copied: string
  likes: string
  saves: string
  views: string
  footerTagline: string
  rights: string
  langToggle: string
}

export const dictionaries: Record<Locale, Dict> = {
  en: {
    nav: {
      explore: 'Explore',
      prompts: 'Prompts',
      categories: 'Categories',
      creators: 'Creators',
      blog: 'Blog',
    },
    submit: 'Submit Prompt',
    login: 'Login',
    logout: 'Sign out',
    heroLabel: 'Prompt Discovery Platform',
    heroSubtitle:
      'Discover premium AI prompts for image, video, text, code, music, and productivity.',
    searchPlaceholder: 'Search thousands of AI prompts...',
    trending: 'Trending Prompts',
    categoriesTitle: 'Explore Categories',
    blogSection: 'AI Blog & Tutorials',
    readMore: 'Read more',
    copyPrompt: 'Copy Prompt',
    copied: 'Copied!',
    likes: 'likes',
    saves: 'saves',
    views: 'views',
    footerTagline: 'Beautiful but fast.',
    rights: 'All rights reserved.',
    langToggle: 'فارسی',
  },
  fa: {
    nav: {
      explore: 'کاوش',
      prompts: 'پرامپت‌ها',
      categories: 'دسته‌بندی‌ها',
      creators: 'سازندگان',
      blog: 'وبلاگ',
    },
    submit: 'ارسال پرامپت',
    login: 'ورود',
    logout: 'خروج',
    heroLabel: 'پلتفرم کشف پرامپت هوش مصنوعی',
    heroSubtitle:
      'هزاران پرامپت حرفه‌ای هوش مصنوعی برای تصویر، ویدیو، متن، کد، موسیقی و بهره‌وری کشف کن.',
    searchPlaceholder: 'جستجو در هزاران پرامپت هوش مصنوعی...',
    trending: 'پرامپت‌های داغ',
    categoriesTitle: 'دسته‌بندی‌ها',
    blogSection: 'وبلاگ و آموزش هوش مصنوعی',
    readMore: 'ادامه مطلب',
    copyPrompt: 'کپی پرامپت',
    copied: 'کپی شد!',
    likes: 'پسند',
    saves: 'ذخیره',
    views: 'بازدید',
    footerTagline: 'زیبا اما سریع.',
    rights: 'تمامی حقوق محفوظ است.',
    langToggle: 'English',
  },
}
