#!/bin/bash
set -e

# ---------- 1) Generate favicon SVG ----------
cat > public/favicon.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#d4a94e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#b8941f;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="6" fill="#070503"/>
  <text x="16" y="22" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="url(#gold)" text-anchor="middle">P</text>
</svg>
EOF

# Also create PNG fallback
cat > public/icon.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#d4a94e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#b8941f;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="#070503"/>
  <text x="256" y="352" font-family="Arial, sans-serif" font-size="288" font-weight="bold" fill="url(#gold)" text-anchor="middle">P</text>
</svg>
EOF

echo "✅ Favicon SVGs created"

# ---------- 2) Update layout.tsx to use favicon ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/layout.tsx'
let s = fs.readFileSync(p, 'utf8')

// Update metadata to include favicon
if (!s.includes('favicon')) {
  s = s.replace(
    "export const metadata: Metadata = {",
    "export const metadata: Metadata = {\n  icons: { icon: '/favicon.svg', apple: '/icon.svg' },"
  )
  fs.writeFileSync(p, s)
  console.log('✅ Layout: favicon metadata added')
} else {
  console.log('⚠️ Favicon already in metadata')
}
NODEEOF

# ---------- 3) Professional rich text editor ----------
cat > src/components/rich-text-editor.tsx << 'EOF'
'use client'

import { useRef, useState, useEffect } from 'react'

export default function RichTextEditor({ name, initialValue = '' }: { name: string; initialValue?: string }) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [wordCount, setWordCount] = useState(0)

  useEffect(() => {
    if (editorRef.current && initialValue) {
      editorRef.current.innerHTML = initialValue
      updateWordCount()
    }
  }, [initialValue])

  const updateWordCount = () => {
    if (editorRef.current) {
      const text = editorRef.current.innerText || ''
      setWordCount(text.split(/\s+/).filter(Boolean).length)
    }
  }

  const execCmd = (cmd: string, value = '') => {
    document.execCommand(cmd, false, value)
    editorRef.current?.focus()
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const html = e.clipboardData.getData('text/html')
    const text = e.clipboardData.getData('text/plain')
    
    if (html) {
      document.execCommand('insertHTML', false, html)
    } else {
      document.execCommand('insertText', false, text)
    }
    
    setTimeout(updateWordCount, 100)
  }

  const handleInput = () => {
    updateWordCount()
  }

  const btnClass = "rounded px-2 py-1 text-xs text-ink-muted transition-colors hover:bg-gold/10 hover:text-gold-bright"

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 rounded-t-lg border-b border-line bg-elevated p-2">
        <button type="button" className={btnClass} onMouseDown={(e) => { e.preventDefault(); execCmd('bold') }}>
          <strong>B</strong>
        </button>
        <button type="button" className={btnClass} onMouseDown={(e) => { e.preventDefault(); execCmd('italic') }}>
          <em>I</em>
        </button>
        <button type="button" className={btnClass} onMouseDown={(e) => { e.preventDefault(); execCmd('underline') }}>
          <u>U</u>
        </button>
        
        <div className="mx-2 h-4 w-px bg-line" />
        
        <button type="button" className={btnClass} onMouseDown={(e) => { e.preventDefault(); execCmd('formatBlock', 'h2') }}>
          H2
        </button>
        <button type="button" className={btnClass} onMouseDown={(e) => { e.preventDefault(); execCmd('formatBlock', 'h3') }}>
          H3
        </button>
        
        <div className="mx-2 h-4 w-px bg-line" />
        
        <button type="button" className={btnClass} onMouseDown={(e) => { e.preventDefault(); execCmd('insertUnorderedList') }}>
          • لیست
        </button>
        <button type="button" className={btnClass} onMouseDown={(e) => { e.preventDefault(); execCmd('insertOrderedList') }}>
          1. لیست عددی
        </button>
        
        <div className="mx-2 h-4 w-px bg-line" />
        
        <button type="button" className={btnClass} onMouseDown={(e) => { e.preventDefault(); execCmd('createLink', prompt('آدرس لینک:', 'https://')) }}>
          🔗 لینک
        </button>
        <button type="button" className={btnClass} onMouseDown={(e) => { e.preventDefault(); execCmd('removeFormat') }}>
          ✕ پاک کردن فرمت
        </button>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        className="min-h-[400px] w-full resize-y rounded-b-lg border border-line bg-[#0a0805] p-4 text-sm leading-7 outline-none focus:border-gold/50"
        suppressContentEditableWarning
      />

      {/* Word count */}
      <div className="mt-2 text-right text-xs text-ink-muted">
        {wordCount} کلمه
      </div>

      {/* Hidden textarea for form submission */}
      <textarea
        name={name}
        required
        className="hidden"
        defaultValue={initialValue}
      />
    </div>
  )
}
EOF
echo "✅ Rich text editor created"

# ---------- 4) Update article form ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/article-form.tsx'
let s = fs.readFileSync(p, 'utf8')

if (!s.includes('RichTextEditor')) {
  s = s.replace(
    "import MarkdownEditor from '@/components/markdown-editor'",
    "import RichTextEditor from '@/components/rich-text-editor'"
  )
  s = s.replace(
    '<MarkdownEditor name="contentFa" />',
    '<RichTextEditor name="contentFa" />'
  )
  s = s.replace(
    'متن مقاله (هر خط = یک پاراگراف؛ ## برای زیرعنوان)',
    'متن مقاله (می‌توانید از ورد کپی کنید — فرمت حفظ می‌شود)'
  )
  fs.writeFileSync(p, s)
  console.log('✅ Article form: rich text editor')
} else {
  console.log('⚠️ Already using RichTextEditor')
}
NODEEOF

echo "✅ update128 done!"