'use client'

import { useRef, useState } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import {
  easeOutBack,
  loadFont,
  type Seg,
  type Style,
} from '@/lib/subtitle-studio'

type Props = {
  videoUrl: string
  baseName: string
  segments: Seg[]
  style?: Style
}

const DEFAULT_STYLE: Style = {
  size: 5,
  color: '#ffffff',
  bgOpacity: 0.6,
  outline: true,
  fontId: 'Vazirmatn',
  x: 50,
  y: 90,
  hlColor: '#f59e0b',
  karaoke: false,
}

const STYLE_STORAGE_KEY = 'promptvault.subtitle.style'
const FPS = 30

function readStoredStyle(): Style | null {
  try {
    const raw = localStorage.getItem(STYLE_STORAGE_KEY)

    if (!raw) return null

    const parsed = JSON.parse(raw)

    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    return {
      ...DEFAULT_STYLE,
      ...parsed,
    }
  } catch {
    return null
  }
}

/**
 * Canvas does not break a single long token automatically.
 * This wrapper handles both normal words and very long tokens.
 */
function wrapTextSafe(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)

  if (!words.length) {
    return ['']
  }

  const lines: string[] = []
  let line = ''

  const pushBrokenWord = (word: string) => {
    let part = ''

    for (const ch of word) {
      const test = part + ch

      if (
        part &&
        ctx.measureText(test).width > maxWidth
      ) {
        lines.push(part)
        part = ch
      } else {
        part = test
      }
    }

    if (part) {
      line = part
    }
  }

  for (const word of words) {
    // Break a word that is wider than the available frame.
    if (ctx.measureText(word).width > maxWidth) {
      if (line) {
        lines.push(line)
        line = ''
      }

      pushBrokenWord(word)
      continue
    }

    const test = line
      ? `${line} ${word}`
      : word

    if (
      line &&
      ctx.measureText(test).width > maxWidth
    ) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }

  if (line) {
    lines.push(line)
  }

  return lines.length ? lines : ['']
}

/**
 * Reduce font size until the whole subtitle box fits inside
 * the available video-frame rectangle.
 */
function fitSubtitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  desiredFontSize: number,
  maxWidth: number,
  maxHeight: number,
  fontFamily: string
) {
  let fontSize = Math.max(1, desiredFontSize)

  for (let i = 0; i < 28; i++) {
    ctx.font = `700 ${fontSize}px "${fontFamily}"`

    const lines = wrapTextSafe(
      ctx,
      text,
      Math.max(1, maxWidth)
    )

    const lineHeight = fontSize * 1.25
    const totalHeight = lines.length * lineHeight

    const maxLineWidth = Math.max(
      ...lines.map((line) =>
        ctx.measureText(line).width
      ),
      0
    )

    const padding = fontSize * 0.6

    const boxWidth =
      maxLineWidth + padding

    const boxHeight =
      totalHeight + padding

    if (
      boxWidth <= maxWidth &&
      boxHeight <= maxHeight
    ) {
      return {
        fontSize,
        lines,
        lineHeight,
        totalHeight,
        maxLineWidth,
        padding,
      }
    }

    fontSize *= 0.92
  }

  ctx.font = `700 ${fontSize}px "${fontFamily}"`

  const lines = wrapTextSafe(
    ctx,
    text,
    Math.max(1, maxWidth)
  )

  const lineHeight = fontSize * 1.25
  const totalHeight = lines.length * lineHeight

  const maxLineWidth = Math.max(
    ...lines.map((line) =>
      ctx.measureText(line).width
    ),
    0
  )

  const padding = fontSize * 0.6

  return {
    fontSize,
    lines,
    lineHeight,
    totalHeight,
    maxLineWidth,
    padding,
  }
}

