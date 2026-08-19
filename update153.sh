#!/bin/bash
set -e

echo "===== بررسی ساختار فعلی ====="

echo ""
echo "1. محتوای mobile-menu.tsx:"
cat src/components/mobile-menu.tsx

echo ""
echo "2. مدل‌های Like و Bookmark در schema:"
grep -A 10 "model Like {" prisma/schema.prisma
echo "---"
grep -A 10 "model Bookmark {" prisma/schema.prisma

echo ""
echo "3. کوئری‌های account page:"
grep -A 5 "prisma.like.findMany" src/app/account/page.tsx
echo "---"
grep -A 5 "prisma.bookmark.findMany" src/app/account/page.tsx

echo ""
echo "===== پایان بررسی ====="