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
