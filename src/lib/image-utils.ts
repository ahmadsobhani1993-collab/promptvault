const ARVAN_WEBSITE_HOST = 'https://promptfa.s3-website.eu-west1.arvanstorage.ir'
const ARVAN_RAW_S3 = 'promptfa.s3.eu-west1.arvanstorage.ir'

export const getImageUrl = (url: string | null | undefined): string => {
  if (!url) return '/placeholder.jpg'

  // اگر قبلاً لینک خام S3 بوده، به هاست استاتیک پرسرعت وب تغییر می‌کند
    // Videos stay on the raw S3 host (the static-website endpoint may not serve them correctly)
  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url) && url.includes(ARVAN_RAW_S3)) return url

  if (url.includes(ARVAN_RAW_S3)) {
    return url.replace(`https://${ARVAN_RAW_S3}`, ARVAN_WEBSITE_HOST)
  }

  // اگر با ساختار کلودینری ذخیره شده بوده
  if (url.includes('res.cloudinary.com')) {
    const match = url.match(/\/upload\/(?:(?:[a-z]_[^/]+,)*[a-z]_[^/]+\/)?(?:v\d+\/)?(.+)$/)
    if (match?.[1]) return `${ARVAN_WEBSITE_HOST}/${match[1]}`
  }

  // اگر صرفاً نام پوشه ذخیره شده است
  if (url.startsWith('promptsfa/')) {
    return `${ARVAN_WEBSITE_HOST}/${url}`
  }

  return url
}
