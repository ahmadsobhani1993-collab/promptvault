#!/bin/bash
set -e

# ---------- 1) layout: fix analytics nav item keys ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/admin/layout.tsx'
let s = fs.readFileSync(p, 'utf8')
s = s.replace(
  "{ href: '/admin/analytics', label: 'آمار بازدید' },",
  "{ href: '/admin/analytics', fa: 'آمار بازدید', en: 'Analytics' },"
)
fs.writeFileSync(p, s)
console.log('✅ layout nav fixed')
NODEEOF

# ---------- 2) gemini.ts: clean rewrite (module-level cleanTitle + safe tags) ----------
cat > src/lib/gemini.ts << 'EOF'
export const TAG_VOCAB: { fa: string; en: string }[] = [
  { fa: 'پرتره', en: 'portrait' },
  { fa: 'محصول', en: 'product' },
  { fa: 'سینمایی', en: 'cinematic' },
  { fa: 'فانتزی', en: 'fantasy' },
  { fa: 'انیمه', en: 'anime' },
  { fa: 'واقع‌گرایانه', en: 'photorealistic' },
  { fa: 'مینیمال', en: 'minimal' },
  { fa: 'لوکس', en: 'luxury' },
  { fa: 'تاریک', en: 'dark' },
  { fa: 'نئون', en: 'neon' },
  { fa: 'طبیعت', en: 'nature' },
  { fa: 'معماری', en: 'architecture' },
  { fa: 'کاراکتر', en: 'character' },
  { fa: 'لوگو', en: 'logo' },
  { fa: 'پوستر', en: 'poster' },
  { fa: 'تبلیغات', en: 'ads' },
  { fa: 'آموزش', en: 'tutorial' },
  { fa: 'کد', en: 'code' },
  { fa: 'نویسندگی', en: 'writing' },
  { fa: 'بهره‌وری', en: 'productivity' },
  { fa: 'موسیقی', en: 'music' },
  { fa: 'ویدیو', en: 'video' },
  { fa: 'عکاسی', en: 'photography' },
  { fa: 'سه‌بعدی', en: '3d' },
  { fa: 'رنگی', en: 'colorful' },
]

export type GeminiResult = {
  titleFa: string
  titleEn: string
  descFa: string
  descEn: string
  usageFa: string
  usageEn: string
  categorySlug: string
  tagsFa: string[]
  tagsEn: string[]
  promptEn: string
}

const cleanTitle = (t: string) => t.replace(/^([\u0600-\u06FF\w]+)\s+\1/, '$1')

// strongest -> weakest (no Gemma)
export const MODEL_CHAIN = [
  'gemini-3.1-pro',
  'gemini-2.5-pro',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3-flash',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
]

export async function generateText(opts: {
  instruction: string
  imgBase64?: string | null
  imgMime?: string
}): Promise<{ text: string; model: string }> {
  const parts: any[] = [{ text: opts.instruction }]
  if (opts.imgBase64) parts.push({ inline_data: { mime_type: opts.imgMime || 'image/jpeg', data: opts.imgBase64 } })

  let lastError = ''
  for (const model of MODEL_CHAIN) {
    try {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + process.env.GEMINI_API_KEY,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts }] }),
          signal: AbortSignal.timeout(25000),
        }
      )
      const body = await res.text()
      if (res.status === 429) { lastError = model + ': quota'; continue }
      if (res.status === 404) { lastError = model + ': not found'; continue }
      if (!res.ok) { lastError = model + ': HTTP ' + res.status; continue }
      const json = JSON.parse(body)
      const raw: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (!raw) { lastError = model + ': empty'; continue }
      return { text: raw, model }
    } catch (e: any) {
      lastError = model + ': ' + String(e?.message ?? e)
      continue
    }
  }
  throw new Error('GEMINI_QUOTA_EXHAUSTED :: ' + lastError)
}

