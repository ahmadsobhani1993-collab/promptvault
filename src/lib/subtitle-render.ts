import { getAnimationState, resolveAlign, resolveDirection, type Seg, type Style } from '@/lib/subtitle-studio'
import { drawWatermarks } from '@/lib/studio/watermark-renderer'

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

export function wrapTextSafe(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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
  return lines.length ? lines : ['']
}

export function fitSubtitle(ctx: CanvasRenderingContext2D, text: string, desiredFontSize: number, maxWidth: number, maxHeight: number, fontFamily: string) {
  let fontSize = Math.max(12, desiredFontSize)
  for (let i = 0; i < 20; i++) {
    ctx.font = `800 ${fontSize}px "${fontFamily}", -apple-system, sans-serif`
    const lines = wrapTextSafe(ctx, text, maxWidth)
    const lineHeight = fontSize * 1.3
    const totalHeight = lines.length * lineHeight
    const maxLineWidth = Math.max(...lines.map((l) => ctx.measureText(l).width), 0)
    if (maxLineWidth <= maxWidth && totalHeight <= maxHeight) {
      return { fontSize, lines, lineHeight, totalHeight, maxLineWidth }
    }
    fontSize *= 0.94
  }
  ctx.font = `800 ${fontSize}px "${fontFamily}", -apple-system, sans-serif`
  const lines = wrapTextSafe(ctx, text, maxWidth)
  return { fontSize, lines, lineHeight: fontSize * 1.3, totalHeight: lines.length * (fontSize * 1.3), maxLineWidth: Math.max(...lines.map((l) => ctx.measureText(l).width), 0) }
}

