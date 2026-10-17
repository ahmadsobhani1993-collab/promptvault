import { StudioSegment, StudioStyleConfig, WordTiming } from './unified-style'
import { getAnimationState } from '@/lib/subtitle-studio'
import { drawWatermarks } from './watermark-renderer'

interface RenderParams {
  ctx: CanvasRenderingContext2D
  canvasWidth: number
  canvasHeight: number
  video: HTMLVideoElement
  currentTime: number
  segments: StudioSegment[]
  style: StudioStyleConfig
}

export function clampCanvasDimensions(w: number, h: number, maxDim = 1920) {
  let outW = w
  let outH = h
  if (outW > maxDim || outH > maxDim) {
    if (outW > outH) {
      outH = Math.round((outH * maxDim) / outW)
      outW = maxDim
    } else {
      outW = Math.round((outW * maxDim) / outH)
      outH = maxDim
    }
  }
  outW = outW % 2 === 0 ? outW : outW - 1
  outH = outH % 2 === 0 ? outH : outH - 1
  return { width: outW, height: outH }
}

export function calculateVideoRect(
  canvasW: number,
  canvasH: number,
  videoW: number,
  videoH: number,
  fit: 'contain' | 'cover'
) {
  const canvasAspect = canvasW / canvasH
  const videoAspect = videoW / videoH

  let drawW: number
  let drawH: number

  if (fit === 'contain') {
    if (videoAspect > canvasAspect) {
      drawW = canvasW
      drawH = canvasW / videoAspect
    } else {
      drawH = canvasH
      drawW = canvasH * videoAspect
    }
  } else {
    if (videoAspect > canvasAspect) {
      drawH = canvasH
      drawW = canvasH * videoAspect
    } else {
      drawW = canvasW
      drawH = canvasW / videoAspect
    }
  }

  const drawX = (canvasW - drawW) / 2
  const drawY = (canvasH - drawH) / 2

  return { drawX, drawY, drawW, drawH }
}

// ───────────────────────── کش زمان‌بندی کلمات ─────────────────────────
interface TimingCacheEntry {
  text: string
  start: number
  end: number
  src: WordTiming[] | undefined
  value: WordTiming[]
}
const timingCache = new WeakMap<StudioSegment, TimingCacheEntry>()

function getWordTimings(segment: StudioSegment): WordTiming[] {
  const cached = timingCache.get(segment)
  if (
    cached &&
    cached.text === segment.text &&
    cached.start === segment.start &&
    cached.end === segment.end &&
    cached.src === segment.words
  ) {
    return cached.value
  }

  const tokens = segment.text.trim().split(/\s+/).filter(Boolean)
  let value: WordTiming[]

  if (segment.words && segment.words.length > 0 && segment.words.length === tokens.length) {
    // فقط وقتی تعداد کلمات با متن یکی است، زمان‌های واقعی قابل اتکا هستند
    value = segment.words
  } else if (!tokens.length) {
    value = []
  } else {
    const totalChars = tokens.reduce((acc, w) => acc + Math.max(1, w.length), 0)
    const duration = Math.max(0.1, segment.end - segment.start)
    let cursor = segment.start
    value = tokens.map((w) => {
      const wordDur = (Math.max(1, w.length) / totalChars) * duration
      const start = cursor
      const end = cursor + wordDur
      cursor = end
      return { text: w, start, end }
    })
  }

  timingCache.set(segment, {
    text: segment.text,
    start: segment.start,
    end: segment.end,
    src: segment.words,
    value,
  })
  return value
}

// ───────────────────────── کش چیدمان متن ─────────────────────────
interface LayoutWord {
  text: string
  width: number
}
interface LayoutLine {
  width: number
  words: LayoutWord[]
}
interface TextLayout {
  lines: LayoutLine[]
  spaceWidth: number
  maxLineWidth: number
}

const MAX_LAYOUT_CACHE = 300
const layoutCache = new Map<string, TextLayout>()

// اگر فونت دیرتر لود شد، اندازه‌گیری‌های قبلی (با فونت جایگزین) نامعتبر می‌شوند
if (typeof document !== 'undefined' && (document as any).fonts?.addEventListener) {
  ;(document as any).fonts.addEventListener('loadingdone', () => layoutCache.clear())
}

