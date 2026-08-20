#!/bin/bash
set -e

echo "===== CLEANING AND FIXING GETIMAGEURL ====="

node << 'NODEEOF'
const fs = require('fs');

const filesToFix = [
  'src/app/prompts/[slug]/page.tsx',
  'src/components/prompt-card.tsx',
  'src/components/prompt-item.tsx'
];

const helperFunc = `
const getImageUrl = (url: string | null | undefined) => {
  if (!url) return '/placeholder.jpg';
  if (url.includes('api.telegram.org')) {
    return '/api/image-proxy?url=' + encodeURIComponent(url);
  }
  return url;
};
`;

for (const file of filesToFix) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // 1. Remove ANY existing getImageUrl definitions (clean slate)
    content = content.replace(/const getImageUrl = \(url: string \| null.*?\n\};?\n?/gs, '');
    
    // 2. Find the last import statement to inject after it
    const importMatches = [...content.matchAll(/^import\s+.*?;$/gm)];
    if (importMatches.length > 0) {
      const lastImport = importMatches[importMatches.length - 1];
      const insertIndex = lastImport.index + lastImport[0].length;
      content = content.slice(0, insertIndex) + '\n' + helperFunc + content.slice(insertIndex);
    } else {
      content = helperFunc + '\n' + content;
    }

    // 3. Safely replace prompt.img or article.img in src attributes
    content = content.replace(/src=\{prompt\.img\}/g, 'src={getImageUrl(prompt.img)}');
    content = content.replace(/src=\{article\.img\}/g, 'src={getImageUrl(article.img)}');
    content = content.replace(/src=\{a\.img\}/g, 'src={getImageUrl(a.img)}');
    
    fs.writeFileSync(file, content);
    console.log(`✅ Cleaned and updated: ${file}`);
  }
}
NODEEOF

# Ensure the proxy route exists and is clean
mkdir -p src/app/api/image-proxy
cat > src/app/api/image-proxy/route.ts << 'EOF'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')

  if (!url || !url.includes('api.telegram.org')) {
    return new NextResponse('Invalid URL', { status: 400 })
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://web.telegram.org/',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      return new NextResponse('Failed to fetch image', { status: response.status })
    }

    const blob = await response.blob()
    const contentType = response.headers.get('content-type') || 'image/jpeg'

    return new NextResponse(blob, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Image proxy error:', error)
    return new NextResponse('Proxy error', { status: 500 })
  }
}
EOF
echo "✅ Image proxy route verified"

echo ""
echo "===== NEXT STEPS ====="
echo "1. Commit and push:"
echo "   git add . && git commit -m 'clean fix for image proxy and duplicate functions' && git push"
echo ""
echo "2. After deploy, test the proxy directly in browser:"
echo "   https://promptsfa.ir/api/image-proxy?url=https://api.telegram.org/file/bot8563185285:AAGnEJAVKReEH9KoFmYTpVYYNiU76CPwP7o/photos/file_2881.jpg"
echo "=================================="

echo "✅ update233 done!"