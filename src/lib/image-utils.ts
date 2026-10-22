export const getImageUrl = (url: string | null | undefined): string => {
  if (!url) return '/placeholder.jpg'

  // اگر تصویر قبلا در کلودینری بوده یا ساختار کلودینری دارد، تبدیل مستقیم به ابر آروان
  if (url.includes('res.cloudinary.com')) {
    const match = url.match(/\/upload\/(?:(?:[a-z]_[^/]+,)*[a-z]_[^/]+\/)?(?:v\d+\/)?(.+)$/)
    if (match?.[1]) return `https://promptfa.s3.eu-west1.arvanstorage.ir/${match[1]}`
  }

  // اگر قبلاً آدرس باکت آروان بود، مستقیماً بازگردانده می‌شود
  if (url.includes('arvanstorage.ir')) {
    return url
  }

  return url
}
