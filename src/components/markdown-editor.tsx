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