export function drawSubtitleOnCanvas(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, W: number, H: number, mediaTime: number, duration: number, segments: Seg[], activeStyle: Style) {
  const t = clamp(mediaTime, 0, duration)
  const seg = segments.find((item) => t >= item.start && t <= item.end)
  const rawStyle = activeStyle as Style & {
    fontFamily?: string; fontSizePercent?: number; positionXPercent?: number; positionYPercent?: number
    textColor?: string; activeWordColor?: string; hasBg?: boolean; hasShadow?: boolean
    shadowColor?: string; shadowBlur?: number; subtitleAnimation?: 'none' | 'pop' | 'zoomIn' | 'zoomOut'
    alignment?: 'center' | 'right' | 'left'; activeWordBgColor?: string; hasActiveWordBg?: boolean
    bgColor?: string; bgBorderColor?: string; bgBorderWidth?: number; bgOpacity?: number
    hasTextStroke?: boolean; textStrokeColor?: string; textStrokeWidth?: number; watermarks?: any[]
    textShadowColor?: string; textShadowBlur?: number; bgRadius?: number
    fontId?: string; size?: number | string; x?: number | string; y?: number | string
    color?: string; hlColor?: string; karaoke?: boolean
  }

  const videoRatio = video.videoWidth / video.videoHeight
  const canvasRatio = W / H
  let drawW: number, drawH: number, offsetX: number, offsetY: number

  if (videoRatio > canvasRatio) {
    drawH = H; drawW = H * videoRatio; offsetX = (W - drawW) / 2; offsetY = 0
  } else {
    drawW = W; drawH = W / videoRatio; offsetX = 0; offsetY = (H - drawH) / 2
  }
  ctx.drawImage(video, offsetX, offsetY, drawW, drawH)
  if (!seg) { drawWatermarks(ctx, rawStyle.watermarks, W, H); return }

  const bgAlpha = rawStyle.bgColor?.match(/rgba?\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)/i)?.[1]
  const isModernStyle = rawStyle.fontSizePercent != null
  const s = {
    ...rawStyle,
    fontId: rawStyle.fontFamily ?? rawStyle.fontId,
    size: rawStyle.fontSizePercent ?? rawStyle.size,
    x: rawStyle.positionXPercent ?? rawStyle.x,
    y: rawStyle.positionYPercent ?? rawStyle.y,
    color: rawStyle.textColor ?? rawStyle.color,
    hlColor: rawStyle.activeWordColor ?? rawStyle.hlColor,
    karaoke: isModernStyle ? true : rawStyle.karaoke,
    align: rawStyle.alignment ?? rawStyle.align,
    bgOpacity: rawStyle.hasBg === false ? 0 : (rawStyle.bgOpacity ?? Number(bgAlpha ?? 0.65)),
    textShadowColor: rawStyle.hasShadow === false ? 'transparent' : (rawStyle.shadowColor ?? rawStyle.textShadowColor),
    textShadowBlur: rawStyle.hasShadow === false ? 0 : (rawStyle.shadowBlur ?? rawStyle.textShadowBlur),
  }
  const direction = resolveDirection(s.direction, seg.text) || 'rtl'
  const align = resolveAlign(s.align, direction)
  const elapsed = Math.max(0, t - seg.start)
  const anim = getAnimationState(seg.fx ?? s.subtitleAnimation, elapsed, seg.end - seg.start, W)

  const maxSubtitleWidth = W * 0.88
  const maxSubtitleHeight = H * 0.35
  const anchorX = s.x != null ? (Number(s.x) / 100) * W : W / 2
  const anchorY = s.y != null ? (Number(s.y) / 100) * H : H * 0.78
  const fontFamily = s.fontId || 'Vazirmatn'
  const baseFontSize = s.size ? (Number(s.size) / 100) * W : W * 0.052

  const fitted = fitSubtitle(ctx, seg.text, baseFontSize, maxSubtitleWidth, maxSubtitleHeight, fontFamily)
  const finalFontSize = fitted.fontSize
  const lines = fitted.lines
  const lineHeight = fitted.lineHeight

  ctx.save()
  ctx.direction = direction
  ctx.globalAlpha = anim.opacity
  ctx.translate(anchorX + anim.translateX, anchorY + anim.translateY)
  ctx.scale(anim.scale, anim.scale)
  ctx.translate(-anchorX, -anchorY)

  const bgOpacity = s.bgOpacity ?? 0.6
  if (seg.hl || bgOpacity > 0) {
    const padX = finalFontSize * 0.6; const padY = finalFontSize * 0.3
    const boxW = fitted.maxLineWidth + padX * 2; const boxH = fitted.totalHeight + padY * 2
    const boxX = anchorX - boxW / 2; const boxY = anchorY - boxH / 2; const radius = s.bgRadius ?? 10
    ctx.save()
    const background = s.bgColor || `rgba(0, 0, 0, ${bgOpacity})`
    const rgbaParts = background.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
    const hex = background.match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1]
    let fillColor = background
    if (rgbaParts) fillColor = `rgba(${rgbaParts[1]},${rgbaParts[2]},${rgbaParts[3]},${bgOpacity})`
    else if (hex) {
      const full = hex.length === 3 ? hex.split('').map((ch: string) => ch + ch).join('') : hex
      fillColor = `rgba(${parseInt(full.slice(0,2),16)},${parseInt(full.slice(2,4),16)},${parseInt(full.slice(4,6),16)},${bgOpacity})`
    }
    ctx.fillStyle = seg.hl || fillColor
    ctx.beginPath()
    if (ctx.roundRect) ctx.roundRect(boxX, boxY, boxW, boxH, radius)
    else ctx.rect(boxX, boxY, boxW, boxH)
    ctx.fill()
    const bgBorderWidth = Number(s.bgBorderWidth ?? 0)
    if (bgBorderWidth > 0) {
      ctx.strokeStyle = s.bgBorderColor || '#ffffff'
      ctx.lineWidth = bgBorderWidth
      ctx.beginPath()
      if (ctx.roundRect) ctx.roundRect(boxX, boxY, boxW, boxH, radius)
      else ctx.rect(boxX, boxY, boxW, boxH)
      ctx.stroke()
    }
    ctx.restore()
  }

  ctx.font = `800 ${finalFontSize}px "${fontFamily}", -apple-system, sans-serif`
  ctx.textBaseline = 'middle'
  ctx.textAlign = align
  const strokeWidth = Math.max(4, finalFontSize * 0.16)

  if (!s.karaoke || !seg.words || !seg.words.length) {
    lines.forEach((line, index) => {
      const y = anchorY + (index - (lines.length - 1) / 2) * lineHeight
      ctx.shadowColor = s.textShadowColor || 'rgba(0, 0, 0, 0.85)'
      ctx.shadowBlur = s.textShadowBlur ?? Math.max(6, finalFontSize * 0.2)
      if (rawStyle.hasTextStroke && Number(rawStyle.textStrokeWidth) > 0) {
        ctx.strokeStyle = rawStyle.textStrokeColor || '#000000'
        ctx.lineWidth = Number(rawStyle.textStrokeWidth)
        ctx.strokeText(line, anchorX, y)
      }
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.fillStyle = s.color || '#FFFFFF'
      ctx.fillText(line, anchorX, y)
    })
  } else {
    const activeWordIndex = seg.words.findIndex((w) => t >= w.start && t <= w.end)
    const spaceWidth = ctx.measureText(' ').width
    let currentWordIndex = 0
    lines.forEach((line, index) => {
      const y = anchorY + (index - (lines.length - 1) / 2) * lineHeight
      const lineWords = line.split(/\s+/).filter(Boolean)
      const lineWidth = ctx.measureText(line).width
      let cursorOffset = 0
      lineWords.forEach((word) => {
        const wordWidth = ctx.measureText(word).width
        const isWordActive = currentWordIndex === activeWordIndex
        let wordX = anchorX
        if (direction === 'rtl') wordX = (anchorX + lineWidth / 2) - cursorOffset - (wordWidth / 2)
        else wordX = (anchorX - lineWidth / 2) + cursorOffset + (wordWidth / 2)

        if (isWordActive && s.hasActiveWordBg) {
          ctx.save()
          ctx.fillStyle = s.activeWordBgColor || 'rgba(245, 158, 11, 0.28)'
          ctx.beginPath()
          if (ctx.roundRect) ctx.roundRect(wordX - wordWidth / 2 - 5, y - finalFontSize / 2 - 3, wordWidth + 10, finalFontSize + 6, 5)
          else ctx.rect(wordX - wordWidth / 2 - 5, y - finalFontSize / 2 - 3, wordWidth + 10, finalFontSize + 6)
          ctx.fill()
          ctx.restore()
        }
        
        const prevAlign = ctx.textAlign
        ctx.textAlign = 'center'
        ctx.shadowColor = s.textShadowColor || 'rgba(0, 0, 0, 0.85)'
        ctx.shadowBlur = s.textShadowBlur ?? Math.max(6, finalFontSize * 0.2)
        if (rawStyle.hasTextStroke && Number(rawStyle.textStrokeWidth) > 0) {
          ctx.strokeStyle = rawStyle.textStrokeColor || '#000000'
          ctx.lineWidth = Number(rawStyle.textStrokeWidth)
          ctx.strokeText(word, wordX, y)
        }
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        ctx.fillStyle = isWordActive ? (s.hlColor || '#FFD600') : (s.color || '#FFFFFF')
        ctx.fillText(word, wordX, y)
        ctx.textAlign = prevAlign
        cursorOffset += wordWidth + spaceWidth
        currentWordIndex++
      })
    })
  }
  ctx.restore()
  drawWatermarks(ctx, rawStyle.watermarks, W, H)
}