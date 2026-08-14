'use client'

import { useState } from 'react'
import Link from 'next/link'
import CategoryIcon from '@/components/category-icon'

export default function CategoryGrid({
  items,
}: {
  items: { slug: string; icon: string; label: string }[]
}) {
  const [hover, setHover] = useState<number | null>(null)

  return (
    <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((c, i) => (
        <Link
          key={c.slug}
          href={'/categories/' + c.slug}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
          className={
            'flex flex-col items-center gap-3 rounded-2xl bg-[#F2EAD8] py-7 text-[#171512] transition-all duration-300 ' +
            (hover === i
              ? 'z-10 scale-110 glow-gold'
              : hover !== null
                ? 'scale-90 opacity-70'
                : 'glow-gold')
          }
        >
          <CategoryIcon name={c.icon} />
          <span className="text-sm font-bold">{c.label}</span>
        </Link>
      ))}
    </div>
  )
}
