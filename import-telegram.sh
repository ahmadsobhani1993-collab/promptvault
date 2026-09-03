#!/bin/bash
AUTH="Authorization: Bearer pv-cron-8x2m1q"
URL="https://promptsfa.ir/api/import/run"
COUNT=3
SLEEP=25
TARGET=500  # هر بار ۵۰۰ تا، دوباره اجرا کن برای بیشتر

echo "🚀 Importing up to $TARGET from Telegram..."
total=0
batch=0

while [ $total -lt $TARGET ]; do
  batch=$((batch + 1))
  result=$(curl -s --max-time 90 "$URL?count=$COUNT" -H "$AUTH")

  imported=$(echo "$result" | grep -o '"imported":[0-9]*' | head -1 | cut -d':' -f2)
  cursor=$(echo "$result" | grep -o '"nextCursor":[0-9]*' | head -1 | cut -d':' -f2)

  if [ -z "$imported" ]; then
    echo "❌ Batch $batch failed"
    break
  fi

  if [ "$imported" = "0" ]; then
    echo "✅ No more prompts. Total: $total"
    break
  fi

  total=$((total + imported))
  echo "Batch $batch | imported: $imported | cursor: $cursor | TOTAL: $total / $TARGET"

  sleep $SLEEP
done

echo "🏁 Finished. Total imported: $total"
