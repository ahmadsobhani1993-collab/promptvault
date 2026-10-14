import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import crypto from 'crypto'

const ARVAN_ACCESS_KEY = process.env.ARVAN_ACCESS_KEY
const ARVAN_SECRET_KEY = process.env.ARVAN_SECRET_KEY
const ARVAN_ENDPOINT = process.env.ARVAN_ENDPOINT || 'https://s3.eu-west1.arvanstorage.ir'
const ARVAN_BUCKET = process.env.ARVAN_BUCKET || 'promptfa'

const s3 = new S3Client({
  region: 'default',
  endpoint: ARVAN_ENDPOINT,
  credentials: {
    accessKeyId: ARVAN_ACCESS_KEY || '',
    secretAccessKey: ARVAN_SECRET_KEY || '',
  },
})

export async function uploadToCloudinary(
  buf: Buffer,
  folder = 'promptsfa'
): Promise<{ url: string; publicId: string }> {
  if (!ARVAN_ACCESS_KEY || !ARVAN_SECRET_KEY) {
    throw new Error('ArvanCloud credentials missing in env')
  }

  const randomName = crypto.randomBytes(8).toString('hex')
  const cleanFolder = folder.replace(/^\/+|\/+$/g, '')
  const publicId = `${cleanFolder}/${Date.now()}-${randomName}`
  const fileKey = `${publicId}.jpg`

  await s3.send(
    new PutObjectCommand({
      Bucket: ARVAN_BUCKET,
      Key: fileKey,
      Body: buf,
      ACL: 'public-read',
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000, immutable', // کش دائمی برای جلوگیری از مصرف ترافیک مکرر
    })
  )

  const url = `https://${ARVAN_BUCKET}.s3.eu-west1.arvanstorage.ir/${fileKey}`
  return { url, publicId }
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

export async function uploadRemoteDirectly(
  remoteUrl: string,
  folder = 'promptsfa/prompts',
  customPublicId?: string,
  resourceType: 'image' | 'video' = 'image'
): Promise<{ url: string; publicId: string }> {
  if (!ARVAN_ACCESS_KEY || !ARVAN_SECRET_KEY) {
    throw new Error('ArvanCloud credentials missing in env')
  }

  const timeout = resourceType === 'video' ? 300000 : 60000
  const r = await fetch(remoteUrl, { signal: AbortSignal.timeout(timeout), redirect: 'follow' })
  if (!r.ok) throw new Error(`remote fetch failed: ${r.status}`)
  const buf = Buffer.from(await r.arrayBuffer())

  const ext = resourceType === 'video' ? 'mp4' : 'jpg'
  const contentType = resourceType === 'video' ? 'video/mp4' : 'image/jpeg'

  const cleanFolder = folder.replace(/^\/+|\/+$/g, '')
  const publicId = customPublicId ? `${cleanFolder}/${customPublicId}` : `${cleanFolder}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}`
  const fileKey = `${publicId}.${ext}`

  await s3.send(
    new PutObjectCommand({
      Bucket: ARVAN_BUCKET,
      Key: fileKey,
      Body: buf,
      ACL: 'public-read',
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  )

  const url = `https://${ARVAN_BUCKET}.s3.eu-west1.arvanstorage.ir/${fileKey}`
  return { url, publicId }
}

export async function ensureCloudinary(
  url: string,
  folder = 'promptsfa/articles'
): Promise<{ url: string; via: string }> {
  if (!url) throw new Error('empty url')
  if (url.includes('arvanstorage.ir') || url.includes('res.cloudinary.com')) {
    return { url, via: 'already-hosted' }
  }
  const up = await uploadFromUrl(url, folder)
  return { url: up.url, via: 'downloaded+uploaded' }
}