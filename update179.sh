#!/bin/bash
set -e

# Fix account page: use 'id' instead of 'createdAt' for likes
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/account/page.tsx'
if (!fs.existsSync(p)) { 
  console.log('⚠️ account page not found')
  process.exit(0) 
}

let s = fs.readFileSync(p, 'utf8')

// Replace createdAt with id in likes orderBy
s = s.replace(
  /orderBy:\s*{\s*createdAt:\s*['"]desc['"]\s*}/g,
  'orderBy: { id: "desc" }'
)

fs.writeFileSync(p, s)
console.log('✅ Account page: fixed likes orderBy')
NODEEOF

echo "✅ update179 done!"