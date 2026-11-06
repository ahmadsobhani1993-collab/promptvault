import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import https from 'https';
import fs from 'fs';

// One-time import of legacy images; all credentials must be provided through environment variables.
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const ARVAN_ACCESS_KEY = process.env.ARVAN_ACCESS_KEY;
const ARVAN_SECRET_KEY = process.env.ARVAN_SECRET_KEY;
const ARVAN_ENDPOINT = process.env.ARVAN_ENDPOINT || 'https://s3.eu-west1.arvanstorage.ir';
const ARVAN_BUCKET = process.env.ARVAN_BUCKET || 'promptfa';
for (const [name, value] of Object.entries({
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  ARVAN_ACCESS_KEY,
  ARVAN_SECRET_KEY,
})) {
  if (!value) throw new Error(`${name} environment variable is required`);
}
const s3 = new S3Client({
  region: 'default',
  endpoint: ARVAN_ENDPOINT,
  credentials: {
    accessKeyId: ARVAN_ACCESS_KEY,
    secretAccessKey: ARVAN_SECRET_KEY,
  },
});

const authHeader = 'Basic ' + Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString('base64');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function doesObjectExist(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: ARVAN_BUCKET, Key: key }));
    return true;
  } catch (err) {
    return false;
  }
}

function streamAndUploadToArvan(url, key, format, resourceType) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return streamAndUploadToArvan(res.headers.location, key, format, resourceType).then(resolve).catch(reject);
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        reject(new Error(`Asset download failed with HTTP ${res.statusCode}`));
        return;
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', async () => {
        const buffer = Buffer.concat(chunks);
        try {
          await s3.send(
            new PutObjectCommand({
              Bucket: ARVAN_BUCKET,
              Key: key,
              Body: buffer,
              ACL: 'public-read',
              ContentType: resourceType === 'video'
                ? ({ mov: 'video/quicktime', ogv: 'video/ogg' }[format] || `video/${format}`)
                : `image/${format === 'jpg' ? 'jpeg' : format}`,
            })
          );
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

async function fetchFromCloudinary(resourceType, cursor) {
  let url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/resources/${resourceType}/upload?max_results=500`;
  if (cursor) url += `&next_cursor=${cursor}`;

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, { 
        headers: { Authorization: authHeader },
        signal: AbortSignal.timeout(30000) // ۳۰ ثانیه مهلت اتصال
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data));
      return data;
    } catch (err) {
      console.warn(`⚠️ تایم‌اوت یا خطا در اتصال به کلودینری (تلاش ${attempt} از ۵). ۵ ثانیه صبر و تلاش مجدد...`);
      await sleep(5000);
    }
  }
  throw new Error('ناتوان در اتصال به کلودینری پس از ۵ بار تلاش.');
}

async function migrateResourceType(resourceType) {
  const cursorFile = resourceType === 'image' ? './migration_cursor.txt' : './migration_cursor_video.txt';
  let nextCursor = null;
  if (fs.existsSync(cursorFile)) {
    nextCursor = fs.readFileSync(cursorFile, 'utf-8').trim() || null;
    if (nextCursor) {
      console.log(`📌 ادامه انتقال از نقطه قبلی (Cursor: ${nextCursor})`);
    }
  }

  while (true) {
    const data = await fetchFromCloudinary(resourceType, nextCursor);

    for (const item of data.resources) {
      const fileKey = `${item.public_id}.${item.format}`;
      
      // اگر قبلاً منتقل شده رد شو
      const exists = await doesObjectExist(fileKey);
      if (exists) {
        console.log(`⏩ قبلاً در آروان ثبت شده، رد شد: ${fileKey}`);
        continue;
      }

      console.log(`🚀 در حال انتقال مستقیم به آروان: ${fileKey}`);
      let uploaded = false;
      for (let retries = 0; retries < 3; retries++) {
        try {
          await streamAndUploadToArvan(item.secure_url, fileKey, item.format, resourceType);
          console.log(`✅ ذخیره شد: ${fileKey}`);
          uploaded = true;
          break;
        } catch (e) {
          console.warn(`تلاش مجدد برای آپلود ${fileKey}...`);
          await sleep(2000);
        }
      }
      if (!uploaded) {
        throw new Error(`Failed to migrate ${fileKey}; the cursor was not advanced.`);
      }
    }

    if (data.next_cursor) {
      nextCursor = data.next_cursor;
      fs.writeFileSync(cursorFile, nextCursor);
      console.log('--- رفتن به صفحه بعدی... ---');
    } else {
      if (fs.existsSync(cursorFile)) fs.unlinkSync(cursorFile);
      console.log(`🎉 انتقال فایل‌های ${resourceType} به آروان کامل شد.`);
      break;
    }
  }
}

async function startMigration() {
  await migrateResourceType('image');
  await migrateResourceType('video');
}

startMigration().catch((error) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});