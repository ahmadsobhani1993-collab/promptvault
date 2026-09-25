export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const isUI = searchParams.get('ui') === '1'

  if (isUI) {
    const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>کنسول ایمپورت هوشمند پرامپت‌ها</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #0b0907; color: #f3f3f3; font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body class="p-6 md:p-10 max-w-4xl mx-auto">
  <div class="border border-[#2a241e] bg-[#14110d] rounded-2xl p-6 md:p-8 shadow-2xl">
    <div class="flex items-center justify-between border-b border-[#2a241e] pb-4 mb-6">
      <div class="flex items-center gap-3">
        <span class="text-3xl">📥</span>
        <div>
          <h1 class="text-xl font-black text-amber-400">کنسول ایمپورت پرامپت (متن، کد، TXT و URL)</h1>
          <p class="text-xs text-stone-400">تبدیل و دسته‌بندی خودکار داده‌ها با هوش مصنوعی و ذخیره مستقیم در دیتابیس</p>
        </div>
      </div>
    </div>

    <!-- بخش ورودی با URL -->
    <div class="mb-6 p-4 rounded-xl border border-stone-800 bg-black/40">
      <label class="block text-xs font-bold text-amber-400 mb-2">روش ۱: ایمپورت مستقیم از لینک اینترنتی (URL)</label>
      <div class="flex gap-2">
        <input id="fetchUrl" type="url" placeholder="https://raw.githubusercontent.com/... یا لینک صفحه منبع" class="flex-1 rounded-xl border border-stone-700 bg-stone-900/90 p-2.5 text-xs text-white focus:outline-none focus:border-amber-400" dir="ltr" />
        <button id="fetchBtn" type="button" class="bg-amber-500 hover:bg-amber-600 text-black px-4 py-2 rounded-xl text-xs font-bold transition-all">
          دریافت محتوا
        </button>
      </div>
    </div>

    <!-- بخش آپلود فایل TXT -->
    <div class="mb-6 p-4 rounded-xl border border-stone-800 bg-black/40">
      <label class="block text-xs font-bold text-amber-400 mb-2">روش ۲: آپلود مستقیم فایل TXT</label>
      <input id="txtFile" type="file" accept=".txt" class="block w-full text-xs text-stone-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-amber-500/20 file:text-amber-400 hover:file:bg-amber-500/30 cursor-pointer" />
    </div>

    <!-- بخش متن خام پرامپت‌ها -->
    <div class="mb-6">
      <label class="block text-xs font-bold text-stone-300 mb-2">محتوای پرامپت‌ها (قابل ویرایش مستقیم یا حاصل از فایل/URL):</label>
      <textarea id="rawText" rows="10" placeholder="متن پرامپت‌ها را اینجا بگذارید..." class="w-full rounded-xl border border-stone-800 bg-stone-900/80 p-3 text-xs text-stone-200 focus:outline-none focus:border-amber-400 font-mono"></textarea>
    </div>

    <!-- دکمه پردازش -->
    <button id="importBtn" type="button" class="w-full bg-amber-500 hover:bg-amber-400 text-black py-3.5 rounded-xl font-black text-sm transition-all shadow-lg shadow-amber-500/10">
      🚀 شروع پردازش و ایمپورت در پرامپت‌فا
    </button>

    <!-- گزارش وضعیت -->
    <div id="statusBox" class="mt-6 hidden p-4 rounded-xl border border-stone-800 bg-black/60 text-xs">
      <div id="statusText" class="font-bold text-amber-400 mb-2">در حال آماده‌سازی...</div>
      <pre id="log" class="text-[11px] text-stone-300 overflow-x-auto max-h-48 whitespace-pre-wrap"></pre>
    </div>
  </div>

  <script>
    const fetchBtn = document.getElementById('fetchBtn');
    const fetchUrlInput = document.getElementById('fetchUrl');
    const txtFileInput = document.getElementById('txtFile');
    const rawTextArea = document.getElementById('rawText');
    const importBtn = document.getElementById('importBtn');
    const statusBox = document.getElementById('statusBox');
    const statusText = document.getElementById('statusText');
    const logBox = document.getElementById('log');

    // خواندن فایل TXT در کلاینت
    txtFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        rawTextArea.value = text;
        alert('محتوای فایل TXT با موفقیت بارگذاری شد!');
      } catch (err) {
        alert('خطا در خواندن فایل TXT');
      }
    });

    // دریافت محتوا از URL
    fetchBtn.addEventListener('click', async () => {
      const url = fetchUrlInput.value.trim();
      if (!url) return alert('لطفاً آدرس اینترنتی معتبر وارد کنید.');
      fetchBtn.disabled = true;
      fetchBtn.innerText = 'در حال دریافت...';
      try {
        const res = await fetch('/api/code-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'fetch_url', url })
        });
        const data = await res.json();
        if (data.ok && data.text) {
          rawTextArea.value = data.text;
          alert('محتوای لینک با موفقیت دریافت شد!');
        } else {
          alert('خطا در دریافت لینک: ' + (data.error || 'ناشناخته'));
        }
      } catch (err) {
        alert('خطا در اتصال به اینترنت یا بلاک بودن منبع.');
      } finally {
        fetchBtn.disabled = false;
        fetchBtn.innerText = 'دریافت محتوا';
      }
    });

    // شروع ایمپورت
    importBtn.addEventListener('click', async () => {
      const text = rawTextArea.value.trim();
      if (!text) return alert('لطفاً ابتدا متنی برای پرامپت‌ها قرار دهید.');

      importBtn.disabled = true;
      statusBox.classList.remove('hidden');
      statusText.innerText = 'در حال استخراج و ساخت رکوردها با هوش مصنوعی...';
      logBox.innerText = 'ارسال متن به سرور...';

      try {
        const res = await fetch('/api/code-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'import_text', text })
        });
        const data = await res.json();
        if (data.ok) {
          statusText.innerText = '✅ پردازش با موفقیت به پایان رسید!';
          logBox.innerText = 'تعداد پرامپت‌های اضافه شده: ' + (data.count || 0) + '\n' + JSON.stringify(data.items, null, 2);
        } else {
          statusText.innerText = '❌ خطا در فرآیند:';
          logBox.innerText = data.error || 'خطای ناشناخته رخ داد.';
        }
      } catch (err) {
        statusText.innerText = '❌ خطای شبکه:';
        logBox.innerText = err.message;
      } finally {
        importBtn.disabled = false;
      }
    });
  </script>
