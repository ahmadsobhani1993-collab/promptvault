#!/bin/bash
set -e

node << 'NODEEOF'
const fs = require('fs')
const p = 'prisma/schema.prisma'
let s = fs.readFileSync(p, 'utf8')

// Find the User model and add pushSubscriptions relation
if (!s.includes('pushSubscriptions PushSubscription[]')) {
  s = s.replace(
    /model User \{([\s\S]*?)\n\}/,
    (match, inner) => {
      if (inner.includes('pushSubscriptions')) return match
      return match.replace('\n}', '\n  pushSubscriptions PushSubscription[]\n}')
    }
  )
  fs.writeFileSync(p, s)
  console.log('✅ User model: pushSubscriptions relation added')
} else {
  console.log('⚠️ already has pushSubscriptions')
}
NODEEOF

echo "✅ Schema fixed!"
