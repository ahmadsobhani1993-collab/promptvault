#!/bin/bash
AUTH="Authorization: Bearer pv-cron-8x2m1q"
URL="https://promptsfa.ir/api/import/run"
TARGET=${1:-50}
COUNT=2

echo "🚀 Telegram import: target=$TARGET (batch=$COUNT)..."
echo "================================"

# اول وضعیت فعلی را نشان بده
status=$(curl -s "https://promptsfa.ir/api/debug/status" -H "$AUTH")
echo "Before: $status" | head -c 300
echo ""
echo "================================"

total=0
batch=0

while [ $total -lt $TARGET ]; do
  batch=$((batch + 1))
  result=$(curl -s --max-time 60 "$URL?count=$COUNT" -H "$AUTH")

  imported=$(echo "$result" | grep -o '"imported":[0-9]*' | head -1 | cut -d':' -f2)
  cursor=$(echo "$result" | grep -o '"nextCursor":[0-9]*' | head -1 | cut -d':' -f2)

  if [ -z "$imported" ]; then
    echo "❌ Batch $batch failed: $(echo "$result" | head -c 200)"
    break
  fi

  if [ "$imported" = "0" ]; then
    echo "✅ No more prompts in channel. Total imported: $total"
    break
  fi

  total=$((total + imported))
  echo "Batch $batch | +$imported | cursor=$cursor | TOTAL=$total/$TARGET"
  sleep 20
done

echo "================================"
echo "🏁 Done. Imported this session: $total"
echo "Final status:"
curl -s "https://promptsfa.ir/api/debug/status" -H "$AUTH" | python3 -m json.tool 2>/dev/null || curl -s "https://promptsfa.ir/api/debug/status" -H "$AUTH"
