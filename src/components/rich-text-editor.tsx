'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Undo, Redo, Link as LinkIcon, Image as ImageIcon,
  AlignRight, AlignCenter, AlignLeft, Table as TableIcon, Plus, Minus,
  Highlighter, MinusSquare, Code2
} from 'lucide-react'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
}

export default function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'محتوای مقاله را اینجا بنویسید...',
      }),
      Link.configure({ openOnClick: false }),
      Image,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        defaultAlignment: 'right',
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse border border-line w-full my-4 rounded-xl overflow-hidden',
        },
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: 'border-b border-line hover:bg-surface-hover/50 transition',
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-line bg-elevated px-4 py-2 font-bold text-gold text-right dir-rtl',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-line px-4 py-2 text-ink text-right dir-rtl',
        },
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'prose prose-gold prose-invert max-w-none min-h-[400px] p-5 focus:outline-none text-right dir-rtl text-ink font-sans leading-relaxed',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  if (!editor) return null

  const addImage = () => {
    const url = window.prompt('آدرس تصویر (URL) را وارد کنید:')
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('آدرس لینک را وارد کنید:', previousUrl)
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  return (
    <div className="w-full border border-line rounded-xl bg-surface overflow-hidden shadow-card transition focus-within:border-gold">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-elevated border-b border-line dir-rtl">
        {/* متن اصلی */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded transition ${editor.isActive('bold') ? 'bg-gold/20 text-gold-bright' : 'text-ink-muted hover:text-ink hover:bg-surface'}`}
          title="برجسته (Bold)"
        >
          <Bold className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded transition ${editor.isActive('italic') ? 'bg-gold/20 text-gold-bright' : 'text-ink-muted hover:text-ink hover:bg-surface'}`}
          title="کج (Italic)"
        >
          <Italic className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-1.5 rounded transition ${editor.isActive('strike') ? 'bg-gold/20 text-gold-bright' : 'text-ink-muted hover:text-ink hover:bg-surface'}`}
          title="خط‌خورده"
        >
          <Strikethrough className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={`p-1.5 rounded transition ${editor.isActive('highlight') ? 'bg-gold/20 text-gold-bright' : 'text-ink-muted hover:text-ink hover:bg-surface'}`}
          title="هایلایت"
        >
          <Highlighter className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-4 bg-line mx-1" />

        {/* تیترها */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1.5 rounded transition ${editor.isActive('heading', { level: 1 }) ? 'bg-gold/20 text-gold-bright' : 'text-ink-muted hover:text-ink hover:bg-surface'}`}
          title="تیتر اصلی (H1)"
        >
          <Heading1 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded transition ${editor.isActive('heading', { level: 2 }) ? 'bg-gold/20 text-gold-bright' : 'text-ink-muted hover:text-ink hover:bg-surface'}`}
          title="تیتر فرعی (H2)"
        >
          <Heading2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-1.5 rounded transition ${editor.isActive('heading', { level: 3 }) ? 'bg-gold/20 text-gold-bright' : 'text-ink-muted hover:text-ink hover:bg-surface'}`}
          title="تیتر کوچک (H3)"
        >
          <Heading3 className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-4 bg-line mx-1" />

        {/* چیدمان متن */}
        <button
          type="button"
          onClick={() => (editor as any).chain().focus().setTextAlign('right').run()}
          className={`p-1.5 rounded transition ${(editor as any).isActive({ textAlign: 'right' }) ? 'bg-gold/20 text-gold-bright' : 'text-ink-muted hover:text-ink hover:bg-surface'}`}
          title="راست‌چین"
        >
          <AlignRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => (editor as any).chain().focus().setTextAlign('center').run()}
          className={`p-1.5 rounded transition ${(editor as any).isActive({ textAlign: 'center' }) ? 'bg-gold/20 text-gold-bright' : 'text-ink-muted hover:text-ink hover:bg-surface'}`}
          title="وسط‌چین"
        >
          <AlignCenter className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => (editor as any).chain().focus().setTextAlign('left').run()}
          className={`p-1.5 rounded transition ${(editor as any).isActive({ textAlign: 'left' }) ? 'bg-gold/20 text-gold-bright' : 'text-ink-muted hover:text-ink hover:bg-surface'}`}
          title="چپ‌چین"
        >
          <AlignLeft className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-4 bg-line mx-1" />

        {/* لیست‌ها و رتبه‌بندی */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded transition ${editor.isActive('bulletList') ? 'bg-gold/20 text-gold-bright' : 'text-ink-muted hover:text-ink hover:bg-surface'}`}
          title="لیست نشاندار"
        >
          <List className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded transition ${editor.isActive('orderedList') ? 'bg-gold/20 text-gold-bright' : 'text-ink-muted hover:text-ink hover:bg-surface'}`}
          title="لیست عددی (رتبه‌بندی)"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-1.5 rounded transition ${editor.isActive('blockquote') ? 'bg-gold/20 text-gold-bright' : 'text-ink-muted hover:text-ink hover:bg-surface'}`}
          title="نقل‌قول"
        >
          <Quote className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`p-1.5 rounded transition ${editor.isActive('codeBlock') ? 'bg-gold/20 text-gold-bright' : 'text-ink-muted hover:text-ink hover:bg-surface'}`}
          title="بلاک کد"
        >
          <Code2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="p-1.5 rounded transition text-ink-muted hover:text-ink hover:bg-surface"
          title="خط جداکننده"
        >
          <MinusSquare className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-4 bg-line mx-1" />

        {/* مدیریت جداول */}
        <button
          type="button"
          onClick={insertTable}
          className={`p-1.5 rounded transition ${editor.isActive('table') ? 'bg-gold/20 text-gold-bright' : 'text-ink-muted hover:text-ink hover:bg-surface'}`}
          title="افزودن جدول (۳x۳)"
        >
          <TableIcon className="w-4 h-4" />
        </button>

        {editor.isActive('table') && (
          <>
            <button
              type="button"
              onClick={() => editor.chain().focus().addRowAfter().run()}
              className="p-1.5 rounded transition text-gold hover:bg-surface"
              title="افزودن سطر"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteRow().run()}
              className="p-1.5 rounded transition text-danger hover:bg-surface"
              title="حذف سطر"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteTable().run()}
              className="p-1.5 text-xs font-bold rounded text-danger hover:bg-surface px-1"
              title="حذف کامل جدول"
            >
              حذف جدول
            </button>
          </>
        )}

        <div className="w-[1px] h-4 bg-line mx-1" />

        {/* رسانه و لینک */}
        <button
          type="button"
          onClick={setLink}
          className={`p-1.5 rounded transition ${editor.isActive('link') ? 'bg-gold/20 text-gold-bright' : 'text-ink-muted hover:text-ink hover:bg-surface'}`}
          title="درج لینک"
        >
          <LinkIcon className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={addImage}
          className="p-1.5 rounded transition text-ink-muted hover:text-ink hover:bg-surface"
          title="درج تصویر"
        >
          <ImageIcon className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-4 bg-line mx-1" />

        {/* تاریخچه */}
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          className="p-1.5 rounded transition text-ink-muted hover:text-ink hover:bg-surface"
          title="Undo"
        >
          <Undo className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          className="p-1.5 rounded transition text-ink-muted hover:text-ink hover:bg-surface"
          title="Redo"
        >
          <Redo className="w-4 h-4" />
        </button>
      </div>

      {/* Editor Content Area */}
      <EditorContent editor={editor} />
    </div>
  )
}