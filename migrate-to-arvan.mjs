import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import https from 'https';
import fs from 'fs';

// ۱. اطلاعات کلودینری (از .env.local خوانده می‌شود یا دستی جایگزین کنید)
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'nvwsdtvz';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '194222451166831';
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || 'h7Quq9kKZsVHUUQf1UT2mXsDHkE';

// ۲. اطلاعات آروان‌کلاد شما
const ARVAN_ACCESS_KEY = 'd1a8d795-2443-4dbc-a02c-8daa85f20012';
const ARVAN_SECRET_KEY = '5bb1ef44f507fcdb5b7983ccedfe9f9a28fc3f12eacab3861377bdbb41bca3df';
const ARVAN_ENDPOINT = 'https://s3.eu-west1.arvanstorage.ir';
const ARVAN_BUCKET = 'promptfa';
const s3 = new S3Client({
  region: 'default',
  endpoint: ARVAN_ENDPOINT,
  credentials: {
    accessKeyId: ARVAN_ACCESS_KEY,
    secretAccessKey: ARVAN_SECRET_KEY,
  },
});

const authHeader = 'Basic ' + Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString('base64');
const CURSOR_FILE = './migration_cursor.txt';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function doesObjectExist(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: ARVAN_BUCKET, Key: key }));
    return true;
  } catch (err) {
    return false;
  }
}

function streamAndUploadToArvan(url, key, format) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return streamAndUploadToArvan(res.headers.location, key, format).then(resolve).catch(reject);
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
              ContentType: `image/${format === 'jpg' ? 'jpeg' : format}`,
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

async function fetchFromCloudinary(cursor) {
  let url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/resources/image/upload?max_results=500`;
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

async function startMigration() {
  let nextCursor = null;
  if (fs.existsSync(CURSOR_FILE)) {
    nextCursor = fs.readFileSync(CURSOR_FILE, 'utf-8').trim() || null;
    if (nextCursor) {
      console.log(`📌 ادامه انتقال از نقطه قبلی (Cursor: ${nextCursor})`);
    }
  }

  while (true) {
    const data = await fetchFromCloudinary(nextCursor);

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
          await streamAndUploadToArvan(item.secure_url, fileKey, item.format);
          console.log(`✅ ذخیره شد: ${fileKey}`);
          uploaded = true;
          break;
        } catch (e) {
          console.warn(`تلاش مجدد برای آپلود ${fileKey}...`);
          await sleep(2000);
        }
      }
      if (!uploaded) {
        console.error(`❌ انتقال ${fileKey} ناموفق بود.`);
      }
    }

    if (data.next_cursor) {
      nextCursor = data.next_cursor;
      fs.writeFileSync(CURSOR_FILE, nextCursor);
      console.log('--- رفتن به صفحه بعدی... ---');
    } else {
      if (fs.existsSync(CURSOR_FILE)) fs.unlinkSync(CURSOR_FILE);
      console.log('🎉 تمام تصاویر با موفقیت کامل و بدون نقص به آروان‌کلاد منتقل شدند!');
      break;
    }
  }
}

startMigration().catch(console.error);