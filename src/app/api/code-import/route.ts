export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateText, TAG_VOCAB } from '@/lib/gemini'

export const maxDuration = 300

const KEY = 'pv-cron-8x2m1q'

const CODE_COVERS = [
  'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1504639725590-34d0984388bd?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1629654297299-c8506221ca97?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=1200&auto=format&fit=crop',
]

function getRandomCover(): string {
  const index = Math.floor(Math.random() * CODE_COVERS.length)
  return CODE_COVERS[index]
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  if (url.searchParams.get('ui') === '1') {
    return new Response(PAGE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
  return NextResponse.json({ ok: true, message: 'Use POST to upload code prompts' })
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const authHeader = req.headers.get('authorization')
  const passedKey = url.searchParams.get('key') || (authHeader ? authHeader.replace('Bearer ', '') : '')

  if (passedKey !== KEY) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const rawChunk = String(body.text || '').trim()

    if (!rawChunk) {
      return NextResponse.json({ ok: false, error: 'متنی ارسال نشده است' }, { status: 400 })
    }

    const categories = await prisma.category.findMany({ include: { subs: true } })
    const catSlugs = categories.map((c) => c.slug).join(', ')
    const vocabFa = TAG_VOCAB.map((t) => t.fa).join('، ')

    const instruction = `You are a specialized developer prompt analyzer.
Analyze the following raw text containing multiple unorganized developer/coding prompts.
Detect and split each separate prompt intelligently.

For EACH identified prompt, extract:
1. 'cleanPrompt': The exact complete code prompt without surrounding noise or instructions.
2. 'titleFa': A concise, professional Persian title starting with "پرامپت ".
3. 'titleEn': A concise, clear English title.
4. 'descFa' & 'descEn': A 1-sentence description explaining what this code prompt does.
5. 'usageFa' & 'usageEn': Brief instructions on which model or IDE to use it in (e.g. Cursor, Claude, ChatGPT).
6. 'tagsFa': 2 to 4 relevant tags selected strictly from: [${vocabFa}]. Always include 'کد'.
7. 'tagsEn': English equivalents for the chosen tags.
8. 'categorySlug': Most appropriate category from: [${catSlugs}]. Defaults to programming/code.
9. 'subSlug': Matching sub-category slug or null.
10. 'suggestedModel': Best AI model for this task (e.g. Claude 3.5 Sonnet, GPT-4o, Cursor).

Return ONLY valid JSON with a root array named "items":
{
  "items": [
    {
      "cleanPrompt": "...",
      "titleFa": "پرامپت ...",
      "titleEn": "...",
      "descFa": "...",
      "descEn": "...",
      "usageFa": "...",
      "usageEn": "...",
      "tagsFa": ["کد"],
      "tagsEn": ["code"],
      "categorySlug": "...",
      "subSlug": null,
      "suggestedModel": "Claude 3.5 Sonnet"
    }
  ]
}

Raw Text:
${rawChunk.slice(0, 15000)}`

    // فراخوانی مستقیم از آبشار مدل‌ها و کلیدهای چرخشی در gemini.ts
    const { text: aiRaw, model: usedModel } = await generateText({
      instruction,
      expectJson: true,
    })

    let parsedItems: any[] = []
    try {
      const cleaned = aiRaw.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim()
      const m = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
      const parsed = JSON.parse(m ? m[0] : cleaned)
      parsedItems = Array.isArray(parsed) ? parsed : (parsed.items || [])
    } catch {
      return NextResponse.json({ ok: false, error: 'خطا در پارس پاسخ هوش مصنوعی', raw: aiRaw }, { status: 500 })
    }

    if (parsedItems.length === 0) {
      return NextResponse.json({ ok: true, count: 0, items: [], usedModel, message: 'پرامپتی در این بخش شناسایی نشد' })
    }

    const savedSlugs: string[] = []

    for (const item of parsedItems) {
      const cleanPrompt = String(item.cleanPrompt || '').trim()
      if (!cleanPrompt) continue

      const baseTitle = String(item.titleFa || 'کدنویسی هوش مصنوعی').trim()
      const titleFa = baseTitle.startsWith('پرامپت') ? baseTitle : `پرامپت ${baseTitle}`
      const titleEn = String(item.titleEn || 'AI Coding Prompt').trim()

      const cat = categories.find((c) => c.slug === item.categorySlug) || categories[0]
      const sub = item.subSlug ? cat?.subs?.find((s) => s.slug === item.subSlug) ?? null : null

      const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 5)
      const slug = `code-${uniqueSuffix}`

      const coverImg = getRandomCover()

      const rawTags = Array.isArray(item.tagsFa) ? item.tagsFa : []
      const tagsFa = rawTags.length > 0 ? rawTags.slice(0, 4) : ['کد', 'آموزش']
      const tagsEn = tagsFa.map((fa: string) => {
        const v = TAG_VOCAB.find((t) => t.fa === fa)
        return v ? v.en : 'code'
      })

      await prisma.prompt.create({
        data: {
          slug,
          titleFa,
          titleEn,
          descFa: String(item.descFa || 'پرامپت برنامه‌نویسی و توسعه نرم‌افزار'),
          descEn: String(item.descEn || 'Software engineering and coding AI prompt'),
          usageFa: String(item.usageFa || 'مناسب برای مدل‌های برنامه‌نویسی و Cursor'),
          usageEn: String(item.usageEn || 'Recommended for Claude 3.5 Sonnet / Cursor'),
          img: coverImg,
          model: String(item.suggestedModel || 'Claude 3.5 Sonnet'),
          type: 'TEXT',
          status: 'PUBLISHED',
          categoryId: cat.id,
          subId: sub?.id ?? null,
          tagsFa,
          tagsEn,
          prompt: cleanPrompt,
          views: Math.floor(Math.random() * 12) + 1,
        },
      })

      savedSlugs.push(slug)
    }

    return NextResponse.json({
      ok: true,
      count: savedSlugs.length,
      usedModel,
      slugs: savedSlugs,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'خطای سرور' }, { status: 500 })
  }
}

