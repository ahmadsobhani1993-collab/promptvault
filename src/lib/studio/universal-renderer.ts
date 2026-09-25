import { StudioSegment, StudioStyleConfig, WordTiming } from './unified-style'

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

function getWordTimings(segment: StudioSegment): WordTiming[] {
  if (segment.words && segment.words.length > 0) return segment.words

  const words = segment.text.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const totalChars = words.reduce((acc, w) => acc + Math.max(1, w.length), 0)
  const duration = Math.max(0.1, segment.end - segment.start)

  let cursor = segment.start
  return words.map((w) => {
    const wordDur = (Math.max(1, w.length) / totalChars) * duration
    const start = cursor
    const end = cursor + wordDur
    cursor = end
    return { text: w, start, end }
  })
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

export function renderStudioFrame({
  ctx,
  canvasWidth,
  canvasHeight,
  video,
  currentTime,
  segments,
  style,
}: RenderParams) {
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  const vW = video.videoWidth || 1920
  const vH = video.videoHeight || 1080
  const vRect = calculateVideoRect(canvasWidth, canvasHeight, vW, vH, style.contentFit)

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, canvasWidth, canvasHeight)
  ctx.clip()
  ctx.drawImage(video, vRect.drawX, vRect.drawY, vRect.drawW, vRect.drawH)
  ctx.restore()

  const activeSegment = segments.find(
    (seg) => currentTime >= seg.start && currentTime <= seg.end
  )

  if (!activeSegment || !activeSegment.text.trim()) return

  const refWidth = style.contentFit === 'cover' ? canvasWidth : vRect.drawW
  const calcFontSize = Math.max(14, (refWidth * style.fontSizePercent) / 100)
  const fontSpec = `${style.fontWeight} ${style.italic ? 'italic ' : ''}${calcFontSize}px "${style.fontFamily}", "Vazirmatn", -apple-system, sans-serif`

  ctx.font = fontSpec
  ctx.direction = 'rtl'
  ctx.textBaseline = 'middle'

  const activeBoundX = style.contentFit === 'cover' ? 0 : vRect.drawX
  const activeBoundW = style.contentFit === 'cover' ? canvasWidth : vRect.drawW

  const maxTextWidth = activeBoundW * 0.88
  const lines = wrapTextRTL(ctx, activeSegment.text, maxTextWidth)
  const lineHeight = calcFontSize * 1.38
  const totalTextHeight = lines.length * lineHeight

  const anchorY = (canvasHeight * style.positionYPercent) / 100
  let anchorX = activeBoundX + activeBoundW / 2
  if (style.alignment === 'right') anchorX = activeBoundX + activeBoundW * 0.90
  if (style.alignment === 'left') anchorX = activeBoundX + activeBoundW * 0.10

  const words = getWordTimings(activeSegment)
  const activeWordIdx = words.findIndex(
    (w) => currentTime >= w.start && currentTime <= w.end
  )

  // باکس بدون سایه
  if (style.hasBg) {
    let maxLineWidth = 0
    lines.forEach((l) => {
      const w = ctx.measureText(l).width
      if (w > maxLineWidth) maxLineWidth = w
    })

    const bgBoxW = maxLineWidth + style.bgPaddingX * 2
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
    ctx.fillStyle = style.bgColor
    drawRoundedRect(ctx, bgBoxX, bgBoxY, bgBoxW, bgBoxH, style.bgRadius)
    ctx.fill()
    ctx.restore()
  }

  let globalWordCounter = 0

  lines.forEach((line, lineIdx) => {
    const yPos = anchorY - ((lines.length - 1) * lineHeight) / 2 + lineIdx * lineHeight
    const lineWords = line.split(/\s+/).filter(Boolean)
    const spaceWidth = ctx.measureText(' ').width
    const fullLineWidth = ctx.measureText(line).width

    let currentX = anchorX + fullLineWidth / 2
    if (style.alignment === 'right') currentX = anchorX
    if (style.alignment === 'left') currentX = anchorX + fullLineWidth

    lineWords.forEach((word) => {
      const wordW = ctx.measureText(word).width
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
      ctx.fillStyle = isCurrentActive ? style.activeWordColor : style.textColor
      ctx.fillText(word, drawWordCenterX, yPos)
      ctx.restore()

      currentX -= wordW + spaceWidth
      globalWordCounter++
    })
  })
}
