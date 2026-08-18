#!/bin/bash
set -e

echo "----- Article model from schema -----"
sed -n '/^model Article {/,/^}/p' prisma/schema.prisma
echo "--------------------------------------"

node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/cron/article/route.ts'
let s = fs.readFileSync(p, 'utf8')

const old = `  let article: any = null
  try {
    article = await prisma.article.create({
      data: {
        titleFa, titleEn: titleFa,
        descFa: metaDescFa, descEn: metaDescFa,
        contentFa, contentEn: contentFa,
        img: image.url,
        tagFa: keywordFa, tagEn: keywordFa,
        slug,
      },
    })
  } catch {
    article = await prisma.article.create({
      data: { titleFa, titleEn: titleFa, descFa: metaDescFa, descEn: metaDescFa, img: image.url, tagFa: keywordFa, tagEn: keywordFa, slug },
    }).catch(() => null)
  }

  if (!article) return NextResponse.json({ ok: false, error: 'article create failed' }, { status: 500 })`

const nw = `  let article: any = null
  let err1 = ''
  let err2 = ''
  try {
    article = await prisma.article.create({
      data: {
        titleFa, titleEn: titleFa,
        descFa: metaDescFa, descEn: metaDescFa,
        contentFa, contentEn: contentFa,
        img: image.url,
        tagFa: keywordFa, tagEn: keywordFa,
        slug,
      },
    })
  } catch (e1: any) {
    err1 = String(e1?.message ?? e1)
    try {
      article = await prisma.article.create({
        data: { titleFa, titleEn: titleFa, descFa: metaDescFa, descEn: metaDescFa, img: image.url, tagFa: keywordFa, tagEn: keywordFa, slug },
      })
    } catch (e2: any) { err2 = String(e2?.message ?? e2) }
  }

  if (!article) return NextResponse.json({ ok: false, error: 'article create failed', err1: err1.slice(0, 500), err2: err2.slice(0, 500) }, { status: 500 })`

if (s.includes(old)) { s = s.replace(old, nw); fs.writeFileSync(p, s); console.log('✅ article: detailed errors enabled') }
else console.log('❌ create block not found')
NODEEOF

echo "✅ update109 done!"