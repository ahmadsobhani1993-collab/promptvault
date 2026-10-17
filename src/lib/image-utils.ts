export const getImageUrl = (url: string | null | undefined) => {
  if (!url) return '/placeholder.jpg'
  if (url.includes('api.telegram.org')) return '/api/image-proxy?url=' + encodeURIComponent(url)
  
  if (url.includes('res.cloudinary.com')) {
    const match = url.match(/\/upload\/(?:(?:[a-z]_[^/]+,)*[a-z]_[^/]+\/)?(?:v\d+\/)?(.+)$/)
    if (match?.[1]) return `https://promptfa.s3.eu-west1.arvanstorage.ir/${match[1]}`
  }
  return url
}
