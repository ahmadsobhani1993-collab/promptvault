#!/bin/bash
AUTH="Authorization: Bearer pv-cron-8x2m1q"
URL="https://promptsfa.ir/api/import/run"
COUNT=3
SLEEP=20
TARGET=200

echo "🚀 Continuing import (batch=$COUNT, sleep=${SLEEP}s, target=$TARGET)..."
echo "================================"

total=0
batch=0
failed=0

while [ $total -lt $TARGET ]; do
  batch=$((batch + 1))
  result=$(curl -s --max-time 90 "$URL?count=$COUNT" -H "$AUTH")

  imported=$(echo "$result" | grep -o '"imported":[0-9]*' | head -1 | cut -d':' -f2)
  cursor=$(echo "$result" | grep -o '"nextCursor":[0-9]*' | head -1 | cut -d':' -f2)

  if [ -z "$imported" ]; then
    echo "❌ Batch $batch: TIMEOUT or ERROR"
    failed=$((failed + 1))
    if [ $failed -gt 5 ]; then
      echo "🛑 Too many failures, stopping. Total so far: $total"
      break
    fi
    sleep 30
    continue
  fi

  failed=0

  if [ "$imported" = "0" ]; then
    echo "✅ No more prompts available. Total: $total"
    break
  fi

  total=$((total + imported))
  echo "Batch $batch | imported: $imported | cursor: $cursor | TOTAL: $total / $TARGET"

  sleep $SLEEP
done

echo "================================"
echo "🏁 Finished. Total imported: $total"
