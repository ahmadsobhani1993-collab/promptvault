'use client'

import React from 'react'

export type ActiveTool =
  | 'none'
  | 'canvas'
  | 'prepare_post'
  | 'ai_denoise'
  | 'text'
  | 'style'
  | 'caption'
  | 'video_shadow'

interface Props {
  activeTool: ActiveTool
  setActiveTool: (tool: ActiveTool) => void
}

const TOOLS = [
  { id: 'canvas', label: 'Canvas', icon: '📐' },
  { id: 'prepare_post', label: 'Prepare Post', icon: '🚀' },
  { id: 'ai_denoise', label: 'AI Denoise', icon: '🎙️' },
  { id: 'text', label: 'Text', icon: '✍️' },
  { id: 'style', label: 'Style & Template', icon: '🎨' },
  { id: 'caption', label: 'Caption', icon: '💬' },
  { id: 'video_shadow', label: 'Video Shadow', icon: '🌗' },
] as const

export default function StudioToolbar({ activeTool, setActiveTool }: Props) {
  return (
    <aside className="flex w-20 flex-col items-center gap-3 border-r border-stone-800 bg-[#0a0908] py-4 select-none z-10">
      {TOOLS.map((tool) => {
        const isActive = activeTool === tool.id
        return (
          <button
            key={tool.id}
            type="button"
            onClick={() => setActiveTool(isActive ? 'none' : (tool.id as ActiveTool))}
            className={`group flex w-16 flex-col items-center justify-center rounded-2xl py-2.5 transition-all ${
              isActive
                ? 'bg-amber-500/15 border border-amber-500/50 text-amber-400 shadow-md'
                : 'text-stone-400 hover:bg-stone-900/80 hover:text-stone-200'
            }`}
          >
            <span className="text-xl transition-transform group-hover:scale-110">{tool.icon}</span>
            <span className="mt-1 text-[10px] font-bold text-center leading-tight">
              {tool.label}
            </span>
          </button>
        )
      })}
    </aside>
  )
}