function wrapTextRTL(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ['']
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines
}

// پیش‌شرط: ctx.font و ctx.direction قبل از صدا زدن ست شده‌اند
function getTextLayout(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSpec: string,
  maxWidth: number
): TextLayout {
  const key = `${fontSpec}|${Math.round(maxWidth * 100)}|${text}`
  const hit = layoutCache.get(key)
  if (hit) return hit

  const lineTexts = wrapTextRTL(ctx, text, maxWidth)
  const spaceWidth = ctx.measureText(' ').width
  let maxLineWidth = 0

  const lines: LayoutLine[] = lineTexts.map((line) => {
    const width = ctx.measureText(line).width
    if (width > maxLineWidth) maxLineWidth = width
    const words = line
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => ({ text: w, width: ctx.measureText(w).width }))
    return { width, words }
  })

  const layout: TextLayout = { lines, spaceWidth, maxLineWidth }
  if (layoutCache.size >= MAX_LAYOUT_CACHE) layoutCache.clear()
  layoutCache.set(key, layout)
  return layout
}

export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.lineTo(x + width, y + height - r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.lineTo(x + r, y + height)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function colorWithOpacity(color: string, opacity: number): string {
  const alpha = Math.max(0, Math.min(1, opacity))
  const rgba = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)$/i)
  if (rgba) return `rgba(${rgba[1]}, ${rgba[2]}, ${rgba[3]}, ${alpha})`
  const hex = color.match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1]
  if (hex) {
    const full = hex.length === 3 ? hex.split('').map(char => char + char).join('') : hex
    return `rgba(${parseInt(full.slice(0, 2), 16)}, ${parseInt(full.slice(2, 4), 16)}, ${parseInt(full.slice(4, 6), 16)}, ${alpha})`
  }
  return color
}

