#!/bin/bash
set -e

# ---------- 1) Remove OpenAI check if not needed ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/debug/quota-check/route.ts'
let s = fs.readFileSync(p, 'utf8')

// Remove OpenAI check
s = s.replace(
  /const openaiKey = process\.env\.OPENAI_API_KEY\s*\n\s*const result: any = \{\s*gemini: \{ configured: \!\!geminiKey, keyLength: geminiKey\?\.length \|\| 0 \},\s*openai: \{ configured: \!\!openaiKey, keyLength: openaiKey\?\.length \|\| 0 \},/,
  `const result: any = {
    gemini: { configured: !!geminiKey, keyLength: geminiKey?.length || 0 },`
)

fs.writeFileSync(p, s)
console.log('✅ Removed OpenAI check from quota-check')
NODEEOF

# ---------- 2) Create simple import test API ----------
mkdir -p src/app/api/debug/test-import
cat > src/app/api/debug/test-import/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { prisma } from '@/lib/db'
import { analyzeWithGemini } from '@/lib/gemini'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    // Get one pending prompt to test
    const prompt = await prisma.prompt.findFirst({
      where: { status: 'PENDING' },
      include: { category: true },
    })

    if (!prompt) {
      return NextResponse.json({
        ok: true,
        message: 'No pending prompts to process',
        totalPublished: await prisma.prompt.count({ where: { status: 'PUBLISHED' } }),
      })
    }

    // Try to analyze it
    console.log(' Testing analysis for prompt:', prompt.id)
    
    const result = await analyzeWithGemini({
      text: prompt.text || '',
      imgBase64: null,
      imgMime: undefined,
      categories: await prisma.category.findMany({ select: { slug: true, fa: true, en: true } }),
    })

    // Update the prompt
    await prisma.prompt.update({
      where: { id: prompt.id },
      data: {
        titleFa: result.titleFa,
        titleEn: result.titleEn,
        descFa: result.descFa,
        descEn: result.descEn,
        prompt: result.promptEn,
        tagsFa: result.tagsFa,
        tagsEn: result.tagsEn,
        categoryId: (await prisma.category.findUnique({ where: { slug: result.categorySlug } }))?.id,
        status: 'PUBLISHED',
      },
    })

    return NextResponse.json({
      ok: true,
      message: 'Successfully processed one pending prompt',
      promptId: prompt.id,
      result,
    })
  } catch (err: any) {
    console.error('❌ Test import error:', err)
    
    if (err.message?.includes('429') || err.message?.includes('quota')) {
      return NextResponse.json({
        ok: false,
        error: 'quota_exhausted',
        message: 'Gemini API quota exhausted. Please wait or use a different API key.',
      }, { status: 429 })
    }
    
    return NextResponse.json({
      ok: false,
      error: err.message,
    }, { status: 500 })
  }
}
EOF
echo "✅ Test import API created"

# ---------- 3) Fix import-loop to handle no pending prompts ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/import-loop/route.ts'
if (!fs.existsSync(p)) {
  console.log('⚠️ import-loop not found')
  process.exit(0)
}

let s = fs.readFileSync(p, 'utf8')

// Add check for no pending prompts at the start
if (!s.includes('No pending prompts')) {
  s = s.replace(
    /const cursor = parseInt\(setting\?\.value \|\| '0', 10\)/,
    `const cursor = parseInt(setting?.value || '0', 10)
    
    // Check if there are any pending prompts
    const pendingCount = await prisma.prompt.count({ where: { status: 'PENDING' } })
    if (pendingCount === 0) {
      return NextResponse.json({
        ok: true,
        message: 'All prompts processed',
        totalPublished: await prisma.prompt.count({ where: { status: 'PUBLISHED' } }),
      })
    }`
  )
  
  fs.writeFileSync(p, s)
  console.log('✅ Import loop: added pending check')
} else {
  console.log('⚠️ Already has pending check')
}
NODEEOF

echo "✅ update164 done!"