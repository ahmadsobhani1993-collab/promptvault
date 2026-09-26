'use client'

import { useState, useRef } from 'react'
import { type Seg, type Style } from '@/lib/subtitle-studio'
import { drawSubtitleOnCanvas } from '@/lib/studio/universal-renderer'

export function useVideoExport() {
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const cancelRef = useRef(false)

  const exportVideo = async (
    videoUrl: string,
    segments: Seg[],
    style: Style,
    baseName: string = 'video'
  ) => {
    if (!videoUrl || exporting) return
    setExporting(true)
    setProgress(0)
    cancelRef.current = false

    const video = document.createElement('video')
    video.src = videoUrl
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.playsInline = true

    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve
      video.onerror = reject
    })

    const W = video.videoWidth || 1080
    const H = video.videoHeight || 1920
    const duration = video.duration || 1

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setExporting(false)
      return
    }

    const stream = canvas.captureStream(30)

    let combinedStream: MediaStream = stream
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const source = audioCtx.createMediaElementSource(video)
      const dest = audioCtx.createMediaStreamDestination()
      source.connect(dest)
      source.connect(audioCtx.destination)
      if (dest.stream.getAudioTracks().length > 0) {
        combinedStream = new MediaStream([
          ...stream.getVideoTracks(),
          ...dest.stream.getAudioTracks(),
        ])
      }
    } catch {
      // استفاده از استریم پیش‌فرض بدون قطع عملیات
    }

    const mime = MediaRecorder.isTypeSupported('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')
      ? 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"'
      : MediaRecorder.isTypeSupported('video/webm; codecs=vp9,opus')
      ? 'video/webm; codecs=vp9,opus'
      : 'video/webm'

    const recorder = new MediaRecorder(combinedStream, {
      mimeType: mime,
      videoBitsPerSecond: 4_500_000,
    })

    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    const finished = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve()
    })

    recorder.start(100)
    video.currentTime = 0
    await video.play()

    await new Promise<void>((resolve) => {
      const renderFrame = () => {
        if (cancelRef.current || video.ended || video.currentTime >= duration) {
          resolve()
          return
        }
        drawSubtitleOnCanvas(ctx, video, W, H, video.currentTime, duration, segments, style)
        setProgress(Math.min(99, Math.round((video.currentTime / duration) * 100)))
        requestAnimationFrame(renderFrame)
      }
      requestAnimationFrame(renderFrame)
    })

    if (!cancelRef.current) {
      recorder.stop()
      video.pause()
      await finished

      setProgress(100)
      const ext = mime.includes('mp4') ? 'mp4' : 'webm'
      const blob = new Blob(chunks, { type: mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${baseName}.subtitled.${ext}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    }

    setExporting(false)
  }

  const cancelExport = () => {
    cancelRef.current = true
    setExporting(false)
  }

  return {
    exporting,
    progress,
    exportVideo,
    cancelExport,
  }
}
