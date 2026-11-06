const ARVAN_WEBSITE_HOST = 'https://promptfa.s3-website.eu-west1.arvanstorage.ir'
const ARVAN_RAW_HOST = 'https://promptfa.s3.eu-west1.arvanstorage.ir'
const ARVAN_RAW_S3 = 'promptfa.s3.eu-west1.arvanstorage.ir'
const VIDEO_FILE = /\.(mp4|webm|ogg|ogv|mov)(?:[?#].*)?$/i

function cloudinaryUrlToArvan(url: URL): string {
  const uploadIndex = url.pathname.indexOf('/upload/')
  if (uploadIndex < 0) return url.toString()

  const resourcePath = url.pathname.slice(uploadIndex + '/upload/'.length)
  const segments = resourcePath.split('/').filter(Boolean)
  const versionIndex = segments.findIndex((segment) => /^v\d+$/.test(segment))
  const keySegments = versionIndex >= 0
    ? segments.slice(versionIndex + 1)
    : segments.filter((segment) => !/^(?:a_[^,]+|c_[^,]+|f_[^,]+|fl_[^,]+|g_[^,]+|q_[^,]+|w_\d+|h_\d+)(?:,|$)/.test(segment))
  const objectKey = keySegments.join('/')
  if (!objectKey || objectKey.endsWith('/')) return url.toString()

  const isVideo = /\/video\/upload\//.test(url.pathname)
  const host = isVideo ? ARVAN_RAW_HOST : ARVAN_WEBSITE_HOST
  return `${host}/${objectKey}`
}

export const getImageUrl = (url: string | null | undefined): string => {
  const source = url?.trim()
  if (!source || source === 'null' || source === 'undefined') return '/placeholder.jpg'

  if (source.startsWith('promptsfa/')) {
    return `${ARVAN_WEBSITE_HOST}/${source}`
  }

  try {
    const parsed = new URL(source)
    if (parsed.hostname === ARVAN_RAW_S3) {
      if (VIDEO_FILE.test(parsed.pathname)) return source
      return `${ARVAN_WEBSITE_HOST}${parsed.pathname}${parsed.search}${parsed.hash}`
    }
    if (parsed.hostname === new URL(ARVAN_WEBSITE_HOST).hostname && VIDEO_FILE.test(parsed.pathname)) {
      return `${ARVAN_RAW_HOST}${parsed.pathname}${parsed.search}${parsed.hash}`
    }

    if (parsed.hostname === 'res.cloudinary.com') return cloudinaryUrlToArvan(parsed)
  } catch {
    return source
  }

  return source
}

export function getVideoPosterUrl(url: string | null | undefined): string | undefined {
  const resolved = getImageUrl(url)
  try {
    const parsed = new URL(resolved)
    const poster = new URLSearchParams(parsed.hash.slice(1)).get('poster')
    if (!poster) return undefined
    const posterUrl = new URL(poster)
    if (posterUrl.protocol !== 'https:' || posterUrl.hostname !== new URL(ARVAN_WEBSITE_HOST).hostname) {
      return undefined
    }
    return posterUrl.toString()
  } catch {
    return undefined
  }
}