export async function analyzeWithGemini(opts: {
  text: string
  imgBase64: string | null
  imgMime?: string
  categories: { slug: string; fa: string; en: string }[]
}): Promise<GeminiResult> {
  const instruction =
    'You are an AI prompt curator. Read the given AI prompt (and image if provided). ' +
    'Return ONLY a valid JSON object (no markdown) with exactly these keys:\n' +
    '"titleFa","titleEn","descFa","descEn","usageFa","usageEn","categorySlug","tagsFa","tagsEn","promptEn"\n' +
    '- titleFa/titleEn: short catchy title (fa/en). NEVER repeat a word twice at the start.\n' +
    '- descFa/descEn: ONE short sentence describing what this prompt does (fa/en).\n' +
    '- usageFa/usageEn: 2-3 sentences explaining HOW to use this prompt (which tool/model, where to paste, tips) (fa/en).\n' +
    '- promptEn: the FULL prompt text translated to English. Keep every detail and parameter. If it is already English, return it unchanged. A few Persian words inside are OK.\n' +
    '- categorySlug: choose ONE from: ' +
    opts.categories.map((c) => c.slug).join(', ') +
    '\n- tagsFa: JSON ARRAY of MAX 4 items ONLY from: ' +
    TAG_VOCAB.map((t) => t.fa).join('، ') +
    '\n- tagsEn: JSON ARRAY, English equivalents of chosen tagsFa in same order.' +
    '\n\nTHE PROMPT TEXT:\n' + (opts.text || '(no text, look at image)')

  const { text: raw } = await generateText({ instruction, imgBase64: opts.imgBase64, imgMime: opts.imgMime })

  const m = raw.match(/\{[\s\S]*\}/)
  let parsed: any = {}
  try { parsed = m ? JSON.parse(m[0]) : {} } catch { parsed = {} }

  const rawTags = Array.isArray(parsed.tagsFa) ? parsed.tagsFa : String(parsed.tagsFa ?? '').split(/[،,]/)
  const tagsFa: string[] = rawTags.map((t: any) => String(t).trim()).filter(Boolean).slice(0, 4)
  const tagsEn: string[] = tagsFa.map((fa) => {
    const v = TAG_VOCAB.find((t) => t.fa === fa)
    return v ? v.en : fa
  })
  const catOk = opts.categories.some((c) => c.slug === parsed.categorySlug)

  return {
    titleFa: cleanTitle(String(parsed.titleFa || 'پرامپت هوش مصنوعی')),
    titleEn: cleanTitle(String(parsed.titleEn || 'AI Prompt')),
    descFa: String(parsed.descFa || ''),
    descEn: String(parsed.descEn || ''),
    usageFa: String(parsed.usageFa || ''),
    usageEn: String(parsed.usageEn || ''),
    categorySlug: catOk ? parsed.categorySlug : opts.categories[0]?.slug ?? 'image',
    tagsFa,
    tagsEn,
    promptEn: String(parsed.promptEn || ''),
  }
}
EOF
echo "✅ gemini.ts fully fixed"

# ---------- 3) markdown editor ----------
cat > src/components/markdown-editor.tsx << 'EOF'
'use client'

import { useRef, useState } from 'react'

