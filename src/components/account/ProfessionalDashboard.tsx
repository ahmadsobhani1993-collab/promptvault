'use client'

import { useState } from 'react'
import Link from 'next/link'
import EditPromptModal from './EditPromptModal'

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
  })
  const [savingProfile, setSavingProfile] = useState(false)

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

  const cartTotal = cartItems.reduce((acc: number, item: any) => acc + (item.product?.price || 0) * (item.quantity || 1), 0)

  return (
    <div className="space-y-8">
      {/* هدر هویت بصری کاربر */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-r from-elevated via-surface to-elevated p-6 md:p-8">
        <div className="flex flex-col md:flex-row items-center gap-6 justify-between">
          <div className="flex flex-col md:flex-row items-center gap-5 text-center md:text-right">
            <div className="relative h-24 w-24 rounded-full border-2 border-gold/40 bg-black/60 overflow-hidden shadow-xl flex items-center justify-center">
              {user.image ? (
                <img src={user.image} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl text-gold-bright font-bold">{user.email?.charAt(0).toUpperCase()}</span>
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
              <p className="mt-2 max-w-lg text-xs leading-relaxed text-ink/80">{user.bio || 'هنوز بیوگرافی اضافه نشده است.'}</p>
            </div>
          </div>

          <div className="flex gap-3">
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

      {/* نوار تب‌بندی پیشرفته */}
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
            {myPrompts.length === 0 && <p className="p-8 text-center text-sm text-ink-muted">هنوز پرامپتی ارسال نکرده‌اید.</p>}
          </div>
        )}

        {/* ۲. تب ذخیره‌ها */}
        {activeTab === 'saved' && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {savedPrompts.map((b: any) => b.prompt && (
              <Link key={b.prompt.id} href={`/prompts/${b.prompt.slug}`} className="card overflow-hidden transition-all hover:border-gold/40">
                <div className="aspect-square bg-black/80">
                  {b.prompt.img && <img src={b.prompt.img} alt={b.prompt.titleFa} className="h-full w-full object-cover" />}
                </div>
                <div className="p-3">
                  <p className="line-clamp-1 text-xs font-bold">{b.prompt.titleFa}</p>
                  <p className="mt-1 text-[10px] text-ink-muted">{b.prompt.category?.nameFa}</p>
                </div>
              </Link>
            ))}
            {savedPrompts.length === 0 && <p className="col-span-full p-8 text-center text-sm text-ink-muted">پرامپتی ذخیره نشده است.</p>}
          </div>
        )}

        {/* ۳. تب لایک‌ها */}
        {activeTab === 'likes' && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {likedPrompts.map((l: any) => l.prompt && (
              <Link key={l.prompt.id} href={`/prompts/${l.prompt.slug}`} className="card overflow-hidden transition-all hover:border-gold/40">
                <div className="aspect-square bg-black/80">
                  {l.prompt.img && <img src={l.prompt.img} alt={l.prompt.titleFa} className="h-full w-full object-cover" />}
                </div>
                <div className="p-3">
                  <p className="line-clamp-1 text-xs font-bold">{l.prompt.titleFa}</p>
                  <p className="mt-1 text-[10px] text-ink-muted">{l.prompt.category?.nameFa}</p>
                </div>
              </Link>
            ))}
            {likedPrompts.length === 0 && <p className="col-span-full p-8 text-center text-sm text-ink-muted">پرامپتی لایک نشده است.</p>}
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
            {myComments.length === 0 && <p className="p-8 text-center text-sm text-ink-muted">هنوز نظری ثبت نکرده‌اید.</p>}
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
                  <span className="font-bold text-base text-gold-bright">{cartTotal.toLocaleString('fa-IR')} تومان</span>
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

      {/* مودال ویرایش پروفایل */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-md border-gold/30 bg-[#12100d] p-6 shadow-2xl">
            <h3 className="font-display text-base font-bold text-gold-bright mb-4">ویرایش اطلاعات حساب کاربری</h3>
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
              <div>
                <label className="block text-xs text-ink-muted mb-1">آدرس عکس آواتار (URL)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={profileData.image}
                  onChange={(e) => setProfileData({ ...profileData, image: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2.5 text-xs text-ink focus:border-gold/60 focus:outline-none"
                />
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
