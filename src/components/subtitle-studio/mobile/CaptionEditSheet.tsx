'use client'

import { useState, useEffect } from 'react'

interface Props {
  isOpen: boolean
  onClose: () => void
  currentText: string
  onApply: (newText: string) => void
}

export default function CaptionEditSheet({ isOpen, onClose, currentText, onApply }: Props) {
  const [text, setText] = useState(currentText)

  useEffect(() => {
    setText(currentText)
  }, [currentText, isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full rounded-t-3xl border-t border-stone-800 bg-[#141210] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-4">
          <h3 className="text-xs font-bold text-amber-400">ویرایش عبارت زیرنویس</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-white text-xs">✕</button>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded-xl border border-stone-700 bg-stone-900/90 p-3 text-sm text-white focus:outline-none focus:border-amber-400 text-center font-bold"
            autoFocus
          />

          <div className="flex gap-2">
            <button
              onClick={() => {
                onApply(text)
                onClose()
              }}
              className="flex-1 bg-amber-500 hover:bg-amber-400 text-black py-2.5 rounded-xl font-bold text-xs transition-all"
            >
              Apply
            </button>
            <button
              onClick={onClose}
              className="px-4 border border-stone-700 rounded-xl text-xs text-stone-400 hover:bg-stone-800"
            >
              انصراف
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
