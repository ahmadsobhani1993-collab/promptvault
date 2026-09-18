function getMediaCover(url: string) {
  if (!url) return ''
  if (url.includes('/video/upload/')) {
    return url.replace(/\/video\/upload\/(?:v\d+\/)?/, '$&so_0,f_jpg/').replace(/\.[^/.]+$/, '.jpg')
  }
  return url
}
