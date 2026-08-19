#!/bin/bash
set -e

# ---------- Fix: Add opposite relation fields to Prompt model ----------
node << 'NODEEOF'
const fs = require('fs')
const schemaPath = 'prisma/schema.prisma'
let schema = fs.readFileSync(schemaPath, 'utf8')

// Find the Prompt model
const promptModelMatch = schema.match(/model Prompt \{([\s\S]*?)\n\}/)
if (!promptModelMatch) {
  console.log('❌ Could not find Prompt model')
  process.exit(1)
}

const promptModelContent = promptModelMatch[1]

// Check if bookmarks relation exists
if (!promptModelContent.includes('bookmarks')) {
  // Add bookmarks relation before the closing brace
  const updatedPromptModel = promptModelContent + '\n  bookmarks Bookmark[]'
  schema = schema.replace(promptModelContent, updatedPromptModel)
  console.log('✅ Added bookmarks relation to Prompt model')
} else {
  console.log('⚠️ bookmarks relation already exists')
}

// Check if likes relation exists
if (!promptModelContent.includes('likes') && !promptModelContent.includes('Likes')) {
  const updatedPromptModel = schema.match(/model Prompt \{([\s\S]*?)\n\}/)[1] + '\n  likes Like[]'
  schema = schema.replace(schema.match(/model Prompt \{([\s\S]*?)\n\}/)[1], updatedPromptModel)
  console.log('✅ Added likes relation to Prompt model')
} else {
  console.log('⚠️ likes relation already exists')
}

fs.writeFileSync(schemaPath, schema)
console.log('✅ Schema updated')
NODEEOF

# ---------- Format and push ----------
echo "Running prisma format..."
npx prisma format

echo "Running prisma generate..."
npx prisma generate

echo "Running prisma db push..."
npx prisma db push

echo "✅ update142 done!"