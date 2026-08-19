#!/bin/bash
set -e

echo "===== Finding import-related files ====="
find src -type f -name "*.ts" -o -name "*.tsx" | grep -i import | head -20
echo "========================================="

echo ""
echo "===== Checking API routes ====="
ls -la src/app/api/ | grep -i import
echo "================================="

echo ""
echo "===== Checking lib files ====="
ls -la src/lib/ | grep -i import
echo "==============================="