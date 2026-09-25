export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('ui') === '1') {
    const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>کنسول ایمپورت پرامپت</title>
  <style>
    * { box-sizing: border-box; font-family: system-ui, sans-serif; }
    body { background: #0b0907; color: #f3f3f3; padding: 30px; margin: 0; }
    .card { background: #14110d; border: 1px solid #2a241e; border-radius: 16px; padding: 25px; max-width: 800px; margin: auto; }
    h1 { color: #f59e0b; font-size: 20px; margin: 0 0 15px 0; }
    .box { border: 1px solid #332a22; border-radius: 12px; padding: 15px; margin-bottom: 20px; background: rgba(0,0,0,0.3); }
    label { display: block; font-size: 13px; color: #f59e0b; font-weight: bold; margin-bottom: 8px; }
    input[type="url"], textarea { width: 100%; border: 1px solid #44382c; background: #1b1612; border-radius: 8px; padding: 10px; color: #fff; font-size: 13px; outline: none; }
    input[type="url"] { direction: ltr; text-align: left; }
    button { background: #f59e0b; color: #000; border: none; font-weight: bold; cursor: pointer; border-radius: 8px; padding: 10px 18px; font-size: 13px; }
    button:hover { background: #fbbf24; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-main { width: 100%; padding: 14px; font-size: 15px; border-radius: 12px; }
    #log { margin-top: 15px; padding: 15px; border-radius: 8px; background: #000; font-size: 12px; white-space: pre-wrap; max-height: 250px; overflow-y: auto; display: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>کنسول ایمپورت پرامپت (متن، کد، TXT و URL)</h1>
    
    <div class="box">
      <label>روش ۱: دریافت محتوا از لینک (URL)</label>
      <div style="display: flex; gap: 10px;">
        <input id="fetchUrl" type="url" placeholder="https://raw.githubusercontent.com/... یا آدرس فایل متنی" />
        <button id="fetchBtn" type="button">دریافت</button>
      </div>
    </div>

    <div class="box">
      <label>روش ۲: بارگذاری فایل TXT</label>
      <input id="txtFile" type="file" accept=".txt" style="font-size: 12px; color: #bbb;" />
    </div>

    <div style="margin-bottom: 20px;">
      <label style="color: #ccc;">محتوای پرامپت‌ها:</label>
      <textarea id="rawText" rows="10" placeholder="متن پرامپت‌ها را اینجا وارد کنید..."></textarea>
    </div>

    <button id="importBtn" type="button" class="btn-main">شروع پردازش و ایمپورت در سایت</button>
    <div id="log"></div>
  </div>

  <script>
    var fetchBtn = document.getElementById('fetchBtn');
    var fetchUrlInput = document.getElementById('fetchUrl');
    var txtFileInput = document.getElementById('txtFile');
    var rawTextArea = document.getElementById('rawText');
    var importBtn = document.getElementById('importBtn');
    var logBox = document.getElementById('log');

    txtFileInput.addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(evt) {
        rawTextArea.value = evt.target.result;
        alert('فایل متنی خوانده شد.');
      };
      reader.onerror = function() {
        alert('خطا در خواندن فایل.');
      };
      reader.readAsText(file);
    });

    fetchBtn.addEventListener('click', function() {
      var url = fetchUrlInput.value.trim();
      if (!url) {
        alert('لطفا آدرس معتبر وارد کنید.');
        return;
      }
      fetchBtn.disabled = true;
      fetchBtn.innerText = 'در حال دریافت...';
      fetch('/api/code-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch_url', url: url })
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.ok && data.text) {
          rawTextArea.value = data.text;
          alert('محتوای لینک دریافت شد.');
        } else {
          alert('خطا: ' + (data.error || 'دریافت ناموفق'));
        }
      })
      .catch(function(err) {
        alert('خطای اتصال: ' + err.message);
      })
      .finally(function() {
        fetchBtn.disabled = false;
        fetchBtn.innerText = 'دریافت';
      });
    });

    importBtn.addEventListener('click', function() {
      var text = rawTextArea.value.trim();
      if (!text) {
        alert('متن پرامپت خالی است.');
        return;
      }
      importBtn.disabled = true;
      importBtn.innerText = 'در حال ذخیره‌سازی...';
      logBox.style.display = 'block';
      logBox.innerText = 'ارسال اطلاعات به سرور...';

      fetch('/api/code-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import_text', text: text })
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.ok) {
          logBox.innerText = 'با موفقیت ثبت شد! تعداد: ' + (data.count || 0) + '\n' + JSON.stringify(data.items, null, 2);
        } else {
          logBox.innerText = 'خطا در ثبت: ' + (data.error || 'نامشخص');
        }
      })
      .catch(function(err) {
        logBox.innerText = 'خطای شبکه: ' + err.message;
      })
      .finally(function() {
        importBtn.disabled = false;
        importBtn.innerText = 'شروع پردازش و ایمپورت در سایت';
      });
    });
  </script>
</body>
</html>`
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
  return NextResponse.json({ message: 'Code Import API active. Pass ?ui=1' })
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
    }

    const body = await req.json()
    const { action, url, text } = body

    if (action === 'fetch_url') {
      if (!url) return NextResponse.json({ error: 'آدرس وارد نشده است' }, { status: 400 })
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const fetchedText = await res.text()
      return NextResponse.json({ ok: true, text: fetchedText.slice(0, 100000) })
    }

    if (action === 'import_text') {
      if (!text) return NextResponse.json({ error: 'متن خالی است' }, { status: 400 })

      let category = await prisma.category.findFirst()
      if (!category) {
        category = await prisma.category.create({
          data: {
            slug: 'code-dev',
            nameFa: 'کدنویسی و توسعه',
            nameEn: 'Coding & Dev',
            icon: 'code',
            descFa: 'پرامپت‌های توسعه نرم‌افزار و کد',
            descEn: 'Coding and developer prompts',
          },
        })
      }

      const slug = 'imp-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6)
      const created = await prisma.prompt.create({
        data: {
          slug,
          titleFa: 'پرامپت متنی جدید',
          titleEn: 'Imported Prompt',
          prompt: text,
          type: 'TEXT',
          model: 'GPT-4o',
          img: '/placeholder.png',
          categoryId: category.id,
          userId: session.user.id,
          tagsFa: ['متن', 'کد'],
          tagsEn: ['text', 'code'],
          status: 'PUBLISHED',
        },
      })

      return NextResponse.json({ ok: true, count: 1, items: [created] })
    }

    return NextResponse.json({ error: 'اکشن نامعتبر است' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطا در سرور' }, { status: 500 })
  }
}
