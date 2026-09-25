'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { StudioSegment, StudioStyleConfig } from '@/lib/studio/unified-style'
import { renderStudioFrame, clampCanvasDimensions } from '@/lib/studio/universal-renderer'
import { ensureFontLoaded } from '@/lib/studio/font-loader'

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>
  currentTime: number
  segments: StudioSegment[]
  styleConfig: StudioStyleConfig
  isPlaying?: boolean
  onVideoClick?: () => void
}

export default function LiveStudioCanvas({
  videoRef,
  currentTime,
  segments,
  styleConfig,
  isPlaying = false,
  onVideoClick,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [fontLoaded, setFontLoaded] = useState(false)

  useEffect(() => {
    let active = true
    setFontLoaded(false)
    ensureFontLoaded(styleConfig.fontFamily).then(() => {
      if (active) setFontLoaded(true)
    })
    return () => { active = false }
  }, [styleConfig.fontFamily])

  // استفاده از useCallback برای جلوگیری از بسته شدن کلوژر قدیمی
  const drawCurrentFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let targetW = video.videoWidth || 1080
    let targetH = video.videoHeight || 1920

    if (styleConfig.aspectRatio === '9:16') {
      targetW = 1080
      targetH = 1920
    } else if (styleConfig.aspectRatio === '16:9') {
      targetW = 1920
      targetH = 1080
    } else if (styleConfig.aspectRatio === '1:1') {
      targetW = 1080
      targetH = 1080
    } else if (styleConfig.aspectRatio === '4:5') {
      targetW = 1080
      targetH = 1350
    }

    const clamped = clampCanvasDimensions(targetW, targetH, 1920)
    if (canvas.width !== clamped.width || canvas.height !== clamped.height) {
      canvas.width = clamped.width
      canvas.height = clamped.height
    }

    renderStudioFrame({
      ctx,
      canvasWidth: clamped.width,
      canvasHeight: clamped.height,
      video,
      currentTime: video.currentTime || currentTime,
      segments,
      style: styleConfig,
    })
  }, [videoRef, currentTime, segments, styleConfig])

  useEffect(() => {
    if (!fontLoaded) return

    if (!isPlaying) {
      drawCurrentFrame()
      return
    }

    let animId: number
    const loop = () => {
      drawCurrentFrame()
      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [isPlaying, fontLoaded, drawCurrentFrame])

  return (
    <div
      onClick={onVideoClick}
      className="relative flex items-center justify-center max-h-[80vh] max-w-full overflow-hidden rounded-2xl shadow-2xl bg-black cursor-pointer border border-stone-800"
    >
      <canvas
        ref={canvasRef}
        className="max-h-[78vh] w-auto max-w-full object-contain pointer-events-auto"
      />
    </div>
  )
}
