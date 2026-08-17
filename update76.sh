#!/bin/bash
set -e

# ---------- skip bot's own posts (no self-processing loop) ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/cron/telegram/route.ts'
let s = fs.readFileSync(p, 'utf8')
const old = "    const p = u.channel_post\n    if (p && String(p.chat.id) === chatId) posts.push(p)"
const nw = "    const p = u.channel_post\n    if (p && String(p.chat.id) === chatId && !p.from?.is_bot) posts.push(p)"
if (s.includes(old)) { s = s.replace(old, nw); fs.writeFileSync(p, s); console.log('✅ cron: skip bot posts') }
else if (s.includes('!p.from?.is_bot')) console.log('⚠️ already patched')
else console.log('❌ pattern not found')
NODEEOF

echo "✅ update76 done!"