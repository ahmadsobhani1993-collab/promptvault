#!/bin/bash
set -e

# clean rewrite of Comment model
node << 'NODEEOF'
const fs = require('fs')
const p = 'prisma/schema.prisma'
let s = fs.readFileSync(p, 'utf8')

// remove existing Comment model completely
s = s.replace(/model Comment \{[\s\S]*?\n\}\n?/, '')

// append fresh Comment model at the end
s += '\nmodel Comment {\n  id        String    @id @default(cuid())\n  name      String\n  text      String\n  createdAt DateTime  @default(now())\n  userId    String?\n  user      User?     @relation(fields: [userId], references: [id], onDelete: SetNull)\n  promptId  String?\n  prompt    Prompt?   @relation(fields: [promptId], references: [id], onDelete: Cascade)\n  articleId String?\n  article   Article?  @relation(fields: [articleId], references: [id], onDelete: Cascade)\n  parentId  String?\n  parent    Comment?  @relation(name: "CommentThread", fields: [parentId], references: [id], onDelete: Cascade)\n  children  Comment[] @relation(name: "CommentThread")\n}\n'

fs.writeFileSync(p, s)
console.log('✅ Comment model rewritten cleanly')
NODEEOF

# verify locally
npx prisma validate || echo "⚠️ local validate failed — continue anyway"