export function renderStudioFrame({
  ctx,
  canvasWidth,
  canvasHeight,
  video,
  currentTime,
  segments,
  style,
}: RenderParams) {
  const vW = video.videoWidth || 1920
  const vH = video.videoHeight || 1080
  const vRect = calculateVideoRect(canvasWidth, canvasHeight, vW, vH, style.contentFit)

  // پس‌زمینه‌ی مشکی فقط وقتی لازم است که ویدیو کل کانوس را نپوشاند (نوارهای contain)
  const coversCanvas =
    vRect.drawX <= 0 &&
    vRect.drawY <= 0 &&
    vRect.drawX + vRect.drawW >= canvasWidth &&
    vRect.drawY + vRect.drawH >= canvasHeight
  if (!coversCanvas) {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)
  }

  // کانوس خودش هر چیز بیرون از مرزهایش را کلیپ می‌کند؛ clip جداگانه لازم نیست
  ctx.drawImage(video, vRect.drawX, vRect.drawY, vRect.drawW, vRect.drawH)

  const activeSegment = segments.find(
    (seg) => currentTime >= seg.start && currentTime <= seg.end
  )

  if (!activeSegment || !activeSegment.text.trim()) {
    drawWatermarks(ctx, style.watermarks, canvasWidth, canvasHeight)
    return
  }

  const refWidth = style.contentFit === 'cover' ? canvasWidth : vRect.drawW
  const calcFontSize = Math.max(14, (refWidth * style.fontSizePercent) / 100)
  const fontSpec = `${style.fontWeight} ${style.italic ? 'italic ' : ''}${calcFontSize}px "${style.fontFamily}", "Vazirmatn", -apple-system, sans-serif`

  ctx.font = fontSpec
  ctx.direction = 'rtl'
  ctx.textBaseline = 'middle'

  const activeBoundX = style.contentFit === 'cover' ? 0 : vRect.drawX
  const activeBoundW = style.contentFit === 'cover' ? canvasWidth : vRect.drawW

  const maxTextWidth = activeBoundW * 0.88
  const layout = getTextLayout(ctx, activeSegment.text, fontSpec, maxTextWidth)
  const lines = layout.lines
  const lineHeight = calcFontSize * 1.38
  const totalTextHeight = lines.length * lineHeight

  const anchorY = (canvasHeight * style.positionYPercent) / 100
  const anchorX = activeBoundX + activeBoundW * (style.positionXPercent / 100)

  const animation = style.subtitleAnimation ?? 'none'
  const elapsed = Math.max(0, currentTime - activeSegment.start)
  const animationState = getAnimationState(animation, elapsed, activeSegment.end - activeSegment.start, canvasWidth)
  const animating = animation !== 'none' && (elapsed < 0.35 || animation === 'zoomIn' || animation === 'zoomOut')
  if (animating) {
    ctx.save()
    ctx.globalAlpha = animationState.opacity
    ctx.translate(anchorX + animationState.translateX, anchorY + animationState.translateY)
    ctx.scale(animationState.scale, animationState.scale)
    ctx.translate(-anchorX, -anchorY)
  }

  const words = getWordTimings(activeSegment)
  const activeWordIdx = words.findIndex(
    (w) => currentTime >= w.start && currentTime <= w.end
  )

  // باکس بدون سایه
  if (style.hasBg) {
    const bgBoxW = layout.maxLineWidth + style.bgPaddingX * 2
    const bgBoxH = totalTextHeight + style.bgPaddingY * 2
    let bgBoxX = anchorX - bgBoxW / 2
    if (style.alignment === 'right') bgBoxX = anchorX - bgBoxW + style.bgPaddingX
    if (style.alignment === 'left') bgBoxX = anchorX - style.bgPaddingX
    const bgBoxY = anchorY - bgBoxH / 2

    ctx.save()
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
    ctx.fillStyle = colorWithOpacity(style.bgColor, style.bgOpacity)
    drawRoundedRect(ctx, bgBoxX, bgBoxY, bgBoxW, bgBoxH, style.bgRadius)
    ctx.fill()
    if (style.bgBorderWidth > 0) {
      ctx.strokeStyle = style.bgBorderColor
      ctx.lineWidth = style.bgBorderWidth
      drawRoundedRect(ctx, bgBoxX, bgBoxY, bgBoxW, bgBoxH, style.bgRadius)
      ctx.stroke()
    }
    ctx.restore()
  }

  let globalWordCounter = 0
  const spaceWidth = layout.spaceWidth

  lines.forEach((line, lineIdx) => {
    const yPos = anchorY - ((lines.length - 1) * lineHeight) / 2 + lineIdx * lineHeight

    let currentX = anchorX + line.width / 2
    if (style.alignment === 'right') currentX = anchorX
    if (style.alignment === 'left') currentX = anchorX + line.width

    line.words.forEach((lw) => {
      const word = lw.text
      const wordW = lw.width
      const isCurrentActive = globalWordCounter === activeWordIdx
      const drawWordCenterX = currentX - wordW / 2

      if (isCurrentActive && style.hasActiveWordBg) {
        ctx.save()
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        ctx.fillStyle = style.activeWordBgColor
        const padX = 6
        const padY = 3
        drawRoundedRect(
          ctx,
          drawWordCenterX - wordW / 2 - padX,
          yPos - calcFontSize / 2 - padY,
          wordW + padX * 2,
          calcFontSize + padY * 2,
          6
        )
        ctx.fill()
        ctx.restore()
      }

      ctx.save()
      if (style.hasShadow) {
        ctx.shadowColor = style.shadowColor
        ctx.shadowBlur = style.shadowBlur
        ctx.shadowOffsetX = style.shadowX
        ctx.shadowOffsetY = style.shadowY
      }

      ctx.textAlign = 'center'
      if (style.hasTextStroke && style.textStrokeWidth > 0) {
        ctx.lineJoin = 'round'
        ctx.strokeStyle = style.textStrokeColor
        ctx.lineWidth = style.textStrokeWidth
        ctx.strokeText(word, drawWordCenterX, yPos)
      }
      ctx.fillStyle = isCurrentActive ? style.activeWordColor : style.textColor
      ctx.fillText(word, drawWordCenterX, yPos)
      ctx.restore()

      currentX -= wordW + spaceWidth
      globalWordCounter++
    })
  })

  if (animating) ctx.restore()
  drawWatermarks(ctx, style.watermarks, canvasWidth, canvasHeight)
}