</body>
</html>`
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  return NextResponse.json({ message: 'Code Import API active. Pass ?ui=1 for console.' })
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'دسترسی فقط مخصوص مدیر است' }, { status: 403 })
    }

    const body = await req.json()
    const { action, url, text } = body

    // هندلر واکشی URL از طریق سرور برای دور زدن CORS
    if (action === 'fetch_url') {
      if (!url) return NextResponse.json({ error: 'آدرس URL ارسال نشده است.' }, { status: 400 })
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const fetchedText = await res.text()
      return NextResponse.json({ ok: true, text: fetchedText.slice(0, 100000) })
    }

    // هندلر پردازش و ذخیره پرامپت‌ها
    if (action === 'import_text') {
      if (!text) return NextResponse.json({ error: 'متن خالی است.' }, { status: 400 })

      // پیش‌فرض دسته‌بندی
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

      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
      const aiPrompt = `Analyze the following raw prompts text and extract individual prompts into a clean JSON array.
Each object must have:
- titleFa: A short catchy Persian title
- titleEn: English title
- prompt: The full prompt text
- type: Either "TEXT" or "CODE"
- tagsFa: array of 2-3 Persian tags
- tagsEn: array of 2-3 English tags

Raw Text:
${text.slice(0, 15000)}

Respond strictly in pure JSON array format without backticks or markdown.`

      const result = await model.generateContent(aiPrompt)
      let parsed = []
      try {
        const rawJson = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim()
        parsed = JSON.parse(rawJson)
      } catch {
        parsed = [
          {
            titleFa: 'پرامپت متنی ایمپورت شده',
            titleEn: 'Imported Prompt',
            prompt: text.slice(0, 5000),
            type: 'TEXT',
            tagsFa: ['کد', 'متن'],
            tagsEn: ['code', 'text'],
          },
        ]
      }

      const createdItems = []
      for (const item of parsed) {
        const slug = `imp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`
        const created = await prisma.prompt.create({
          data: {
            slug,
            titleFa: item.titleFa || 'پرامپت جدید',
            titleEn: item.titleEn || 'New Prompt',
            prompt: item.prompt || '',
            type: item.type === 'CODE' ? 'CODE' : 'TEXT',
            model: 'GPT-4o / Claude',
            img: '/placeholder.png',
            categoryId: category.id,
            userId: session.user.id,
            tagsFa: item.tagsFa || [],
            tagsEn: item.tagsEn || [],
            status: 'PUBLISHED',
          },
        })
        createdItems.push({ id: created.id, titleFa: created.titleFa, slug: created.slug })
      }

      return NextResponse.json({ ok: true, count: createdItems.length, items: createdItems })
    }

    return NextResponse.json({ error: 'اکشن نامعتبر است' }, { status: 400 })
  } catch (error: any) {
    console.error('Import error:', error)
    return NextResponse.json({ error: error.message || 'خطا در پردازش سرور' }, { status: 500 })
  }
}
