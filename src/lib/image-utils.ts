export const getImageUrl = (url: string | null | undefined, width: number = 600) => {
  if (!url) return '/placeholder.jpg'

  // پروکسی برای تصاویر تلگرام
  if (url.includes('api.telegram.org')) {
    return '/api/image-proxy?url=' + encodeURIComponent(url)
  }

  // تغییر مسیر هوشمند از کلودینری به آروان‌کلاد
  if (url.includes('res.cloudinary.com')) {
    // حذف بخش پیشوند و ترنسفورمیشن‌های احتمالی کلودینری و استخراج مسیر نهایی فایل
    const match = url.match(/\/upload\/(?:(?:[a-z]_[^/]+,)*[a-z]_[^/]+\/)?(?:v\d+\/)?(.+)$/)
    if (match && match[1]) {
      const cleanPath = match[1]
      return `https://promptfa.s3.eu-west1.arvanstorage.ir/${cleanPath}`
    }
  }

  return url
}