export default function SubtitleVideoExport({
  videoUrl,
  baseName,
  segments,
  style,
}: Props) {
  const [exporting, setExporting] =
    useState(false)

  const [progress, setProgress] =
    useState(0)

  const [status, setStatus] =
    useState('')

  const currentStyle =
    style || DEFAULT_STYLE

  const styleRef =
    useRef(currentStyle)

  styleRef.current =
    currentStyle

  const segRef =
    useRef(segments)

  segRef.current =
    segments

  const exportVideo = async () => {
    if (exporting || !videoUrl) {
      return
    }

    setExporting(true)
    setProgress(0)
    setStatus('آماده‌سازی...')

    let video: HTMLVideoElement | null = null
    let audioCtx: AudioContext | null = null
    let ffmpeg: FFmpeg | null = null

    try {
      /*
       * IMPORTANT:
       * SubtitleStudio writes the live style to localStorage.
       * This means the export button gets the exact slider/font/position
       * even though the current parent component does not pass style.
       */
      const storedStyle =
        readStoredStyle()

      const exportStyle: Style = {
        ...(storedStyle || DEFAULT_STYLE),
        ...(style || {}),
      }

      styleRef.current =
        exportStyle

      video =
        document.createElement('video')

      video.src =
        videoUrl

      video.playsInline =
        true

      video.muted =
        true

      video.crossOrigin =
        'anonymous'

      video.style.position =
        'absolute'

      video.style.left =
        '-9999px'

      video.style.top =
        '-9999px'

      document.body.appendChild(video)

      await new Promise<void>(
        (resolve, reject) => {
          let settled = false

          const finish = (
            fn: () => void
          ) => {
            if (settled) return

            settled = true
            fn()
          }

          video!.onloadedmetadata =
            () => finish(resolve)

          video!.onerror =
            () =>
              finish(() =>
                reject(
                  new Error(
                    'لود ویدیو شکست خورد'
                  )
                )
              )

          window.setTimeout(
            () =>
              finish(() =>
                reject(
                  new Error(
                    'تایم‌اوت لود ویدیو'
                  )
                )
              ),
            15000
          )
        }
      )

      const W =
        video.videoWidth || 1920

      const H =
        video.videoHeight || 1080

      const duration =
        video.duration || 60

      const canvas =
        document.createElement(
          'canvas'
        )

      canvas.width = W
      canvas.height = H

      const ctx =
        canvas.getContext('2d')

      if (!ctx) {
        throw new Error(
          'Canvas در این مرورگر در دسترس نیست'
        )
      }

      setStatus('لود فونت...')

      await loadFont(
        exportStyle.fontId ||
          'Vazirmatn'
      )

      try {
        await document.fonts.ready
      } catch {}

      setStatus(
        'رندر ویدیو...'
      )

      const stream =
        canvas.captureStream(FPS)

      try {
        audioCtx =
          new AudioContext()

        const src =
          audioCtx.createMediaElementSource(
            video
          )

        const dest =
          audioCtx.createMediaStreamDestination()

        src.connect(dest)

        dest.stream
          .getAudioTracks()
          .forEach((track) =>
            stream.addTrack(track)
          )

        if (
          audioCtx.state ===
          'suspended'
        ) {
          await audioCtx.resume()
        }
      } catch (e) {
        console.warn(
          'No audio track:',
          e
        )
      }

      const mime =
        MediaRecorder.isTypeSupported(
          'video/webm;codecs=vp8,opus'
        )
          ? 'video/webm;codecs=vp8,opus'
          : 'video/webm'

      const recorder =
        new MediaRecorder(
          stream,
          {
            mimeType: mime,
            videoBitsPerSecond:
              8_000_000,
          }
        )

      const chunks: Blob[] = []

      recorder.ondataavailable =
        (e) => {
          if (
            e.data &&
            e.data.size > 0
          ) {
            chunks.push(e.data)
          }
        }

      const recorderStopped =
        new Promise<void>(
          (resolve) => {
            recorder.onstop =
              () => resolve()
          }
        )

      let frameCount = 0
      let lastRenderedTime = -1

      const renderFrame = () => {
        const t =
          video!.currentTime

        /*
         * Avoid drawing the same media time twice.
         */
        if (
          Math.abs(
            t - lastRenderedTime
          ) < 0.001
        ) {
          return
        }

        lastRenderedTime =
          t

        const seg =
          segRef.current.find(
            (s) =>
              t >= s.start &&
              t <= s.end
          )

        ctx.clearRect(
          0,
          0,
          W,
          H
        )

        /*
         * The canvas is exactly W x H,
         * therefore this is the actual video frame.
         */
        ctx.drawImage(
          video!,
          0,
          0,
          W,
          H
        )

        if (seg) {
          const s2 =
            styleRef.current ||
            DEFAULT_STYLE

          const prog =
            Math.min(
              1,
              Math.max(
                0,
                (t - seg.start) /
                  Math.max(
                    0.1,
                    seg.end -
                      seg.start
                  )
              )
            )

          let animationScale =
            1

          if (
            seg.fx === 'pop'
          ) {
            animationScale =
              easeOutBack(prog)
          }

          if (
            seg.fx === 'zoomIn'
          ) {
            animationScale =
              0.8 +
              0.35 * prog
          }

          if (
            seg.fx === 'zoomOut'
          ) {
            animationScale =
              1.15 -
              0.35 * prog
          }

          /*
           * CORE RULE:
           *
           * size = percentage of real video width.
           *
           * size 5 on 1920px video:
           * 0.05 x 1920 = 96px
           *
           * size 5 on 720px video:
           * 0.05 x 720 = 36px
           */
          const desiredFontSize =
            (Number(s2.size) /
              100) *
            W *
            animationScale

          const anchorX =
            s2.x != null
              ? (Number(s2.x) /
                  100) *
                W
              : W / 2

          const anchorY =
            s2.y != null
              ? (Number(s2.y) /
                  100) *
                H
              : H * 0.9

          /*
           * Safe margin inside the REAL video frame.
           */
          const edgeMargin =
            Math.max(
              2,
              W * 0.01
            )

          /*
           * Available width depends on the user's
           * chosen anchor position.
           *
           * If the subtitle is near the right edge,
           * its available width is reduced accordingly.
           */
          const maxAvailableWidth =
            Math.max(
              1,
              Math.min(
                W -
                  edgeMargin * 2,
                2 *
                  Math.min(
                    anchorX -
                      edgeMargin,
                    W -
                      anchorX -
                      edgeMargin
                  )
              )
            )

          const maxAvailableHeight =
            Math.max(
              1,
              H -
                edgeMargin * 2
            )

          const fontFamily =
            s2.fontId ||
            'Vazirmatn'

          /*
           * Automatically shrink long captions
           * until the complete subtitle box fits.
           */
          const fitted =
            fitSubtitle(
              ctx,
              seg.text,
              desiredFontSize,
              maxAvailableWidth,
              maxAvailableHeight,
              fontFamily
            )

          const finalFontSize =
            fitted.fontSize

          const lines =
            fitted.lines

          const lineHeight =
            fitted.lineHeight

          const totalH =
            fitted.totalHeight

          const maxLineWidth =
            Math.max(
              ...lines.map(
                (line) =>
                  ctx.measureText(
                    line
                  ).width
              ),
              0
            )

          const padding =
            Math.max(
              2,
              finalFontSize *
                0.6
            )

          /*
           * Final hard clamp based on the
           * ACTUAL measured text dimensions.
           */
          const minX =
            edgeMargin +
            maxLineWidth / 2 +
            padding / 2

          const maxX =
            W -
            edgeMargin -
            maxLineWidth / 2 -
            padding / 2

          const minY =
            edgeMargin +
            totalH / 2 +
            padding / 2

          const maxY =
            H -
            edgeMargin -
            totalH / 2 -
            padding / 2

          const finalX =
            minX <= maxX
              ? Math.max(
                  minX,
                  Math.min(
                    maxX,
                    anchorX
                  )
                )
              : W / 2

          const finalY =
            minY <= maxY
              ? Math.max(
                  minY,
                  Math.min(
                    maxY,
                    anchorY
                  )
                )
              : H / 2

          ctx.save()

          ctx.font =
            `700 ${finalFontSize}px "${fontFamily}"`

          ctx.textAlign =
            'center'

          ctx.textBaseline =
            'middle'

          /*
           * Canvas direction is important for Persian/Arabic.
           */
          try {
            ctx.direction =
              'rtl'
          } catch {}

          if (
            s2.bgOpacity > 0
          ) {
            const bgX =
              Math.max(
                edgeMargin,
                finalX -
                  maxLineWidth /
                    2 -
                  padding / 2
              )

            const bgY =
              Math.max(
                edgeMargin,
                finalY -
                  totalH / 2 -
                  padding / 2
              )

            const bgRight =
              Math.min(
                W -
                  edgeMargin,
                finalX +
                  maxLineWidth /
                    2 +
                  padding / 2
              )

            const bgBottom =
              Math.min(
                H -
                  edgeMargin,
                finalY +
                  totalH / 2 +
                  padding / 2
              )

            ctx.fillStyle =
              `rgba(0,0,0,${Math.max(
                0,
                Math.min(
                  1,
                  s2.bgOpacity
                )
              )})`

            ctx.fillRect(
              bgX,
              bgY,
              Math.max(
                0,
                bgRight -
                  bgX
              ),
              Math.max(
                0,
                bgBottom -
                  bgY
              )
            )
          }

          lines.forEach(
            (line, i) => {
              const y =
                finalY +
                (i -
                  (lines.length -
                    1) /
                    2) *
                  lineHeight

              if (
                s2.outline
              ) {
                ctx.strokeStyle =
                  '#000'

                ctx.lineWidth =
                  Math.max(
                    2,
                    finalFontSize *
                      0.08
                  )

                ctx.strokeText(
                  line,
                  finalX,
                  y
                )
              }

              ctx.fillStyle =
                s2.color

              ctx.fillText(
                line,
                finalX,
                y
              )
            }
          )

          ctx.restore()
        }

        frameCount++

        setProgress(
          Math.min(
            55,
            (t / duration) *
              55
          )
        )
      }

      console.log(
        '[Export] Starting...'
      )

      await video.play()

      recorder.start(1000)

      console.log(
        '[Export] Recording...'
      )

      const renderInterval =
        window.setInterval(
          () => {
            try {
              renderFrame()
            } catch (err) {
              console.error(
                '[Export] Frame error:',
                err
              )
            }

            if (
              video!.ended
            ) {
              window.clearInterval(
                renderInterval
              )
            }
          },
          1000 / FPS
        )

      await new Promise<void>(
        (resolve) => {
          let finished =
            false

          const finish = () => {
            if (finished)
              return

            finished = true
            resolve()
          }

          video!.onended =
            finish

          const timeout =
            window.setInterval(
              () => {
                if (
                  video!.ended ||
                  video!.currentTime >=
                    duration -
                      0.02
                ) {
                  window.clearInterval(
                    timeout
                  )

                  finish()
                }
              },
              100
            )
        }
      )

      window.clearInterval(
        renderInterval
      )

      renderFrame()

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            250
          )
      )

      recorder.stop()

      await recorderStopped

      console.log(
        '[Export] Stopped:',
        frameCount,
        'frames',
        chunks.length,
        'chunks'
      )

      if (!chunks.length) {
        throw new Error(
          'هیچ داده‌ای ضبط نشد'
        )
      }

      setProgress(60)

      setStatus(
        'تبدیل به MP4...'
      )

      ffmpeg =
        new FFmpeg()

      ffmpeg.on(
        'progress',
        ({ progress: p }) => {
          setProgress(
            60 +
              Math.round(
                p * 40
              )
          )
        }
      )

      const baseURL =
        'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'

      const coreBlob =
        await (
          await fetch(
            `${baseURL}/ffmpeg-core.js`
          )
        ).blob()

      const wasmBlob =
        await (
          await fetch(
            `${baseURL}/ffmpeg-core.wasm`
          )
        ).blob()

      await ffmpeg.load({
        coreURL:
          URL.createObjectURL(
            coreBlob
          ),
        wasmURL:
          URL.createObjectURL(
            wasmBlob
          ),
      })

      const webmBlob =
        new Blob(
          chunks,
          {
            type: mime,
          }
        )

      await ffmpeg.writeFile(
        'input.webm',
        new Uint8Array(
          await webmBlob.arrayBuffer()
        )
      )

      await ffmpeg.exec([
        '-i',
        'input.webm',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-crf',
        '23',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        'output.mp4',
      ])

      const mp4Data =
        await ffmpeg.readFile(
          'output.mp4'
        ) as Uint8Array

      const mp4Blob =
        new Blob(
          [mp4Data],
          {
            type:
              'video/mp4',
          }
        )

      setStatus(
        'دانلود...'
      )

      const url =
        URL.createObjectURL(
          mp4Blob
        )

      const a =
        document.createElement(
          'a'
        )

      a.href = url

      a.download =
        `${baseName}.subtitled.mp4`

      document.body.appendChild(a)

      a.click()

      a.remove()

      setTimeout(() => {
        URL.revokeObjectURL(
          url
        )

        ffmpeg
          ?.deleteFile(
            'input.webm'
          )
          .catch(() => {})

        ffmpeg
          ?.deleteFile(
            'output.mp4'
          )
          .catch(() => {})
      }, 5000)

      setProgress(100)

      setStatus(
        '✅ کامل شد!'
      )
    } catch (e: any) {
      console.error(
        '[Export Error]',
        e
      )

      alert(
        '❌ خطا: ' +
          (e?.message ||
            'Unknown')
      )
    } finally {
      if (audioCtx) {
        audioCtx
          .close()
          .catch(() => {})
      }

      if (
        video?.parentNode
      ) {
        video.parentNode.removeChild(
          video
        )
      }

      setExporting(false)
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/90 z-50">
      <button
        onClick={exportVideo}
        disabled={exporting}
        className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white font-bold rounded-xl transition-all"
      >
        {exporting ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm">
              {status}
            </span>

            <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
              <div
                className="bg-white h-full rounded-full transition-all"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>

            <span className="text-xs">
              {Math.round(progress)}%
            </span>
          </div>
        ) : (
          '📹 خروجی MP4 با زیرنویس'
        )}
      </button>
    </div>
  )
}
