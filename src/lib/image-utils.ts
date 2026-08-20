export const getImageUrl = (url: string | null | undefined) => {
  if (!url) return '/placeholder.jpg';
  if (url.includes('api.telegram.org')) {
    return '/api/image-proxy?url=' + encodeURIComponent(url);
  }
  return url;
};
