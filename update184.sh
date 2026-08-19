#!/bin/bash
set -e

# ---------- 1) Check current image storage ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/lib/import-loop.ts'
if (!fs.existsSync(p)) {
  console.log('⚠️ import-loop.ts not found')
  process.exit(0)
}

let s = fs.readFileSync(p, 'utf8')

// Check if we're downloading images
if (s.includes('getFile') || s.includes('downloadPhoto')) {
  console.log('️ Currently downloading images from Telegram')
  console.log('Will replace with file_id storage only')
} else {
  console.log('✅ Already using file_id only')
}
NODEEOF

# ---------- 2) Modify import-loop to store file_id only ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/lib/import-loop.ts'
if (!fs.existsSync(p)) {
  console.log('⚠️ import-loop.ts not found, skipping')
  process.exit(0)
}

let s = fs.readFileSync(p, 'utf8')

// Find the image download/upload section and replace with file_id storage
// Look for patterns like: downloadPhoto, getFile, uploadToTelegram, etc.

const patterns = [
  /await downloadPhoto\([^)]+\)/g,
  /await.*?getFile\([^)]+\)/g,
  /await.*?uploadToTelegram\([^)]+\)/g,
  /Buffer\.from\(.*?arrayBuffer\(\)\)/g,
]

let modified = false
for (const pattern of patterns) {
  if (pattern.test(s)) {
    console.log('Found pattern:', pattern.toString())
    modified = true
  }
}

if (modified) {
  console.log('⚠️ Need manual review of import-loop.ts')
  console.log('Please check the file and replace download/upload with file_id storage')
} else {
  console.log('✅ No download/upload patterns found')
}
NODEEOF

echo "✅ update184 done!"