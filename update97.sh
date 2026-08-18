#!/bin/bash
set -e

node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/explore/page.tsx'
let s = fs.readFileSync(p, 'utf8')

// compute full tag list
if (!s.includes('const allTags')) {
  s = s.replace(
    'const top = Object.entries(freq)',
    'const allTags = Object.keys(freq)\n  const top = Object.entries(freq)'
  )
}

// pass correct props to TagFilter
s = s.replace(
  /<TagFilter tags=\{top\} selected=\{selectedTags\} \/>/,
  '<TagFilter all={allTags} top={top} selected={selectedTags} />'
)

fs.writeFileSync(p, s)
console.log('✅ TagFilter props fixed (all/top/selected)')
NODEEOF

echo "✅ update97 done!"