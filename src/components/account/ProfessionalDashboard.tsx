'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import EditPromptModal from './EditPromptModal'

const ANIME_AVATARS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Felix',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Zack',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Luna',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Milo',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Oliver',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Bella',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Jasper',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Coco',
]

export default function ProfessionalDashboard({
  user,
  likedPrompts,
  savedPrompts,
  myPrompts,
  myComments,
  cartItems = [],
}: any) {
  const [activeTab, setActiveTab] = useState<'prompts' | 'saved' | 'likes' | 'comments' | 'cart'>('prompts')
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)
  
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    username: user?.username || '',
    bio: user?.bio || '',
    image: user?.image || '',
    telegram: user?.telegram || '',
    instagram: user?.instagram || '',
    telegramHandle: user?.telegramHandle || '',
  })
  
  const [savingProfile, setSavingProfile] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const size = 160
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, size, size)
          const compressed = canvas.toDataURL('image/webp', 0.6)
          setProfileData((prev) => ({ ...prev, image: compressed }))
        }
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    setErrorMessage(null)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      })
      const data = await res.json()
      if (res.ok) {
        setIsEditProfileOpen(false)
        window.location.reload()
      } else {
        setErrorMessage(data.error || 'خطا در ثبت اطلاعات')
      }
    } finally {
      setSavingProfile(false)
    }
  }

  const cartTotal = cartItems.reduce(
    (acc: number, item: any) => acc + (item.product?.price || 0) * (item.quantity || 1),
    0
  )

  const publicUrl = user?.username ? `/u/${user.username}` : null

  return (
    <div className="space-y-8">
      {/* هدر اطلاعات کاربر */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-r from-elevated via-surface to-elevated p-6 md:p-8">
        <div className="flex flex-col md:flex-row items-center gap-6 justify-between">
          <div className="flex flex-col md:flex-row items-center gap-5 text-center md:text-right">
            {publicUrl ? (
              <Link href={publicUrl} className="relative h-24 w-24 rounded-full border-2 border-gold/40 bg-black/60 overflow-hidden shadow-xl flex items-center justify-center shrink-0 hover:border-gold transition-all">
                {user.image ? (
                  <img src={user.image} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl text-gold-bright font-bold">
                    {user.name ? user.name.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                  </span>
                )}
              </Link>
            ) : (
              <div className="relative h-24 w-24 rounded-full border-2 border-gold/40 bg-black/60 overflow-hidden shadow-xl flex items-center justify-center shrink-0">
                {user.image ? (
                  <img src={user.image} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl text-gold-bright font-bold">
                    {user.name ? user.name.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            )}

            <div>
              <div className="flex items-center gap-3 justify-center md:justify-start">
                {publicUrl ? (
                  <Link href={publicUrl} className="font-display text-2xl font-black text-ink hover:text-gold-bright transition-colors">
                    {user.name || 'کاربر PromptsFA'}
                  </Link>
                ) : (
                  <h1 className="font-display text-2xl font-black text-ink">{user.name || 'کاربر PromptsFA'}</h1>
                )}
                
                <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-[10px] text-gold-bright">
                  {user.role === 'ADMIN' ? 'مدیر سیستم' : 'عضو طلایی'}
                </span>
              </div>
              
              <div className="mt-1 flex items-center gap-2 justify-center md:justify-start text-xs text-ink-muted">
                <span>{user.email}</span>
                {user.username && (
                  <>
                    <span>·</span>
                    <Link href={publicUrl!} target="_blank" className="text-gold-bright hover:underline" dir="ltr">
                      promptsfa.ir/u/{user.username} ↗
                    </Link>
                  </>
                )}
              </div>

              <p className="mt-2 max-w-lg text-xs leading-relaxed text-ink/80">
                {user.bio || 'هنوز بیوگرافی اضافه نشده است.'}
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-center md:justify-start gap-3">
                {user.telegramHandle && (
                  <a
                    href={`https://t.me/${user.telegramHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs text-sky-400 hover:bg-sky-500/20 hover:border-sky-400 transition-all"
                  >
                    <span>✈️</span>
                    <span dir="ltr">@{user.telegramHandle}</span>
                  </a>
                )}
                {user.instagram && (
                  <a
                    href={`https://instagram.com/${user.instagram.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-full border border-pink-500/40 bg-pink-500/10 px-3 py-1 text-xs text-pink-400 hover:bg-pink-500/20 hover:border-pink-400 transition-all"
                  >
                    <span>📷</span>
                    <span dir="ltr">@{user.instagram.replace(/^@/, '')}</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 justify-center">
            {publicUrl && (
              <Link
                href={publicUrl}
                target="_blank"
                className="btn-secondary rounded-xl border border-line px-3.5 py-2 text-xs font-bold text-gold-bright hover:border-gold/50 transition-all"
              >
                🌐 مشاهده صفحه عمومی
              </Link>
            )}
            <button
              onClick={() => setIsEditProfileOpen(true)}
              className="btn-secondary rounded-xl border border-line px-4 py-2 text-xs font-bold text-ink-muted hover:border-gold/50 hover:text-gold-bright transition-all"
            >
              ⚙️ ویرایش مشخصات
            </button>
          </div>
        </div>
      </div>

      {/* تب‌ها */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
        {[
          { key: 'prompts', label: 'پرامپت‌های من', count: myPrompts?.length || 0, icon: '' },
          { key: 'saved', label: 'ذخیره‌شده‌ها', count: savedPrompts?.length || 0, icon: '🔖' },
          { key: 'likes', label: 'لایک‌ها', count: likedPrompts?.length || 0, icon: '❤️' },
          { key: 'comments', label: 'نظرات', count: myComments?.length || 0, icon: '💬' },
          { key: 'cart', label: 'سبد خرید', count: cartItems?.length || 0, icon: '🛒' },
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
        {activeTab === 'prompts' && (
          <div className="card divide-y divide-line overflow-hidden">
            {myPrompts && myPrompts.length > 0 ? (
              myPrompts.map((p: any) => (
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
              ))
            ) : (
              <p className="p-8 text-center text-sm text-ink-muted">هنوز پرامپتی ارسال نکرده‌اید.</p>
            )}
          </div>
        )}

        {activeTab === 'saved' && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {savedPrompts && savedPrompts.length > 0 ? (
              savedPrompts.map((b: any) => (
                b.prompt && (
                  <Link
                    key={b.id || b.prompt.id}
                    href={`/prompts/${b.prompt.slug}`}
                    className="group card overflow-hidden transition-all hover:border-gold/40"
                  >
                    <div className="aspect-square overflow-hidden bg-black/80">
                      <img src={b.prompt.img || '/placeholder.png'} alt={b.prompt.titleFa} className="h-full w-full object-cover" />
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-1 text-xs font-bold">{b.prompt.titleFa}</p>
                      <p className="mt-1 text-[10px] text-ink-muted">{b.prompt.category?.nameFa}</p>
                    </div>
                  </Link>
                )
              ))
            ) : (
              <p className="col-span-full p-8 text-center text-sm text-ink-muted">پرامپتی ذخیره نشده است.</p>
            )}
          </div>
        )}

        {activeTab === 'likes' && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {likedPrompts && likedPrompts.length > 0 ? (
              likedPrompts.map((l: any) => (
                l.prompt && (
                  <Link
                    key={l.id || l.prompt.id}
                    href={`/prompts/${l.prompt.slug}`}
                    className="group card overflow-hidden transition-all hover:border-gold/40"
                  >
                    <div className="aspect-square overflow-hidden bg-black/80">
                      <img src={l.prompt.img || '/placeholder.png'} alt={l.prompt.titleFa} className="h-full w-full object-cover" />
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-1 text-xs font-bold">{l.prompt.titleFa}</p>
                      <p className="mt-1 text-[10px] text-ink-muted">{l.prompt.category?.nameFa}</p>
                    </div>
                  </Link>
                )
              ))
            ) : (
              <p className="col-span-full p-8 text-center text-sm text-ink-muted">پرامپتی لایک نشده است.</p>
            )}
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="card divide-y divide-line overflow-hidden">
            {myComments && myComments.length > 0 ? (
              myComments.map((c: any) => (
                <div key={c.id} className="p-4">
                  <p className="text-xs text-ink leading-relaxed">{c.text}</p>
                  <div className="mt-2 flex items-center justify-between text-[10px]">
                    {c.prompt && (
                      <Link href={`/prompts/${c.prompt.slug}`} className="text-gold-bright hover:underline">
                        {c.prompt.titleFa}
                      </Link>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="p-8 text-center text-sm text-ink-muted">هنوز نظری ثبت نکرده‌اید.</p>
            )}
          </div>
        )}

        {activeTab === 'cart' && (
          <div className="card p-6">
            <h3 className="font-display text-lg font-bold text-gold-bright mb-4">سبد خرید شما</h3>
            {cartItems && cartItems.length > 0 ? (
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
                  💳 تسویه حساب
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

      {/* مودال ویرایش پروفایل */}
      {isEditProfileOpen && (
        <div
          onClick={() => setIsEditProfileOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card w-full max-w-lg border-gold/40 bg-[#12100d] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
              <h3 className="font-display text-base font-bold text-gold-bright">
                ویرایش اطلاعات حساب کاربری
              </h3>
              <button type="button" onClick={() => setIsEditProfileOpen(false)} className="text-ink-muted hover:text-ink text-sm p-1">
                ✕
              </button>
            </div>

            {errorMessage && (
              <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-2.5 text-xs text-red-400">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-ink-muted mb-1 font-bold">نام نمایشی</label>
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    className="w-full rounded-lg border border-line bg-surface p-2.5 text-xs text-ink focus:border-gold/60 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-muted mb-1 font-bold">نام کاربری یکتا (URL)</label>
                  <input
                    type="text"
                    placeholder="username"
                    value={profileData.username}
                    onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                    className="w-full rounded-lg border border-line bg-surface p-2.5 text-xs text-ink focus:border-gold/60 focus:outline-none dir-ltr text-left font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-ink-muted mb-2 font-bold">تصویر آواتار</label>
                <div className="flex items-center gap-4">
                  <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-gold/50 bg-black/60 shrink-0">
                    {profileData.image ? (
                      <img src={profileData.image} alt="Preview" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-ink-muted">بدون عکس</div>
                    )}
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 rounded-xl border border-gold/40 bg-gold/10 px-4 py-2.5 text-xs font-bold text-gold-bright hover:bg-gold/20 transition-all"
                  >
                    <span>📁</span>
                    <span>انتخاب عکس</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-ink-muted mb-2 font-bold">یا انتخاب آواتار انیمیشنی</label>
                <div className="flex items-center gap-2.5 overflow-x-auto pb-2">
                  {ANIME_AVATARS.map((avatar, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setProfileData({ ...profileData, image: avatar })}
                      className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 bg-[#1a1714] p-1 transition-all ${
                        profileData.image === avatar
                          ? 'border-gold-bright scale-110 shadow-[0_0_12px_rgba(212,175,55,0.5)]'
                          : 'border-line/60 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={avatar} alt={`Avatar ${idx}`} className="h-full w-full object-contain" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-ink-muted mb-1 font-bold">آیدی تلگرام (برای اتصال به حساب)</label>
                  <input
                    type="text"
                    placeholder="username (بدون @)"
                    value={profileData.telegramHandle}
                    onChange={(e) => setProfileData({ ...profileData, telegramHandle: e.target.value })}
                    className="w-full rounded-lg border border-line bg-surface p-2.5 text-xs text-ink focus:border-gold/60 focus:outline-none dir-ltr text-left"
                  />
                  <p className="mt-1 text-[10px] text-ink-faint">برای اتصال حساب تلگرام به ایمیل خود</p>
                </div>
                <div>
                  <label className="block text-xs text-ink-muted mb-1 font-bold">آیدی اینستاگرام</label>
                  <input
                    type="text"
                    placeholder="username"
                    value={profileData.instagram}
                    onChange={(e) => setProfileData({ ...profileData, instagram: e.target.value })}
                    className="w-full rounded-lg border border-line bg-surface p-2.5 text-xs text-ink focus:border-gold/60 focus:outline-none dir-ltr text-left"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-ink-muted mb-1 font-bold">بیوگرافی کوتاه</label>
                <textarea
                  rows={3}
                  value={profileData.bio}
                  onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2.5 text-xs text-ink focus:border-gold/60 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-line">
                <button type="button" onClick={() => setIsEditProfileOpen(false)} className="rounded-lg border border-line px-4 py-2 text-xs text-ink-muted hover:bg-surface">
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