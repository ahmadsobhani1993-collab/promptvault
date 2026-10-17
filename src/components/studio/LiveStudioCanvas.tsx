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
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const [fontLoaded, setFontLoaded] = useState(false)

  // آخرین مقادیر را در ref نگه می‌داریم تا drawCurrentFrame ثابت بماند و حلقه‌ی rAF بی‌دلیل ساخته نشود
  const segmentsRef = useRef(segments)
  const styleRef = useRef(styleConfig)
  const timeRef = useRef(currentTime)
  segmentsRef.current = segments
  styleRef.current = styleConfig
  timeRef.current = currentTime

  useEffect(() => {
    let active = true
    setFontLoaded(false)

    ensureFontLoaded(styleConfig.fontFamily)
      .then(() => {
        if (active) setFontLoaded(true)
      })
      .catch((error) => {
        console.error('[LiveStudioCanvas] Font loading failed:', error)
        if (active) setFontLoaded(true)
      })

    return () => {
      active = false
    }
  }, [styleConfig.fontFamily])

  const drawCurrentFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return

    const style = styleRef.current

    let targetW = video.videoWidth || 1080
    let targetH = video.videoHeight || 1920

    switch (style.aspectRatio) {
      case '9:16':
        targetW = 1080
        targetH = 1920
        break
      case '16:9':
        targetW = 1920
        targetH = 1080
        break
      case '1:1':
        targetW = 1080
        targetH = 1080
        break
      case '4:5':
        targetW = 1080
        targetH = 1350
        break
    }

    const { width, height } = clampCanvasDimensions(targetW, targetH, 1920)
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }

    if (!ctxRef.current) {
      ctxRef.current = canvas.getContext('2d', {
        alpha: false,
        desynchronized: true,
      })
    }
    const ctx = ctxRef.current
    if (!ctx) return

    // Reapply these after any canvas resize, since resizing resets context state.
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    // Do not use `video.currentTime || currentTime`: time 0 is valid, not a fallback case.
    const renderTime = Number.isFinite(video.currentTime) ? video.currentTime : timeRef.current

    renderStudioFrame({
      ctx,
      canvasWidth: width,
      canvasHeight: height,
      video,
      currentTime: renderTime,
      segments: segmentsRef.current,
      style,
    })
  }, [videoRef])

  // حالت توقف: با تغییر زمان/سگمنت/استایل یک بار دوباره رسم کن
  useEffect(() => {
    if (!fontLoaded || isPlaying) return
    drawCurrentFrame()
  }, [fontLoaded, isPlaying, drawCurrentFrame, currentTime, segments, styleConfig])

  // حالت پخش: حلقه فقط وقتی شروع/پایان می‌شود که isPlaying یا فونت عوض شود
  useEffect(() => {
    if (!fontLoaded || !isPlaying) return

    let animId = 0
    let stopped = false
    const loop = () => {
      if (stopped) return
      drawCurrentFrame()
      animId = window.requestAnimationFrame(loop)
    }

    animId = window.requestAnimationFrame(loop)
    return () => {
      stopped = true
      window.cancelAnimationFrame(animId)
    }
  }, [isPlaying, fontLoaded, drawCurrentFrame])

  // Redraw when the source video becomes ready or its dimensions change.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const redraw = () => drawCurrentFrame()
    video.addEventListener('loadeddata', redraw)
    video.addEventListener('loadedmetadata', redraw)
    video.addEventListener('seeked', redraw)

    return () => {
      video.removeEventListener('loadeddata', redraw)
      video.removeEventListener('loadedmetadata', redraw)
      video.removeEventListener('seeked', redraw)
    }
  }, [videoRef, drawCurrentFrame])

  return (
    <div
      onClick={onVideoClick}
      className="relative flex items-center justify-center max-h-[80vh] max-w-full overflow-hidden rounded-2xl bg-black shadow-2xl border border-stone-800 cursor-pointer"
    >
      <canvas
        ref={canvasRef}
        aria-label="پیش‌نمایش زیرنویس ویدئو"
        className="block max-h-[78vh] max-w-full w-auto object-contain pointer-events-auto"
        style={{
          // Keep the preview scaled by CSS only; the internal canvas resolution stays high.
          height: 'auto',
        }}
      />
    </div>
  )
}