function simpleMd(md: string) {
  const esc = md.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  return esc
    .replace(/^### (.*)$/gm, '<h4 class="mt-4 font-bold text-gold-bright">$1</h4>')
    .replace(/^## (.*)$/gm, '<h3 class="mt-5 text-lg font-extrabold text-gold-bright">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[-•] (.*)$/gm, '<div class="pr-3">• $1</div>')
    .replace(/^\d+\. (.*)$/gm, '<div class="pr-3">$1</div>')
    .replace(/^> (.*)$/gm, '<blockquote class="my-2 border-r-2 border-gold pr-3 text-ink-muted">$1</blockquote>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a class="text-gold-bright underline" href="$2">$1</a>')
    .replace(/\n/g, '<br/>')
}

export default function MarkdownEditor({ name }: { name: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [preview, setPreview] = useState(false)

  const wrap = (before: string, after = before) => {
    const el = ref.current
    if (!el) return
    const s = el.selectionStart
    const e = el.selectionEnd
    const sel = el.value.slice(s, e) || 'متن'
    el.value = el.value.slice(0, s) + before + sel + after + el.value.slice(e)
    el.focus()
  }
  const line = (prefix: string) => {
    const el = ref.current
    if (!el) return
    const s = el.selectionStart
    const ls = el.value.lastIndexOf('\n', s - 1) + 1
    el.value = el.value.slice(0, ls) + prefix + el.value.slice(ls)
    el.focus()
  }

  const btn = 'rounded-lg border border-line bg-elevated px-2.5 py-1 text-[11px] text-ink-muted transition-colors hover:text-gold-bright'

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        <button type="button" className={btn} onClick={() => line('## ')}>عنوان ۲</button>
        <button type="button" className={btn} onClick={() => line('### ')}>عنوان ۳</button>
        <button type="button" className={btn} onClick={() => wrap('**')}>بولد</button>
        <button type="button" className={btn} onClick={() => wrap('*')}>ایتالیک</button>
        <button type="button" className={btn} onClick={() => line('- ')}>لیست</button>
        <button type="button" className={btn} onClick={() => line('1. ')}>لیست عددی</button>
        <button type="button" className={btn} onClick={() => wrap('[', '](/explore)')}>لینک</button>
        <button type="button" className={btn} onClick={() => line('> ')}>نقل‌قول</button>
        <button type="button" className={btn} onClick={() => wrap('\n| ابزار | کاربرد |\n|---|---|\n| ', ' | ... |\n')}>جدول</button>
        <button type="button" className={btn + (preview ? ' !border-gold !text-gold-bright' : '')} onClick={() => setPreview(!preview)}>
          {preview ? '✏️ ویرایش' : '👁 پیش‌نمایش'}
        </button>
      </div>
      <textarea
        ref={ref}
        name={name}
        required
        rows={14}
        className={'input w-full text-sm leading-7 ' + (preview ? 'hidden' : '')}
        placeholder={'## مقدمه\nمتن مقاله...'}
      />
      {preview && (
        <div className="input min-h-[300px] w-full overflow-auto text-sm leading-8" dangerouslySetInnerHTML={{ __html: simpleMd(ref.current?.value ?? '') }} />
      )}
    </div>
  )
}
EOF

# ---------- 4) article form uses editor ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/article-form.tsx'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('MarkdownEditor')) {
  s = s.replace("import { useState } from 'react'", "import { useState } from 'react'\nimport MarkdownEditor from '@/components/markdown-editor'")
  s = s.replace(/<textarea name="contentFa"[\s\S]*?\/>/, '<MarkdownEditor name="contentFa" />')
  fs.writeFileSync(p, s)
  console.log('✅ article form: markdown editor')
} else console.log('⚠️ already')
NODEEOF

# ---------- 5) schedule: direct telegram photo url ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/lib/schedule.ts'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('direct photo')) {
  s = s.replace(
    "    const out = process.env.TELEGRAM_OUTPUT",
    `    // direct photo url (telegram-hosted) for reliable sending
    let photo = p.img
    try {
      const row = await prisma.promptImage.findUnique({ where: { promptId: p.id } })
      if (row?.type === 'tg') {
        const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
        const g = await (await fetch('https://api.telegram.org/bot' + token + '/getFile?file_id=' + encodeURIComponent(row.data), { signal: AbortSignal.timeout(8000) })).json()
        if (g?.result?.file_path) photo = 'https://api.telegram.org/file/bot' + token + '/' + g.result.file_path
      }
    } catch {}
    const out = process.env.TELEGRAM_OUTPUT`
  )
  s = s.replace(/tgSendPhoto\(out, p\.img,/g, 'tgSendPhoto(out, photo,')
  fs.writeFileSync(p, s)
  console.log('✅ schedule: direct photo url')
} else console.log('⚠️ already')
NODEEOF

echo "✅ update119 done!"