#!/bin/bash
set -e

# ---------- 1) qwen: retries + pollinations with referrer ----------
cat > src/lib/qwen.ts << 'EOF'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function qwenSingle(model: string, instruction: string, timeoutMs = 25000): Promise<string> {
  const key = process.env.TOKENROUTER_API_KEY
  if (!key) throw new Error('TOKENROUTER_API_KEY not set')

  const res = await fetch('https://api.tokenrouter.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: instruction }],
      temperature: 0.8,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error('qwen HTTP ' + res.status + ' :: ' + t.slice(0, 300))
  }
  const j = await res.json()
  const text: string = j?.choices?.[0]?.message?.content ?? ''
  if (!text) throw new Error('empty: ' + model)
  return text
}

async function pollinationsPost(instruction: string): Promise<string> {
  const res = await fetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Referrer: 'https://promptsfa.ir/' },
    body: JSON.stringify({
      model: 'openai',
      messages: [{ role: 'user', content: instruction }],
      temperature: 0.8,
      referrer: 'promptsfa.ir',
    }),
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error('pollinations HTTP ' + res.status)
  const j = await res.json()
  const text: string = j?.choices?.[0]?.message?.content ?? ''
  if (!text) throw new Error('pollinations empty')
  return text
}

export async function qwenGenerate(instruction: string): Promise<string> {
  // 1) free qwen with backoff retries
  if (process.env.TOKENROUTER_API_KEY) {
    for (let i = 0; i < 2; i++) {
      try { return await qwenSingle('qwen/qwen3.8-max-free', instruction, 20000) }
      catch { await sleep(2000 * (i + 1)) }
    }
  }
  // 2) pollinations
  return await pollinationsPost(instruction)
}
EOF
echo "✅ qwen.ts updated"

# ---------- 2) schedule: ensureDailyArticle (auto retry all day) ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/lib/schedule.ts'
let s = fs.readFileSync(p, 'utf8')

if (!s.includes('ensureDailyArticle')) {
  s += `
async function getSet(k: string, d: string) {
  return (await prisma.setting.findUnique({ where: { key: k } }))?.value ?? d
}
async function setSet(k: string, v: string) {
  await prisma.setting.upsert({ where: { key: k }, update: { value: v }, create: { key: k, value: v } })
}

// if no article today, try every 30 min (via the 5-min telegram cron)
export async function ensureDailyArticle(appUrl: string) {
  try {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date())
    const start = new Date(today + 'T00:00:00+03:30')
    const count = await prisma.article.count({ where: { createdAt: { gte: start } } })
    if (count > 0) return false
    const last = parseInt(await getSet('article_last_attempt', '0'), 10)
    if (Date.now() - last < 30 * 60000) return false
    await setSet('article_last_attempt', String(Date.now()))
    const key = process.env.CRON_SECRET ?? ''
    fetch(appUrl + '/api/cron/article?key=' + key + '&step=1', { signal: AbortSignal.timeout(8000) }).catch(() => {})
    return true
  } catch {
    return false
  }
}
`
  fs.writeFileSync(p, s)
  console.log('✅ schedule: ensureDailyArticle added')
} else console.log('⚠️ already')
NODEEOF

# ---------- 3) telegram cron: call ensureDailyArticle ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/cron/telegram/route.ts'
let s = fs.readFileSync(p, 'utf8')

if (!s.includes('ensureDailyArticle')) {
  s = s.replace(
    "import { sendDueTelegram, sendDueInstagram } from '@/lib/schedule'",
    "import { sendDueTelegram, sendDueInstagram, ensureDailyArticle } from '@/lib/schedule'"
  )
  s = s.replace(
    "const scheduledTg = await sendDueTelegram().catch(() => [])",
    "await ensureDailyArticle(APP()).catch(() => {})\n    const scheduledTg = await sendDueTelegram().catch(() => [])"
  )
  fs.writeFileSync(p, s)
  console.log('✅ telegram cron: auto article retry')
} else console.log('⚠️ already')
NODEEOF

echo "✅ update105 done!"