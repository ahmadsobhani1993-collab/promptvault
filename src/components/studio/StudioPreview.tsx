'use client'

import React, { useRef, useEffect } from 'react'
import { CaptionSegment, StyleConfig } from '@/lib/studio/types'

interface Props {
  videoUrl: string
  currentTime: number
  styleConfig: StyleConfig
  currentSegment: CaptionSegment | null
  videoRef: React.RefObject<HTMLVideoElement | null>
  onVideoClick: () => void
}

export default function StudioPreview({
  videoUrl,
  currentTime,
  styleConfig,
  currentSegment,
  videoRef,
  onVideoClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  // محاسبه کلمه فعال جاری در سگمنت
  const activeWordIndex = currentSegment?.words
    ? currentSegment.words.findIndex((w) => currentTime >= w.start && currentTime <= w.end)
    : -1

  return (
    <div
      ref={containerRef}
      className="relative flex-1 bg-black flex items-center justify-center p-4 overflow-hidden select-none"
    >
      <div
        className={`relative overflow-hidden transition-all duration-200 flex items-center justify-center rounded-2xl border border-stone-800 shadow-2xl bg-black ${
          styleConfig.aspectRatio === '9:16'
            ? 'aspect-[9/16] h-[78vh]'
            : styleConfig.aspectRatio === '1:1'
            ? 'aspect-square h-[60vh]'
            : styleConfig.aspectRatio === '4:5'
            ? 'aspect-[4/5] h-[75vh]'
            : 'aspect-video w-[80vw]'
        }`}
      >
        <video
          ref={videoRef as any}
          src={videoUrl}
          onClick={onVideoClick}
          className={`w-full h-full cursor-pointer ${
            styleConfig.contentFit === 'fill' ? 'object-cover' : 'object-contain'
          }`}
          playsInline
        />

        {/* لایه زیرنویس زنده */}
        {currentSegment && (
          <div
            className="absolute bottom-12 px-5 py-2.5 max-w-[88%] text-center transition-all duration-150"
            style={{
              backgroundColor: styleConfig.hasBg ? styleConfig.bgColor : 'transparent',
              borderRadius: `${styleConfig.bgRadius}px`,
              textShadow: styleConfig.hasShadow
                ? `${styleConfig.shadowX}px ${styleConfig.shadowY}px ${styleConfig.shadowBlur}px ${styleConfig.shadowColor}`
                : 'none',
              textAlign: styleConfig.alignment,
            }}
            dir="rtl"
          >
            {currentSegment.words && currentSegment.words.length > 0 ? (
              <span className="flex flex-wrap justify-center gap-1.5">
                {currentSegment.words.map((w, idx) => {
                  const isActive = idx === activeWordIndex
                  return (
                    <span
                      key={idx}
                      style={{
                        fontFamily: styleConfig.fontFamily,
                        fontSize: `${styleConfig.fontSize}px`,
                        fontWeight: styleConfig.fontWeight,
                        fontStyle: styleConfig.italic ? 'italic' : 'normal',
                        textDecoration: styleConfig.underline ? 'underline' : 'none',
                        color: isActive ? styleConfig.activeWordColor : styleConfig.textColor,
                        backgroundColor:
                          isActive && styleConfig.hasActiveWordBg
                            ? styleConfig.activeWordBgColor
                            : 'transparent',
                        padding: isActive && styleConfig.hasActiveWordBg ? '1px 6px' : '0',
                        borderRadius: '6px',
                        transition: 'color 0.1s, background-color 0.1s',
                      }}
                    >
                      {w.text}
                    </span>
                  )
                })}
              </span>
            ) : (
              <span
                style={{
                  fontFamily: styleConfig.fontFamily,
                  fontSize: `${styleConfig.fontSize}px`,
                  fontWeight: styleConfig.fontWeight,
                  fontStyle: styleConfig.italic ? 'italic' : 'normal',
                  textDecoration: styleConfig.underline ? 'underline' : 'none',
                  color: styleConfig.textColor,
                }}
              >
                {currentSegment.text}
              </span>
            )}

            {/* نوار پیشرفت زیر متن در صورت فعال بودن تمپلیت Progress */}
            {styleConfig.showProgressBar && (
              <div className="mt-2 h-1 w-full bg-black/40 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-75 rounded-full"
                  style={{
                    backgroundColor: styleConfig.progressColor,
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        ((currentTime - currentSegment.start) /
                          Math.max(0.1, currentSegment.end - currentSegment.start)) *
                          100
                      )
                    )}%`,
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
