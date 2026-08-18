#!/bin/bash
set -e

# ---------- 1) PWA button: smaller, bottom-right, doesn't block ----------
cat > src/components/pwa-controls.tsx << 'EOF'
'use client'

import { useEffect, useState } from 'react'

export default function PWAControls() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true)
        return
      }

      const handler = (e: any) => {
        e.preventDefault()
        setDeferredPrompt(e)
      }

      window.addEventListener('beforeinstallprompt', handler)
      return () => window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setDeferredPrompt(null)
        setIsInstalled(true)
      }
    } else {
      alert(' برای نصب:\n\n• Chrome موبایل: منوی سه‌نقطه → "Add to Home Screen"\n• Safari iOS: Share → "Add to Home Screen"\n• Chrome دسکتاپ: آیکون install در نوار آدرس')
    }
  }

  if (isInstalled || !deferredPrompt) return null

  return (
    <button
      onClick={handleInstall}
      className="fixed bottom-4 right-4 z-40 flex items-center gap-1 rounded-full bg-gold/90 px-3 py-1.5 text-[10px] font-bold text-black shadow-lg transition-all hover:scale-105 active:scale-95 md:bottom-6 md:right-6 md:px-4 md:py-2 md:text-xs"
      title="نصب اپلیکیشن"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3 md:h-4 md:w-4">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
      <span className="hidden sm:inline">نصب اپ</span>
    </button>
  )
}
EOF
echo "✅ PWA button: smaller, bottom-right"

# ---------- 2) Rich text editor: fix Word paste + form submission ----------
cat > src/components/rich-text-editor.tsx << 'EOF'
'use client'

import { useRef, useState, useEffect } from 'react'

export default function RichTextEditor({ name, initialValue = '' }: { name: string; initialValue?: string }) {
  const editorRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [wordCount, setWordCount] = useState(0)

  useEffect(() => {
    if (editorRef.current && initialValue) {
      editorRef.current.innerHTML = initialValue
      syncToTextarea()
    }
  }, [initialValue])

  const syncToTextarea = () => {
    if (editorRef.current && textareaRef.current) {
      textareaRef.current.value = editorRef.current.innerHTML
    }
  }

  const updateWordCount = () => {
    if (editorRef.current) {
      const text = editorRef.current.innerText || ''
      setWordCount(text.split(/\s+/).filter(Boolean).length)
    }
  }

  const execCmd = (cmd: string, value = '') => {
    document.execCommand(cmd, false, value)
    editorRef.current?.focus()
    syncToTextarea()
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const html = e.clipboardData.getData('text/html')
    const text = e.clipboardData.getData('text/plain')
    
    // Clean Word formatting artifacts
    let cleanHtml = html
    if (html) {
      // Remove Word-specific tags and classes
      cleanHtml = html
        .replace(/<o:p>[\s\S]*?<\/o:p>/gi, '')
        .replace(/<w:.*?>[\s\S]*?<\/w:.*?>/gi, '')
        .replace(/class="Mso.*?"/gi, '')
        .replace(/style="[^"]*mso-[^"]*"/gi, '')
        .replace(/<span[^>]*>[\s\S]*?<\/span>/gi, (match) => {
          // Keep span content but remove empty spans
          const content = match.replace(/<[^>]+>/g, '')
          return content.trim() ? match : ''
        })
    }
    
    if (cleanHtml) {
      document.execCommand('insertHTML', false, cleanHtml)
    } else {
      document.execCommand('insertText', false, text)
    }
    
    setTimeout(() => {
      syncToTextarea()
      updateWordCount()
    }, 100)
  }

  const handleInput = () => {
    syncToTextarea()
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
        
        <button type="button" className={btnClass} onMouseDown={(e) => { 
          e.preventDefault()
          const url = prompt('آدرس لینک:', 'https://')
          if (url) execCmd('createLink', url)
        }}>
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
        ref={textareaRef}
        name={name}
        required
        className="hidden"
        defaultValue={initialValue}
      />
    </div>
  )
}
EOF
echo "✅ Rich text editor: Word paste + form sync fixed"

# ---------- 3) Article form: ensure textarea sync before submit ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/article-form.tsx'
let s = fs.readFileSync(p, 'utf8')

// Add ref to form and sync before submit
if (!s.includes('formRef')) {
  s = s.replace(
    "const [msg, setMsg] = useState('')",
    "const [msg, setMsg] = useState('')\n  const formRef = useRef<HTMLFormElement>(null)"
  )
  
  s = s.replace(
    'const fd = new FormData(e.target)',
    "// Sync rich text editor content before submission\n    const editor = formRef.current?.querySelector('[contenteditable]') as HTMLDivElement\n    const textarea = formRef.current?.querySelector('textarea[name=\"contentFa\"]') as HTMLTextAreaElement\n    if (editor && textarea) textarea.value = editor.innerHTML\n    const fd = new FormData(e.target)"
  )
  
  s = s.replace(
    '<form onSubmit={submit}',
    '<form ref={formRef} onSubmit={submit}'
  )
  
  fs.writeFileSync(p, s)
  console.log('✅ Article form: sync before submit')
} else {
  console.log('⚠️ Already has formRef')
}
NODEEOF

echo "✅ update129 done!"