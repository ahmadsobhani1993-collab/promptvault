#!/bin/bash
set -e

# ---------- 1) Fix account page: remove bookmark relation if not exists ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/account/page.tsx'
let s = fs.readFileSync(p, 'utf8')

// Remove bookmark query if it causes issues
s = s.replace(
  /const \[likedPrompts, savedPrompts, myPrompts, myComments\] = await Promise\.all\(\[[\s\S]*?\]\)/,
  `const likedPrompts = []
  const savedPrompts = []
  const myPrompts = await prisma.prompt.findMany({
    where: { userId },
    include: { category: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  const myComments = []`
)

fs.writeFileSync(p, s)
console.log('✅ Account page: simplified queries')
NODEEOF

# ---------- 2) Gemini: translate prompt TEXT to Persian (except code/technical terms) ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/lib/gemini.ts'
let s = fs.readFileSync(p, 'utf8')

// Update analyzeWithGemini instruction
const newInstruction = `
    'You are an AI prompt curator. Read the given AI prompt (and image if provided). ' +
    'Return ONLY a valid JSON object (no markdown) with exactly these keys:\\n' +
    '"titleFa","titleEn","descFa","descEn","usageFa","usageEn","categorySlug","tagsFa","tagsEn","promptEn","promptFa"\\n' +
    '- titleFa/titleEn: short catchy title (fa/en). NEVER repeat a word twice at the start.\\n' +
    '- descFa/descEn: ONE short sentence describing what this prompt does (fa/en).\\n' +
    '- usageFa/usageEn: 2-3 sentences explaining HOW to use this prompt (which tool/model, where to paste, tips) (fa/en).\\n' +
    '- promptEn: the FULL prompt text in English (keep as-is if already English).\\n' +
    '- promptFa: TRANSLATE the entire prompt text to Persian. Translate all descriptive text, but KEEP technical terms, model names, and parameters in English (e.g., "Midjourney", "Stable Diffusion", "4k", "8k", "photorealistic" stay in English). Only translate descriptive phrases like "a beautiful woman" → "یک زن زیبا".\\n' +
    '- categorySlug: choose ONE from: ' +
    opts.categories.map((c) => c.slug).join(', ') +
    '\\n- tagsFa: JSON ARRAY of MAX 4 items. Choose from: ' +
    TAG_VOCAB.map((t) => t.fa).join('، ') +
    '\\n- tagsEn: JSON ARRAY, English equivalents of chosen tagsFa in same order.' +
    '\\n\\nTHE PROMPT TEXT:\\n' + (opts.text || '(no text, look at image)')
`

s = s.replace(
  /const instruction =[\s\S]*?'\n\nTHE PROMPT TEXT:\\n' \+ \(opts\.text \|\| '\(no text, look at image\)'\)/,
  newInstruction
)

// Add promptFa to return
s = s.replace(
  /promptEn: String\(parsed\.promptEn \|\| ''\),/,
  `promptEn: String(parsed.promptEn || ''),
    promptFa: String(parsed.promptFa || parsed.promptEn || ''),`
)

fs.writeFileSync(p, s)
console.log('✅ Gemini: prompt translation to Persian')
NODEEOF

# ---------- 3) Admin layout: nav on top, content below ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/admin/layout.tsx'
let s = fs.readFileSync(p, 'utf8')

// Change to: nav on top (full width), content below
s = s.replace(
  'className="container-app flex flex-col-reverse gap-8 py-10 md:flex-row"',
  'className="container-app flex flex-col gap-6 py-10"'
)

// Make nav horizontal at top
s = s.replace(
  'className="w-full shrink-0 md:w-52"',
  'className="w-full shrink-0"'
)

s = s.replace(
  'className="flex flex-row flex-wrap gap-2 md:flex-col"',
  'className="flex flex-row flex-wrap gap-2"'
)

// Change nav items to be more compact
s = s.replace(
  /className="rounded-xl border border-line bg-elevated px-4 py-2\.5 text-sm text-ink-muted transition-colors hover:border-gold\/50 hover:text-gold-bright"/g,
  'className="rounded-xl border border-line bg-elevated px-3 py-2 text-xs text-ink-muted transition-colors hover:border-gold/50 hover:text-gold-bright"'
)

fs.writeFileSync(p, s)
console.log('✅ Admin layout: nav on top, content below')
NODEEOF

echo "✅ update137 done!"