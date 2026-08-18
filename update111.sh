#!/bin/bash
set -e

node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/cron/article/route.ts'
let s = fs.readFileSync(p, 'utf8')

// find the data block and add the 4 missing required fields
const old = `  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date())
  const slug = String(a.slugEn || 'ai-education').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + date
  const titleFa = String(a.titleFa || 'آموزش هوش مصنوعی')
  const metaDescFa = String(a.metaDescFa || a.descFa || titleFa)
  const contentFa = String(a.contentFa || '')
  const keywordFa = String(a.keywordFa || 'هوش مصنوعی')`

const nw = `  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date())
  const dateFa = new Intl.DateTimeFormat('fa-IR-u-nu-latn', { timeZone: 'Asia/Tehran', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date())
  const dateEn = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tehran', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date())
  const slugBase = String(a.slugEn || 'ai-education').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const slug = slugBase + '-' + date + '-' + Math.random().toString(36).slice(2, 6)
  const titleFa = String(a.titleFa || 'آموزش هوش مصنوعی')
  const metaDescFa = String(a.metaDescFa || a.descFa || titleFa)
  const contentFa = String(a.contentFa || '')
  const keywordFa = String(a.keywordFa || 'هوش مصنوعی')
  const readTimeFa = '۵ دقیقه مطالعه'
  const readTimeEn = '5 min read'`

if (s.includes(old)) {
  s = s.replace(old, nw)
  console.log('✅ date/read fields added')
} else console.log('❌ anchor not found')

// update both create calls
s = s.replace(
  /img: image\.url,\s+tagFa: keywordFa, tagEn: keywordFa,\s+slug,\s+\}\,\s+\}\)/,
  "img: image.url,\n        tagFa: keywordFa, tagEn: keywordFa,\n        dateFa, dateEn,\n        readFa: readTimeFa, readEn: readTimeEn,\n        slug,\n      },\n    })"
)
s = s.replace(
  /img: image\.url, tagFa: keywordFa, tagEn: keywordFa, slug \}\)/,
  "img: image.url, tagFa: keywordFa, tagEn: keywordFa, dateFa, dateEn, readFa: readTimeFa, readEn: readTimeEn, slug })"
)

fs.writeFileSync(p, s)
console.log('✅ article create: all required fields included')
NODEEOF

echo "✅ update111 done!"