const PAGE_HTML = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>کنسول ایمپورت پرامپت‌های متنی و کد</title>
<style>
body{font-family:Tahoma,system-ui,sans-serif;background:#0d1117;color:#c9d1d9;margin:0;padding:24px;line-height:1.6}
.container{max-width:860px;margin:0 auto}
h2{color:#58a6ff;margin-top:0}
.drop-zone{border:2px dashed #30363d;border-radius:12px;padding:32px 16px;text-align:center;background:#161b22;cursor:pointer;transition:.2s}
.drop-zone:hover,.drop-zone.dragover{border-color:#58a6ff;background:#1c2128}
textarea{width:100%;height:160px;background:#0d1117;border:1px solid #30363d;border-radius:8px;color:#c9d1d9;padding:12px;box-sizing:border-box;font-family:monospace;margin-top:12px;direction:ltr;resize:vertical}
.actions{margin-top:16px;display:flex;align-items:center;gap:12px}
button{padding:12px 24px;font-size:15px;font-weight:bold;border:0;border-radius:8px;background:#238636;color:#fff;cursor:pointer;transition:.2s}
button:hover{background:#2ea043}
button:disabled{opacity:.4;cursor:not-allowed}
#log{margin-top:20px;background:#000;border:1px solid #30363d;border-radius:8px;padding:14px;height:45vh;overflow-y:auto;font-family:Consolas,monospace;font-size:13px;white-space:pre-wrap;direction:ltr;text-align:left}
.ok{color:#3fb950}.err{color:#f85149}.info{color:#58a6ff}
.progress{margin-top:10px;font-size:14px;color:#8b949e}
</style>
</head>
<body>
<div class="container">
  <h2>⚡ ایمپورت هوشمند پرامپت‌های کد و متنی</h2>
  <p style="color:#8b949e;font-size:14px">متن فایل را بارگذاری کنید. سیستم با چرخش آبشاری مدل‌ها (۹ مدل) و کلیدهای هوش مصنوعی، پرامپت‌ها را تفکیک و منتشر می‌کند.</p>
  
  <div class="drop-zone" id="dropZone">
    <div style="font-size:24px;margin-bottom:8px">📁</div>
    <div>فایل متنی (.txt) خود را اینجا رها کنید، یا <b>کلیک کنید</b> برای انتخاب فایل</div>
    <input type="file" id="fileInput" accept=".txt" style="display:none">
  </div>

  <textarea id="rawInput" placeholder="یا متن پرامپت‌ها را مستقیماً اینجا پیست کنید..."></textarea>

  <div class="actions">
    <button id="startBtn">🚀 شروع پردازش و ارسال به سایت</button>
    <span class="progress" id="statusText"></span>
  </div>

  <div id="log"></div>
</div>

<script>
var KEY = 'pv-cron-8x2m1q';
var dropZone = document.getElementById('dropZone');
var fileInput = document.getElementById('fileInput');
var rawInput = document.getElementById('rawInput');
var startBtn = document.getElementById('startBtn');
var logEl = document.getElementById('log');
var statusText = document.getElementById('statusText');

dropZone.onclick = function() { fileInput.click(); };
fileInput.onchange = function(e) {
  var file = e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(evt) { rawInput.value = evt.target.result; log('فایل خوانده شد (' + file.name + ' - ' + file.size + ' بایت)', 'ok'); };
  reader.readAsText(file);
};

dropZone.ondragover = function(e) { e.preventDefault(); dropZone.classList.add('dragover'); };
dropZone.ondragleave = function() { dropZone.classList.remove('dragover'); };
dropZone.ondrop = function(e) {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) {
    fileInput.files = e.dataTransfer.files;
    var file = e.dataTransfer.files[0];
    var reader = new FileReader();
    reader.onload = function(evt) { rawInput.value = evt.target.result; log('فایل بارگذاری شد: ' + file.name, 'ok'); };
    reader.readAsText(file);
  }
};

function log(msg, cls) {
  cls = cls || 'info';
  var d = document.createElement('div');
  d.className = cls;
  d.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
  logEl.appendChild(d);
  logEl.scrollTop = logEl.scrollHeight;
}

function chunkText(text, maxChars) {
  var chunks = [];
  var i = 0;
  while (i < text.length) {
    var end = Math.min(i + maxChars, text.length);
    if (end < text.length) {
      var nextNewline = text.lastIndexOf('\n', end);
      if (nextNewline > i + 1000) end = nextNewline;
    }
    chunks.push(text.slice(i, end));
    i = end;
  }
  return chunks;
}

startBtn.onclick = async function() {
  var fullText = rawInput.value.trim();
  if (!fullText) { alert('لطفاً ابتدا متنی وارد کرده یا فایلی انتخاب کنید'); return; }

  startBtn.disabled = true;
  log('شروع پردازش هوشمند...', 'info');

  var chunks = chunkText(fullText, 6000);
  log('متن به ' + chunks.length + ' بخش تقسیم شد تا با دقت کامل در جمینای تحلیل شود.', 'info');

  var totalSaved = 0;

  for (var idx = 0; idx < chunks.length; idx++) {
    statusText.textContent = 'در حال تحلیل بخش ' + (idx + 1) + ' از ' + chunks.length + '...';
    log('ارسال بخش ' + (idx + 1) + ' به هوش مصنوعی...', 'info');

    try {
      var res = await fetch('/api/code-import?key=' + KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: chunks[idx] })
      });
      var data = await res.json();

      if (data.ok) {
        var added = data.count || 0;
        totalSaved += added;
        var modelInfo = data.usedModel ? ' [مدل: ' + data.usedModel + ']' : '';
        log('✅ بخش ' + (idx + 1) + ' موفق' + modelInfo + ': ' + added + ' پرامپت ذخیره شد (' + (data.slugs ? data.slugs.join(', ') : '') + ')', 'ok');
      } else {
        log('❌ خطا در بخش ' + (idx + 1) + ': ' + (data.error || 'ناشناخته'), 'err');
      }
    } catch (err) {
      log('❌ خطای ارتباطی: ' + err.message, 'err');
    }
  }

  statusText.textContent = 'پایان! مجموع کل: ' + totalSaved + ' پرامپت ثبت شد.';
  log('🎉 فرآیند تکمیل شد. تمام پرامپت‌ها در سایت منتشر شدند.', 'ok');
  startBtn.disabled = false;
};
</script>
</body>
</html>
