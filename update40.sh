#!/bin/bash
set -e

cat > src/components/share-buttons.tsx << 'EOF'
'use client'

import { useState } from 'react'

export default function ShareButtons({ title, desc }: { title: string; desc: string }) {
  const [copied, setCopied] = useState(false)

  const tgShare = () => {
    const url = window.location.href
    const text = '✨ ' + title + (desc ? '\n' + desc : '')
    window.open(
      'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text),
      '_blank'
    )
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  const nativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: '✨ ' + title, text: desc, url: window.location.href })
      } catch {}
    } else {
      tgShare()
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={tgShare} className="btn-secondary">
        📤 {title ? 'اشتراک در تلگرام' : 'Share'}
      </button>
      <button type="button" onClick={copyLink} className="btn-secondary">
        {copied ? '✅ کپی شد' : '🔗 کپی لینک'}
      </button>
      <button type="button" onClick={nativeShare} className="btn-secondary">
        📲 اشتراک
      </button>
    </div>
  )
}
EOF

node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/prompts/[slug]/page.tsx'
let s = fs.readFileSync(p, 'utf8')

// import ShareButtons
if (!s.includes('ShareButtons')) {
  s = s.replace(
    "import PromptReveal from '@/components/prompt-reveal'",
    "import PromptReveal from '@/components/prompt-reveal'\nimport ShareButtons from '@/components/share-buttons'"
  )

  // add share buttons after star button
  s = s.replace(
    /<StarButton promptId=\{item\.id\} initial=\{\(item as any\)\.stars \?\? 0\} label=\{L\(locale, 'ستاره', 'stars'\)\} \/>/,
    `$&\n            <ShareButtons title={L(locale, item.titleFa, item.titleEn)} desc={L(locale, item.descFa ?? '', item.descEn ?? '')} />`
  )

  // richer OpenGraph for Telegram preview
  s = s.replace(
    `    openGraph: {
      title: item.titleFa,
      description: item.descFa ?? '',
      images: [{ url: item.img }],
      locale: 'fa_IR',
    },`,
    `    openGraph: {
      title: '✨ ' + item.titleFa,
      description: (item.descFa ?? item.titleFa) + ' — دیدن و کپی پرامپت در PromptsFA',
      images: [{ url: item.img.replace('output=webp', 'output=jpg'), width: 900, height: 900 }],
      locale: 'fa_IR',
      siteName: 'PromptsFA',
      url: (process.env.NEXT_PUBLIC_APP_URL ?? '') + '/prompts/' + item.slug,
      type: 'article',
    },`
  )

  fs.writeFileSync(p, s)
  console.log('✅ share buttons + rich OG added')
} else {
  console.log('⚠️ already patched')
}
NODEEOF

echo "✅ Share to Telegram + rich link preview!"