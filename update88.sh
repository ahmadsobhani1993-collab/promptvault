#!/bin/bash
set -e

# ---------- 1) gemini: correct model names + stop on exhaustion ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/lib/gemini.ts'
let s = fs.readFileSync(p, 'utf8')

// replace MODEL_CHAIN with working Gemini models (remove broken Gemma)
const oldChain = s.match(/export const MODEL_CHAIN = \[[\s\S]*?\]/)
if (oldChain) {
  const newChain = `export const MODEL_CHAIN = [
  'gemini-2.0-flash-exp',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite-001',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-3.1-pro-preview',
  'gemini-2.5-pro',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3-flash',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-3.5-flash-lite',
]`
  s = s.replace(oldChain[0], newChain)
  console.log('✅ model chain: Gemma removed, working Gemini models')
}

// make the exhaustion error distinctive (so import-loop can stop cleanly)
s = s.replace(
  "throw new Error('all models exhausted :: ' + lastError)",
  "throw new Error('GEMINI_QUOTA_EXHAUSTED :: ' + lastError)"
)

fs.writeFileSync(p, s)
NODEEOF

# ---------- 2) import-loop: stop when quota exhausted, don't advance cursor ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/import-loop/route.ts'
let s = fs.readFileSync(p, 'utf8')

// detect exhaustion and stop (do NOT advance cursor)
if (!s.includes('GEMINI_QUOTA_EXHAUSTED')) {
  const anchor = "    } catch (e: any) {\n      debug.push('  error: ' + String(e?.message ?? e))\n    }"
  const replacement = `    } catch (e: any) {
      const msg = String(e?.message ?? e)
      if (msg.includes('GEMINI_QUOTA_EXHAUSTED') || msg.includes('429')) {
        // stop the chain cleanly — cursor stays at the failed position
        await setSetting('import_cursor', String(cursor))
        return NextResponse.json({ ok: true, cursor, stop, results, chained: false, stopped: 'quota_exhausted', debug })
      }
      debug.push('  error: ' + msg)
    }`
  if (s.includes(anchor)) {
    s = s.replace(anchor, replacement)
    console.log('✅ import-loop: stops on quota exhaustion')
  } else {
    console.log('⚠️ anchor not found, trying alternate pattern')
    s = s.replace(
      /results\.push\(\{ id: cursor, error: String\(e\?\.message \?\? e\) \}\)/,
      "const em = String(e?.message ?? e); results.push({ id: cursor, error: em }); if (em.includes('GEMINI_QUOTA_EXHAUSTED') || em.includes('429')) { await setSetting('import_cursor', String(cursor)); return NextResponse.json({ ok: true, cursor, stop, results, chained: false, stopped: 'quota_exhausted', debug }) }"
    )
  }
  fs.writeFileSync(p, s)
} else console.log('⚠️ already has quota guard')
NODEEOF

echo "✅ update88 done!"