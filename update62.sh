#!/bin/bash
set -e

# ---------- cron: use READ token for ingestion ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/cron/telegram/route.ts'
let s = fs.readFileSync(p, 'utf8')

s = s.replace(
  "const token = process.env.TELEGRAM_BOT_TOKEN\n  if (!token) return NextResponse.json({ error: 'no bot token' }, { status: 500 })",
  "const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN\n  if (!token) return NextResponse.json({ error: 'no bot token' }, { status: 500 })"
)

// fresh offset key for the new reader bot
s = s.replace("getSetting('tg_update_offset', '0')", "getSetting('tg_update_offset2', '0')")
s = s.replace("setSetting('tg_update_offset', String(offset))", "setSetting('tg_update_offset2', String(offset))")

fs.writeFileSync(p, s)
console.log('✅ cron: READ token separated')
NODEEOF

# ---------- debug: show webhook status ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/debug/tg-bot-test/route.ts'
let s = fs.readFileSync(p, 'utf8')

s = s.replace(
  "const token = process.env.TELEGRAM_BOT_TOKEN",
  "const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN"
)

s = s.replace(
  "  // 4) get latest updates (force include channel_post)",
  `  // webhook check (if set, getUpdates returns nothing!)
  let webhook: any = {}
  try { webhook = await (await fetch(api('getWebhookInfo'), { signal: AbortSignal.timeout(8000) })).json() } catch {}

  // 4) get latest updates (force include channel_post)`
)

s = s.replace(
  "    totalUpdates: (updates.result || []).length,",
  "    webhookUrl: webhook.result?.url || '(none — getUpdates works)',\n    totalUpdates: (updates.result || []).length,"
)

fs.writeFileSync(p, s)
console.log('✅ debug: webhook check added')
NODEEOF

echo "✅ update62 done!"