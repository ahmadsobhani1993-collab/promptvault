export const getImageUrl = (url: string | null | undefined, width: number = 600) => {
  if (!url) return '/placeholder.jpg'

  // پروکسی برای تصاویر تلگرام
  if (url.includes('api.telegram.org')) {
    return '/api/image-proxy?url=' + encodeURIComponent(url)
  }

  // تبدیل هوشمند برای تصاویر Cloudinary
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    // جلوگیری از تکرار پارامترها در صورتی که قبلاً ترنسفورم شده باشند
    if (url.includes('f_auto') || url.includes('q_auto')) {
      return url
    }
    const transformParams = `f_auto,q_auto:good,w_${width},c_limit`
    return url.replace('/upload/', `/upload/${transformParams}/`)
  }

  return url
}
