#!/bin/bash
set -e

# ---------- 1) SEO-grade instruction ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/cron/article/route.ts'
let s = fs.readFileSync(p, 'utf8')

const newInstruction = `const INSTRUCTION =
  'تو یک متخصص سئو و نویسنده ارشد فارسی برای سایت آموزش هوش مصنوعی هستی. هدف: مقاله‌ای که برای کلمه کلیدی اصلی در گوگل رتبه بگیرد.\\n' +
  'مراحل دقیق:\\n' +
  '1) یک موضوع داغ آموزش هوش مصنوعی انتخاب کن و کلمه کلیدی اصلی (keywordFa) را مشخص کن.\\n' +
  '2) عنوان (titleFa): شامل کلمه کلیدی، زیر 60 کاراکتر، با عدد یا کلمه قدرتمند (راهنما، بهترین، آموزش کامل).\\n' +
  '3) توضیح متا (metaDescFa): زیر 155 کاراکتر، شامل کلمه کلیدی و دعوت به اقدام.\\n' +
  '4) پاراگراف اول: کلمه کلیدی حتماً در دو جمله اول، بدون حاشیه.\\n' +
  '5) بدنه: حداقل 900 کلمه؛ حداقل 4 زیرعنوان با ## که در 3 تای آن‌ها کلمه کلیدی یا هم‌معنی آن آمده باشد؛ لیست‌ها؛ بولد کردن عبارات مهم با **.\\n' +
  '6) یک بخش «## پرسش‌های متداول» با دقیقاً 4 پرسش و پاسخ کوتاه (برای featured snippet گوگل).\\n' +
  '7) دو لینک داخلی داخل متن به صورت مارک‌داون: [کاوش پرامپت‌های هوش مصنوعی](/explore) و [دسته‌بندی‌ها](/categories).\\n' +
  '8) نتیجه‌گیری با تکرار طبیعی کلمه کلیدی.\\n' +
  'فقط و فقط یک JSON معتبر برگردان (بدون markdown) با کلیدهای دقیق:\\n' +
  '{"keywordFa","keywordEn","keywordsFa":[6],"titleFa","titleEn","slugEn","metaDescFa","descFa","contentFa","imagePromptEn"}\\n' +
  '- slugEn: lowercase english hyphenated.\\n' +
  '- imagePromptEn: detailed english prompt for a futuristic cover image about the topic.'

s = s.replace(/const INSTRUCTION =[\s\S]*?\n\nasync function genImageFast/, newInstruction + '\n\nasync function genImageFast')
fs.writeFileSync(p, s)
console.log('✅ SEO instruction upgraded')
NODEEOF

# ---------- 2) blog post page: SEO metadata ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/blog/[slug]/page.tsx'
if (!fs.existsSync(p)) { console.log('⚠️ blog [slug] page not found'); process.exit(0) }
let s = fs.readFileSync(p, 'utf8')

if (s.includes('generateMetadata')) { console.log('⚠️ already has generateMetadata'); process.exit(0) }
if (!s.includes("@/lib/db")) { console.log('⚠️ no prisma import, skipping'); process.exit(0) }

const meta = `
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const a = await prisma.article.findUnique({ where: { slug } })
  if (!a) return { title: 'وبلاگ | PromptsFA' }
  return {
    title: a.titleFa + ' | وبلاگ PromptsFA',
    description: a.descFa,
    keywords: a.tagFa,
    openGraph: {
      title: a.titleFa,
      description: a.descFa,
      images: [a.img],
      type: 'article',
      locale: 'fa_IR',
    },
    twitter: { card: 'summary_large_image', title: a.titleFa, description: a.descFa },
  }
}
`

// inject right before the default export
s = s.replace(/export default (async )?function/, meta + '\nexport default $1function')
fs.writeFileSync(p, s)
console.log('✅ blog post: generateMetadata added')
NODEEOF

echo "✅ update114 done!"