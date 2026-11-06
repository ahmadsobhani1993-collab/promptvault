import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import crypto from 'crypto'
import sharp from 'sharp'

const ARVAN_ACCESS_KEY = process.env.ARVAN_ACCESS_KEY
const ARVAN_SECRET_KEY = process.env.ARVAN_SECRET_KEY
const ARVAN_ENDPOINT = process.env.ARVAN_ENDPOINT || 'https://s3.eu-west1.arvanstorage.ir'
const ARVAN_BUCKET = process.env.ARVAN_BUCKET || 'promptfa'
const ARVAN_RAW_HOST = `https://${ARVAN_BUCKET}.s3.eu-west1.arvanstorage.ir`
const ARVAN_WEBSITE_HOST = `https://${ARVAN_BUCKET}.s3-website.eu-west1.arvanstorage.ir`

const s3 = new S3Client({
  region: 'default',
  endpoint: ARVAN_ENDPOINT,
  credentials: {
    accessKeyId: ARVAN_ACCESS_KEY || '',
    secretAccessKey: ARVAN_SECRET_KEY || '',
  },
})

export async function uploadImageToStorage(
  buf: Buffer,
  folder = 'promptsfa'
): Promise<{ url: string; publicId: string }> {
  if (!ARVAN_ACCESS_KEY || !ARVAN_SECRET_KEY) {
    throw new Error('ArvanCloud credentials missing in env')
  }

  // Compress and convert images to WebP before storing them in Arvan.
  let finalBuffer = buf
  try {
    finalBuffer = await sharp(buf)
      .webp({ quality: 82, effort: 4 })
      .toBuffer()
  } catch (err) {
    console.warn('[Sharp] WebP conversion fallback to original buffer:', err)
  }

  const randomName = crypto.randomBytes(8).toString('hex')
  const cleanFolder = folder.replace(/^\/+|\/+$/g, '')
  const publicId = `${cleanFolder}/${Date.now()}-${randomName}`
  const fileKey = `${publicId}.webp`

  await s3.send(
    new PutObjectCommand({
      Bucket: ARVAN_BUCKET,
      Key: fileKey,
      Body: finalBuffer,
      ACL: 'public-read',
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    })
  )

  const url = `${ARVAN_WEBSITE_HOST}/${fileKey}`
  return { url, publicId }
}

export async function uploadVideoToStorage(
  buf: Buffer,
  contentType: string,
  folder = 'promptsfa',
  thumbnail?: Buffer
): Promise<{ url: string; publicId: string; posterUrl?: string }> {
  const extensions: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogv',
    'video/quicktime': 'mov',
  }
  const extension = extensions[contentType]
  if (!extension) throw new Error('Unsupported video format')
  if (!ARVAN_ACCESS_KEY || !ARVAN_SECRET_KEY) {
    throw new Error('ArvanCloud credentials missing in env')
  }

  const randomName = crypto.randomBytes(8).toString('hex')
  const cleanFolder = folder.replace(/^\/+|\/+$/g, '')
  const publicId = `${cleanFolder}/${Date.now()}-${randomName}`
  const fileKey = `${publicId}.${extension}`

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

  const url = `${ARVAN_RAW_HOST}/${fileKey}`
  let posterUrl: string | undefined
  if (thumbnail) {
    const posterKey = `${publicId}.jpg`
    await s3.send(
      new PutObjectCommand({
        Bucket: ARVAN_BUCKET,
        Key: posterKey,
        Body: thumbnail,
        ACL: 'public-read',
        ContentType: 'image/jpeg',
        CacheControl: 'public, max-age=31536000, immutable',
      })
    )
    posterUrl = `${ARVAN_WEBSITE_HOST}/${posterKey}`
  }

  return { url, publicId, posterUrl }
}
