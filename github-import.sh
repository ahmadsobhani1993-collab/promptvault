#!/bin/bash
AUTH="Authorization: Bearer pv-cron-8x2m1q"
URL="https://promptsfa.ir/api/import/github"
TARGET=100
COUNT=3

echo "🚀 Importing up to $TARGET from GitHub (batch=$COUNT)..."
total=0

while [ $total -lt $TARGET ]; do
  result=$(curl -s --max-time 90 "$URL?count=$COUNT" -H "$AUTH")
  imported=$(echo "$result" | grep -o '"imported":[0-9]*' | head -1 | cut -d':' -f2)
  remaining=$(echo "$result" | grep -o '"remaining":[0-9]*' | head -1 | cut -d':' -f2)
  
  if [ -z "$imported" ]; then
    echo "❌ Error: $result"
    break
  fi
  
  if [ "$imported" = "0" ]; then
    echo "✅ Done. Total: $total"
    break
  fi
  
  total=$((total + imported))
  echo "imported=$imported | remaining=$remaining | TOTAL=$total/$TARGET"
  sleep 25
done
