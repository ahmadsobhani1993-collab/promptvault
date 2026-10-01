const GOOGLE_FONT_FAMILIES = new Set([
  'Vazirmatn',
  'Estedad',
  'Readex Pro',
  'IBM Plex Sans Arabic',
  'Noto Kufi Arabic',
  'Lalezar',
  'Amiri',
  'Noto Nastaliq Urdu',
])

const pendingFonts = new Map<string, Promise<void>>()
const FONT_DB = 'promptvault-subtitle-fonts'
const FONT_STORE = 'fonts'

export interface UploadedSubtitleFont {
  id: string
  name: string
  family: string
  createdAt: number
}

function openFontDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FONT_DB, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(FONT_STORE)) request.result.createObjectStore(FONT_STORE, { keyPath: 'family' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function listUploadedFonts(): Promise<UploadedSubtitleFont[]> {
  if (typeof indexedDB === 'undefined') return []
  const db = await openFontDb()
  return new Promise((resolve, reject) => {
    const request = db.transaction(FONT_STORE, 'readonly').objectStore(FONT_STORE).getAll()
    request.onsuccess = () => resolve(request.result.map(({ family, name, createdAt }: any) => ({ id: family, name, family, createdAt })))
    request.onerror = () => reject(request.error)
  })
}

export async function saveUploadedFont(file: File): Promise<UploadedSubtitleFont> {
  if (!/\.(woff2?|ttf|otf)$/i.test(file.name)) throw new Error('فقط فایل‌های WOFF، WOFF2، TTF یا OTF مجاز هستند.')
  if (file.size > 15 * 1024 * 1024) throw new Error('حجم فونت نباید بیشتر از ۱۵ مگابایت باشد.')
  const db = await openFontDb()
  const family = `CustomFont_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
  const record = { family, name: file.name.replace(/\.(woff2?|ttf|otf)$/i, ''), blob: file, createdAt: Date.now() }
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(FONT_STORE, 'readwrite').objectStore(FONT_STORE).put(record)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
  await ensureFontLoaded(family)
  return { id: family, name: record.name, family, createdAt: record.createdAt }
}

function googleFontFamilyUrl(family: string): string {
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}&display=swap`
}

export async function ensureFontLoaded(fontFamily: string): Promise<void> {
  if (typeof window === 'undefined' || !('fonts' in document)) return

  const requested = fontFamily.replace(/^['"]|['"]$/g, '').trim()
  const family = requested
  if (!GOOGLE_FONT_FAMILIES.has(family) && !family.startsWith('CustomFont_')) return

  const existing = pendingFonts.get(family)
  if (existing) return existing

  const loading = (async () => {
    if (family.startsWith('CustomFont_')) {
      const db = await openFontDb()
      const record = await new Promise<any>((resolve, reject) => {
        const request = db.transaction(FONT_STORE, 'readonly').objectStore(FONT_STORE).get(family)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      if (!record?.blob) throw new Error(`Uploaded font not found: ${family}`)
      const url = URL.createObjectURL(record.blob)
      try {
        const face = new FontFace(family, `url(${url})`)
        await face.load()
        document.fonts.add(face)
      } finally {
        URL.revokeObjectURL(url)
      }
      return
    }

    const id = `google-font-${family.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
    if (!document.getElementById(id)) {
      await new Promise<void>((resolve, reject) => {
        const link = document.createElement('link')
        link.id = id
        link.rel = 'stylesheet'
        link.href = googleFontFamilyUrl(family)
        link.onload = () => resolve()
        link.onerror = () => reject(new Error(`Font stylesheet failed: ${family}`))
        document.head.appendChild(link)
      })
    }
    await document.fonts.load(`700 24px "${family}"`, 'نمونه فونت فارسی')
  })()

  pendingFonts.set(family, loading)
  try {
    await loading
  } catch (error) {
    pendingFonts.delete(family)
    console.warn(`Font load failed for ${family}:`, error)
  }
}