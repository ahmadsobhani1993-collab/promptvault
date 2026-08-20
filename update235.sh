#!/bin/bash
set -e

echo "===== APPLYING IMAGE PROXY TO ARTICLES ====="

node << 'NODEEOF'
const fs = require('fs');
const path = require('path');

// Find all article-related files
const articleFiles = [
  'src/components/article-card.tsx',
  'src/components/article-item.tsx',
  'src/app/articles/[slug]/page.tsx',
  'src/app/blog/[slug]/page.tsx',
  'src/components/blog-card.tsx',
  'src/components/post-card.tsx',
];

let updatedCount = 0;

for (const file of articleFiles) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;
    
    // 1. Add import if not exists
    if (!content.includes("import { getImageUrl }")) {
      content = content.replace(
        /(import .*? from .*\n)+/m,
        (match) => match + "import { getImageUrl } from '@/lib/image-utils';\n"
      );
      modified = true;
      console.log(`  Added import to: ${file}`);
    }
    
    // 2. Replace article img usage patterns
    const patterns = [
      { regex: /src=\{article\.img\}/g, replacement: 'src={getImageUrl(article.img)}' },
      { regex: /src=\{post\.img\}/g, replacement: 'src={getImageUrl(post.img)}' },
      { regex: /src=\{item\.img\}/g, replacement: 'src={getImageUrl(item.img)}' },
      { regex: /src={a\.img}/g, replacement: 'src={getImageUrl(a.img)}' },
      { regex: /content=\{article\.img\}/g, replacement: 'content={getImageUrl(article.img)}' },
      { regex: /content=\{post\.img\}/g, replacement: 'content={getImageUrl(post.img)}' },
    ];
    
    for (const pattern of patterns) {
      if (content.match(pattern.regex)) {
        content = content.replace(pattern.regex, pattern.replacement);
        modified = true;
        console.log(`  Updated img pattern in: ${file}`);
      }
    }
    
    if (modified) {
      fs.writeFileSync(file, content);
      updatedCount++;
    }
  }
}

console.log(`\n✅ Updated ${updatedCount} article file(s)`);
NODEEOF

echo ""
echo "===== AFTER DEPLOY ====="
echo "1. Commit and push:"
echo "   git add . && git commit -m 'apply image proxy to articles' && git push"
echo ""
echo "2. Test article images will now use the proxy"
echo "=================================="

echo "✅ update235 done!"