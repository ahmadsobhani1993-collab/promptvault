const FONT_MAP: Record<string, string> = {
  Vazirmatn: 'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn[wght].woff2',
  Shabnam: 'https://cdn.jsdelivr.net/gh/rastikerdar/shabnam-font@v5.0.1/dist/Shabnam.woff2',
  Samim: 'https://cdn.jsdelivr.net/gh/rastikerdar/samim-font@v4.0.5/dist/Samim.woff2',
  Sahel: 'https://cdn.jsdelivr.net/gh/rastikerdar/sahel-font@v3.4.0/dist/Sahel.woff2',
}

const loadedFonts = new Set<string>()

export async function ensureFontLoaded(fontFamily: string): Promise<void> {
  if (typeof window === 'undefined' || !('fonts' in document)) return
  if (loadedFonts.has(fontFamily)) return

  const fontUrl = FONT_MAP[fontFamily] || FONT_MAP.Vazirmatn
  try {
    const fontFace = new FontFace(fontFamily, `url(${fontUrl})`, {
      weight: '100 900',
      style: 'normal',
    })
    await fontFace.load()
    document.fonts.add(fontFace)
    loadedFonts.add(fontFamily)
  } catch (e) {
    console.warn(`Font load fallback for ${fontFamily}:`, e)
  }

  try {
    await document.fonts.load(`16px "${fontFamily}"`)
    loadedFonts.add(fontFamily)
  } catch {}
}
