'use client'

import { useState } from 'react'

export interface SubtitleStyleConfig {
  template: string
  fontFamily: string
  fontSize: number
  textColor: string
  activeWordColor: string
  activeWordBgColor: string
  hasActiveWordBg: boolean
  bgColor: string
  bgRadius: number
  hasBg: boolean
  hasShadow: boolean
  shadowColor: string
  shadowBlur: number
  shadowX: number
  shadowY: number
  aspectRatio: 'original' | '1:1' | '4:5' | '9:16' | '16:9'
  contentFit: 'fit' | 'fill'
}

export const DEFAULT_STYLE_CONFIG: SubtitleStyleConfig = {
  template: 'dynamic-yellow',
  fontFamily: 'dana',
  fontSize: 22,
  textColor: '#ffffff',
  activeWordColor: '#facc15',
  activeWordBgColor: '#000000',
  hasActiveWordBg: false,
  bgColor: 'rgba(0,0,0,0.6)',
  bgRadius: 8,
  hasBg: false,
  hasShadow: true,
  shadowColor: '#000000',
  shadowBlur: 4,
  shadowX: 0,
  shadowY: 2,
  aspectRatio: '9:16',
  contentFit: 'fit',
}

export function useMobileStudioState() {
  const [styleConfig, setStyleConfig] = useState<SubtitleStyleConfig>(DEFAULT_STYLE_CONFIG)
  const [activeSheet, setActiveSheet] = useState<
    'none' | 'canvas' | 'style' | 'caption_edit' | 'ai_denoise' | 'prepare_post'
  >('none')
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number>(0)

  const updateStyle = (patch: Partial<SubtitleStyleConfig>) => {
    setStyleConfig((prev) => ({ ...prev, ...patch }))
  }

  return {
    styleConfig,
    updateStyle,
    activeSheet,
    setActiveSheet,
    selectedSegmentIndex,
    setSelectedSegmentIndex,
  }
}
