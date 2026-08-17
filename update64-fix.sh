#!/bin/bash
set -e

node << 'NODEEOF'
const fs = require('fs')
const p = 'prisma/schema.prisma'
let s = fs.readFileSync(p, 'utf8')

const promptBlock = s.match(/model Prompt \{[\s\S]*?\n\}/)
if (promptBlock && !promptBlock[0].includes('image PromptImage?')) {
  s = s.replace(promptBlock[0], promptBlock[0].replace(/\n\}$/, '\n  image    PromptImage?\n}'))
  fs.writeFileSync(p, s)
  console.log('✅ schema: Prompt.image relation added')
} else console.log('⚠️ already has image relation')
NODEEOF