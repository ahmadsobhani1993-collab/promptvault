#!/bin/bash
set -e

echo "===== بررسی مدل Save vs Bookmark ====="

# ---------- Check which model is actually used ----------
echo ""
echo "بررسی مدل‌ها در schema:"
echo ""
echo "=== Model Save ==="
grep -A 10 "model Save {" prisma/schema.prisma || echo "❌ Save model not found"

echo ""
echo "=== Model Bookmark ==="
grep -A 10 "model Bookmark {" prisma/schema.prisma || echo "❌ Bookmark model not found"

echo ""
echo "=== بررسی استفاده در کد ==="
grep -r "prisma.save" src/ | head -5
grep -r "prisma.bookmark" src/ | head -5

echo ""
echo "===== پایان بررسی ====="