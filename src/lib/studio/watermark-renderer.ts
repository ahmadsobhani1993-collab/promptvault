import type { WatermarkOverlay } from './unified-style'

export function drawWatermarks(ctx: CanvasRenderingContext2D, watermarks: WatermarkOverlay[] | undefined, width: number, height: number): void {
  if (!watermarks?.length) return
  for (const watermark of watermarks) {
    const value = String(watermark.value || '').trim()
    if (!value) continue
    const fontSize = Math.max(12, width * Math.max(1, Number(watermark.size) || 4) / 100)
    ctx.save()
    ctx.globalAlpha = Math.max(0.05, Math.min(1, Number(watermark.opacity) || 0.65))
    ctx.translate(width * Math.max(0, Math.min(100, Number(watermark.x) || 50)) / 100, height * Math.max(0, Math.min(100, Number(watermark.y) || 50)) / 100)
    ctx.rotate((Number(watermark.rotation) || 0) * Math.PI / 180)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (watermark.type === 'sticker') {
      ctx.font = `${fontSize * 1.8}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`
      ctx.fillText(value, 0, 0)
    } else {
      ctx.font = `700 ${fontSize}px "${watermark.fontFamily || 'Vazirmatn'}", sans-serif`
      ctx.lineJoin = 'round'
      ctx.lineWidth = Math.max(1, fontSize * 0.08)
      ctx.strokeStyle = 'rgba(0,0,0,0.75)'
      ctx.strokeText(value, 0, 0)
      ctx.fillStyle = watermark.color || '#ffffff'
      ctx.fillText(value, 0, 0)
    }
    ctx.restore()
  }
}
