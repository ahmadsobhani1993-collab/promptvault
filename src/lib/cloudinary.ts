export async function uploadToCloudinary(
  buf: Buffer,
  folder = 'promptsfa'
): Promise<{ url: string; publicId: string }> {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME
  const key = process.env.CLOUDINARY_API_KEY
  const secret = process.env.CLOUDINARY_API_SECRET
  if (!cloud || !key || !secret) throw new Error('Cloudinary env missing')

  const form = new URLSearchParams()
  form.set('file', 'data:image/jpeg;base64,' + buf.toString('base64'))
  form.set('folder', folder)

  const r = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
    signal: AbortSignal.timeout(30000),
  })
  const j: any = await r.json()
  if (!r.ok) throw new Error('cloudinary upload failed: ' + (j.error?.message || r.status))
  return { url: j.secure_url, publicId: j.public_id }
}

export async function uploadFromUrl(
  url: string,
  folder = 'promptsfa/articles'
): Promise<{ url: string; publicId: string }> {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000), redirect: 'follow' })
  if (!r.ok) throw new Error('download failed: ' + r.status)
  const buf = Buffer.from(await r.arrayBuffer())
  if (buf.length < 1000) throw new Error('image too small')
  if (buf.length > 10_000_000) throw new Error('image too large')
  return uploadToCloudinary(buf, folder)
}

export async function ensureCloudinary(
  url: string,
  folder = 'promptsfa/articles'
): Promise<{ url: string; via: string }> {
  if (!url) throw new Error('empty url')
  if (url.includes('res.cloudinary.com')) return { url, via: 'already-cloudinary' }
  const up = await uploadFromUrl(url, folder)
  return { url: up.url, via: 'downloaded+uploaded' }
}
