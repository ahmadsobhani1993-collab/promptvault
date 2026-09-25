'use client'

import { useState } from 'react'
import Link from 'next/link'
import EditPromptModal from './EditPromptModal'

// آواتارهای شیک و آماده
const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
]

// تابع کمکی برای تشخیص ویدیو و حل باگ تصویر شکسته
function isVideoMedia(url?: string | null, type?: string | null) {
  if (!url) return false
  if (type === 'VIDEO' || type === 'video') return true
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url)
}

function PromptMediaPreview({ prompt }: { prompt: any }) {
  const mediaUrl = prompt.img || prompt.videoUrl || prompt.mediaUrl || ''
  const isVideo = isVideoMedia(mediaUrl, prompt.type)

  if (isVideo) {
    return (
      <div className="relative h-full w-full bg-black/90 group/media">
        <video
          src={mediaUrl}
          muted
          loop
          playsInline
          onMouseEnter={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
          onMouseLeave={(e) => {
            const v = e.target as HTMLVideoElement
            v.pause()
            v.currentTime = 0
          }}
          className="h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/60 p-1.5 text-gold-bright backdrop-blur-md">
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    )
  }

  return (
    <img
      src={mediaUrl || '/placeholder.png'}
      alt={prompt.titleFa || 'Prompt'}
      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      onError={(e) => {
        // فالبک برای تصاویر نامعتبر
        (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="%23222"><rect width="24" height="24"/><text x="50%" y="50%" fill="%23d4af37" font-size="3" text-anchor="middle" dominant-baseline="middle">Media</text></svg>'
      }}
    />
  )
}

export default function ProfessionalDashboard({
  user,
  likedPrompts,
  savedPrompts,
  myPrompts,
  myComments,
  cartItems = [],
  locale = 'fa',
}: any) {
  const [activeTab, setActiveTab] = useState<'prompts' | 'saved' | 'likes' | 'comments' | 'cart'>('prompts')
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    bio: user?.bio || '',
    image: user?.image || '',
    telegram: user?.telegram || '',
    instagram: user?.instagram || '',
  })
  const [savingProfile, setSavingProfile] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [togglingPush, setTogglingPush] = useState(false)

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      })
      if (res.ok) {
        setIsEditProfileOpen(false)
        window.location.reload()
      }
    } finally {
      setSavingProfile(false)
    }
  }

  const handleTogglePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('مرورگر شما از وب پوش پشتیبانی نمی‌کند.')
      return
    }
    setTogglingPush(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        setNotificationsEnabled(true)
        alert('اعلان‌های اختصاصی PromptsFA فعال شدند!')
      } else {
        alert('اجازه دریافت نوتیفیکیشن داده نشد.')
      }
    } catch {
      alert('خطا در تنظیم اعلان‌ها')
    } finally {
      setTogglingPush(false)
    }
  }

  const cartTotal = cartItems.reduce(
    (acc: number, item: any) => acc + (item.product?.price || 0) * (item.quantity || 1),
    0
  )

  return (
    <div className="space-y-8">
      {/* هدر هویت بصری کاربر */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-r from-elevated via-surface to-elevated p-6 md:p-8">
        <div className="flex flex-col md:flex-row items-center gap-6 justify-between">
          <div className="flex flex-col md:flex-row items-center gap-5 text-center md:text-right">
            <div className="relative h-24 w-24 rounded-full border-2 border-gold/40 bg-black/60 overflow-hidden shadow-xl flex items-center justify-center shrink-0">
              {user.image ? (
                <img src={user.image} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl text-gold-bright font-bold">
                  {user.name ? user.name.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-3 justify-center md:justify-start">
                <h1 className="font-display text-2xl font-black text-ink">{user.name || 'کاربر PromptsFA'}</h1>
                <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-[10px] text-gold-bright">
                  {user.role === 'ADMIN' ? 'مدیر سیستم' : 'عضو طلایی'}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-muted">{user.email}</p>
              <p className="mt-2 max-w-lg text-xs leading-relaxed text-ink/80">
                {user.bio || 'هنوز بیوگرافی اضافه نشده است.'}
              </p>

              {/* نمایش آیدی‌های شبکه‌های اجتماعی */}
              <div className="mt-3 flex items-center justify-center md:justify-start gap-3">
                {user.telegram && (
                  <a
                    href={`https://t.me/${user.telegram.replace('@', '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[11px] text-sky-400 hover:border-sky-400 transition-colors"
                  >
                    <span>✈️</span>
                    <span>{user.telegram}</span>
                  </a>
                )}
                {user.instagram && (
                  <a
                    href={`https://instagram.com/${user.instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-full border border-pink-500/30 bg-pink-500/10 px-2.5 py-0.5 text-[11px] text-pink-400 hover:border-pink-400 transition-colors"
                  >
                    <span>📷</span>
                    <span>{user.instagram}</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 justify-center">
            {/* دکمه نوتیفیکیشن در تنظیمات */}
            <button
              onClick={handleTogglePush}
              disabled={togglingPush}
              className="flex items-center gap-1.5 rounded-xl border border-line bg-surface/70 px-3.5 py-2 text-xs font-bold text-ink-muted hover:border-gold/50 hover:text-gold-bright transition-all"
              title="اعلان‌های مرورگر"
            >
              <span>🔔</span>
              <span>{notificationsEnabled ? 'اعلان‌ها فعال' : 'فعال‌سازی نوتیف'}</span>
            </button>

            <button
              onClick={() => setIsEditProfileOpen(true)}
              className="btn-secondary rounded-xl border border-line px-4 py-2 text-xs font-bold text-ink-muted hover:border-gold/50 hover:text-gold-bright transition-all"
            >
              ⚙️ ویرایش مشخصات
            </button>
            {user.role === 'ADMIN' && (
              <Link href="/admin" className="btn-primary rounded-xl px-4 py-2 text-xs font-bold">
                پنل مدیریت
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* نوار تب‌ها */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
        {[
          { key: 'prompts', label: 'پرامپت‌های من', count: myPrompts.length, icon: '⚡' },
          { key: 'saved', label: 'ذخیره‌شده‌ها', count: savedPrompts.length, icon: '🔖' },
          { key: 'likes', label: 'لایک‌ها', count: likedPrompts.length, icon: '❤️' },
          { key: 'comments', label: 'نظرات', count: myComments.length, icon: '💬' },
          { key: 'cart', label: 'سبد خرید', count: cartItems.length, icon: '🛒' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all ${
              activeTab === tab.key
                ? 'border border-gold bg-gold/15 text-gold-bright shadow-lg'
                : 'border border-line bg-surface text-ink-muted hover:border-gold/30 hover:text-ink'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px]">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* محتوای تب‌ها */}
      <div>
        {/* ۱. تب پرامپت‌های من */}
        {activeTab === 'prompts' && (
          <div className="card divide-y divide-line overflow-hidden">
            {myPrompts.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between p-4 hover:bg-surface/50 transition-colors">
                <div>
                  <Link href={`/prompts/${p.slug}`} className="text-sm font-bold text-ink hover:text-gold-bright">
                    {p.titleFa}
                  </Link>
                  <p className="mt-1 text-[10px] text-ink-faint">مدل: {p.model || 'نامشخص'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <EditPromptModal prompt={p} />
                  <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-[10px] font-bold text-green-400">
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
            {myPrompts.length === 0 && (
              <p className="p-8 text-center text-sm text-ink-muted">هنوز پرامپتی ارسال نکرده‌اید.</p>
            )}
          </div>
        )}

        {/* ۲. تب ذخیره‌ها (با حل باگ تصویر ویدیو) */}
        {activeTab === 'saved' && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {savedPrompts.map(
              (b: any) =>
                b.prompt && (
                  <Link
                    key={b.prompt.id}
                    href={`/prompts/${b.prompt.slug}`}
                    className="group card overflow-hidden transition-all hover:border-gold/40"
                  >
                    <div className="aspect-square overflow-hidden bg-black/80">
                      <PromptMediaPreview prompt={b.prompt} />
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-1 text-xs font-bold">{b.prompt.titleFa}</p>
                      <p className="mt-1 text-[10px] text-ink-muted">{b.prompt.category?.nameFa}</p>
                    </div>
                  </Link>
                )
            )}
            {savedPrompts.length === 0 && (
              <p className="col-span-full p-8 text-center text-sm text-ink-muted">پرامپتی ذخیره نشده است.</p>
            )}
          </div>
        )}

        {/* ۳. تب لایک‌ها (با حل باگ تصویر ویدیو) */}
        {activeTab === 'likes' && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {likedPrompts.map(
              (l: any) =>
                l.prompt && (
                  <Link
                    key={l.prompt.id}
                    href={`/prompts/${l.prompt.slug}`}
                    className="group card overflow-hidden transition-all hover:border-gold/40"
                  >
                    <div className="aspect-square overflow-hidden bg-black/80">
                      <PromptMediaPreview prompt={l.prompt} />
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-1 text-xs font-bold">{l.prompt.titleFa}</p>
                      <p className="mt-1 text-[10px] text-ink-muted">{l.prompt.category?.nameFa}</p>
                    </div>
                  </Link>
                )
            )}
            {likedPrompts.length === 0 && (
              <p className="col-span-full p-8 text-center text-sm text-ink-muted">پرامپتی لایک نشده است.</p>
            )}
          </div>
        )}

        {/* ۴. تب نظرات */}
        {activeTab === 'comments' && (
          <div className="card divide-y divide-line overflow-hidden">
            {myComments.map((c: any) => (
              <div key={c.id} className="p-4">
                <p className="text-xs text-ink leading-relaxed">{c.text}</p>
                <div className="mt-2 flex items-center justify-between text-[10px]">
                  <Link href={`/prompts/${c.prompt?.slug}`} className="text-gold-bright hover:underline">
                    {c.prompt?.titleFa}
                  </Link>
                </div>
              </div>
            ))}
            {myComments.length === 0 && (
              <p className="p-8 text-center text-sm text-ink-muted">هنوز نظری ثبت نکرده‌اید.</p>
            )}
          </div>
        )}

        {/* ۵. تب سبد خرید */}
        {activeTab === 'cart' && (
          <div className="card p-6">
            <h3 className="font-display text-lg font-bold text-gold-bright mb-4">سبد خرید شما</h3>
            {cartItems.length > 0 ? (
              <div className="space-y-4">
                {cartItems.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between border-b border-line pb-3">
                    <div>
                      <p className="text-sm font-bold">{item.product?.titleFa}</p>
                      <p className="text-xs text-ink-muted">{item.product?.price?.toLocaleString('fa-IR')} تومان</p>
                    </div>
                    <span className="text-xs">تعداد: {item.quantity}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-4">
                  <span className="font-bold text-sm">مجموع پرداختی:</span>
                  <span className="font-bold text-base text-gold-bright">
                    {cartTotal.toLocaleString('fa-IR')} تومان
                  </span>
                </div>
                <button className="btn-primary w-full py-3 mt-4 rounded-xl font-bold text-sm">
                  💳 تسویه حساب و اتصال به درگاه
                </button>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-4xl mb-2">🛒</div>
                <p className="text-sm text-ink-muted">سبد خرید شما در حال حاضر خالی است.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* مودال حرفه‌ای ویرایش پروفایل همراه با انتخاب آواتار و آیدی شبکه‌های اجتماعی */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="card w-full max-w-lg border-gold/40 bg-[#12100d] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-display text-base font-bold text-gold-bright mb-4">
              ویرایش اطلاعات حساب کاربری
            </h3>
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-ink-muted mb-1">نام یا نام مستعار</label>
                <input
                  type="text"
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2.5 text-xs text-ink focus:border-gold/60 focus:outline-none"
                />
              </div>

              {/* بخش انتخاب آواتارهای آماده */}
              <div>
                <label className="block text-xs text-ink-muted mb-2">انتخاب سریع آواتار</label>
                <div className="flex items-center gap-3 overflow-x-auto pb-2">
                  {PRESET_AVATARS.map((avatar, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setProfileData({ ...profileData, image: avatar })}
                      className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 transition-all ${
                        profileData.image === avatar
                          ? 'border-gold-bright scale-110 shadow-[0_0_10px_rgba(212,175,55,0.4)]'
                          : 'border-line/60 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={avatar} alt={`Avatar ${idx}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-ink-muted mb-1">یا آدرس عکس آواتار دلخواه (URL)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={profileData.image}
                  onChange={(e) => setProfileData({ ...profileData, image: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2.5 text-xs text-ink focus:border-gold/60 focus:outline-none"
                />
              </div>

              {/* ورودی آیدی تلگرام و اینستاگرام */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-ink-muted mb-1">آیدی تلگرام</label>
                  <input
                    type="text"
                    placeholder="@username"
                    value={profileData.telegram}
                    onChange={(e) => setProfileData({ ...profileData, telegram: e.target.value })}
                    className="w-full rounded-lg border border-line bg-surface p-2.5 text-xs text-ink focus:border-gold/60 focus:outline-none dir-ltr text-left"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-muted mb-1">آیدی اینستاگرام</label>
                  <input
                    type="text"
                    placeholder="@username"
                    value={profileData.instagram}
                    onChange={(e) => setProfileData({ ...profileData, instagram: e.target.value })}
                    className="w-full rounded-lg border border-line bg-surface p-2.5 text-xs text-ink focus:border-gold/60 focus:outline-none dir-ltr text-left"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-ink-muted mb-1">بیوگرافی کوتاه</label>
                <textarea
                  rows={3}
                  value={profileData.bio}
                  onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2.5 text-xs text-ink focus:border-gold/60 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(false)}
                  className="rounded-lg border border-line px-4 py-2 text-xs text-ink-muted hover:bg-surface"
                >
                  انصراف
                </button>
                <button type="submit" disabled={savingProfile} className="btn-primary px-5 py-2 text-xs font-bold">
                  {savingProfile ? 'در حال ثبت...' : 'ذخیره تغییرات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}