#!/bin/bash
set -e

echo "===== FIXING SYNTAX ERRORS PROPERLY ====="

# Create a shared utility file for getImageUrl
mkdir -p src/lib
cat > src/lib/image-utils.ts << 'EOF'
export const getImageUrl = (url: string | null | undefined) => {
  if (!url) return '/placeholder.jpg';
  if (url.includes('api.telegram.org')) {
    return '/api/image-proxy?url=' + encodeURIComponent(url);
  }
  return url;
};
EOF
echo "✅ Created shared utility file"

# Now update the files to import this utility instead of defining it inline
node << 'NODEEOF'
const fs = require('fs');

const filesToUpdate = [
  'src/app/prompts/[slug]/page.tsx',
  'src/components/prompt-card.tsx',
  'src/components/prompt-item.tsx'
];

for (const file of filesToUpdate) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // 1. Remove ANY existing getImageUrl definitions (the broken ones)
    content = content.replace(/const getImageUrl = \(url:.*?\n.*?return url;\n.*?\};?\n?/gs, '');
    content = content.replace(/if \(!url\) return.*?api\.telegram\.org.*?return url;.*?\};?\n?/gs, '');
    
    // 2. Add import for the utility at the top (after other imports)
    if (!content.includes("import { getImageUrl }")) {
      content = content.replace(
        /(import .*? from .*\n)+/m,
        (match) => match + "import { getImageUrl } from '@/lib/image-utils';\n"
      );
    }
    
    // 3. Replace direct img usage with the utility
    content = content.replace(/src=\{prompt\.img\}/g, 'src={getImageUrl(prompt.img)}');
    content = content.replace(/src=\{article\.img\}/g, 'src={getImageUrl(article.img)}');
    content = content.replace(/src=\{a\.img\}/g, 'src={getImageUrl(a.img)}');
    content = content.replace(/src={\(prompt\.img\)/g, 'src={getImageUrl(prompt.img)');
    
    fs.writeFileSync(file, content);
    console.log(`✅ Fixed: ${file}`);
  }
}
NODEEOF

echo ""
echo "===== NEXT STEPS ====="
echo "1. Commit and push:"
echo "   git add . && git commit -m 'fix image proxy with shared utility' && git push"
echo ""
echo "2. After deploy, test proxy:"
echo "   https://promptsfa.ir/api/image-proxy?url=https://api.telegram.org/file/bot8563185285:AAGnEJAVKReEH9KoFmYTpVYYNiU76CPwP7o/photos/file_2881.jpg"
echo "=================================="

echo "✅ update234 done!"