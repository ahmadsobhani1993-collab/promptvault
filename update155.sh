#!/bin/bash
set -e

echo "===== بررسی کامل مشکلات ====="

# ---------- 1) Check if Analytics component is mounted ----------
echo ""
echo "1. بررسی mount شدن Analytics در layout:"
grep -n "Analytics" src/app/layout.tsx || echo " Analytics not found in layout"

# ---------- 2) Check if track API exists ----------
echo ""
echo "2. بررسی وجود API track:"
if [ -f "src/app/api/track/route.ts" ]; then
  echo "✅ Track API exists"
  head -20 src/app/api/track/route.ts
else
  echo "❌ Track API not found"
fi

# ---------- 3) Check account page queries ----------
echo ""
echo "3. بررسی کوئری‌های صفحه حساب:"
grep -A 3 "DEBUG:" src/app/account/page.tsx || echo " No DEBUG logs found"

# ---------- 4) Check if Like/Bookmark buttons exist ----------
echo ""
echo "4. بررسی دکمه‌های لایک و بوک‌مارک در prompt-card:"
grep -n "like\|bookmark\|save" src/components/prompt-card.tsx | head -10 || echo "❌ No like/bookmark found"

echo ""
echo "===== پایان بررسی ====="