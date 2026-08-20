#!/bin/bash
set -e

# ---------- 1) Create Image Proxy (if not exists) ----------
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
      return new NextResponse('Failed to fetch', { status: response.status })
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
    console.error('Proxy error:', error)
    return new NextResponse('Proxy error', { status: 500 })
  }
}
EOF
echo "✅ Image proxy created"

# ---------- 2) Update prompt display to use proxy ----------
# Find and update prompt card component
for file in src/components/prompt-card.tsx src/components/prompt-item.tsx src/app/prompts/\[slug\]/page.tsx; do
  if [ -f "$file" ]; then
    # Add helper function
    if ! grep -q "getImageUrl" "$file"; then
      sed -i '/^import/a\
\
const getImageUrl = (url: string | null) => {\
  if (!url) return "/placeholder.jpg";\
  if (url.includes("api.telegram.org")) {\
    return "/api/image-proxy?url=" + encodeURIComponent(url);\
  }\
  return url;\
};' "$file"
      
      # Replace prompt.img with getImageUrl(prompt.img)
      sed -i 's/src={prompt\.img}/src={getImageUrl(prompt.img)}/g' "$file"
      sed -i 's/content={prompt\.img}/content={getImageUrl(prompt.img)}/g' "$file"
      
      echo "✅ Updated $file"
    fi
  fi
done

echo ""
echo "===== AFTER DEPLOY ====="
echo ""
echo "Test the proxy directly:"
echo "  https://promptsfa.ir/api/image-proxy?url=https://api.telegram.org/file/bot8563185285:AAGnEJAVKReEH9KoFmYTpVYYNiU76CPwP7o/photos/file_2881.jpg"
echo ""
echo "If the proxy shows the image, your site will automatically use it."
echo "=================================="

echo "✅ update231 done!"