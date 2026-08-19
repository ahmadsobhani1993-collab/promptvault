#!/bin/bash
set -e

# ---------- 1) Add account link to mobile menu ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/layout/header.tsx'
let s = fs.readFileSync(p, 'utf8')

// Find mobileLinks array and add account link for logged-in users
if (s.includes('const mobileLinks = [')) {
  // Check if account link already exists
  if (!s.includes("href: '/account'")) {
    // Add account link after mobileLinks definition, before the return
    const accountLink = `
  if (session?.user) {
    mobileLinks.push({ href: '/account', label: L(locale, 'حساب', 'Account') })
  }
`
    
    // Find the closing bracket of mobileLinks and add after it
    s = s.replace(
      /(\]\n\n  return \()/,
      accountLink + '\n  $1'
    )
    
    fs.writeFileSync(p, s)
    console.log('✅ Account link added to mobile menu')
  } else {
    console.log('⚠️ Account link already exists in mobile menu')
  }
} else {
  console.log(' Could not find mobileLinks array')
}
NODEEOF

# ---------- 2) Verify schema has proper relations ----------
node << 'NODEEOF'
const fs = require('fs')
const schema = fs.readFileSync('prisma/schema.prisma', 'utf8')

// Check Prompt model for bookmarks and likes relations
const promptModel = schema.match(/model Prompt \{([\s\S]*?)\n\}/)
if (promptModel) {
  const content = promptModel[1]
  
  if (!content.includes('bookmarks')) {
    console.log('⚠️ Prompt model missing bookmarks relation')
  } else {
    console.log('✅ Prompt has bookmarks relation')
  }
  
  if (!content.includes('likes') && !content.includes('Likes')) {
    console.log('⚠️ Prompt model missing likes relation')
  } else {
    console.log('✅ Prompt has likes relation')
  }
} else {
  console.log(' Could not find Prompt model')
}

// Check User model for bookmarks and likes relations
const userModel = schema.match(/model User \{([\s\S]*?)\n\}/)
if (userModel) {
  const content = userModel[1]
  
  if (!content.includes('bookmarks')) {
    console.log('⚠️ User model missing bookmarks relation')
  } else {
    console.log('✅ User has bookmarks relation')
  }
  
  if (!content.includes('likes') && !content.includes('Likes')) {
    console.log('️ User model missing likes relation')
  } else {
    console.log('✅ User has likes relation')
  }
} else {
  console.log('❌ Could not find User model')
}
NODEEOF

# ---------- 3) Run prisma format and push ----------
echo "Formatting schema..."
npx prisma format

echo "Generating client..."
npx prisma generate

echo "Pushing to database..."
npx prisma db push

echo "✅ update143 done!"